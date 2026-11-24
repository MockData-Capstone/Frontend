// 백엔드 DTO 소스(feature/candidate·feature/minigame·feature/signaling 브랜치) 기준 — 노션 API명세서와 다른 곳이 있다.

export interface MemberProfile {
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
}

export type WorkspaceRole = 'HOST' | 'MEMBER';

// WS-02 목록 항목 — GET /api/workspaces
export interface WorkspaceSummary {
  id: number;
  name: string;
  memberCount: number;
  myRole: WorkspaceRole;
  lastActivityAt: string;
}

// WS-02 상세 — GET /api/workspaces/{workspaceId}
export interface WorkspaceDetail {
  id: number;
  name: string;
  description: string | null;
  host: MemberProfile;
  memberCount: number;
  myRole: WorkspaceRole;
  createdAt: string;
}

// MEM-01 초대 링크. 프론트는 token으로 초대 링크 주소(/invite/{token})를 만든다.
export interface Invitation {
  token: string;
  expiresAt: string;
}

// MEM-02 보조 — 참여 확인 화면(04)용이라 로그인 없이 조회한다.
export interface InvitationPreview {
  workspaceName: string;
  hostNickname: string;
  memberCount: number;
  expiresAt: string;
}

// MEM-02 초대 수락. 이미 멤버였으면 alreadyMember가 true (등록하지 않고 바로 이동)
export interface AcceptInvitationResult {
  workspaceId: number;
  alreadyMember: boolean;
}

// MEM-03 멤버 목록 항목 — GET /api/workspaces/{workspaceId}/members
export interface WorkspaceMember {
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
  role: WorkspaceRole;
  joinedAt: string;
  // 지금 그룹 연결(Workspace 소켓)에 접속 중인지. 미니게임은 접속 중인 멤버만 참여할 수 있다(GAME-01).
  // 백엔드 feature/notification부터 온다 — 값이 없는 서버에서는 접속 중으로 본다.
  // 바뀌면 그룹 연결의 MEMBER_ONLINE·MEMBER_OFFLINE(MemberOnlineChangedData)으로 알려준다.
  online?: boolean;
}

// 그룹 연결 MEMBER_ONLINE·MEMBER_OFFLINE의 data. 같은 회원이 여러 탭이면 첫 연결·마지막 해제 때만 온다.
export interface MemberOnlineChangedData {
  userId: number;
}

// AUTH-04 — GET /api/users/me
export interface MeResponse {
  id: number;
  email: string | null;
  nickname: string;
  profileImageUrl: string | null;
  providers: ('LOCAL' | 'KAKAO' | 'GOOGLE')[];
  hasPassword: boolean;
}

export type SlopeGrade = 'GENTLE' | 'MODERATE' | 'STEEP';
export type VehicleAccess = 'POSSIBLE' | 'LIMITED' | 'IMPOSSIBLE' | 'UNKNOWN';

// LOC-03 — LocationResponse.Slope. 경로를 구하지 못했으면 averagePercent 등이 null("경로 정보 없음").
export interface SlopeInfo {
  averagePercent: number | null;
  maxPercent: number | null;
  grade: SlopeGrade | null;
  destination: string | null;
  source: string | null;
  estimated: boolean;
}

// LOC-03 — LocationResponse.Vehicle
export interface VehicleInfo {
  access: VehicleAccess;
  reason: string | null;
  source: string | null;
  estimated: boolean;
}

// LOC-03 — CandidateResponse.location. 산출 자체가 안 됐으면 slope/vehicleAccess가 null("정보 없음").
export interface LocationInfo {
  slope: SlopeInfo | null;
  vehicleAccess: VehicleInfo | null;
}

// VOTE — Backend vote/entity/VoteChoice
export type VoteChoice = 'AGREE' | 'DISAGREE';

// CAND-02·VOTE-02 — CandidateResponse.votes
export interface VoteSummary {
  agreeCount: number;
  disagreeCount: number;
  split: boolean;
  myChoice: VoteChoice | null;
}

// VOTE-03 — CandidateVotesResponse. 그룹 연결 VOTE_UPDATED의 data로도 온다.
// 통지는 받는 멤버마다 내 표가 달라 myChoice가 null이므로, 내 표는 votes에서 찾는다.
export interface CandidateVotes {
  candidateId: number;
  candidateName: string;
  agreeCount: number;
  disagreeCount: number;
  split: boolean;
  myChoice: VoteChoice | null;
  votes: { userId: number; nickname: string; profileImageUrl: string | null; choice: VoteChoice }[];
}

// 그룹 연결 CANDIDATE_UPDATED(이름 수정)·CANDIDATE_REMOVED의 data. CANDIDATE_ADDED는 Candidate 전체가 온다.
export interface CandidateRenamedData {
  candidateId: number;
  name: string;
}

export interface CandidateRemovedData {
  candidateId: number;
}

// CAND-02 — CandidateResponse (목록·상세 공용)
export interface Candidate {
  candidateId: number;
  name: string;
  placeName: string;
  latitude: number;
  longitude: number;
  kakaoPlaceId: string | null;
  recommendationId: number;
  addedBy: MemberProfile | null;
  createdAt: string;
  location: LocationInfo;
  votes: VoteSummary;
}

