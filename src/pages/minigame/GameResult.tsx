import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useWorkspace } from '../../app/providers/useWorkspace';
import Avatar from '../../components/Avatar';
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

// 22 방문자 선정 결과 (GAME-03). [집보기 참여]는 투어 화면(23)이 아직 없어 비활성,
// [게임으로 돌아가기]는 19로 간다(UI명세 Q9). 시안의 "OO 님이 집보기를 시작했어요"는 투어 상태라 넣지 않았다.
function GameResult({ gameId }: { gameId: number }) {
  const { workspace } = useWorkspace();
  const gamePath = `/workspaces/${workspace.id}/minigame`;
  const [game, setGame] = useState<MiniGame | null>(null);
  const [error, setError] = useState<string | null>(null);

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

        <div className="minigame-result__actions">
          <button
            type="button"
            className="button button--primary"
            disabled
            title="준비 중인 화면이에요."
          >
            집보기 참여
          </button>
          <Link to={gamePath} className="button button--secondary">
            게임으로 돌아가기
          </Link>
        </div>
        <p className="minigame-result__note">방문자는 모바일에서 카메라를 켜고 집보기를 진행해요.</p>
      </section>
    </div>
  );
}
