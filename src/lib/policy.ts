// 이용약관·개인정보 처리방침·화면 하단이 함께 쓰는 운영 정보.
// 문의 이메일과 개인정보 보호책임자는 아직 정하지 않아 비워 둔다. 비어 있으면 하단·처리방침에서 그 줄을 빼고,
// 정해지면 여기에만 넣으면 하단 운영 정보와 처리방침 제7·10조에 나타난다.
export const POLICY_INFO = {
  service: 'ZIPFIT',
  operator: 'ZIPFIT 팀(MockData)',
  operatorNote: '캡스톤 디자인 프로젝트',
  contactEmail: null as string | null,
  privacyOfficer: null as string | null,
  version: '1.0',
  effectiveDate: '2026년 11월 23일',
};

export type PolicyDoc = 'terms' | 'privacy';

export const POLICY_DOCS: Record<PolicyDoc, { title: string; path: string }> = {
  terms: { title: '이용약관', path: '/policy/terms' },
  privacy: { title: '개인정보 처리방침', path: '/policy/privacy' },
};

export function isPolicyDoc(value: string | undefined): value is PolicyDoc {
  return value === 'terms' || value === 'privacy';
}

// 가입 동의 (이메일 가입·카카오 첫 가입). 서버에는 개인정보 동의(privacyAgreed)만 보내고 나머지는 화면에서 확인한다.
export interface Consents {
  age: boolean;
  terms: boolean;
  privacy: boolean;
}

export const EMPTY_CONSENTS: Consents = { age: false, terms: false, privacy: false };

export function hasRequiredConsents(consents: Consents): boolean {
  return consents.age && consents.terms && consents.privacy;
}

export function privacyOfficerText(): string {
  return POLICY_INFO.privacyOfficer ? `${POLICY_INFO.privacyOfficer} (${POLICY_INFO.operator})` : POLICY_INFO.operator;
}
