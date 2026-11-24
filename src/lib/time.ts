// 백엔드 Instant(UTC 문자열) → epoch ms. 소수점 아래가 4자리 이상이면 못 읽는 브라우저가 있어 밀리초까지만 남긴다.
export function parseInstant(value: string): number {
  return Date.parse(value.replace(/(\.\d{3})\d+/, '$1'));
}

const TIME_FORMAT = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' });
const DATE_FORMAT = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' });

// 채팅 시각. 오늘이면 "오후 3:20", 다른 날이면 "11월 15일 오후 3:20" (기기 시간대 기준)
export function formatChatTime(value: string, now: number = Date.now()): string {
  const time = parseInstant(value);
  if (Number.isNaN(time)) return '';
  const date = new Date(time);
  const text = TIME_FORMAT.format(date);
  return date.toDateString() === new Date(now).toDateString() ? text : `${DATE_FORMAT.format(date)} ${text}`;
}
