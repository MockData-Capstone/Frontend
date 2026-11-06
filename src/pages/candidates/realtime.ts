import type { WsMessage } from '../../lib/websocket';
import type {
  Candidate,
  CandidateRemovedData,
  CandidateRenamedData,
  CandidateVotes,
} from '../../types';

// 그룹 연결의 후보지·투표 통지 (CAND-01·03·04, VOTE-01·02). 다른 멤버가 후보지를 추가·이름 수정·제외하거나
// 투표하면 새로고침 없이 목록·상세에 반영한다 (백엔드 "프론트 요청사항: 후보지·투표").
const CANDIDATE_MESSAGES = new Set(['CANDIDATE_ADDED', 'CANDIDATE_UPDATED', 'CANDIDATE_REMOVED', 'VOTE_UPDATED']);

export function isCandidateMessage(message: WsMessage): boolean {
  return CANDIDATE_MESSAGES.has(message.type);
}

// 통지 하나를 후보지 목록에 반영한 새 목록을 돌려준다. 관계없는 통지면 같은 배열을 그대로 돌려준다.
// 목록은 서버와 같이 추가된 순서(id 오름차순)라서, 새 후보지는 끝에 붙인다.
export function applyCandidateMessage(
  list: Candidate[],
  message: WsMessage,
  meId: number | null,
): Candidate[] {
  switch (message.type) {
    case 'CANDIDATE_ADDED': {
      const added = message.data as Candidate;
      // 목록을 불러온 뒤에 온 통지가 이미 반영된 후보지일 수 있다.
      return list.some((c) => c.candidateId === added.candidateId) ? list : [...list, added];
    }
    case 'CANDIDATE_UPDATED': {
      const { candidateId, name } = message.data as CandidateRenamedData;
      return list.map((c) => (c.candidateId === candidateId ? { ...c, name } : c));
    }
    case 'CANDIDATE_REMOVED': {
      const { candidateId } = message.data as CandidateRemovedData;
      return list.filter((c) => c.candidateId !== candidateId);
    }
    case 'VOTE_UPDATED': {
      const result = message.data as CandidateVotes;
      const myChoice = result.votes.find((v) => v.userId === meId)?.choice ?? null;
      return list.map((c) =>
        c.candidateId === result.candidateId
          ? {
              ...c,
              votes: {
                agreeCount: result.agreeCount,
                disagreeCount: result.disagreeCount,
                split: result.split,
                myChoice,
              },
            }
          : c,
      );
    }
    default:
      return list;
  }
}
