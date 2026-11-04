import { api } from './api';
import type { GameType, Hand, MiniGame, VisitorRule } from '../types';

// 진행 상황(라운드 개시·결과, 방문자 확정, 중단)은 Workspace 소켓의 GAME_* 통지로 받는다.

// GAME-01 미니게임 시작 (참여 멤버는 Workspace 소켓에 접속 중인 멤버 2명 이상, 방문자 기준은 가위바위보만)
// — POST /api/workspaces/{workspaceId}/minigames
export async function startGame(
  workspaceId: number,
  payload: { type: GameType; participantUserIds: number[]; visitorRule: VisitorRule | null },
): Promise<MiniGame> {
  const { data } = await api.post<MiniGame>(`/api/workspaces/${workspaceId}/minigames`, payload);
  return data;
}

// GAME-05 진행 중인 미니게임 (없으면 null) — 새로고침해도 진행 상태를 이어서 보여준다
// — GET /api/workspaces/{workspaceId}/minigames/current
export async function getCurrentGame(workspaceId: number): Promise<MiniGame | null> {
  const { data } = await api.get<{ game: MiniGame | null }>(
    `/api/workspaces/${workspaceId}/minigames/current`,
  );
  return data.game;
}

// GAME-06 끝나거나 중단된 게임 (최신순) — GET /api/workspaces/{workspaceId}/minigames
export async function getGameHistory(workspaceId: number): Promise<MiniGame[]> {
  const { data } = await api.get<{ items: MiniGame[] }>(`/api/workspaces/${workspaceId}/minigames`);
  return data.items;
}

// GAME-03 미니게임 결과 (확정 전에는 visitor가 null, 진행 중인 라운드의 선택은 비공개)
// — GET /api/minigames/{gameId}
export async function getGame(gameId: number): Promise<MiniGame> {
  const { data } = await api.get<MiniGame>(`/api/minigames/${gameId}`);
  return data;
}

// GAME-02 룰렛 추첨. 서버가 방문자를 정하고 GAME_FINISHED로 모두에게 알린다 — POST /api/minigames/{gameId}/draw
export async function drawRoulette(gameId: number): Promise<MiniGame> {
  const { data } = await api.post<MiniGame>(`/api/minigames/${gameId}/draw`);
  return data;
}

// GAME-02 가위바위보 선택. 라운드당 한 번이고 바꿀 수 없다 — POST /api/minigames/{gameId}/rounds/{roundNo}/choices
export async function submitChoice(gameId: number, roundNo: number, choice: Hand): Promise<MiniGame> {
  const { data } = await api.post<MiniGame>(
    `/api/minigames/${gameId}/rounds/${roundNo}/choices`,
    { choice },
  );
  return data;
}

// GAME-04 미니게임 중단 (시작한 멤버만). 지우지 않고 ABORTED가 된 게임을 돌려준다 — DELETE /api/minigames/{gameId}
export async function abortGame(gameId: number): Promise<MiniGame> {
  const { data } = await api.delete<MiniGame>(`/api/minigames/${gameId}`);
  return data;
}
