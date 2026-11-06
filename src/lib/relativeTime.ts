import { parseInstant } from './time';

// 시각 표시 (Guidelines 3절). 서버 UTC 문자열을 parseInstant로 읽어 한국 시간으로 보여준다.

const KOREA_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function koreaDate(ms: number) {
  const parts = Object.fromEntries(KOREA_PARTS.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// 1분 미만 "방금 전", 1시간 미만 "N분 전", 24시간 미만 "N시간 전", 어제 날짜면 "어제",
// 그 이전은 "M월 D일", 올해가 아니면 "YYYY년 M월 D일".
export function formatRelativeTime(value: string, now: number = Date.now()): string {
  const time = parseInstant(value);
  const diff = Math.max(0, now - time);
  if (diff < MINUTE) return '방금 전';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;

  const target = koreaDate(time);
  const yesterday = koreaDate(now - DAY);
  if (target.year === yesterday.year && target.month === yesterday.month && target.day === yesterday.day) {
    return '어제';
  }
  if (target.year === koreaDate(now).year) return `${target.month}월 ${target.day}일`;
  return `${target.year}년 ${target.month}월 ${target.day}일`;
}

// 정확한 시각: "M월 D일 HH:mm" (24시간제)
export function formatExactTime(value: string): string {
  const target = koreaDate(parseInstant(value));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${target.month}월 ${target.day}일 ${pad(target.hour)}:${pad(target.minute)}`;
}
