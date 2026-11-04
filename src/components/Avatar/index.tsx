import './Avatar.css';

// 프로필 이미지가 없으면 성을 뺀 첫 글자를 쓴다 (UI v0.4 §3, 손지은 → 지).
export default function Avatar({
  nickname,
  profileImageUrl,
}: {
  nickname: string;
  profileImageUrl: string | null;
}) {
  if (profileImageUrl) {
    return <img className="avatar" src={profileImageUrl} alt="" />;
  }
  return (
    <span className="avatar" aria-hidden="true">
      {nickname.length >= 2 ? nickname[1] : nickname}
    </span>
  );
}
