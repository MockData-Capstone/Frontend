import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../app/providers/useAuth';
import { useWorkspace } from '../../app/providers/useWorkspace';
import Avatar from '../../components/Avatar';
import { tourHeldFor, useTourStatus } from '../../hooks/useTourStatus';
import { getErrorMessage } from '../../lib/authApi';
import { getGame } from '../../lib/minigameApi';
import type { MiniGame } from '../../types';
import { gameTypeLabel, roundHands, visitorRuleLabel } from './format';
import './MiniGame.css';

// 다른 게임 결과로 이동하면 key로 다시 마운트한다.
export default function GameResultPage() {
  const { gameId } = useParams<{ gameId: string }>();
  return <GameResult key={gameId} gameId={Number(gameId)} />;
}

// 22 방문자 선정 결과 (GAME-03). 방문자에게는 [집보기 시작](→ 24 송출), 다른 멤버에게는 집보기가 시작되면
// [집보기 참여](→ 23 시청)를 보여준다. [게임으로 돌아가기]는 19로 간다(UI명세 Q9).
function GameResult({ gameId }: { gameId: number }) {
  const { workspace } = useWorkspace();
  const { me } = useAuth();
  const gamePath = `/workspaces/${workspace.id}/minigame`;
  const [game, setGame] = useState<MiniGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tourStatus = useTourStatus(workspace.id);

  useEffect(() => {
    let cancelled = false;
    getGame(gameId)
      .then((data) => {
        if (!cancelled) setGame(data);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, '게임 결과를 불러오지 못했어요.'));
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  if (error) {
    return (
      <div className="minigame minigame--result">
        <p className="minigame__error">{error}</p>
        <Link to={gamePath} className="button button--secondary">
          게임으로 돌아가기
        </Link>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="minigame minigame--result">
        <p className="minigame__hint">불러오는 중...</p>
      </div>
    );
  }

  // 아직 진행 중이면 게임 화면에서 이어서 본다.
  if (game.status === 'IN_PROGRESS') {
    return <Navigate to={gamePath} replace />;
  }

  const visitor = game.visitor;
  const meta = [
    gameTypeLabel(game.type),
    game.type === 'ROCK_PAPER_SCISSORS' && game.visitorRule
      ? visitorRuleLabel(game.visitorRule)
      : null,
    `참여 ${game.participants.length}명`,
    game.type === 'ROCK_PAPER_SCISSORS' ? `${game.rounds.length}라운드` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // 시안: "OO 님이 집보기를 시작했어요." + [집보기 참여]. 방문자 본인에게는 [집보기 시작]으로 바꿔 보여준다.
  const liveTour = tourStatus.tour;
  const viewerPath = `/workspaces/${workspace.id}/tour`;
  const broadcastPath = `/workspaces/${workspace.id}/tour/broadcast`;
  let tourLine: string | null = null;
  let tourAction: ReactNode = null;
  if (visitor && liveTour) {
    tourLine = `${liveTour.visitor.nickname} 님이 집보기를 시작했어요.`;
    tourAction =
      liveTour.visitor.userId === me?.id ? (
        <Link to={broadcastPath} className="button button--primary">
          송출 화면으로
        </Link>
      ) : (
        <Link to={viewerPath} className="button button--primary">
          집보기 참여
        </Link>
      );
  } else if (visitor && liveTour === null) {
    const held = tourHeldFor(tourStatus, game);
    if (visitor.userId === me?.id && !held) {
      tourLine = '휴대폰에서 [집보기 시작]을 누르면 카메라가 켜지고 집보기가 시작돼요.';
      tourAction = (
        <Link to={broadcastPath} className="button button--primary">
          집보기 시작
        </Link>
      );
    } else {
      tourLine = held
        ? '이 결과로 한 집보기는 끝났어요.'
        : '방문자가 집보기를 시작하면 참여할 수 있어요.';
      tourAction = (
        <button type="button" className="button button--primary" disabled>
          집보기 참여
        </button>
      );
    }
  } else if (visitor) {
    tourAction = (
      <button type="button" className="button button--primary" disabled>
        집보기 참여
      </button>
    );
  }

  return (
    <div className="minigame minigame--result">
      <div className="minigame__heading">
        <div>
          <h1 className="minigame__title">
            {visitor ? '방문자가 정해졌어요' : '중단된 게임이에요'}
          </h1>
          <p className="minigame__subtitle">
            {visitor
              ? '게임 결과는 그룹 멤버에게 함께 표시돼요.'
              : '방문자를 정하지 않고 끝난 게임이에요.'}
          </p>
        </div>
      </div>

      <section className="minigame__card minigame-result">
        {visitor && (
          <>
            <div className="minigame-result__avatar">
              <Avatar nickname={visitor.nickname} profileImageUrl={null} />
            </div>
            <h2 className="minigame-result__title">이번 집보기는 {visitor.nickname} 님이 가요</h2>
          </>
        )}
        <p className="minigame-result__meta">{meta}</p>

        <div className="minigame-result__rounds">
          {game.type === 'ROCK_PAPER_SCISSORS' ? (
            game.rounds.map((round, i) => (
              <p key={round.roundNo}>
                <span className="minigame-result__round-no">라운드 {round.roundNo}</span>
                {roundHands(round)}
                {round.draw && ' (무승부)'}
                {visitor && i === game.rounds.length - 1 && ` → ${visitor.nickname} 님 방문`}
              </p>
            ))
          ) : (
            <p>
              <span className="minigame-result__round-no">참여 멤버</span>
              {game.participants.map((p) => p.nickname).join(' · ')}
            </p>
          )}
        </div>

        {tourLine && <p className="minigame-result__status">{tourLine}</p>}
        <div className="minigame-result__actions">
          {tourAction}
          <Link to={gamePath} className="button button--secondary">
            게임으로 돌아가기
          </Link>
        </div>
        <p className="minigame-result__note">방문자는 모바일에서 카메라를 켜고 집보기를 진행해요.</p>
      </section>
    </div>
  );
}
