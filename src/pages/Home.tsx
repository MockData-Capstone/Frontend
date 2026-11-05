import { Navigate } from 'react-router-dom';
import { useAuth } from '../app/providers/useAuth';
import Header from '../components/Header';
import { pendingInvite } from '../lib/invite';

// 메인(동네 찾기) 화면. 지금은 상단바만 노출한다.
// TODO: 동네 둘러보기 본문 — PRD/기능명세서에 없는 기능이라 팀 확인 후 착수 (README 참고)
export default function Home() {
  const { accessToken } = useAuth();

  // 로그인·가입·카카오 로그인은 모두 마지막에 메인으로 온다. 초대 링크로 와서 로그인하러 갔던 거면
  // 초대 화면(04)으로 돌려보내 참여를 이어간다 (MEM-02).
  const invite = accessToken ? pendingInvite() : null;
  if (invite) {
    return <Navigate to={`/invite/${invite}`} replace />;
  }

  return (
    <div className="page page--home">
      <Header />
    </div>
  );
}
