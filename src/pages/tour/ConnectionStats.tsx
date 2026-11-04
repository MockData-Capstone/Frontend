import { devFlags } from '../../lib/devFlags';
import type { TourSnapshot } from '../../lib/webrtc';
import { formatElapsed, routeLabel } from './format';
import { useNow } from './useTour';

const SIGNALING_LABELS: Record<TourSnapshot['signaling'], string> = {
  connecting: '연결 중',
  joined: '연결됨',
  reconnecting: '다시 연결 중',
  closed: '닫힘',
};

const PEER_STATE_LABELS: Record<RTCPeerConnectionState, string> = {
  new: '준비',
  connecting: '연결 중',
  connected: '연결됨',
  disconnected: '잠시 끊김',
  failed: '실패',
  closed: '나감',
};

// ?debug=1일 때만 보이는 측정용 연결 정보 — 10분 유지(M7), 재연결 시간(M8), TURN 사용 여부
export default function ConnectionStats({
  snapshot,
  nicknameOf,
}: {
  snapshot: TourSnapshot;
  nicknameOf: (userId: number) => string;
}) {
  const now = useNow(true, Date.now);

  return (
    <div className="tour-stats">
      <p className="tour-stats__title">
        연결 정보 · 시그널링 {SIGNALING_LABELS[snapshot.signaling]}
        {devFlags.relay && ' · TURN만 사용'}
      </p>
      {snapshot.peers.length === 0 && <p>아직 연결된 상대가 없어요.</p>}
      {snapshot.peers.map((peer) => (
        <p key={peer.userId}>
          {nicknameOf(peer.userId)} · {PEER_STATE_LABELS[peer.state]} · {routeLabel(peer.route)}
          {peer.rttMs !== null && ` · RTT ${peer.rttMs}ms`}
          {peer.connectedAt !== null &&
            ` · 연결 ${formatElapsed(Math.max(0, Math.floor((now - peer.connectedAt) / 1000)))}`}
          {` · 끊김 ${peer.disconnects}회`}
          {peer.lastReconnectMs !== null && ` · 재연결 ${(peer.lastReconnectMs / 1000).toFixed(1)}초`}
        </p>
      ))}
    </div>
  );
}
