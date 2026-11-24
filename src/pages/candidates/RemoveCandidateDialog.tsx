import Dialog from '../../components/Dialog';
import type { Candidate } from '../../types';
import './RemoveCandidateDialog.css';

// CAND-03 후보지 삭제 확인창. 후보지 상세와 그룹 홈(후보지 탭 카드 · 지도 위 저장한 후보지)에서 같이 쓴다.
// 요청은 연 쪽에서 한다(상세는 목록으로 이동, 그룹 홈은 목록에서 바로 뺀다).
export default function RemoveCandidateDialog({
  candidate,
  letter,
  busy,
  onConfirm,
  onClose,
}: {
  candidate: Candidate | null;
  letter: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={candidate !== null}
      title="후보지를 삭제할까요?"
      description={
        candidate && (
          <>
            <span className="remove-candidate__name">
              <span className="letter-badge">{letter}</span> {candidate.name}
            </span>
            이 후보지의 투표도 함께 삭제돼요. 삭제한 후보지는 후보지 목록과 비교표에서 빠지고, 되돌릴 수 없어요.
          </>
        )
      }
      confirmLabel="삭제"
      busyLabel="삭제하는 중"
      tone="danger"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
