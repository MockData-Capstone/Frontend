// 백엔드 Instant(UTC 문자열) → epoch ms. 소수점 아래가 4자리 이상이면 못 읽는 브라우저가 있어 밀리초까지만 남긴다.
export function parseInstant(value: string): number {
  return Date.parse(value.replace(/(\.\d{3})\d+/, '$1'));
}
