import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/useAuth';
import { useWorkspace } from '../../app/providers/useWorkspace';
import { useWorkspaceMessages, useWorkspaceReconnect } from '../../app/providers/useWorkspaceSocket';
import { getErrorMessage } from '../../lib/authApi';
import {
  abortGame,
  drawRoulette,
  getCurrentGame,
  getGame,
  startGame,
  submitChoice,
} from '../../lib/minigameApi';
import { getMembers } from '../../lib/workspaceApi';
import type {
  GameAbortedData,
  GameEventData,
  GameFinishedData,
  GamePlayerLeftData,
  GameType,
  Hand,
  MemberOnlineChangedData,
  MiniGame,
  VisitorRule,
  WorkspaceMember,
} from '../../types';
import TourBanner from '../../components/Tour';
import GameSetup from './GameSetup';
import RockPaperScissors from './RockPaperScissors';
import Roulette from './Roulette';
import { abortNotice } from './format';
import './MiniGame.css';

// 다른 멤버가 냈는지(선택 완료/고르는 중)는 ROUND_CHOICE_SUBMITTED 통지로 바로 다시 조회한다. 그 통지가 없는
// 서버(백엔드 feature/notification 이전)도 있어서, 가위바위보 진행 중에는 이 간격으로도 다시 조회한다.
const POLL_INTERVAL_MS = 1000;

