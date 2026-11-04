import type {
  AbortReason,
  GameChoice,
  GamePlayer,
  GameRound,
  GameType,
  Hand,
  VisitorRule,
} from '../../types';

// 시안(20)의 카드 순서
export const HANDS: Hand[] = ['SCISSORS', 'ROCK', 'PAPER'];

export function handLabel(hand: Hand): string {
  switch (hand) {
    case 'SCISSORS':
      return '가위';
    case 'ROCK':
      return '바위';
    case 'PAPER':
      return '보';
  }
}

export function gameTypeLabel(type: GameType): string {
  return type === 'ROULETTE' ? '룰렛' : '가위바위보';
}

export function visitorRuleLabel(rule: VisitorRule): string {
  return rule === 'LOSER' ? '진 사람이 방문' : '이긴 사람이 방문';
}

// 19로 돌아갈 때 보여줄 중단 이유
export function abortNotice(reason: AbortReason, startedBy: GamePlayer, meId: number | null): string {
  switch (reason) {
    case 'STOPPED_BY_STARTER':
      return startedBy.userId === meId
        ? '게임을 중단했어요.'
        : `${startedBy.nickname} 님이 게임을 중단했어요.`;
    case 'NOT_ENOUGH_PLAYERS':
      return '참가자가 2명보다 적어져서 게임이 중단됐어요.';
    case 'WORKSPACE_DELETED':
      return '그룹이 삭제되어 게임이 중단됐어요.';
  }
}

const nameOf = (choice: GameChoice) => choice.nickname ?? '알 수 없음';

// 라운드에서 다음으로 남은 참가자 (낸 사람 중 탈락하지 않은 사람)
function survivorNames(round: GameRound): string[] {
  return round.choices.filter((c) => !round.eliminatedUserIds.includes(c.userId)).map(nameOf);
}

// 20 오른쪽 안내 박스: "라운드 1: 가위 2명 · 바위 2명" / "진 사람인 손지은, 김석현 님이 남았어요."
export function roundSummary(round: GameRound, rule: VisitorRule | null): string[] {
  const counts = HANDS.map((hand) => ({
    hand,
    count: round.choices.filter((c) => c.choice === hand).length,
  }))
    .filter(({ count }) => count > 0)
    .map(({ hand, count }) => `${handLabel(hand)} ${count}명`)
    .join(' · ');
  const lines = [`라운드 ${round.roundNo}: ${counts}`];

  if (round.draw) {
    lines.push('비겨서 같은 멤버가 다시 해요.');
  } else {
    const side = rule === 'WINNER' ? '이긴' : '진';
    const survivors = survivorNames(round);
    lines.push(
      survivors.length === 1
        ? `${side} 사람인 ${survivors[0]} 님이 방문자로 정해졌어요.`
        : `${side} 사람인 ${survivors.join(', ')} 님이 남았어요.`,
    );
  }

  const auto = round.choices.filter((c) => c.auto).map(nameOf);
  if (auto.length > 0) {
    lines.push(`시간 안에 고르지 않은 ${auto.join(', ')} 님은 무작위로 냈어요.`);
  }
  return lines;
}

// 22 라운드 기록 한 줄: "손지은·김석현 가위 / 표다은·황성민 바위"
export function roundHands(round: GameRound): string {
  return HANDS.map((hand) => round.choices.filter((c) => c.choice === hand).map(nameOf))
    .map((names, i) => (names.length > 0 ? `${names.join('·')} ${handLabel(HANDS[i])}` : null))
    .filter(Boolean)
    .join(' / ');
}
