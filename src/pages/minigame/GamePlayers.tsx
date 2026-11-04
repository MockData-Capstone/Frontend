import Avatar from '../../components/Avatar';

export interface GamePlayerRow {
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
  // 이름 아래 상태 (선택 완료, 참여 중, 제외 등)
  status: string;
  // 오른쪽 표시 (나, 참가자, 멤버)
  tag: string;
}

// 20·21 오른쪽 패널의 참가자 목록 한 묶음
export default function GamePlayers({ rows }: { rows: GamePlayerRow[] }) {
  return (
    <ul className="minigame-players">
      {rows.map((row) => (
        <li key={row.userId} className="minigame-player">
          <Avatar nickname={row.nickname} profileImageUrl={row.profileImageUrl} />
          <span className="minigame-player__text">
            <span className="minigame-player__name">{row.nickname}</span>
            {row.status && <span className="minigame-player__status">{row.status}</span>}
          </span>
          <span className="minigame-player__tag">{row.tag}</span>
        </li>
      ))}
    </ul>
  );
}
