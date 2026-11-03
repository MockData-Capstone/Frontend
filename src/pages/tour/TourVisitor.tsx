import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../app/providers/useAuth';
import { getErrorCode, getErrorMessage } from '../../lib/authApi';
import { devFlags } from '../../lib/devFlags';
import { parseInstant } from '../../lib/time';
import { endTour, getCurrentTour, rejoinTour, startTour } from '../../lib/tourApi';
import { TourConnection } from '../../lib/webrtc';
import type { Tour, TourJoin } from '../../types';
import ConnectionStats from './ConnectionStats';
import { endNotice, formatElapsed } from './format';
import { useNow, useTourSnapshot } from './useTour';
import './Tour.css';

type Facing = 'environment' | 'user';
// preparing: 카메라·투어 준비 중 / live: 송출 중 / denied: 카메라 권한 거부 / unsupported: HTTPS가 아니라 카메라를 못 씀
type Phase = 'preparing' | 'live' | 'denied' | 'unsupported' | 'error';

// 휴대폰 세로 화면 기준 720p. 시청자가 늘수록 업로드가 커져 상한을 둔다 (PRD R7).
const videoConstraints = (facing: Facing): MediaTrackConstraints => ({
  facingMode: { ideal: facing },
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 24, max: 30 },
});

// 카메라 권한은 HTTPS(또는 localhost)에서만 요청할 수 있다 (NFR-011)
const canUseCamera = () => window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);

const stopStream = (stream: MediaStream | null) => stream?.getTracks().forEach((track) => track.stop());

function cameraErrorMessage(err: unknown): string | null {
  if (!(err instanceof DOMException)) return null;
  switch (err.name) {
    case 'NotFoundError':
    case 'OverconstrainedError':
      return '사용할 수 있는 카메라를 찾지 못했어요.';
    case 'NotReadableError':
      return '다른 앱이 카메라를 쓰고 있어요. 그 앱을 닫고 다시 시도해 주세요.';
    default:
      return null;
  }
}

// 진행 중인 내 투어가 있으면 다시 들어가고(TOUR-05), 없으면 새로 시작한다(TOUR-01).
async function startOrRejoin(workspaceId: number, meId: number): Promise<TourJoin> {
  const current = await getCurrentTour(workspaceId);
  if (current?.visitor.userId === meId) return rejoinTour(current.tourId);
  try {
    return await startTour(workspaceId);
  } catch (err) {
    // 다른 탭·기기에서 방금 시작했다.
    if (getErrorCode(err) === 'TOUR_IN_PROGRESS') {
      const started = await getCurrentTour(workspaceId);
      if (started?.visitor.userId === meId) return rejoinTour(started.tourId);
    }
    throw err;
  }
}

export default function TourVisitorPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return <TourVisitor key={workspaceId} workspaceId={Number(workspaceId)} />;
}

