import { useEffect, useState } from 'react';
import { useWorkspaceMessages, useWorkspaceReconnect } from '../../app/providers/useWorkspaceSocket';
import { getErrorMessage } from '../../lib/authApi';
import { getCandidates } from '../../lib/candidateApi';
import type { Candidate } from '../../types';
import { applyCandidateMessage, isCandidateMessage } from '../candidates/realtime';

// 그룹 홈(11)의 지도 마커·후보지 카드에 쓰는 후보지 목록. 후보지 목록(14)처럼 통지로 바로 반영하고,
// 다시 연결되면 끊긴 동안 놓친 통지가 있을 수 있어 새로 불러온다.
export function useWorkspaceCandidates(workspaceId: number, meId: number | null) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCandidates(workspaceId)
      .then((data) => {
        if (!cancelled) setCandidates(data);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, '후보지를 불러오지 못했어요.'));
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useWorkspaceMessages((message) => {
    if (!isCandidateMessage(message)) return;
    setCandidates((list) => list && applyCandidateMessage(list, message, meId));
  });

  useWorkspaceReconnect(() => {
    getCandidates(workspaceId)
      .then((data) => {
        setCandidates(data);
        setError(null);
      })
      .catch(() => {});
  });

  return { candidates, error };
}
