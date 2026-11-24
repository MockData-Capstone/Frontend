import { useCallback, useEffect, useState } from 'react';
import { useWorkspaceMessages, useWorkspaceReconnect } from '../app/providers/useWorkspaceSocket';
import { getErrorMessage } from '../lib/authApi';
import { emptyCondition, getConditions, saveConditions, validateCondition } from '../lib/conditionApi';
import type { ConditionView, HouseCondition, SavedCondition } from '../types/search';

// 그룹 조건 (COND-01~03). 확정 조건이 있으면 그것, 없으면 최근 분석 초안(draft)을 값으로 쓴다.
// 조건 칩(06 상단)과 조건 확정·매물 검색(10)이 같이 쓴다. 다른 멤버가 확정·수정하면 CONDITION_UPDATED로 바로 맞춘다.
export function useGroupConditions(workspaceId: number) {
  const [view, setView] = useState<ConditionView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      getConditions(workspaceId)
        .then((data) => {
          setView(data);
          setError(null);
        })
        .catch((err) => setError(getErrorMessage(err, '조건을 불러오지 못했어요.'))),
    [workspaceId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useWorkspaceMessages((message) => {
    switch (message.type) {
      case 'CONDITION_UPDATED':
        setView((current) => ({ condition: message.data as SavedCondition, draft: current?.draft ?? null }));
        return;
      case 'RECOMMENDATION_COMPLETED':
      case 'CONDITION_SUGGESTION_ACCEPTED':
        void load();
    }
  });

  useWorkspaceReconnect(() => void load());

  const confirmed = view?.condition ?? null;
  const current: HouseCondition = pick(confirmed ?? view?.draft ?? emptyCondition);

  // 일부만 바꿔 저장한다. 확정 전이면 이 저장이 곧 확정(POST)이다.
  const save = useCallback(
    async (next: HouseCondition) => {
      const invalid = validateCondition(next);
      if (invalid) throw new Error(invalid);
      const saved = await saveConditions(workspaceId, pick(next), confirmed !== null);
      setView((v) => ({ condition: saved, draft: v?.draft ?? null }));
      return saved;
    },
    [workspaceId, confirmed],
  );

  return { view, confirmed, current, error, loaded: view !== null, save, reload: load };
}

// 서버 응답에 붙어 오는 lastModifiedBy·updatedAt을 떼고 조건 필드만 남긴다
export function pick(c: HouseCondition): HouseCondition {
  return {
    depositMin: c.depositMin,
    depositMax: c.depositMax,
    monthlyRentMin: c.monthlyRentMin,
    monthlyRentMax: c.monthlyRentMax,
    roomType: c.roomType,
    areaMin: c.areaMin,
    areaMax: c.areaMax,
    avoidSlope: c.avoidSlope,
    needVehicleAccess: c.needVehicleAccess,
  };
}
