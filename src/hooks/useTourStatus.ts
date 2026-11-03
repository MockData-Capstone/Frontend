import { useCallback, useEffect, useState } from 'react';
import { useWorkspaceMessages } from '../app/providers/useWorkspaceSocket';
import { parseInstant } from '../lib/time';
import { getCurrentTour, getTourHistory } from '../lib/tourApi';
import type { MiniGame, Tour } from '../types';

export interface TourStatus {
  // undefined: 불러오는 중, null: 진행 중인 집보기 없음
  tour: Tour | null | undefined;
  // 가장 최근에 끝난 집보기가 시작된 시각
  lastEndedTourStartedAt: string | null;
}

// 진행 중인 집보기와 가장 최근에 끝난 집보기 (TOUR-03·06).
// Workspace 소켓의 TOUR_STARTED·TOUR_ENDED를 받으면 다시 조회한다.
export function useTourStatus(workspaceId: number): TourStatus {
  const [status, setStatus] = useState<TourStatus>({
    tour: undefined,
    lastEndedTourStartedAt: null,
  });

  const load = useCallback(
    () =>
      Promise.all([getCurrentTour(workspaceId), getTourHistory(workspaceId)]).then(
        ([tour, history]) => ({ tour, lastEndedTourStartedAt: history[0]?.startedAt ?? null }),
      ),
    [workspaceId],
  );

  useEffect(() => {
    let cancelled = false;
    load()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(() => {
        if (!cancelled) setStatus({ tour: null, lastEndedTourStartedAt: null });
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useWorkspaceMessages((message) => {
    if (message.type === 'TOUR_STARTED' || message.type === 'TOUR_ENDED') {
      load()
        .then(setStatus)
        .catch(() => {});
    }
  });

  return status;
}

// 이 게임 결과로 집보기를 이미 했는지(진행 중이거나 끝남). 한 결과로는 한 번만 할 수 있다(TOUR_ALREADY_HELD).
export function tourHeldFor(status: TourStatus, game: MiniGame): boolean {
  if (status.tour?.gameId === game.gameId) return true;
  return Boolean(
    game.finishedAt &&
      status.lastEndedTourStartedAt &&
      parseInstant(status.lastEndedTourStartedAt) >= parseInstant(game.finishedAt),
  );
}
