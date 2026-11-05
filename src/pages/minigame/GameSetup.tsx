import { useState } from 'react';
import { useWorkspaceSocket } from '../../app/providers/useWorkspaceSocket';
import Avatar from '../../components/Avatar';
import { getErrorMessage } from '../../lib/authApi';
import type { GameType, VisitorRule, WorkspaceMember } from '../../types';
import { gameTypeLabel, visitorRuleLabel } from './format';

const GAME_TYPES: GameType[] = ['ROCK_PAPER_SCISSORS', 'ROULETTE'];
const VISITOR_RULES: VisitorRule[] = ['LOSER', 'WINNER'];

// 19 집 보러 갈 사람 정하기 (GAME-01). 서버는 그룹 연결에 접속 중인 멤버만 참여시킨다(PLAYER_NOT_AVAILABLE).
// 멤버 목록의 online으로 미접속 멤버는 고를 수 없게 하고 "미접속"으로 표시한다. online을 주지 않는 서버에서는
// 모두 고를 수 있고, 미접속 멤버를 고르면 서버의 거절 문구를 그대로 보여준다.
export default function GameSetup({
  members,
  meId,
  notice,
  onStart,
}: {
  members: WorkspaceMember[];
  meId: number | null;
  notice: string | null;
  onStart: (payload: {
    type: GameType;
    participantUserIds: number[];
    visitorRule: VisitorRule | null;
  }) => Promise<void>;
}) {
  const { connected } = useWorkspaceSocket();
  const [type, setType] = useState<GameType>('ROCK_PAPER_SCISSORS');
  const [rule, setRule] = useState<VisitorRule>('LOSER');
  // 시작하는 멤버가 보통 같이 하므로 나만 골라 둔다.
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(meId === null ? [] : [meId]),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 그사이 나가거나 접속이 끊긴 멤버가 선택에 남지 않게 지금 멤버 기준으로 센다.
  const participantUserIds = members
    .filter((m) => selected.has(m.userId) && m.online !== false)
    .map((m) => m.userId);
  // 서버가 접속 상태를 주면 시안처럼 "접속 중인 N명"으로 보여준다.
  const knowsOnline = members.some((m) => m.online !== undefined);
  const isRps = type === 'ROCK_PAPER_SCISSORS';

  const toggle = (userId: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const handleStart = async () => {
    setBusy(true);
    setError(null);
    try {
      await onStart({ type, participantUserIds, visitorRule: isRps ? rule : null });
    } catch (err) {
      setError(getErrorMessage(err, '게임을 시작하지 못했어요.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="minigame">
      <div className="minigame__heading">
        <div>
          <h1 className="minigame__title">집 보러 갈 사람 정하기</h1>
          <p className="minigame__subtitle">
            게임으로 방문자를 정하고, 나머지 멤버는 실시간 영상으로 함께 봐요.
          </p>
        </div>
      </div>

      {notice && <p className="minigame__notice">{notice}</p>}

      <div className="minigame__columns">
        <section className="minigame__card">
          <p className="minigame__label">게임 종류</p>
          <div className="minigame__options">
            {GAME_TYPES.map((value) => (
              <button
                key={value}
                type="button"
                className="minigame-option"
                aria-pressed={type === value}
                onClick={() => setType(value)}
              >
                {gameTypeLabel(value)}
              </button>
            ))}
          </div>

          <p className="minigame__label">방문자 기준</p>
          <div className="minigame__options">
            {VISITOR_RULES.map((value) => (
              <button
                key={value}
                type="button"
                className="minigame-option minigame-option--small"
                aria-pressed={isRps && rule === value}
                onClick={() => setRule(value)}
                disabled={!isRps}
                title={isRps ? undefined : '방문자 기준은 가위바위보에만 적용돼요.'}
              >
                {visitorRuleLabel(value)}
              </button>
            ))}
          </div>

          <p className="minigame__label">
            참여 멤버 · {knowsOnline && '접속 중인 '}
            {participantUserIds.length}명 선택
          </p>
          <p className="minigame__label-hint">그룹 화면을 열어 둔 멤버만 참여할 수 있어요.</p>
          {members.length === 0 ? (
            <p className="minigame__hint">멤버 목록을 불러오지 못했어요.</p>
          ) : (
            <ul className="minigame-members">
              {members.map((member) => {
                const offline = member.online === false;
                return (
                  <li key={member.userId}>
                    <label className={`minigame-member${offline ? ' is-offline' : ''}`}>
                      <input
                        type="checkbox"
                        checked={!offline && selected.has(member.userId)}
                        onChange={() => toggle(member.userId)}
                        disabled={offline}
                      />
                      <Avatar nickname={member.nickname} profileImageUrl={member.profileImageUrl} />
                      <span className="minigame-member__name">{member.nickname}</span>
                      <span className="minigame-member__tag">
                        {offline
                          ? '미접속'
                          : member.userId === meId
                            ? '나'
                            : member.role === 'HOST'
                              ? '호스트'
                              : '멤버'}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {error && <p className="minigame__error">{error}</p>}
          {!connected && <p className="minigame__hint">실시간 연결 중이에요. 잠시 후 시작할 수 있어요.</p>}
          <button
            type="button"
            className="button button--primary minigame__wide"
            onClick={handleStart}
            disabled={busy || !connected || participantUserIds.length < 2}
          >
            게임 시작
          </button>
        </section>

        <aside className="minigame__card minigame__side">
          <h2 className="minigame__side-title">함께 정하는 방문자</h2>
          <p className="minigame__side-text">
            선택한 기준에 해당하는 멤버가
            <br />
            다음 라운드에 남아요.
            <br />
            마지막 한 명이 방문자가 돼요.
          </p>
          <p className="minigame__info">
            룰렛은 참여 멤버 중 한 명을 무작위로 정해요. 방문자 기준 선택은 가위바위보에만
            적용돼요.
          </p>
          <p className="minigame__side-note">접속 중인 멤버가 2명 이상이어야 시작할 수 있어요.</p>
        </aside>
      </div>
    </div>
  );
}
