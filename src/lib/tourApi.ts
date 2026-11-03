import { api } from './api';
import type { IceServers, Tour, TourHistoryItem, TourJoin } from '../types';

// 영상은 서버를 거치지 않는다. 시작·참여 응답의 signalingPath로 시그널링 소켓에 접속해 P2P로 연결한다(lib/webrtc.ts).

// TOUR-01 실시간 투어 시작 (가장 최근 미니게임의 방문자만) — POST /api/workspaces/{workspaceId}/tours
export async function startTour(workspaceId: number): Promise<TourJoin> {
  const { data } = await api.post<TourJoin>(`/api/workspaces/${workspaceId}/tours`);
  return data;
}

// TOUR-03 진행 중인 투어 (없으면 null) — GET /api/workspaces/{workspaceId}/tours/current
export async function getCurrentTour(workspaceId: number): Promise<Tour | null> {
  const { data } = await api.get<{ tour: Tour | null }>(
    `/api/workspaces/${workspaceId}/tours/current`,
  );
  return data.tour;
}

// TOUR-06 종료된 투어 (최신순) — GET /api/workspaces/{workspaceId}/tours
export async function getTourHistory(workspaceId: number): Promise<TourHistoryItem[]> {
  const { data } = await api.get<{ items: TourHistoryItem[] }>(
    `/api/workspaces/${workspaceId}/tours`,
  );
  return data.items;
}

// TOUR-02 시청자로 참여 (방문자 포함 최대 6명, 이미 참여 중이면 같은 정보를 다시 준다)
// — POST /api/tours/{tourId}/participants
export async function joinTour(tourId: number): Promise<TourJoin> {
  const { data } = await api.post<TourJoin>(`/api/tours/${tourId}/participants`);
  return data;
}

// TOUR-05 방문자 재참여 — POST /api/tours/{tourId}/rejoin
export async function rejoinTour(tourId: number): Promise<TourJoin> {
  const { data } = await api.post<TourJoin>(`/api/tours/${tourId}/rejoin`);
  return data;
}

// TOUR-04 시청자 나가기 (세션은 유지) — DELETE /api/tours/{tourId}/participants/me
export async function leaveTour(tourId: number): Promise<void> {
  await api.delete(`/api/tours/${tourId}/participants/me`);
}

// TOUR-04 방문자 종료 (모든 참여자의 연결을 정리) — DELETE /api/tours/{tourId}
export async function endTour(tourId: number): Promise<void> {
  await api.delete(`/api/tours/${tourId}`);
}

// TOUR-02 보조 STUN·TURN과 시간 제한 자격증명. expiresAt 전에 다시 받는다 — GET /api/tours/{tourId}/ice-servers
export async function getIceServers(tourId: number): Promise<IceServers> {
  const { data } = await api.get<IceServers>(`/api/tours/${tourId}/ice-servers`);
  return data;
}