// GAME — Backend minigame/entity/GameEnums
export type GameType = 'ROULETTE' | 'ROCK_PAPER_SCISSORS';
// 가위바위보에서 다음 라운드에 남는 쪽. 마지막 1명이 방문자다.
export type VisitorRule = 'WINNER' | 'LOSER';
export type GameStatus = 'IN_PROGRESS' | 'FINISHED' | 'ABORTED';
export type AbortReason = 'STOPPED_BY_STARTER' | 'NOT_ENOUGH_PLAYERS' | 'WORKSPACE_DELETED';
// 진행 중 / 라운드에서 탈락 / 나감·연결 끊김으로 제외
export type PlayerStatus = 'PLAYING' | 'ELIMINATED' | 'LEFT';
export type Hand = 'ROCK' | 'PAPER' | 'SCISSORS';

export interface GamePlayer {
  userId: number;
  nickname: string;
}

export interface GameParticipant {
  userId: number;
  nickname: string;
  status: PlayerStatus;
  // 탈락하거나 빠진 라운드
  outRound: number | null;
}

export interface GameChoice {
  userId: number;
  nickname: string | null;
  choice: Hand;
  // 제한 시간 안에 내지 않아 서버가 무작위로 골랐다
  auto: boolean;
}

export interface GameRound {
  roundNo: number;
  // 세 가지가 모두 나오거나 전원이 같으면 무승부로 같은 멤버가 다시 한다
  draw: boolean;
  choices: GameChoice[];
  eliminatedUserIds: number[];
}

// GAME-03·05 — GameResponse. Workspace 소켓 GAME_STARTED의 data도 같다.
export interface MiniGame {
  gameId: number;
  workspaceId: number;
  type: GameType;
  visitorRule: VisitorRule | null;
  status: GameStatus;
  startedBy: GamePlayer;
  participants: GameParticipant[];
  // 가위바위보의 현재 라운드. 룰렛은 0
  currentRound: number;
  // 현재 라운드 제출 마감. 지나면 서버가 대신 고른다
  roundDeadline: string | null;
  // 현재 라운드에 낸 참가자. 무엇을 냈는지는 라운드가 끝나야 공개된다
  submittedUserIds: number[];
  // 끝난 라운드
  rounds: GameRound[];
  // 결과가 확정되기 전에는 null
  visitor: GamePlayer | null;
  abortReason: AbortReason | null;
  startedAt: string;
  finishedAt: string | null;
}

// SIG-06 미니게임 진행 통지의 data — Backend minigame/dto/GameEvents.
// ROUND_OPENED·ROUND_RESULT·GAME_PLAYER_LEFT는 화면이 게임을 다시 조회하므로 gameId만 쓴다.
export interface GameEventData {
  gameId: number;
}

export interface GamePlayerLeftData extends GameEventData {
  userId: number;
  nickname: string;
}

export interface GameFinishedData extends GameEventData {
  visitor: GamePlayer;
}

export interface GameAbortedData extends GameEventData {
  reason: AbortReason;
}

// TOUR — Backend tour/entity/TourEnums
export type TourStatus = 'IN_PROGRESS' | 'ENDED';
// 방문자가 종료 / 방문자가 대기 시간(3분) 안에 돌아오지 않음 / 방문자가 그룹을 나감 / 그룹 삭제
export type TourEndReason =
  | 'VISITOR_ENDED'
  | 'VISITOR_TIMEOUT'
  | 'VISITOR_LEFT_WORKSPACE'
  | 'WORKSPACE_DELETED';
// 방문자는 영상을 송출하고, 시청자는 받는다.
export type TourRole = 'VISITOR' | 'VIEWER';
// 참여자가 보고하는 WebRTC 연결 상태 (SIG-04)
export type TourConnectionState = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

export interface TourParticipant {
  userId: number;
  nickname: string;
  role: TourRole;
  connectionState: TourConnectionState;
  joinedAt: string;
}

// TOUR-03 — TourResponse. Workspace 소켓 TOUR_STARTED의 data도 같다.
export interface Tour {
  tourId: number;
  workspaceId: number;
  gameId: number;
  status: TourStatus;
  visitor: { userId: number; nickname: string };
  // false면 "방문자 연결 끊김"을 표시한다
  visitorConnected: boolean;
  // 지금 참여 중인 사람 (방문자 포함)
  participants: TourParticipant[];
  participantCount: number;
  maxParticipants: number;
  startedAt: string;
  endedAt: string | null;
  endReason: TourEndReason | null;
}

// TOUR-02 보조 — STUN·TURN 서버. TURN 자격증명은 expiresAt까지만 쓸 수 있다.
export interface IceServers {
  iceServers: { urls: string[]; username?: string; credential?: string }[];
  expiresAt: string;
}

// TOUR-01·02·05 시작·참여·재참여 응답. signalingPath 뒤에 &token=을 붙여 시그널링 소켓에 접속한다.
export interface TourJoin {
  tour: Tour;
  signalingPath: string;
  ice: IceServers;
}

// TOUR-06 — TourHistoryResponse
export interface TourHistoryItem {
  tourId: number;
  visitor: { userId: number; nickname: string };
  startedAt: string;
  endedAt: string | null;
  endReason: TourEndReason | null;
}

// Workspace 소켓·시그널링 소켓 TOUR_ENDED의 data
export interface TourEndedData {
  tourId: number;
  reason: TourEndReason;
}
