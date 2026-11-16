import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { CHAT_MAX_LENGTH, type Chat, type PendingMessage } from '../../hooks/useChat';
import { formatChatTime } from '../../lib/time';
import type { ChatMessage } from '../../types/search';
import Avatar from '../Avatar';
import './Chat.css';

// 11 그룹 홈의 대화 (CHAT-01·02, UI v0.4 §6). 목록과 입력창을 따로 내보낸다 — 11 왼쪽 패널에서 둘 사이에
// "함께 정한 조건"·추천 위치·[대화 분석하기]가 들어간다. 상태는 hooks/useChat이 들고 있다.

// 맨 아래에서 이만큼 안을 보고 있으면 새 메시지가 올 때 따라 내려간다.
const STICK_THRESHOLD_PX = 80;
// 맨 위에서 이만큼 안으로 올라오면 이전 기록을 불러온다.
const LOAD_OLDER_THRESHOLD_PX = 60;

export function ChatMessageList({ chat, meId }: { chat: Chat; meId: number | null }) {
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  // 이전 기록을 위에 붙이기 직전의 스크롤 — 붙인 뒤에도 보던 메시지가 그 자리에 있게 한다.
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const pendingCount = useRef(0);

  const firstId = chat.messages[0]?.messageId ?? null;
  const lastKey = chat.pending.at(-1)?.clientMessageId ?? chat.messages.at(-1)?.messageId ?? null;

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // 내가 새로 보낸 메시지는 어디를 보고 있었든 보이게 내려간다.
    if (chat.pending.length > pendingCount.current) stickToBottom.current = true;
    pendingCount.current = chat.pending.length;
    if (anchor.current) {
      if (chat.loadingOlder) return;
      list.scrollTop = list.scrollHeight - anchor.current.height + anchor.current.top;
      anchor.current = null;
      return;
    }
    if (stickToBottom.current) list.scrollTop = list.scrollHeight;
  }, [firstId, lastKey, chat.status, chat.loadingOlder, chat.pending.length]);

  // 아래 칸(조건·추천 위치)이 커져 목록 높이가 줄어도, 맨 아래를 보고 있었으면 맨 아래에 둔다.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) list.scrollTop = list.scrollHeight;
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  const handleScroll = () => {
    const list = listRef.current;
    if (!list) return;
    stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < STICK_THRESHOLD_PX;
    if (list.scrollTop < LOAD_OLDER_THRESHOLD_PX && chat.hasOlder && !chat.loadingOlder) {
      anchor.current = { height: list.scrollHeight, top: list.scrollTop };
      chat.loadOlder();
    }
  };

  const isMine = (message: ChatMessage) => meId !== null && message.sender?.userId === meId;

  return (
    <div className="chat-messages" ref={listRef} onScroll={handleScroll} role="log" aria-label="대화">
      {chat.loadingOlder && <p className="chat-messages__hint">이전 대화를 불러오는 중...</p>}
      {chat.status === 'loading' && <p className="chat-messages__hint">불러오는 중...</p>}
      {chat.status === 'error' && (
        <div className="chat-messages__status">
          <p className="chat-messages__error">{chat.error}</p>
          <button type="button" className="button button--secondary" onClick={chat.reload}>
            다시 불러오기
          </button>
        </div>
      )}
      {chat.status === 'ready' && chat.messages.length === 0 && chat.pending.length === 0 && (
        <p className="chat-messages__hint">아직 대화가 없어요. 원하는 동네와 조건을 이야기해 보세요.</p>
      )}
      <ol className="chat-messages__list">
        {chat.messages.map((message, i) => {
          const previous = chat.messages[i - 1];
          // 다른 멤버의 메시지는 보낸 사람이 바뀔 때만 이름을 붙인다.
          const showSender =
            !isMine(message) &&
            message.sender !== null &&
            (previous === undefined || previous.sender?.userId !== message.sender.userId);
          return (
            <MessageItem
              key={message.messageId}
              message={message}
              mine={isMine(message)}
              showSender={showSender}
            />
          );
        })}
        {chat.pending.map((item) => (
          <PendingItem key={item.clientMessageId} item={item} onRetry={chat.retry} onDiscard={chat.discard} />
        ))}
      </ol>
    </div>
  );
}

function MessageItem({
  message,
  mine,
  showSender,
}: {
  message: ChatMessage;
  mine: boolean;
  showSender: boolean;
}) {
  return (
    <li className={`chat-message${mine ? ' chat-message--mine' : ''}`}>
      {showSender && message.sender && (
        <div className="chat-message__sender">
          <Avatar nickname={message.sender.nickname} profileImageUrl={message.sender.profileImageUrl} />
          <span className="chat-message__nickname">{message.sender.nickname}</span>
        </div>
      )}
      <div className="chat-message__row">
        {/* 작성자가 탈퇴하면 서버가 작성자와 내용을 지우고 deleted로 준다 (AUTH-06) */}
        <p className={`chat-message__bubble${message.deleted ? ' is-deleted' : ''}`}>
          {message.deleted ? '탈퇴한 사용자의 메시지입니다' : message.content}
        </p>
        <time className="chat-message__meta" dateTime={message.createdAt}>
          {formatChatTime(message.createdAt)}
        </time>
      </div>
    </li>
  );
}

function PendingItem({
  item,
  onRetry,
  onDiscard,
}: {
  item: PendingMessage;
  onRetry: (item: PendingMessage) => void;
  onDiscard: (clientMessageId: string) => void;
}) {
  return (
    <li className="chat-message chat-message--mine">
      <div className="chat-message__row">
        <p className="chat-message__bubble is-pending">{item.content}</p>
        {item.status === 'sending' && <span className="chat-message__meta">보내는 중…</span>}
      </div>
      {item.status === 'failed' && (
        <p className="chat-message__failed" role="alert">
          <span>{item.error ?? '메시지를 보내지 못했어요.'}</span>
          <button type="button" onClick={() => onRetry(item)}>
            다시 보내기
          </button>
          <button type="button" onClick={() => onDiscard(item.clientMessageId)}>
            삭제
          </button>
        </p>
      )}
    </li>
  );
}

export function ChatComposer({ onSend }: { onSend: (content: string) => boolean }) {
  const [text, setText] = useState('');

  const submit = () => {
    if (onSend(text)) setText('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  // Enter는 보내기, Shift+Enter는 줄바꿈. 한글 조합 중의 Enter(조합 확정)로는 보내지 않는다.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    submit();
  };

  return (
    <form className="chat-composer" onSubmit={handleSubmit}>
      <textarea
        className="chat-composer__input"
        rows={1}
        value={text}
        maxLength={CHAT_MAX_LENGTH}
        placeholder="메시지를 입력하세요"
        aria-label="메시지 입력"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button type="submit" className="chat-composer__send" disabled={!text.trim()} aria-label="보내기">
        <SendIcon />
      </button>
    </form>
  );
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}