// 24 방문자 모바일 송출 (TOUR-01·04·05, SIG, UI v0.4 §6 390×844). 그룹 헤더 없이 전체 화면으로 띄운다.
// 카메라 권한을 받은 뒤 투어를 시작하고, 시청자마다 P2P로 영상·음성을 보낸다.
function TourVisitor({ workspaceId }: { workspaceId: number }) {
  const { me } = useAuth();
  const meId = me?.id ?? null;
  const listPath = `/workspaces/${workspaceId}/candidates`;
  const gamePath = `/workspaces/${workspaceId}/minigame`;

  const [phase, setPhase] = useState<Phase>(() => (canUseCamera() ? 'preparing' : 'unsupported'));
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connection, setConnection] = useState<TourConnection | null>(null);
  const [tour, setTour] = useState<Tour | null>(null);
  const [facing, setFacing] = useState<Facing>('environment');
  const [micOn, setMicOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const snapshot = useTourSnapshot(connection);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (meId === null || !canUseCamera()) return;
    let cancelled = false;
    let opened: MediaStream | null = null;
    let created: TourConnection | null = null;
    // StrictMode가 effect를 두 번 돌려도 카메라·투어 시작이 한 번만 되도록 한 틱 미룬다.
    const timer = setTimeout(async () => {
      try {
        opened = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints('environment'),
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        // 권한 창을 기다리는 사이 화면을 떠났으면 바로 끈다(정리 함수는 이미 지나갔다).
        if (cancelled) {
          stopStream(opened);
          return;
        }
        const join = await startOrRejoin(workspaceId, meId);
        if (cancelled) {
          stopStream(opened);
          return;
        }
        created = new TourConnection({
          tourId: join.tour.tourId,
          role: 'VISITOR',
          signalingPath: join.signalingPath,
          ice: join.ice,
          localStream: opened,
          forceRelay: devFlags.relay,
          collectStats: devFlags.debug,
        });
        setStream(opened);
        setConnection(created);
        setTour(join.tour);
        setPhase('live');
      } catch (err) {
        stopStream(opened);
        if (cancelled) return;
        if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
          setPhase('denied');
          return;
        }
        setError(cameraErrorMessage(err) ?? getErrorMessage(err, '집보기를 시작하지 못했어요.'));
        setPhase('error');
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      created?.close();
      // 카메라를 바꿔도 같은 MediaStream에 트랙을 바꿔 끼우므로 여기서 모두 끈다.
      stopStream(opened);
    };
  }, [workspaceId, meId, attempt]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) video.play().catch(() => {});
  }, [stream]);

  const ended = snapshot?.ended ?? null;

  // 끝나면 카메라·마이크를 바로 끈다.
  useEffect(() => {
    if (ended) stopStream(stream);
  }, [ended, stream]);

  // 송출하는 동안 화면이 꺼지지 않게 한다. 화면이 꺼지면 카메라가 멈춰 투어가 끊긴다.
  const broadcasting = phase === 'live' && !ended;
  useEffect(() => {
    if (!broadcasting || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    const request = () => {
      navigator.wakeLock
        .request('screen')
        .then((sentinel) => {
          if (released) sentinel.release().catch(() => {});
          else lock = sentinel;
        })
        .catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [broadcasting]);

  const now = useNow(broadcasting);

  const retry = () => {
    setError(null);
    setPhase('preparing');
    setAttempt((value) => value + 1);
  };

  const toggleMic = () => {
    const track = stream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  };

  // 휴대폰은 카메라를 하나씩만 열 수 있어 지금 카메라를 끄고 반대쪽을 켠다. 시청자와는 다시 연결하지 않는다.
  const switchCamera = async () => {
    if (!stream || !connection) return;
    const next: Facing = facing === 'environment' ? 'user' : 'environment';
    const previous = stream.getVideoTracks()[0];
    setBusy(true);
    setError(null);
    previous?.stop();
    if (previous) stream.removeTrack(previous);
    const attach = async (target: Facing) => {
      const opened = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(target) });
      const track = opened.getVideoTracks()[0];
      stream.addTrack(track);
      await connection.replaceVideoTrack(track, stream);
      setFacing(target);
    };
    try {
      await attach(next);
    } catch {
      await attach(facing).catch(() => setError('카메라를 다시 켜지 못했어요.'));
    } finally {
      const video = videoRef.current;
      if (video) {
        video.srcObject = null;
        video.srcObject = stream;
        video.play().catch(() => {});
      }
      setBusy(false);
    }
  };

  const handleEnd = async () => {
    if (!tour || !window.confirm('집보기를 끝낼까요? 시청 중인 멤버의 연결도 모두 끊겨요.')) return;
    setBusy(true);
    setError(null);
    try {
      // 서버가 TOUR_ENDED를 보내면 종료 화면으로 바뀐다.
      await endTour(tour.tourId);
    } catch (err) {
      setError(getErrorMessage(err, '집보기를 끝내지 못했어요.'));
    } finally {
      setBusy(false);
    }
  };

  const viewerCount = snapshot?.peers.filter((peer) => peer.state === 'connected').length ?? 0;
  const reconnecting = snapshot?.signaling === 'reconnecting';
  const nicknameOf = (userId: number) =>
    tour?.participants.find((p) => p.userId === userId)?.nickname ?? `시청자 ${userId}`;

  let message: { title: string; text?: string } | null = null;
  if (ended) {
    message = { title: '집보기가 끝났어요', text: endNotice(ended, tour?.visitor.nickname ?? '', true) };
  } else if (snapshot?.closed === 'replaced') {
    message = { title: '다른 탭에서 송출을 이어가고 있어요', text: '이 화면의 연결은 끊었어요.' };
  } else if (phase === 'unsupported') {
    message = {
      title: '카메라를 켤 수 없어요',
      text: '보안 연결(HTTPS) 주소에서만 카메라를 쓸 수 있어요. https 주소로 접속해 주세요.',
    };
  } else if (phase === 'denied') {
    message = {
      title: '카메라 권한이 필요해요',
      text: '브라우저 주소창의 자물쇠(또는 사이트 설정)에서 카메라와 마이크를 "허용"으로 바꾼 뒤 다시 시도해 주세요.',
    };
  } else if (phase === 'error') {
    message = { title: '집보기를 시작하지 못했어요', text: error ?? undefined };
  }

  return (
    <div className="broadcast">
      <header className="broadcast__top">
        <span>
          {broadcasting && tour
            ? `진행 중 ${formatElapsed(Math.max(0, Math.floor((now - parseInstant(tour.startedAt)) / 1000)))}`
            : '집보기'}
        </span>
        <span>시청 {viewerCount}명</span>
      </header>

      {broadcasting && (
        <p className="broadcast__notice">촬영 전에 중개사·임대인의 동의를 확인해주세요.</p>
      )}
      {broadcasting && reconnecting && (
        <p className="broadcast__notice broadcast__notice--warn">
          연결이 끊겨 다시 연결하는 중이에요. 3분 안에 돌아오지 않으면 집보기가 끝나요.
        </p>
      )}
      {broadcasting && error && <p className="broadcast__notice broadcast__notice--warn">{error}</p>}

      <div className="broadcast__screen">
        <video
          ref={videoRef}
          className={`broadcast__video${facing === 'user' ? ' is-mirrored' : ''}`}
          autoPlay
          playsInline
          muted
          hidden={!broadcasting}
        />
        {message ? (
          <div className="broadcast__message">
            <p className="broadcast__message-title">{message.title}</p>
            {message.text && <p className="broadcast__message-text">{message.text}</p>}
            <div className="broadcast__message-actions">
              {phase === 'denied' && (
                <button type="button" className="button button--primary" onClick={retry}>
                  다시 시도
                </button>
              )}
              <Link to={ended ? listPath : gamePath} className="button button--secondary">
                {ended ? '후보지 목록으로' : '돌아가기'}
              </Link>
            </div>
          </div>
        ) : (
          !broadcasting && (
            <p className="broadcast__placeholder">
              {facing === 'environment' ? '후면' : '전면'} 카메라 연결 중
            </p>
          )
        )}
        {devFlags.debug && snapshot && <ConnectionStats snapshot={snapshot} nicknameOf={nicknameOf} />}
      </div>

      <footer className="broadcast__controls">
        <button
          type="button"
          className="broadcast__control"
          onClick={toggleMic}
          disabled={!broadcasting}
          aria-pressed={!micOn}
        >
          <span className="broadcast__control-icon">
            <MicIcon off={!micOn} />
          </span>
          <span>{micOn ? '마이크' : '마이크 꺼짐'}</span>
        </button>
        <button
          type="button"
          className="broadcast__control"
          onClick={switchCamera}
          disabled={!broadcasting || busy}
        >
          <span className="broadcast__control-icon">
            <CameraIcon />
          </span>
          <span>카메라 전환</span>
        </button>
        <button
          type="button"
          className="broadcast__end"
          onClick={handleEnd}
          disabled={!broadcasting || busy}
        >
          집보기 종료
        </button>
      </footer>
    </div>
  );
}

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function MicIcon({ off }: { off: boolean }) {
  return (
    <svg {...iconProps}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  );
}
