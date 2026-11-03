import { useEffect, useState } from 'react';
import { useWorkspaceSocket } from '../../app/providers/useWorkspaceSocket';
import { getErrorMessage } from '../../lib/authApi';
import { parseInstant } from '../../lib/time';
import { serverNow } from '../../lib/websocket';
import type { GameParticipant, Hand, MiniGame } from '../../types';
import GamePlayers, { type GamePlayerRow } from './GamePlayers';
import { HANDS, handLabel, roundSummary, visitorRuleLabel } from './format';

// Backend game.round-timeout 기본값. 막대 길이에만 쓰고, 마감 판단은 서버가 한다.
const ROUND_MS = 10_000;

// 20 가위바위보 (GAME-02). 카드를 누르면 바로 내고(라운드당 한 번, 바꿀 수 없음), 전원이 내거나 마감이 지나면
// 서버가 판정해 모두에게 알린다. [결과 확인]은 방문자가 정해지면 켜지고 22로 간다.
export default function RockPaperScissors({
  game,
  meId,
  notice,
  profileImageOf,
  onSubmit,
  onAbort,
  onShowResult,
}: {
  game: MiniGame;
  meId: number | null;
  notice: string | null;
  profileImageOf: (userId: number) => string | null;
  onSubmit: (hand: Hand) => Promise<unknown>;
  onAbort: () => Promise<void>;
  onShowResult: () => void;
}) {
  const { connected } = useWorkspaceSocket();
  // 서버는 라운드가 끝나기 전엔 무엇을 냈는지 알려주지 않아서 내가 낸 것을 여기 기억한다.
  const [pick, setPick] = useState<{ roundNo: number; hand: Hand } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inProgress = game.status === 'IN_PROGRESS';
  const remainingMs = useRemainingMs(inProgress ? game.roundDeadline : null);
  const me = game.participants.find((p) => p.userId === meId) ?? null;
  const submitted = meId !== null && game.submittedUserIds.includes(meId);
  const myHand = pick?.roundNo === game.currentRound ? pick.hand : null;
  const canChoose = inProgress && me?.status === 'PLAYING' && !submitted && !myHand && !busy;
  const isStarter = game.startedBy.userId === meId;
  const rule = game.visitorRule ?? 'LOSER';
  const lastRound = game.rounds.at(-1) ?? null;
  const playing = game.participants.filter((p) => p.status === 'PLAYING');

  const choose = async (hand: Hand) => {
    const roundNo = game.currentRound;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(hand);
      setPick({ roundNo, hand });
    } catch (err) {
      setError(getErrorMessage(err, '선택을 보내지 못했어요.'));
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

  let status: string | null = null;
  if (inProgress) {
    if (!me) status = '이번 게임 참가자가 아니에요. 결과는 함께 볼 수 있어요.';
    else if (me.status === 'ELIMINATED')
      status = `라운드 ${me.outRound}에서 제외됐어요. 남은 참가자의 결과를 기다려 주세요.`;
    else if (me.status === 'LEFT') status = '이번 게임에서 빠져 결과에서 제외됐어요.';
    else if (myHand)
      status = `${handLabel(myHand)}를 선택했어요. 다른 멤버의 선택을 기다리고 있어요.`;
    else if (submitted) status = '선택했어요. 다른 멤버의 선택을 기다리고 있어요.';
  }

  const submittedIds = new Set(game.submittedUserIds);
  const rowOf = (p: GameParticipant, playerStatus: string, tag: string): GamePlayerRow => ({
    userId: p.userId,
    nickname: p.nickname,
    profileImageUrl: profileImageOf(p.userId),
    status: playerStatus,
    tag: p.userId === meId ? '나' : tag,
  });
  const playingRows = playing.map((p) =>
    rowOf(
      p,
      !inProgress
        ? game.visitor?.userId === p.userId
          ? '방문자'
          : ''
        : submittedIds.has(p.userId)
          ? '선택 완료'
          : '고르는 중',
      '참가자',
    ),
  );
  const outRounds = [
    ...new Set(
      game.participants
        .filter((p) => p.status === 'ELIMINATED' && p.outRound !== null)
        .map((p) => p.outRound as number),
    ),
  ].sort((a, b) => a - b);
  const left = game.participants.filter((p) => p.status === 'LEFT');

  return (
    <div className="minigame">
      <div className="minigame__heading">
        <div>
          <h1 className="minigame__title">가위바위보</h1>
          <p className="minigame__subtitle">
            {inProgress
              ? `라운드 ${game.currentRound} · ${visitorRuleLabel(rule)} · 남은 참가자 ${playing.length}명`
              : `${visitorRuleLabel(rule)} · 참여 ${game.participants.length}명 · ${game.rounds.length}라운드`}
          </p>
        </div>
        {isStarter && inProgress && (
          <button
            type="button"
            className="button button--secondary"
            onClick={handleAbort}
            disabled={busy}
          >
            게임 중단
          </button>
        )}
      </div>

      {notice && <p className="minigame__notice">{notice}</p>}
      {!connected && inProgress && (
        <p className="minigame__notice">
          실시간 연결이 끊겨 다시 연결하는 중이에요. 10초 넘게 끊기면 게임에서 빠져요.
        </p>
      )}

      <div className="minigame__columns">
        <section className="minigame__card minigame__card--wide">
          {inProgress && (
            <>
              <div className="rps-timer">
                <span className="rps-timer__label">남은 시간</span>
                <span className="rps-timer__value">{Math.ceil(remainingMs / 1000)}초</span>
              </div>
              <div className="rps-timer__track">
                <div
                  className="rps-timer__fill"
                  style={{ width: `${Math.min(100, (remainingMs / ROUND_MS) * 100)}%` }}
                />
              </div>
            </>
          )}

          <h2 className="rps__title">
            {!inProgress
              ? '방문자가 정해졌어요'
              : me?.status === 'PLAYING'
                ? '하나를 고르세요'
                : '참가자가 고르는 중이에요'}
          </h2>
          <p className="rps__desc">
            {inProgress
              ? '시간이 끝나면 이번 라운드 결과가 함께 표시돼요.'
              : '[결과 확인]을 눌러 방문자를 확인하세요.'}
          </p>

          <div className={`rps-hands${myHand ? ' rps-hands--picked' : ''}`}>
            {HANDS.map((hand) => (
              <button
                key={hand}
                type="button"
                className={`rps-hand${myHand === hand ? ' is-picked' : ''}`}
                onClick={() => choose(hand)}
                disabled={!canChoose}
                aria-pressed={myHand === hand}
              >
                <HandIcon hand={hand} />
                <span>{handLabel(hand)}</span>
              </button>
            ))}
          </div>

          {status && <p className="rps__status">{status}</p>}
          {error && <p className="minigame__error">{error}</p>}

          <button
            type="button"
            className="button button--primary minigame__wide rps__result"
            onClick={onShowResult}
            disabled={inProgress}
          >
            결과 확인
          </button>
        </section>

        <aside className="minigame__card minigame__side">
          <h2 className="minigame__side-title">{inProgress ? '이번 라운드' : '참여 멤버'}</h2>
          <GamePlayers rows={playingRows} />
          {outRounds.map((roundNo) => (
            <div key={roundNo}>
              <p className="minigame-players__group">라운드 {roundNo}에서 제외</p>
              <GamePlayers
                rows={game.participants
                  .filter((p) => p.status === 'ELIMINATED' && p.outRound === roundNo)
                  .map((p) => rowOf(p, '제외', '멤버'))}
              />
            </div>
          ))}
          {left.length > 0 && (
            <>
              <p className="minigame-players__group">게임에서 빠짐</p>
              <GamePlayers rows={left.map((p) => rowOf(p, '나감·연결 끊김', '멤버'))} />
            </>
          )}
          {lastRound && (
            <div className="minigame__info">
              {roundSummary(lastRound, rule).map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// 라운드 마감까지 남은 시간(ms). 서버 시각 기준으로 0.2초마다 갱신한다.
function useRemainingMs(deadline: string | null): number {
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNow(serverNow()), 200);
    return () => clearInterval(timer);
  }, [deadline]);

  if (!deadline) return 0;
  return Math.min(ROUND_MS, Math.max(0, parseInstant(deadline) - now));
}

// 시안의 선 아이콘 (가위·바위·보)
function HandIcon({ hand }: { hand: Hand }) {
  const props = {
    width: 32,
    height: 32,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  } as const;

  switch (hand) {
    case 'SCISSORS':
      return (
        <svg {...props}>
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M8.12 8.12 12 12" />
          <path d="M20 4 8.12 15.88" />
          <path d="M14.8 14.8 20 20" />
        </svg>
      );
    case 'ROCK':
      return (
        <svg {...props}>
          <path d="M5 11V8.5A2.5 2.5 0 0 1 7.5 6h9A2.5 2.5 0 0 1 19 8.5V11" />
          <path d="M4 11h16" />
          <path d="M5 11v3a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6v-3" />
          <path d="M9.5 6v5M14.5 6v5" />
        </svg>
      );
    case 'PAPER':
      return (
        <svg {...props}>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="M10 9H8M16 13H8M16 17H8" />
        </svg>
      );
  }
}
