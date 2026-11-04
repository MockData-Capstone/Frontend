// 측정·시험용 설정. 새로고침하면 로그아웃되므로 주소에 붙인 값을 이 브라우저에 기억해 둔다 —
// 로그인 화면 주소에 ?debug=1 이나 ?relay=1 을 붙여 열면 켜지고, =0 을 붙여 열면 꺼진다.
const STORAGE_KEYS = {
  debug: 'zipfit.debug',
  relay: 'zipfit.relay',
} as const;

function readFlag(name: keyof typeof STORAGE_KEYS): boolean {
  try {
    const value = new URLSearchParams(window.location.search).get(name);
    if (value === '1') localStorage.setItem(STORAGE_KEYS[name], '1');
    else if (value === '0') localStorage.removeItem(STORAGE_KEYS[name]);
    return localStorage.getItem(STORAGE_KEYS[name]) === '1';
  } catch {
    return false;
  }
}

export const devFlags = {
  // 23·24 구석에 연결 방식(P2P/TURN)·연결 시간·끊김 횟수·재연결 시간 표시 (PRD M7·M8, NFR-005 측정용)
  debug: readFlag('debug'),
  // ICE 후보를 TURN 중계로만 제한 (PRD 평가 방법의 TURN 강제 시험)
  relay: readFlag('relay'),
};
