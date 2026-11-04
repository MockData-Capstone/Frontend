import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/useAuth';
import { useWorkspace } from '../../app/providers/useWorkspace';
import PlayerList, { type PlayerRow } from '../../components/PlayerList';
import { getErrorMessage } from '../../lib/authApi';
import { devFlags } from '../../lib/devFlags';
import { parseInstant } from '../../lib/time';
import { getCurrentTour, joinTour, leaveTour } from '../../lib/tourApi';
import { TourConnection } from '../../lib/webrtc';
import { getMembers } from '../../lib/workspaceApi';
import type { Tour, WorkspaceMember } from '../../types';
import ConnectionStats from './ConnectionStats';
import { connectionLabel, endNotice, formatElapsed } from './format';
import { useNow, useTourSnapshot } from './useTour';
import './Tour.css';

// 23 실시간 집보기 시청 (TOUR-02·03·04, SIG-01~05, UI v0.4 §6).
// 방문자 영상을 P2P(안 되면 TURN)로 받는다. 끝나거나 나가면 후보지 목록으로 간다(그룹 홈 11 대신, UI명세 Q10).
export default function TourViewerPage() {
  const { workspace } = useWorkspace();
  const { me } = useAuth();
  const meId = me?.id ?? null;
  const navigate = useNavigate();
  const listPath = `/workspaces/${workspace.id}/candidates`;

  // undefined: 불러오는 중, null: 진행 중인 집보기 없음
  const [tour, setTour] = useState<Tour | null | undefined>(undefined);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [connection, setConnection] = useState<TourConnection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const snapshot = useTourSnapshot(connection);
  const screenRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    getMembers(workspace.id)
      .then((list) => {
        if (!cancelled) setMembers(list);
      })
      .catch(() => {});
    getCurrentTour(workspace.id)
      .then((current) => {
        if (!cancelled) setTour(current);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, '집보기 정보를 불러오지 못했어요.'));
      });
    return () => {
      cancelled = true;
    };
  }, [workspace.id]);

  // 참여자 입·퇴장·연결 상태가 바뀌면 목록을 다시 받는다. 끝난 뒤(null)에는 마지막 모습을 그대로 둔다.
  const refreshTour = useEffectEvent(() => {
    getCurrentTour(workspace.id)
      .then((current) => {
        if (current) setTour(current);
      })
      .catch(() => {});
  });

  const tourId = tour?.tourId ?? null;
  const isVisitor = Boolean(tour && tour.visitor.userId === meId);

  useEffect(() => {
    if (tourId === null || meId === null || isVisitor) return;
    let cancelled = false;
    let created: TourConnection | null = null;
    // StrictMode가 effect를 두 번 돌려도 참여·연결이 한 번만 되도록 한 틱 미룬다.
    const timer = setTimeout(() => {
      joinTour(tourId)
        .then((join) => {
          if (cancelled) return;
          created = new TourConnection({
            tourId,
            role: 'VIEWER',
            signalingPath: join.signalingPath,
            ice: join.ice,
            forceRelay: devFlags.relay,
            collectStats: devFlags.debug,
            onRoomChange: () => refreshTour(),
          });
          setConnection(created);
          setTour(join.tour);
        })
        .catch((err) => {
          if (!cancelled) setError(getErrorMessage(err, '집보기에 참여하지 못했어요.'));
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      created?.close();
    };
  }, [tourId, meId, isVisitor]);

  const stream = snapshot?.remoteStream ?? null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (!stream) return;
    // 소리가 있는 자동 재생이 막히면(주로 모바일) 음소거로 재생하고 [음소거 해제]로 소리를 켜게 한다.
    video.play().catch(() => {
      video.muted = true;
      setMuted(true);
      video.play().catch(() => {});
    });
  }, [stream]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const live = Boolean(tour) && !snapshot?.ended;
  const now = useNow(live);

  if (error && !tour) {
    return (
      <div className="tour">
        <p className="tour__error">{error}</p>
      </div>
    );
  }

  if (tour === undefined) {
    return (
      <div className="tour">
        <p className="tour__hint">불러오는 중...</p>
      </div>
    );
  }

  if (tour === null) {
    return (
      <div className="tour">
        <div className="tour__heading">
          <h1 className="tour__title">실시간 집보기</h1>
          <p className="tour__subtitle">지금 진행 중인 집보기가 없어요.</p>
        </div>
        <Link to={`/workspaces/${workspace.id}/minigame`} className="button button--secondary">
          집보기 화면으로
        </Link>
      </div>
    );
  }

  // 방문자는 송출 화면(24)에서 참여한다.
  if (isVisitor) {
    return <Navigate to={`/workspaces/${workspace.id}/tour/broadcast`} replace />;
  }

  const ended = snapshot?.ended ?? null;
  const nicknameOf = (userId: number) =>
    members.find((m) => m.userId === userId)?.nickname ??
    tour.participants.find((p) => p.userId === userId)?.nickname ??
    String(userId);

  // 방문자가 나가면 서버는 퇴장(PEER_LEFT)을 먼저 알리고 연결 끊김은 그 뒤에 저장한다 —
  // 다시 조회한 투어 상태가 늦을 수 있어 실제 연결도 같이 본다.
  const visitorPeer = snapshot?.peers.find((peer) => peer.userId === tour.visitor.userId);
  const visitorLive =
    tour.visitorConnected && visitorPeer?.state !== 'closed' && visitorPeer?.state !== 'failed';

  let placeholder: string | null = null;
  if (snapshot?.closed === 'removed') placeholder = '집보기에서 빠졌어요.';
  else if (snapshot?.closed === 'replaced')
    placeholder = '다른 탭에서 집보기를 열어 이 화면의 연결을 끊었어요.';
  else if (error) placeholder = '집보기에 참여하지 못했어요.';
  else if (snapshot?.signaling === 'reconnecting') placeholder = '연결이 끊겨 다시 연결하는 중이에요.';
  else if (!stream && snapshot?.signaling === 'joined' && !visitorLive)
    placeholder = '방문자 연결이 끊겼어요. 다시 연결되기를 기다리는 중이에요.';
  else if (!stream) placeholder = '영상 연결 중';

  const handleLeave = async () => {
    if (!ended) await leaveTour(tour.tourId).catch(() => {});
    connection?.close();
    navigate(listPath);
  };

  const enterFullscreen = () => {
    const screen = screenRef.current;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (screen?.requestFullscreen) screen.requestFullscreen().catch(() => {});
    else video?.webkitEnterFullscreen?.();
  };

  const participantIds = new Set(tour.participants.map((p) => p.userId));
  const profileImageOf = (userId: number) =>
    members.find((m) => m.userId === userId)?.profileImageUrl ?? null;
  // 내가 보고한 상태는 서버가 다른 참여자에게만 알려서, 내 줄은 방문자와의 실제 연결로 바로 보여준다.
  const myStatus = visitorPeer?.state === 'connected' ? '연결됨' : '연결 중';
  const rows: PlayerRow[] = [
    ...[...tour.participants]
      .sort((a, b) => Number(b.role === 'VISITOR') - Number(a.role === 'VISITOR'))
      .map((p) => ({
        userId: p.userId,
        nickname: p.nickname,
        profileImageUrl: profileImageOf(p.userId),
        status: ended
          ? '집보기 종료'
          : p.role === 'VISITOR'
            ? visitorLive
              ? '송출 중'
              : '연결 끊김'
            : p.userId === meId
              ? myStatus
              : connectionLabel(p.connectionState),
        tag: p.role === 'VISITOR' ? '방문자' : p.userId === meId ? '나' : '시청자',
      })),
    ...members
      .filter((m) => !participantIds.has(m.userId))
      .map((m) => ({
        userId: m.userId,
        nickname: m.nickname,
        profileImageUrl: m.profileImageUrl,
        status: '미참여',
        tag: '미참여',
      })),
  ];

  return (
    <div className="tour">
      <div className="tour__heading">
        <h1 className="tour__title">실시간 집보기</h1>
        <p className="tour__subtitle">
          {workspace.name} · {tour.visitor.nickname} 님이 현장에서 영상을 보내고 있어요.
        </p>
      </div>

      <div className="tour__columns">
        <section className="tour-stage">
          <div className="tour-stage__bar">
            <span>{tour.visitor.nickname}의 카메라</span>
            {live && (
              <span>
                진행 중{' '}
                {formatElapsed(Math.max(0, Math.floor((now - parseInstant(tour.startedAt)) / 1000)))}
              </span>
            )}
          </div>

          <div className="tour-stage__screen" ref={screenRef}>
            <video
              ref={videoRef}
              className="tour-stage__video"
              autoPlay
              playsInline
              hidden={!stream || Boolean(ended)}
            />
            {ended ? (
              <div className="tour-stage__ended">
                <p className="tour-stage__ended-title">집보기가 끝났어요</p>
                <p className="tour-stage__ended-text">
                  {endNotice(ended, tour.visitor.nickname, false)}
                </p>
                <Link to={listPath} className="button button--secondary">
                  후보지 목록으로
                </Link>
              </div>
            ) : (
              placeholder && <p className="tour-stage__placeholder">{placeholder}</p>
            )}
            {devFlags.debug && snapshot && (
              <ConnectionStats snapshot={snapshot} nicknameOf={nicknameOf} />
            )}
          </div>

          <div className="tour-stage__actions">
            <button
              type="button"
              className="tour-stage__button"
              onClick={() => setMuted((value) => !value)}
              disabled={!stream || Boolean(ended)}
              aria-pressed={muted}
            >
              {muted ? '음소거 해제' : '음소거'}
            </button>
            <button
              type="button"
              className="tour-stage__button"
              onClick={enterFullscreen}
              disabled={!stream || Boolean(ended)}
            >
              전체 화면
            </button>
            <button type="button" className="tour-stage__button" onClick={handleLeave}>
              나가기
            </button>
          </div>
        </section>

        <aside className="tour__side">
          <section className="tour-card">
            <h2 className="tour-card__title">
              참여자 {tour.participantCount}명 · 그룹 멤버 {members.length}명
            </h2>
            <PlayerList rows={rows} />
          </section>

          {/* 시청자 → 방문자 요청 수단은 미결(PRD Q7)이고 백엔드 기능이 없어 시안대로 두되 비활성 */}
          <section className="tour-card tour-card--memo">
            <h2 className="tour-card__title">실시간 메모</h2>
            <p className="tour-card__hint">준비 중인 기능이에요.</p>
            <form className="tour-memo" onSubmit={(e) => e.preventDefault()}>
              <input
                className="tour-memo__input"
                placeholder="메모를 입력하세요"
                disabled
                title="준비 중인 기능이에요."
              />
              <button type="submit" className="tour-memo__send" disabled aria-label="메모 보내기">
                →
              </button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
