import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceMessages, useWorkspaceReconnect } from '../../app/providers/useWorkspaceSocket';
import { getErrorMessage } from '../../lib/authApi';
import { addCandidate } from '../../lib/candidateApi';
import {
  getRecommendations,
  refreshesRecommendations,
  requestRecommendations,
} from '../../lib/recommendationApi';
import type { Analysis, Recommendation } from '../../types/search';

// REC-01·02 대화 분석과 추천 위치, CAND-01 추천 위치를 후보지로 추가.
// 분석은 서버가 따로 돌리고 그룹 연결로 시작·완료·실패를 알려준다(RECOMMENDATION_*). 그 통지를 받거나
// 후보지가 바뀌면(CANDIDATE_* — 추천의 "후보지에 추가됨"이 바뀐다) 다시 조회한다.
// 조회 응답이 섞여 도착할 수 있어 가장 나중에 시작한 조회만 반영한다.
export function useRecommendations(workspaceId: number) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [items, setItems] = useState<Recommendation[]>([]);
  const [requesting, setRequesting] = useState(false);
  // 후보지로 추가하는 중인 recommendationId
  const [adding, setAdding] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);

  const refresh = useCallback(() => {
    const id = ++sequence.current;
    return getRecommendations(workspaceId).then((data) => {
      if (id !== sequence.current) return;
      setAnalysis(data.analysis);
      setItems(data.items);
    });
  }, [workspaceId]);

  useEffect(() => {
    refresh().catch((err) => setError(getErrorMessage(err, '분석 결과를 불러오지 못했어요.')));
  }, [refresh]);

  useWorkspaceMessages((message) => {
    if (refreshesRecommendations(message.type)) refresh().catch(() => {});
  });

  // 연결이 끊긴 동안 분석이 끝났을 수 있다.
  useWorkspaceReconnect(() => {
    refresh().catch(() => {});
  });

  const requestAnalysis = useCallback(async () => {
    setRequesting(true);
    setError(null);
    try {
      await requestRecommendations(workspaceId);
    } catch (err) {
      // 대화가 없거나 이미 분석 중이면 409와 안내 문구가 온다.
      setError(getErrorMessage(err, '대화를 분석하지 못했어요.'));
    }
    // 실패해도 다시 조회한다 — 다른 멤버가 먼저 시작했으면 진행 중으로 보여야 한다.
    await refresh().catch(() => {});
    setRequesting(false);
  }, [workspaceId, refresh]);

  const add = useCallback(
    async (recommendationId: number) => {
      setAdding((list) => [...list, recommendationId]);
      setError(null);
      try {
        await addCandidate(workspaceId, recommendationId);
      } catch (err) {
        setError(getErrorMessage(err, '후보지로 추가하지 못했어요.'));
      }
      await refresh().catch(() => {});
      setAdding((list) => list.filter((id) => id !== recommendationId));
    },
    [workspaceId, refresh],
  );

  return { analysis, items, requesting, adding, error, requestAnalysis, add };
}
