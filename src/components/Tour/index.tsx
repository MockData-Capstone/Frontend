import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspaceMessages, useWorkspaceReconnect } from '../../app/providers/useWorkspaceSocket';
import { tourHeldFor, useTourStatus } from '../../hooks/useTourStatus';
import { getGameHistory } from '../../lib/minigameApi';
import type { MiniGame } from '../../types';
import './Tour.css';

// 19 위 집보기 안내 (UI 결정): 진행 중인 집보기에 참여하거나, 방금 뽑힌 방문자가 집보기를 시작하는 길.
// 투어가 시작돼도 자동으로 옮기지 않고 여기서 들어오게 한다.
export default function TourBanner({ workspaceId, meId }: { workspaceId: number; meId: number | null }) {
  const status = useTourStatus(workspaceId);
  const [latestGame, setLatestGame] = useState<MiniGame | null>(null);

  useEffect(() => {
    let cancelled = false;
    getGameHistory(workspaceId)
      .then((games) => {
        if (!cancelled) setLatestGame(games.find((g) => g.status === 'FINISHED') ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useWorkspaceMessages((message) => {
    if (message.type !== 'GAME_FINISHED') return;
    getGameHistory(workspaceId)
      .then((games) => setLatestGame(games.find((g) => g.status === 'FINISHED') ?? null))
      .catch(() => {});
  });

  useWorkspaceReconnect(() => {
    getGameHistory(workspaceId)
      .then((games) => setLatestGame(games.find((g) => g.status === 'FINISHED') ?? null))
      .catch(() => {});
  });

  const viewerPath = `/workspaces/${workspaceId}/tour`;
  const broadcastPath = `/workspaces/${workspaceId}/tour/broadcast`;
  const { tour } = status;

  if (tour) {
    const mine = tour.visitor.userId === meId;
    return (
      <div className="tour-banner">
        <div className="tour-banner__box">
          <p className="tour-banner__text">
            {mine ? '집보기를 송출하고 있어요.' : `${tour.visitor.nickname} 님이 집보기 중이에요.`}
          </p>
          <Link to={mine ? broadcastPath : viewerPath} className="button button--primary">
            {mine ? '송출 화면으로' : '집보기 참여'}
          </Link>
        </div>
      </div>
    );
  }

  if (tour === null && latestGame?.visitor?.userId === meId && !tourHeldFor(status, latestGame)) {
    return (
      <div className="tour-banner">
        <div className="tour-banner__box">
          <p className="tour-banner__text">
            이번 집보기 방문자로 정해졌어요. 휴대폰에서 시작하는 걸 권장해요.
          </p>
          <Link to={broadcastPath} className="button button--primary">
            집보기 시작
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
