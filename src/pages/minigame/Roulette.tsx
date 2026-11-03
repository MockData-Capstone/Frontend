import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../lib/authApi';
import type { GameParticipant, MiniGame } from '../../types';
import PlayerList from '../../components/PlayerList';

// 바퀴 칸 색 (채움, 글씨) — 시안 21의 4칸 순서
const SLICE_COLORS: [string, string][] = [
  ['var(--code-bg)', 'var(--text-h)'],
  ['var(--selected-bg)', 'var(--text-h)'],
  ['var(--info-bg)', 'var(--text-h)'],
  ['var(--accent)', '#fff'],
];
const FULL_TURNS = 6;
// MiniGame.css .roulette__wheel의 회전 시간과 맞춘다.
const SPIN_MS = 4500;
const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 2;

// 21 룰렛 (GAME-02). 시안에 없는 [룰렛 돌리기]는 시작한 멤버에게만 있다 — 누르면 서버가 방문자를 정해
// GAME_FINISHED로 모두에게 알리고, 모든 화면에서 같이 돌다가 방문자 칸에서 멈춘다.
export default function Roulette({
  game,
  meId,
  notice,
  profileImageOf,
  onDraw,
  onAbort,
  onShowResult,
}: {
  game: MiniGame;
  meId: number | null;
  notice: string | null;
  profileImageOf: (userId: number) => string | null;
  onDraw: () => Promise<unknown>;
  onAbort: () => Promise<void>;
  onShowResult: () => void;
}) {
  // 이미 방문자가 정해진 채로 열렸으면 돌리지 않고 결과를 바로 보여준다.
  const [spun, setSpun] = useState(() => game.visitor !== null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 나가거나 연결이 끊긴 참가자는 추첨에서 빠지므로 바퀴에서도 뺀다.
  const players = game.participants.filter((p) => p.status === 'PLAYING');
  const isStarter = game.startedBy.userId === meId;
  const visitor = game.visitor;
  const inProgress = game.status === 'IN_PROGRESS';
  const visitorIndex = visitor ? players.findIndex((p) => p.userId === visitor.userId) : -1;
  // 방문자 칸 가운데가 위쪽 바늘에 오도록 시계 방향으로 몇 바퀴 돌린다.
  const rotation =
    visitorIndex >= 0 ? FULL_TURNS * 360 - ((visitorIndex + 0.5) * 360) / players.length : 0;
  const visitorId = visitor?.userId ?? null;

  // 탭이 가려져 있으면 화면이 그려지지 않아 transitionend가 늦게 온다 — 회전 시간이 지나면 결과를 보여준다.
  useEffect(() => {
    if (visitorId === null || spun) return;
    const timer = setTimeout(() => setSpun(true), SPIN_MS + 500);
    return () => clearTimeout(timer);
  }, [visitorId, spun]);

  const handleDraw = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDraw();
    } catch (err) {
      setError(getErrorMessage(err, '룰렛을 돌리지 못했어요.'));
    } finally {
      setBusy(false);
    }
  };

  const handleAbort = async () => {
    if (!window.confirm('게임을 중단할까요? 방문자는 정해지지 않아요.')) return;
    setBusy(true);
    setError(null);
    try {
      await onAbort();
    } catch (err) {
      setError(getErrorMessage(err, '게임을 중단하지 못했어요.'));
      setBusy(false);
    }
  };

  let title: string;
  if (visitor && spun) title = `${visitor.nickname} 님이 뽑혔어요`;
  else if (visitor || busy) title = '돌리는 중이에요';
  else if (isStarter) title = '룰렛을 돌려 주세요';
  else title = `${game.startedBy.nickname} 님이 룰렛을 돌리길 기다리고 있어요`;

  const rowOf = (p: GameParticipant) => ({
    userId: p.userId,
    nickname: p.nickname,
    profileImageUrl: profileImageOf(p.userId),
    status:
      p.status === 'LEFT'
        ? '나감·연결 끊김'
        : spun && visitor?.userId === p.userId
          ? '방문자'
          : '참여 중',
    tag: p.userId === meId ? '나' : '참가자',
  });

  return (
    <div className="minigame">
      <div className="minigame__heading">
        <div>
          <h1 className="minigame__title">룰렛</h1>
          <p className="minigame__subtitle">
            참여한 {players.length}명 중 한 명을 무작위로 정해요.
          </p>
        </div>
        {isStarter && inProgress && !busy && (
          <button type="button" className="button button--secondary" onClick={handleAbort}>
            게임 중단
          </button>
        )}
      </div>

      {notice && <p className="minigame__notice">{notice}</p>}

      <div className="minigame__columns">
        <section className="minigame__card minigame__card--wide roulette-card">
          <div className="roulette">
            <span className="roulette__pointer" aria-hidden="true" />
            <svg
              className="roulette__wheel"
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              role="img"
              aria-label={`룰렛 칸: ${players.map((p) => p.nickname).join(', ')}`}
              style={{ transform: `rotate(${rotation}deg)` }}
              onTransitionEnd={(e) => {
                if (e.propertyName === 'transform') setSpun(true);
              }}
            >
              {players.map((p, i) => {
                const slice = 360 / players.length;
                const [fill, color] = SLICE_COLORS[i % SLICE_COLORS.length];
                const [labelX, labelY] = pointAt(RADIUS * 0.6, (i + 0.5) * slice);
                return (
                  <g key={p.userId}>
                    <path d={slicePath(i * slice, (i + 1) * slice)} style={{ fill }} />
                    <text
                      x={labelX}
                      y={labelY}
                      className="roulette__label"
                      style={{ fill: color }}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {p.nickname}
                    </text>
                  </g>
                );
              })}
              <circle cx={CENTER} cy={CENTER} r={RADIUS} className="roulette__rim" />
              <circle cx={CENTER} cy={CENTER} r={24} className="roulette__hub" />
            </svg>
          </div>

          <div className="roulette__status">
            <h2 className="roulette__title">{title}</h2>
            <p className="roulette__desc">
              {visitor && spun
                ? '[결과 확인]을 눌러 방문자를 확인하세요.'
                : '결과는 모든 멤버에게 함께 보여요.'}
            </p>
            {error && <p className="minigame__error">{error}</p>}
            {isStarter && !visitor ? (
              <button
                type="button"
                className="button button--primary roulette__button"
                onClick={handleDraw}
                disabled={busy}
              >
                룰렛 돌리기
              </button>
            ) : (
              <button
                type="button"
                className="button button--primary roulette__button"
                onClick={onShowResult}
                disabled={!visitor || !spun}
              >
                결과 확인
              </button>
            )}
          </div>
        </section>

        <aside className="minigame__card minigame__side">
          <h2 className="minigame__side-title">참여 멤버</h2>
          <PlayerList rows={game.participants.map(rowOf)} />
          <p className="minigame__info">게임 중 연결이 끊긴 멤버는 결과에서 제외돼요.</p>
        </aside>
      </div>
    </div>
  );
}

// 12시 방향에서 시계 방향으로 angle도 떨어진, 중심에서 r만큼 떨어진 점
function pointAt(r: number, angle: number): [number, number] {
  const rad = ((angle - 90) * Math.PI) / 180;
  return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)];
}

function slicePath(start: number, end: number): string {
  const [x0, y0] = pointAt(RADIUS, start);
  const [x1, y1] = pointAt(RADIUS, end);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${x0} ${y0} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x1} ${y1} Z`;
}
