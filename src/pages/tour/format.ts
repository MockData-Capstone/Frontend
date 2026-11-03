import type { PeerRoute, TourEndState } from '../../lib/webrtc';
import type { TourConnectionState } from '../../types';

// 진행 시간 "03:05", 1시간이 넘으면 "1:02:03"
export function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mmss = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}

// 23 참여자 목록의 연결 상태 (SIG-04)
export function connectionLabel(state: TourConnectionState): string {
  switch (state) {
    case 'CONNECTED':
      return '연결됨';
    case 'CONNECTING':
      return '연결 중';
    case 'DISCONNECTED':
      return '연결 끊김';
  }
}

// 집보기가 끝난 이유 (SIG-05)
export function endNotice(ended: TourEndState, visitorNickname: string, meIsVisitor: boolean): string {
  switch (ended) {
    case 'VISITOR_ENDED':
      return meIsVisitor ? '집보기를 끝냈어요.' : `${visitorNickname} 님이 집보기를 끝냈어요.`;
    case 'VISITOR_TIMEOUT':
      return '방문자 연결이 3분 넘게 끊겨 집보기가 끝났어요.';
    case 'VISITOR_LEFT_WORKSPACE':
      return '방문자가 그룹을 나가 집보기가 끝났어요.';
    case 'WORKSPACE_DELETED':
      return '그룹이 삭제되어 집보기가 끝났어요.';
    case 'UNKNOWN':
      return '집보기가 끝났어요.';
  }
}

// 측정 표시용 연결 방식
export function routeLabel(route: PeerRoute | null): string {
  switch (route) {
    case 'host':
      return 'P2P(같은 네트워크)';
    case 'stun':
      return 'P2P(STUN)';
    case 'relay':
      return 'TURN 중계';
    case null:
      return '확인 중';
  }
}
