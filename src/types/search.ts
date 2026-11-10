import type { LocationInfo, MemberProfile, VoteSummary } from './index';

export interface CursorPage<T> { items: T[]; nextCursor: string | null; hasNext: boolean }
export interface ChatMessage {
  messageId: number; workspaceId: number; clientMessageId: string;
  sender: MemberProfile | null; content: string | null; deleted: boolean; createdAt: string;
}
export type RoomType = 'ONE_ROOM' | 'TWO_ROOM' | 'THREE_ROOM_OR_MORE';
export interface HouseCondition {
  depositMin: number | null; depositMax: number | null;
  monthlyRentMin: number | null; monthlyRentMax: number | null;
  roomType: RoomType | null; areaMin: number | null; areaMax: number | null;
  avoidSlope: boolean | null; needVehicleAccess: boolean | null;
}
export interface ExtractedConditions extends HouseCondition {
  region: string | null; facilities: string[]; destinations: string[];
}
export interface Analysis {
  analysisId: number; status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  failure: string | null; failureMessage: string | null; conditions: ExtractedConditions | null;
  requestedAt: string; completedAt: string | null;
}
export interface Recommendation {
  recommendationId: number; placeName: string; latitude: number | null; longitude: number | null;
  reason: string; kakaoPlaceId: string | null; addedAsCandidate: boolean; candidateId: number | null;
}
export interface Recommendations { analysis: Analysis | null; items: Recommendation[] }
export interface SavedCondition extends HouseCondition { lastModifiedBy: MemberProfile; updatedAt: string }
export interface ConditionView { condition: SavedCondition | null; draft: HouseCondition | null }
export interface Suggestion {
  type: 'SLOPE' | 'VEHICLE_ACCESS'; message: string; accepted: boolean;
  evidence: { candidateId: number; candidateName: string; detail: string }[];
}
export interface ComparisonRow {
  candidateId: number; name: string; latitude: number | null; longitude: number | null;
  slope: LocationInfo['slope']; vehicleAccess: LocationInfo['vehicleAccess']; votes: VoteSummary;
}
export interface ComparisonResult { generatedAt: string; items: ComparisonRow[] }
export type ListingCondition = 'LOCATION' | 'DEPOSIT' | 'MONTHLY_RENT' | 'ROOM_TYPE' | 'AREA';
export interface ListingLinks {
  candidateId: number; region: string;
  links: { site: string; siteName: string; url: string; appliedConditions: ListingCondition[];
    excludedConditions: ListingCondition[]; fallback: boolean }[];
}
