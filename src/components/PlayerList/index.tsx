import Avatar from '../Avatar';
import './PlayerList.css';

export interface PlayerRow {
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
  // 이름 아래 상태 (선택 완료, 참여 중, 연결됨 등)
  status: string;
  // 오른쪽 표시 (나, 참가자, 방문자, 시청자 등)
  tag: string;
}

// 미니게임(20·21)·실시간 집보기(23) 오른쪽 패널의 멤버 목록
export default function PlayerList({ rows }: { rows: PlayerRow[] }) {
  return (
    <ul className="player-list">
      {rows.map((row) => (
        <li key={row.userId} className="player-list__item">
          <Avatar nickname={row.nickname} profileImageUrl={row.profileImageUrl} />
          <span className="player-list__text">
            <span className="player-list__name">{row.nickname}</span>
            {row.status && <span className="player-list__status">{row.status}</span>}
          </span>
          <span className="player-list__tag">{row.tag}</span>
        </li>
      ))}
    </ul>
  );
}