// 19 방문자 정하기 · 20 가위바위보 · 21 룰렛 (UI v0.4 §6).
// 진행 중인 게임이 있으면 게임 화면을, 없으면 19를 보여준다. 진행은 Workspace 소켓 통지를 받을 때마다 다시 조회해 맞춘다.
export default function MiniGamePage() {
  const { workspace } = useWorkspace();
  const { me } = useAuth();
  const navigate = useNavigate();
  const meId = me?.id ?? null;

  // undefined: 불러오는 중, null: 진행 중인 게임 없음(19)
  const [game, setGame] = useState<MiniGame | null | undefined>(undefined);
  // null: 불러오는 중. 불러오지 못하면 빈 목록으로 두고 19에서 안내한다.
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 요청 응답과 통지 뒤 재조회가 섞여 도착하므로, 가장 나중에 시작한 것만 화면에 반영한다.
  const sequence = useRef(0);

  const apply = useCallback((next: MiniGame | null) => {
    sequence.current += 1;
    setError(null);
    setGame(next?.status === 'ABORTED' ? null : next);
  }, []);

  const sync = useCallback(
    <T extends MiniGame | null>(request: Promise<T>) => {
      const id = ++sequence.current;
      return request.then((next) => {
        if (id === sequence.current) apply(next);
        return next;
      });
    },
    [apply],
  );

  const refresh = useCallback(
    (gameId: number) => {
      sync(getGame(gameId)).catch(() => {
        // 다음 통지나 폴링에서 다시 맞춘다.
      });
    },
    [sync],
  );

  useEffect(() => {
    let cancelled = false;
    getMembers(workspace.id)
      .then((list) => {
        if (!cancelled) setMembers(list);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    sync(getCurrentGame(workspace.id)).catch((err) => {
      if (!cancelled) setError(getErrorMessage(err, '미니게임 정보를 불러오지 못했어요.'));
    });
    return () => {
      cancelled = true;
    };
  }, [workspace.id, sync]);

  // 연결이 끊긴 동안 놓친 통지(접속·입장·퇴장, 게임 시작·결과·중단)를 메운다. 멤버는 새로 불러오고,
  // 게임은 19 대기 중이면 그사이 시작된 게임을 찾고, 진행 중이면 그 게임을 다시 조회한다(룰렛은 폴링이 없다).
  // 결과가 나온 뒤에는 결과 확인 흐름을 끊지 않게 그대로 둔다.
  useWorkspaceReconnect(() => {
    getMembers(workspace.id)
      .then(setMembers)
      .catch(() => {});
    if (game == null) {
      sync(getCurrentGame(workspace.id)).catch(() => {});
    } else if (game?.status === 'IN_PROGRESS') {
      refresh(game.gameId);
    }
  });

  const pollingGameId =
    game?.type === 'ROCK_PAPER_SCISSORS' && game.status === 'IN_PROGRESS' ? game.gameId : null;

  useEffect(() => {
    if (pollingGameId === null) return;
    const timer = setInterval(() => refresh(pollingGameId), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pollingGameId, refresh]);

  useWorkspaceMessages((message) => {
    switch (message.type) {
      case 'GAME_STARTED':
        setNotice(null);
        apply(message.data as MiniGame);
        return;
      case 'ROUND_OPENED':
      case 'ROUND_RESULT':
      case 'ROUND_CHOICE_SUBMITTED': {
        const { gameId } = message.data as GameEventData;
        if (game?.gameId === gameId) refresh(gameId);
        return;
      }
      case 'GAME_FINISHED': {
        const { gameId, visitor } = message.data as GameFinishedData;
        if (game?.gameId !== gameId) return;
        // 룰렛이 모든 화면에서 같이 돌기 시작하도록 방문자를 바로 반영하고, 나머지는 다시 조회한다.
        apply({ ...game, status: 'FINISHED', visitor });
        refresh(gameId);
        return;
      }
      case 'GAME_PLAYER_LEFT': {
        const { gameId, nickname } = message.data as GamePlayerLeftData;
        if (game?.gameId !== gameId) return;
        setNotice(`${nickname} 님이 게임에서 빠져 결과에서 제외됐어요.`);
        refresh(gameId);
        return;
      }
      case 'GAME_ABORTED': {
        const { gameId, reason } = message.data as GameAbortedData;
        if (!game || game.gameId !== gameId) return;
        setNotice(abortNotice(reason, game.startedBy, meId));
        apply(null);
        return;
      }
      case 'MEMBER_JOINED':
      case 'MEMBER_LEFT':
      case 'MEMBER_KICKED':
        getMembers(workspace.id)
          .then(setMembers)
          .catch(() => {});
        return;
      // 접속 상태가 바뀌면 그 멤버만 고친다. 미접속 멤버는 19에서 고를 수 없다.
      case 'MEMBER_ONLINE':
      case 'MEMBER_OFFLINE': {
        const { userId } = message.data as MemberOnlineChangedData;
        const online = message.type === 'MEMBER_ONLINE';
        setMembers((list) => list?.map((m) => (m.userId === userId ? { ...m, online } : m)) ?? list);
        return;
      }
    }
  });

  if (error) {
    return (
      <div className="minigame">
        <p className="minigame__error">{error}</p>
      </div>
    );
  }

  if (game === undefined || members === null) {
    return (
      <div className="minigame">
        <p className="minigame__hint">불러오는 중...</p>
      </div>
    );
  }

  // 진행 중인 집보기 참여, 또는 방금 뽑힌 방문자의 집보기 시작 안내
  const tourBanner = <TourBanner workspaceId={workspace.id} meId={meId} />;

  if (game === null) {
    return (
      <>
        {tourBanner}
        <GameSetup
          members={members}
          meId={meId}
          notice={notice}
          onStart={async (payload: {
            type: GameType;
            participantUserIds: number[];
            visitorRule: VisitorRule | null;
          }) => {
            setNotice(null);
            await sync(startGame(workspace.id, payload));
          }}
        />
      </>
    );
  }

  const shared = {
    game,
    meId,
    notice,
    profileImageOf: (userId: number) =>
      members.find((m) => m.userId === userId)?.profileImageUrl ?? null,
    onAbort: async () => {
      await abortGame(game.gameId);
      setNotice(abortNotice('STOPPED_BY_STARTER', game.startedBy, meId));
      apply(null);
    },
    onShowResult: () => navigate(`/workspaces/${workspace.id}/minigame/${game.gameId}`),
  };

  // 새 게임이 시작되면 key로 다시 마운트해 이전 게임의 선택·회전 상태를 버린다.
  return (
    <>
      {tourBanner}
      {game.type === 'ROULETTE' ? (
        <Roulette key={game.gameId} {...shared} onDraw={() => sync(drawRoulette(game.gameId))} />
      ) : (
        <RockPaperScissors
          key={game.gameId}
          {...shared}
          onSubmit={(hand: Hand) => sync(submitChoice(game.gameId, game.currentRound, hand))}
        />
      )}
    </>
  );
}
