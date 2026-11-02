// 백엔드 DTO 소스(feature/candidate 브랜치) 기준 — 노션 API명세서와 다른 곳이 있다.

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

// CAND-02·VOTE-02 — CandidateResponse.votes
export interface VoteSummary {
  agreeCount: number;
  disagreeCount: number;
  split: boolean;
  myChoice: 'AGREE' | 'DISAGREE' | null;
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
