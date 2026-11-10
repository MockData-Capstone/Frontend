import { isCancel } from 'axios';
import { forceLogout, getTokens, refreshTokens } from './api';
import { parseInstant } from './time';
import { getIceServers } from './tourApi';
import { WS_BASE_URL, WsClose, retryDelay, serverNow, syncServerClock } from './websocket';
import type { IceServers, TourConnectionState, TourEndReason, TourRole } from '../types';

// 방문자 송출 상한. P2P는 시청자마다 영상을 따로 올려서 인원이 늘수록 업로드가 커진다 (PRD R7).
const MAX_VIDEO_BITRATE = 1_000_000;
const STATS_INTERVAL_MS = 2000;
// TURN 자격증명이 만료되기 이만큼 전에 새로 받는다 (NFR-009)
const ICE_REFRESH_MARGIN_MS = 60_000;

// 선택된 ICE 후보 쌍으로 본 연결 방식: 같은 네트워크 직접 / STUN으로 찾은 주소로 직접(P2P) / TURN 중계
export type PeerRoute = 'host' | 'stun' | 'relay';

export interface PeerSnapshot {
  userId: number;
  state: RTCPeerConnectionState;
  route: PeerRoute | null;
  rttMs: number | null;
  // 지금 연결이 맺어진 시각(ms). 끊겨 있으면 null
  connectedAt: number | null;
  // 연결됐다가 끊긴 횟수
  disconnects: number;
  // 마지막으로 끊겼다가 다시 연결되기까지 걸린 시간(ms) (PRD M8)
  lastReconnectMs: number | null;
}

// 'UNKNOWN': 다시 접속하려는데 투어가 이미 끝나 있었다(종료 통지를 못 받음)
export type TourEndState = TourEndReason | 'UNKNOWN';

export interface TourSnapshot {
  signaling: 'connecting' | 'joined' | 'reconnecting' | 'closed';
  visitorUserId: number | null;
  // 시청자가 받는 방문자 영상·음성
  remoteStream: MediaStream | null;
  peers: PeerSnapshot[];
  ended: TourEndState | null;
  // 다시 접속하지 않고 닫힌 이유: 투어에서 빠짐(4403) / 다른 탭에서 새로 접속(4409) / 잘못된 주소(4400)
  closed: 'removed' | 'replaced' | 'rejected' | null;
}

export interface TourConnectionOptions {
  tourId: number;
  role: TourRole;
  signalingPath: string;
  ice: IceServers;
  // 방문자만: 송출할 카메라·마이크
  localStream?: MediaStream;
  // ICE 후보를 TURN 중계로만 제한한다 (TURN 강제 시험)
  forceRelay?: boolean;
  // 연결 방식·RTT를 주기적으로 잰다 (측정 표시용)
  collectStats?: boolean;
  // 참여자 입·퇴장·연결 상태가 바뀌었다 (투어 상태를 다시 조회할 때 쓴다)
  onRoomChange?: () => void;
}

// 시그널링 소켓 메시지의 data (Backend SignalingSocketHandler)
interface JoinedData {
  visitorUserId: number;
  peers: { userId: number; role: TourRole }[];
}
interface PeerData {
  userId: number;
  role?: TourRole;
}
interface SdpData {
  fromUserId: number;
  sdp: string;
}
interface CandidateData {
  fromUserId: number;
  candidate: RTCIceCandidateInit;
}

interface Peer {
  pc: RTCPeerConnection;
  // 상대 SDP를 받기 전에 도착한 ICE 후보
  pendingCandidates: RTCIceCandidateInit[];
}

