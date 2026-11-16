import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useWorkspaceMessages,
  useWorkspaceReconnect,
  useWorkspaceSocket,
} from '../app/providers/useWorkspaceSocket';
import { getErrorMessage } from '../lib/authApi';
import { getMessages, mergeMessages } from '../lib/chatApi';
import type { ChatMessage } from '../types/search';

// Backend ChatMessage.CONTENT_MAX_LENGTH
export const CHAT_MAX_LENGTH = 1000;
// 보낸 뒤 이 시간 안에 서버가 같은 메시지(CHAT_MESSAGE)를 돌려주지 않으면 실패로 보여준다.
const SEND_TIMEOUT_MS = 10000;

// 내가 보냈지만 아직 서버 확인(CHAT_MESSAGE)을 못 받은 메시지
export interface PendingMessage {
  clientMessageId: string;
  content: string;
  status: 'sending' | 'failed';
  error: string | null;
}

export interface Chat {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  // 서버에 저장된 메시지 (messageId 오름차순)
  messages: ChatMessage[];
  pending: PendingMessage[];
  hasOlder: boolean;
  loadingOlder: boolean;
  loadOlder: () => void;
  reload: () => void;
  // 보낼 수 없는 내용(빈 칸·1000자 초과)이면 false
  send: (content: string) => boolean;
  retry: (item: PendingMessage) => void;
  discard: (clientMessageId: string) => void;
}

// 다시 보낼 때도 같은 ID를 써서 서버가 한 번만 저장하게 한다.
// randomUUID는 HTTPS(또는 localhost)에서만 있어서, 없으면 getRandomValues로 만든다.
function newClientMessageId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

