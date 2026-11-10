import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../app/providers/useAuth';
import { useWorkspace } from '../../app/providers/useWorkspace';
import { useWorkspaceMessages, useWorkspaceReconnect, useWorkspaceSocket } from '../../app/providers/useWorkspaceSocket';
import { getMessages, mergeMessages } from '../../lib/chatApi';
import { parseInstant } from '../../lib/time';
import type { ChatMessage } from '../../types/search';
import { useResource } from '../../hooks/useResource';
import { useTask } from '../../hooks/useTask';
import { ErrorNotice } from '../FeatureUI';

type PendingMessage = { clientMessageId: string; content: string; failed: boolean };

export default function Chat() {
  const { workspace } = useWorkspace();
  const { me } = useAuth();
  const { send, connected } = useWorkspaceSocket();
  const history = useResource(useCallback(() => getMessages(workspace.id), [workspace.id]));
  const task = useTask();
  const [extra, setExtra] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<PendingMessage | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const messages = useMemo(() => mergeMessages(history.data?.items ?? [], extra), [history.data, extra]);
  const lastId = messages.at(-1)?.messageId;

  const receive = (items: ChatMessage[]) => {
    setExtra((current) => mergeMessages(current, items));
    setPending((current) => current && items.some((item) => item.clientMessageId === current.clientMessageId && item.sender?.userId === me?.id) ? null : current);
  };
  useWorkspaceMessages((message) => {
    if (message.type === 'CHAT_MESSAGE') receive([message.data as ChatMessage]);
    if (message.type === 'ERROR') {
      const error = message.data as { requestId: string | null; message: string };
      if (error.requestId && error.requestId === pending?.clientMessageId) {
        task.setError(error.message);
        setPending((current) => current && { ...current, failed: true });
      }
    }
  });
  useWorkspaceReconnect(() => {
    void task.run(async () => {
      let after = lastId?.toString();
      do {
        const page = await getMessages(workspace.id, after ? { after } : {});
        receive(page.items);
        // 최초 최신 페이지의 nextCursor는 이전 기록(before)을 가리킨다.
        if (!after || !page.hasNext || !page.nextCursor) break;
        after = page.nextCursor;
      } while (after);
    });
  });
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [lastId]);
  useEffect(() => {
    if (!pending || pending.failed) return;
    const timer = setTimeout(() => {
      setPending((current) => current && { ...current, failed: true });
    }, 10000);
    return () => clearTimeout(timer);
  }, [pending]);

  const transmit = (message: PendingMessage) => {
    task.setError(null);
    const sent = send({ type: 'CHAT_SEND', data: { clientMessageId: message.clientMessageId, content: message.content } });
    setPending({ ...message, failed: !sent });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending || !draft.trim() || draft.length > 1000 || !connected) return;
    transmit({ clientMessageId: crypto.randomUUID(), content: draft.trim(), failed: false });
    setDraft('');
  };
  return <section className="feature-card"><h2>우리의 집 찾기 대화</h2>
    <p className="feature-muted">지역, 예산, 출퇴근 목적지와 원하는 집 조건을 함께 이야기해요.</p>
    <ErrorNotice message={history.error} retry={() => { void history.reload(); }} />
    <ErrorNotice message={task.error} />
    {history.data?.hasNext && <button className="button button--secondary" disabled={task.busy} onClick={() => void task.run(async () => {
      const page = await getMessages(workspace.id, { before: history.data!.nextCursor! });
      history.setData((current) => ({ ...page, items: mergeMessages(page.items, current?.items ?? []) }));
    })}>이전 대화 불러오기</button>}
    <ol className="feature-list chat-log" aria-label="대화 기록" aria-live="polite">
      {messages.map((message) => <li key={message.messageId}>
        <div className="chat-meta"><strong>{message.sender?.nickname ?? '탈퇴한 사용자'}{message.sender?.userId === me?.id ? ' · 나' : ''}</strong>
          <time dateTime={message.createdAt}>{new Date(parseInstant(message.createdAt)).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</time></div>
        <p className="chat-message">{message.deleted ? '탈퇴한 사용자의 메시지입니다.' : message.content}</p>
      </li>)}
    </ol><div ref={end} />
    {!history.loading && messages.length === 0 && <p className="feature-muted">첫 대화를 남겨주세요.</p>}
    {pending && <div className="feature-success"><p className="chat-message">{pending.content}</p><p>{pending.failed ? '전송을 확인하지 못했어요. 같은 메시지로 다시 시도할 수 있어요.' : '전송 확인 중...'}</p>
      {pending.failed && <button className="button button--secondary" disabled={!connected} onClick={() => transmit(pending)}>메시지 재전송</button>}</div>}
    <form className="feature-form" onSubmit={submit}><label>메시지<textarea value={draft} maxLength={1000} onChange={(event) => setDraft(event.target.value)} /></label>
      <div className="feature-actions"><span className="feature-muted">{draft.length}/1000 · {connected ? '연결됨' : '다시 연결하는 중'}</span>
        <button className="button button--primary" disabled={!connected || !draft.trim() || Boolean(pending)}>보내기</button></div></form>
  </section>;
}