// 실시간 투어 한 번의 WebRTC 연결 (TOUR, SIG-01~05).
// 방문자가 시청자마다 RTCPeerConnection을 하나씩 열어 영상을 보내고(방문자 → 시청자 별 모양 P2P), 시청자는 받기만 한다.
// offer는 방문자만 만든다 — 입장 응답(JOINED)의 기존 시청자와 새로 들어온 시청자(PEER_JOINED)에게.
// 영상은 서버를 거치지 않고, 시그널링 소켓은 연결 정보(SDP·ICE)만 상대에게 전한다.
export class TourConnection {
  private readonly options: TourConnectionOptions;
  private localStream: MediaStream | null;
  private iceServers: RTCIceServer[];
  private socket: WebSocket | null = null;
  private readonly peers = new Map<number, Peer>();
  private readonly metrics = new Map<number, PeerSnapshot>();
  // 연결이 끊긴 시각 (다시 연결되면 재연결 시간을 잰다)
  private readonly lostAt = new Map<number, number>();
  // 시그널링 방에 들어와 있는 다른 참여자
  private readonly roomUserIds = new Set<number>();
  private visitorUserId: number | null = null;
  private remoteStream: MediaStream | null = null;
  private signaling: TourSnapshot['signaling'] = 'connecting';
  private ended: TourEndState | null = null;
  private closedReason: TourSnapshot['closed'] = null;
  private reportedState: TourConnectionState | null = null;
  private attempt = 0;
  private stopped = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private iceTimer: ReturnType<typeof setTimeout> | undefined;
  private statsTimer: ReturnType<typeof setInterval> | undefined;
  private readonly listeners = new Set<() => void>();
  private snapshot: TourSnapshot;

  constructor(options: TourConnectionOptions) {
    this.options = options;
    this.localStream = options.localStream ?? null;
    this.iceServers = options.ice.iceServers;
    this.snapshot = this.buildSnapshot();
    this.scheduleIceRefresh(options.ice.expiresAt);
    if (options.collectStats) {
      this.statsTimer = setInterval(() => void this.collectStats(), STATS_INTERVAL_MS);
    }
    this.open();
  }

  // useSyncExternalStore용
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  // 방문자: 카메라를 바꾸면 모든 시청자에게 보내는 영상만 바꿔 끼운다(다시 연결하지 않음).
  async replaceVideoTrack(track: MediaStreamTrack, stream: MediaStream) {
    this.localStream = stream;
    await Promise.all(
      [...this.peers.values()].flatMap(({ pc }) =>
        pc
          .getSenders()
          .filter((sender) => sender.track?.kind === 'video')
          .map((sender) => sender.replaceTrack(track)),
      ),
    );
  }

