import type { WsMessage } from '../../lib/websocket';
import type { CandidateRemovedData, CandidateRenamedData, CandidateVotes } from '../../types';

// VOTE_UPDATED의 myChoice는 항상 null이다. 멤버별 기록으로 내 선택을 복원한다.
export function withMyChoice(result: CandidateVotes, meId: number | null): CandidateVotes {
  return { ...result, myChoice: result.votes.find((voter) => voter.userId === meId)?.choice ?? null };
}

export function applyVoteMessage(list: CandidateVotes[], message: WsMessage, meId: number | null): CandidateVotes[] {
  switch (message.type) {
    case 'VOTE_UPDATED': {
      const result = withMyChoice(message.data as CandidateVotes, meId);
      return list.map((item) => item.candidateId === result.candidateId ? result : item);
    }
    case 'CANDIDATE_UPDATED': {
      const data = message.data as CandidateRenamedData;
      return list.map((item) => item.candidateId === data.candidateId ? { ...item, candidateName: data.name } : item);
    }
    case 'CANDIDATE_REMOVED':
      return list.filter((item) => item.candidateId !== (message.data as CandidateRemovedData).candidateId);
    default:
      return list;
  }
}
