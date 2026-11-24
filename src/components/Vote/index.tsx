import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../app/providers/useAuth';
import { useWorkspace } from '../../app/providers/useWorkspace';
import { badgeLetter } from '../../pages/candidates/format';
import LoadState from '../LoadState';
import { useVotes } from './useVotes';
import './Vote.css';

// 17 / 후보지 투표 — Figma v0.4.2의 08-A 모달. 저장은 선택 즉시, 완료는 닫기만 한다.
export default function VoteModal({ onClose }: { onClose: () => void }) {
  const { workspace } = useWorkspace();
  const { me } = useAuth();
  const { results, pending, error, reload, vote } = useVotes(workspace.id, me?.id ?? null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const panel = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel?.showModal();
    return () => {
      panel?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialog}
      className="vote-modal"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <div className="vote-modal__heading">
        <h2 id={titleId}>후보지 투표</h2>
        <button type="button" className="button button--secondary vote-modal__close" aria-label="투표 팝업 닫기" onClick={onClose}>×</button>
      </div>
      <p id={descriptionId} className="vote-modal__description">후보지마다 찬성 또는 반대를 선택하세요. 선택은 바꿀 수 있어요.</p>
      <div className="vote-modal__body" aria-busy={results === null && !error}>
        {error && <LoadState status="error" onRetry={() => void reload()} />}
        {!error && results === null && <LoadState status="loading" />}
        {results?.length === 0 && <p className="vote-modal__empty">아직 추가된 후보지가 없어요.</p>}
        {results && results.length > 0 && (
          <ul className="vote-modal__list">
            {results.map((result, index) => (
              <li key={result.candidateId} className="vote-modal__candidate">
                <div className="vote-modal__candidate-heading">
                  <span className="vote-modal__badge">{badgeLetter(index)}</span>
                  <h3>{result.candidateName}</h3>
                  {result.split && <span className="vote-modal__split">의견이 갈림</span>}
                </div>
                <div className="vote-modal__result">
                  <p>찬성 {result.agreeCount} · 반대 {result.disagreeCount} · 미투표 {Math.max(0, workspace.memberCount - result.agreeCount - result.disagreeCount)}</p>
                  <div className="vote-modal__choices" role="group" aria-label={`${result.candidateName} 내 투표`} aria-busy={pending.has(result.candidateId)}>
                    {(['AGREE', 'DISAGREE'] as const).map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        className={`button button--secondary vote-modal__choice${result.myChoice === choice ? ' is-selected' : ''}`}
                        aria-pressed={result.myChoice === choice}
                        disabled={pending.has(result.candidateId) || !me || error}
                        onClick={() => void vote(result.candidateId, choice)}
                      >
                        {choice === 'AGREE' ? '찬성' : '반대'}
                      </button>
                    ))}
                  </div>
                </div>
                {result.votes.length > 0 && (
                  <ul className="vote-modal__members" aria-label={`${result.candidateName} 멤버별 선택`}>
                    {result.votes.map((voter) => (
                      <li key={voter.userId}>{voter.nickname}{voter.userId === me?.id ? '(나)' : ''} · {voter.choice === 'AGREE' ? '찬성' : '반대'}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="vote-modal__hint">멤버 {workspace.memberCount}명 · 선택한 버튼이 연한 초록색으로 표시돼요.</p>
      <div className="vote-modal__actions">
        <button type="button" className="button button--primary vote-modal__done" onClick={onClose}>완료</button>
      </div>
    </dialog>,
    document.body,
  );
}