  close() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearTimeout(this.iceTimer);
    clearInterval(this.statsTimer);
    this.socket?.close(1000);
    this.socket = null;
    this.peers.forEach(({ pc }) => pc.close());
    this.peers.clear();
    this.listeners.clear();
  }

  private open() {
    const accessToken = getTokens()?.accessToken;
    if (this.stopped || !accessToken) return;
    // 브라우저 WebSocket은 헤더를 붙일 수 없어서 토큰을 쿼리로 보낸다.
    const ws = new WebSocket(
      `${WS_BASE_URL}${this.options.signalingPath}&token=${encodeURIComponent(accessToken)}`,
    );
    this.socket = ws;
    ws.onopen = () => {
      this.attempt = 0;
      this.send('JOIN');
    };
    ws.onmessage = (event) => this.handleMessage(event.data as string);
    ws.onclose = (event) => {
      if (this.socket === ws) this.handleClose(event.code, accessToken);
    };
  }

  private handleClose(code: number, accessToken: string) {
    this.socket = null;
    // 다시 들어가면 서버가 연결 중(CONNECTING)으로 되돌리므로 상태도 다시 보고한다.
    this.reportedState = null;
    if (this.stopped) return;
    switch (code) {
      case WsClose.UNAUTHORIZED:
        forceLogout();
        return;
      case WsClose.TOKEN_EXPIRED:
        refreshTokens(accessToken).then(() => this.open(), (error: unknown) => {
          if (!this.stopped && !isCancel(error)) forceLogout();
        });
        return;
      case WsClose.NOT_FOUND:
        this.ended ??= 'UNKNOWN';
        this.shutdown();
        return;
      case WsClose.FORBIDDEN:
        this.closedReason = 'removed';
        this.shutdown();
        return;
      case WsClose.REPLACED:
        this.closedReason = 'replaced';
        this.shutdown();
        return;
      case WsClose.BAD_REQUEST:
        this.closedReason = 'rejected';
        this.shutdown();
        return;
      default:
        // 서버 재시작·네트워크 변경 등. 다시 들어가면 JOINED부터 연결을 새로 맺는다.
        this.signaling = 'reconnecting';
        this.emit();
        this.retryTimer = setTimeout(() => this.open(), retryDelay(this.attempt++));
    }
  }

  // 투어가 끝났거나 이 연결로는 더 참여할 수 없다. 다시 접속하지 않는다.
  private shutdown() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearTimeout(this.iceTimer);
    clearInterval(this.statsTimer);
    this.peers.forEach(({ pc }) => pc.close());
    this.peers.clear();
    this.remoteStream = null;
    this.signaling = 'closed';
    this.emit();
  }

  private handleMessage(raw: string) {
    let message: { type: string; data: unknown; sentAt?: string };
    try {
      message = JSON.parse(raw) as { type: string; data: unknown; sentAt?: string };
    } catch {
      return;
    }
    syncServerClock(message.sentAt);
    switch (message.type) {
      case 'JOINED':
        this.onJoined(message.data as JoinedData);
        return;
      case 'PEER_JOINED': {
        const { userId, role } = message.data as PeerData;
        this.roomUserIds.add(userId);
        if (this.options.role === 'VISITOR' && role === 'VIEWER') void this.offerTo(userId);
        this.options.onRoomChange?.();
        return;
      }
      case 'PEER_LEFT': {
        const { userId } = message.data as PeerData;
        this.roomUserIds.delete(userId);
        this.closePeer(userId);
        if (userId === this.visitorUserId) this.remoteStream = null;
        this.emit();
        this.options.onRoomChange?.();
        return;
      }
      case 'PEER_STATE':
        this.options.onRoomChange?.();
        return;
      case 'OFFER': {
        const { fromUserId, sdp } = message.data as SdpData;
        void this.answerTo(fromUserId, sdp);
        return;
      }
      case 'ANSWER': {
        const { fromUserId, sdp } = message.data as SdpData;
        void this.acceptAnswer(fromUserId, sdp);
        return;
      }
      case 'ICE_CANDIDATE': {
        const { fromUserId, candidate } = message.data as CandidateData;
        void this.addCandidate(fromUserId, candidate);
        return;
      }
      case 'TOUR_ENDED':
        // 이어서 서버가 4404로 닫는다.
        this.ended = (message.data as { reason: TourEndReason }).reason;
        this.shutdown();
        return;
      // ERROR: 상대가 방금 나가 중계하지 못한(PEER_NOT_FOUND) 경우 등. PEER_LEFT로 정리되므로 따로 처리하지 않는다.
    }
  }

  // SIG-01 입장. 방문자는 이미 들어와 있는 시청자 모두에게 연결을 새로 맺는다(재접속 포함).
  private onJoined({ visitorUserId, peers }: JoinedData) {
    this.visitorUserId = visitorUserId;
    this.signaling = 'joined';
    this.roomUserIds.clear();
    peers.forEach((peer) => this.roomUserIds.add(peer.userId));
    if (this.options.role === 'VISITOR') {
      // 카메라를 켜고 방에 들어왔으면 송출 중이다. 시청자에게 "방문자 연결 끊김"이 풀린다.
      this.report('CONNECTED');
      peers.filter((peer) => peer.role === 'VIEWER').forEach((peer) => void this.offerTo(peer.userId));
    } else {
      this.report('CONNECTING');
    }
    this.emit();
    this.options.onRoomChange?.();
  }

  // 방문자 → 시청자 offer (SIG-02·03)
  private async offerTo(userId: number) {
    const stream = this.localStream;
    if (!stream || !this.roomUserIds.has(userId)) return;
    const pc = this.createPeer(userId);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    try {
      await pc.setLocalDescription(await pc.createOffer());
      this.limitVideoBitrate(pc);
      this.send('OFFER', { targetUserId: userId, sdp: pc.localDescription?.sdp });
    } catch {
      // 그사이 상대가 나가 연결을 정리했다.
    }
  }

  // 시청자: 방문자의 offer에 answer. 새 offer가 오면(방문자 재접속·연결 실패) 연결을 새로 맺는다.
  private async answerTo(fromUserId: number, sdp: string) {
    if (this.options.role !== 'VIEWER') return;
    const pc = this.createPeer(fromUserId);
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp });
      await this.flushCandidates(fromUserId, pc);
      await pc.setLocalDescription(await pc.createAnswer());
      this.send('ANSWER', { targetUserId: fromUserId, sdp: pc.localDescription?.sdp });
    } catch {
      // 그사이 더 새 offer로 연결을 바꿨다.
    }
  }

  private async acceptAnswer(fromUserId: number, sdp: string) {
    const peer = this.peers.get(fromUserId);
    if (!peer || peer.pc.signalingState !== 'have-local-offer') return;
    try {
      await peer.pc.setRemoteDescription({ type: 'answer', sdp });
      await this.flushCandidates(fromUserId, peer.pc);
    } catch {
      // 오래된 answer
    }
  }

  private async addCandidate(fromUserId: number, candidate: RTCIceCandidateInit) {
    const peer = this.peers.get(fromUserId);
    if (!peer) return;
    if (!peer.pc.remoteDescription) {
      peer.pendingCandidates.push(candidate);
      return;
    }
    await peer.pc.addIceCandidate(candidate).catch(() => {});
  }

  private async flushCandidates(userId: number, pc: RTCPeerConnection) {
    const peer = this.peers.get(userId);
    if (!peer || peer.pc !== pc) return;
    const pending = peer.pendingCandidates.splice(0);
    await Promise.all(pending.map((candidate) => pc.addIceCandidate(candidate).catch(() => {})));
  }

  private createPeer(userId: number): RTCPeerConnection {
    this.peers.get(userId)?.pc.close();
    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceTransportPolicy: this.options.forceRelay ? 'relay' : 'all',
    });
    this.peers.set(userId, { pc, pendingCandidates: [] });
    // 연결 중이던 것을 새 연결로 바꾸면 그 사이 영상이 끊기므로 끊김으로 센다.
    const metrics = this.metricsOf(userId);
    if (metrics.state === 'connected') this.markLost(metrics, Date.now());
    metrics.state = 'new';
    const current = () => this.peers.get(userId)?.pc === pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && current()) {
        this.send('ICE_CANDIDATE', { targetUserId: userId, candidate: event.candidate.toJSON() });
      }
    };
    pc.onconnectionstatechange = () => {
      if (current()) this.onPeerState(userId, pc.connectionState);
    };
    pc.ontrack = (event) => {
      if (!current() || this.options.role !== 'VIEWER') return;
      const [stream] = event.streams;
      if (stream && stream !== this.remoteStream) {
        this.remoteStream = stream;
        this.emit();
      }
    };
    return pc;
  }

  private onPeerState(userId: number, state: RTCPeerConnectionState) {
    const metrics = this.metricsOf(userId);
    const now = Date.now();
    if (state === 'connected') {
      const lostAt = this.lostAt.get(userId);
      if (lostAt !== undefined) {
        metrics.lastReconnectMs = now - lostAt;
        this.lostAt.delete(userId);
      }
      metrics.connectedAt = now;
    } else if ((state === 'disconnected' || state === 'failed') && metrics.state === 'connected') {
      this.markLost(metrics, now);
    }
    metrics.state = state;

    // 시청자는 방문자와의 연결 상태를 보고한다 → 참여자 목록의 "연결됨/연결 끊김" (SIG-04)
    if (this.options.role === 'VIEWER' && userId === this.visitorUserId) {
      if (state === 'connected') this.report('CONNECTED');
      else if (state === 'failed') this.report('DISCONNECTED');
    }
    // 방문자는 연결에 실패한 시청자에게 연결을 새로 맺는다 (FR-054 자동 재연결)
    if (this.options.role === 'VISITOR' && state === 'failed') void this.offerTo(userId);
    this.emit();
  }

  // 상대가 나갔다(PEER_LEFT). 다시 들어오면 재연결 시간을 잴 수 있게 지표는 남긴다.
  private closePeer(userId: number) {
    const peer = this.peers.get(userId);
    if (!peer) return;
    peer.pc.close();
    this.peers.delete(userId);
    const metrics = this.metricsOf(userId);
    if (metrics.state === 'connected') this.markLost(metrics, Date.now());
    metrics.state = 'closed';
  }

  private markLost(metrics: PeerSnapshot, now: number) {
    metrics.disconnects += 1;
    metrics.connectedAt = null;
    this.lostAt.set(metrics.userId, now);
  }

  private metricsOf(userId: number): PeerSnapshot {
    let metrics = this.metrics.get(userId);
    if (!metrics) {
      metrics = {
        userId,
        state: 'new',
        route: null,
        rttMs: null,
        connectedAt: null,
        disconnects: 0,
        lastReconnectMs: null,
      };
      this.metrics.set(userId, metrics);
    }
    return metrics;
  }

  // SIG-04 내 연결 상태를 서버에 알린다. 같은 상태는 다시 보내지 않는다.
  private report(state: TourConnectionState) {
    if (this.reportedState === state) return;
    this.reportedState = state;
    this.send('CONNECTION_STATE', { state });
  }

  private send(type: string, data?: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, data }));
    }
  }

  private limitVideoBitrate(pc: RTCPeerConnection) {
    pc.getSenders()
      .filter((sender) => sender.track?.kind === 'video')
      .forEach((sender) => {
        const params = sender.getParameters();
        if (!params.encodings?.length) params.encodings = [{}];
        params.encodings[0].maxBitrate = MAX_VIDEO_BITRATE;
        sender.setParameters(params).catch(() => {});
      });
  }

  // TURN 자격증명은 시간 제한이 있어 만료 전에 새로 받아 이후 연결부터 쓴다 (TOUR-02 보조)
  private scheduleIceRefresh(expiresAt: string) {
    const delay = parseInstant(expiresAt) - serverNow() - ICE_REFRESH_MARGIN_MS;
    if (Number.isNaN(delay)) return;
    this.iceTimer = setTimeout(
      () => {
        getIceServers(this.options.tourId)
          .then((ice) => {
            if (this.stopped) return;
            this.iceServers = ice.iceServers;
            this.peers.forEach(({ pc }) =>
              pc.setConfiguration({ ...pc.getConfiguration(), iceServers: ice.iceServers }),
            );
            this.scheduleIceRefresh(ice.expiresAt);
          })
          .catch(() => {
            // 다음 연결에서 서버가 다시 준다.
          });
      },
      Math.min(Math.max(delay, 0), 2 ** 31 - 1),
    );
  }

  // 측정 표시용: 지금 쓰는 후보 쌍으로 연결 방식(P2P/TURN)과 RTT를 잰다.
  private async collectStats() {
    let changed = false;
    await Promise.all(
      [...this.peers].map(async ([userId, { pc }]) => {
        if (pc.connectionState !== 'connected') return;
        const stats = await pc.getStats();
        const reports: RTCStats[] = [];
        stats.forEach((report: RTCStats) => reports.push(report));
        // Chrome은 transport에 선택된 쌍을 알려주고, 아니면 지명(nominated)돼 성공한 쌍을 쓴다.
        const selectedId = reports
          .filter((report) => report.type === 'transport')
          .map((report) => (report as RTCTransportStats).selectedCandidatePairId)
          .find(Boolean);
        const pair = (
          selectedId
            ? stats.get(selectedId)
            : reports.find((report) => {
                const candidatePair = report as RTCIceCandidatePairStats;
                return (
                  report.type === 'candidate-pair' &&
                  candidatePair.nominated &&
                  candidatePair.state === 'succeeded'
                );
              })
        ) as RTCIceCandidatePairStats | undefined;
        if (!pair) return;
        const types = [pair.localCandidateId, pair.remoteCandidateId].map(
          (id) => (stats.get(id) as { candidateType?: string } | undefined)?.candidateType,
        );
        const route: PeerRoute = types.includes('relay')
          ? 'relay'
          : types.some((type) => type === 'srflx' || type === 'prflx')
            ? 'stun'
            : 'host';
        const rttMs =
          pair.currentRoundTripTime !== undefined ? Math.round(pair.currentRoundTripTime * 1000) : null;
        const metrics = this.metricsOf(userId);
        if (metrics.route !== route || metrics.rttMs !== rttMs) {
          metrics.route = route;
          metrics.rttMs = rttMs;
          changed = true;
        }
      }),
    );
    if (changed) this.emit();
  }

  private emit() {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((listener) => listener());
  }

  private buildSnapshot(): TourSnapshot {
    return {
      signaling: this.signaling,
      visitorUserId: this.visitorUserId,
      remoteStream: this.remoteStream,
      peers: [...this.metrics.values()].map((peer) => ({ ...peer })),
      ended: this.ended,
      closed: this.closedReason,
    };
  }
}
