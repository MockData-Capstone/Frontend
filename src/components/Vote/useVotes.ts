import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceMessages, useWorkspaceReconnect } from '../../app/providers/useWorkspaceSocket';
import { getErrorCode, getErrorMessage } from '../../lib/authApi';
import { getVotes, submitVote } from '../../lib/voteApi';
import type { WsMessage } from '../../lib/websocket';
import type { CandidateVotes, VoteChoice } from '../../types';
import { useToast } from '../Toast/useToast';
import { applyVoteMessage, withMyChoice } from './state';

export function useVotes(workspaceId: number, meId: number | null) {
  const { showToast } = useToast();
  const [results, setResults] = useState<CandidateVotes[] | null>(null);
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [error, setError] = useState(false);
  const current = useRef<CandidateVotes[] | null>(null);
  const saving = useRef(new Set<number>());
  const active = useRef(false);
  const request = useRef(0);
  const changes = useRef<WsMessage[]>([]);
  const fetching = useRef(false);
  const revision = useRef(0);

  const update = useCallback((next: CandidateVotes[]) => {
    current.current = next;
    setResults(next);
  }, []);

  const fetchResults = useCallback(async (): Promise<{ data: CandidateVotes[] } | { error: true } | null> => {
    const id = ++request.current;
    changes.current = [];
    fetching.current = true;
    try {
      let data = (await getVotes(workspaceId)).map((item) => withMyChoice(item, meId));
      if (!active.current || id !== request.current) return null;
      // GET 중 도착한 통지/저장 결과가 뒤늦은 스냅샷에 덮이지 않게 재적용한다.
      for (const message of changes.current) data = applyVoteMessage(data, message, meId);
      return { data };
    } catch {
      return active.current && id === request.current ? { error: true } : null;
    } finally {
      if (id === request.current) {
        changes.current = [];
        fetching.current = false;
      }
    }
  }, [workspaceId, meId]);

  const applyResult = useCallback((result: Awaited<ReturnType<typeof fetchResults>>) => {
    if (!result || !active.current) return;
    if ('data' in result) {
      update(result.data);
      setError(false);
    } else setError(true);
  }, [update]);

  const reload = useCallback(() => fetchResults().then(applyResult), [fetchResults, applyResult]);

  useEffect(() => {
    active.current = true;
    void fetchResults().then(applyResult);
    return () => { active.current = false; };
  }, [fetchResults, applyResult]);

  const receive = (message: WsMessage) => {
    revision.current++;
    if (fetching.current) changes.current.push(message);
    if (current.current) update(applyVoteMessage(current.current, message, meId));
  };

  useWorkspaceMessages((message) => {
    if (['VOTE_UPDATED', 'CANDIDATE_UPDATED', 'CANDIDATE_REMOVED'].includes(message.type)) receive(message);
    // 후보지 추가와 멤버 이탈은 전체 결과(0표 후보지 포함)를 다시 조회한다.
    if (['CANDIDATE_ADDED', 'MEMBER_LEFT', 'MEMBER_KICKED'].includes(message.type)) void reload();
  });
  useWorkspaceReconnect(() => { void reload(); });

  const vote = async (candidateId: number, choice: VoteChoice) => {
    const previous = current.current?.find((item) => item.candidateId === candidateId);
    // 첫 POST가 끝나기 전 같은 후보지의 중복 요청을 막는다.
    if (!previous || meId === null || saving.current.has(candidateId)) return;
    if (previous.myChoice === choice) return; // 재클릭해도 철회하지 않는다.
    saving.current.add(candidateId);
    setPending(new Set(saving.current));
    const version = revision.current;
    try {
      const result = await submitVote(candidateId, choice, previous.myChoice);
      if (!active.current) return;
      // 저장 도중 더 최신 통지가 왔다면 HTTP 응답으로 되돌리지 않고 서버에서 재조회한다.
      if (version !== revision.current) await reload();
      else receive({ type: 'VOTE_UPDATED', data: result });
    } catch (err) {
      if (!active.current) return;
      showToast(getErrorMessage(err, '투표를 저장하지 못했어요. 다시 시도해 주세요.'));
      // 다른 탭의 선행 투표, 제외된 후보지, 응답 유실도 서버 상태로 복구한다.
      const code = getErrorCode(err);
      if (code === 'ALREADY_VOTED' || code === 'VOTE_NOT_FOUND' || code === 'CANDIDATE_NOT_FOUND' || !code) await reload();
    } finally {
      saving.current.delete(candidateId);
      if (active.current) setPending(new Set(saving.current));
    }
  };

  return { results, pending, error, reload, vote };
}