// CHAT-01·02 그룹 대화. 기록은 HTTP로 불러오고, 보내기·받기는 그룹 연결(Workspace 소켓)을 쓴다.
// - 처음엔 최신 50개, 위로 올리면 그 이전 50개씩(before 커서) 불러온다.
// - 다시 연결되면 마지막 메시지 뒤로 놓친 것을 받고(after 커서), 확인 못 받은 메시지는 같은 ID로 다시 보낸다.
export function useChat(workspaceId: number, meId: number | null): Chat {
  const { send: sendMessage } = useWorkspaceSocket();
  const [status, setStatus] = useState<Chat['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    let cancelled = false;
    getMessages(workspaceId)
      .then((page) => {
        if (cancelled) return;
        // 불러오는 사이에 실시간으로 받은 메시지가 있을 수 있어 합친다.
        setMessages((current) => mergeMessages(current, page.items));
        setOlderCursor(page.hasNext ? page.nextCursor : null);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(getErrorMessage(err, '대화를 불러오지 못했어요.'));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, loadAttempt]);

  useEffect(() => {
    const sendTimers = timers.current;
    return () => {
      sendTimers.forEach((timer) => clearTimeout(timer));
      sendTimers.clear();
    };
  }, []);

  const settle = useCallback((clientMessageId: string) => {
    clearTimeout(timers.current.get(clientMessageId));
    timers.current.delete(clientMessageId);
  }, []);

  const fail = useCallback(
    (clientMessageId: string, reason: string) => {
      settle(clientMessageId);
      setPending((list) =>
        list.map(
          (item): PendingMessage =>
            item.clientMessageId === clientMessageId ? { ...item, status: 'failed', error: reason } : item,
        ),
      );
    },
    [settle],
  );

  // 연결이 끊겨 있어 못 보냈으면 다시 붙을 때 보낸다. 그래도 10초 안에 확인이 없으면 실패로 둔다.
  const transmit = useCallback(
    (clientMessageId: string, content: string) => {
      settle(clientMessageId);
      sendMessage({ type: 'CHAT_SEND', data: { clientMessageId, content } });
      timers.current.set(
        clientMessageId,
        setTimeout(() => fail(clientMessageId, '메시지를 보내지 못했어요.'), SEND_TIMEOUT_MS),
      );
    },
    [sendMessage, settle, fail],
  );

  const send = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content || content.length > CHAT_MAX_LENGTH) return false;
      const clientMessageId = newClientMessageId();
      setPending((list) => [...list, { clientMessageId, content, status: 'sending', error: null }]);
      transmit(clientMessageId, content);
      return true;
    },
    [transmit],
  );

  const retry = useCallback(
    (item: PendingMessage) => {
      setPending((list) =>
        list.map(
          (p): PendingMessage =>
            p.clientMessageId === item.clientMessageId ? { ...p, status: 'sending', error: null } : p,
        ),
      );
      transmit(item.clientMessageId, item.content);
    },
    [transmit],
  );

  const discard = useCallback(
    (clientMessageId: string) => {
      settle(clientMessageId);
      setPending((list) => list.filter((item) => item.clientMessageId !== clientMessageId));
    },
    [settle],
  );

  const reload = useCallback(() => {
    setStatus('loading');
    setError(null);
    setLoadAttempt((n) => n + 1);
  }, []);

  const loadOlder = useCallback(() => {
    if (!olderCursor || loadingOlder) return;
    setLoadingOlder(true);
    getMessages(workspaceId, { before: olderCursor })
      .then((page) => {
        setMessages((list) => mergeMessages(list, page.items));
        setOlderCursor(page.hasNext ? page.nextCursor : null);
      })
      .catch(() => {
        // 다시 위로 올리면 또 불러온다.
      })
      .finally(() => setLoadingOlder(false));
  }, [workspaceId, olderCursor, loadingOlder]);

  // 서버가 저장한 내 메시지가 오면 보내는 중이던 것을 지운다.
  const confirm = (items: ChatMessage[]) => {
    const mine = items.filter((m) => meId !== null && m.sender?.userId === meId).map((m) => m.clientMessageId);
    if (mine.length === 0) return;
    mine.forEach(settle);
    setPending((list) => list.filter((item) => !mine.includes(item.clientMessageId)));
  };

  useWorkspaceMessages((message) => {
    if (message.type === 'CHAT_MESSAGE') {
      const data = message.data as ChatMessage;
      setMessages((list) => mergeMessages(list, [data]));
      confirm([data]);
    } else if (message.type === 'ERROR') {
      // 거절된 요청은 보낸 연결에만 { code, message, requestId(= clientMessageId) }로 온다.
      const { requestId, message: reason } = message.data as { requestId?: string; message?: string };
      if (requestId) fail(requestId, reason ?? '메시지를 보내지 못했어요.');
    }
  });

  // 끊긴 동안 놓친 메시지를 마지막 메시지 뒤로 이어 받는다.
  const fetchMissed = async (afterId: number) => {
    let cursor: string | null = String(afterId);
    while (cursor) {
      const page = await getMessages(workspaceId, { after: cursor });
      setMessages((list) => mergeMessages(list, page.items));
      confirm(page.items);
      cursor = page.hasNext ? page.nextCursor : null;
    }
  };

  useWorkspaceReconnect(() => {
    if (status === 'error') {
      reload();
    } else if (status === 'ready') {
      const last = messages.at(-1);
      // 대화가 없었으면 처음처럼 최신 기록을 받는다. 실패하면 다음 재연결 때 다시 맞춘다.
      const missed = last
        ? fetchMissed(last.messageId)
        : getMessages(workspaceId).then((page) => {
            setMessages((list) => mergeMessages(list, page.items));
            setOlderCursor(page.hasNext ? page.nextCursor : null);
            confirm(page.items);
          });
      missed.catch(() => {});
    }
    // 서버가 이미 저장한 메시지면 새로 저장하지 않고 그 메시지를 다시 돌려준다.
    pending
      .filter((item) => item.status === 'sending')
      .forEach((item) => transmit(item.clientMessageId, item.content));
  });

  return {
    status,
    error,
    messages,
    pending,
    hasOlder: olderCursor !== null,
    loadingOlder,
    loadOlder,
    reload,
    send,
    retry,
    discard,
  };
}
