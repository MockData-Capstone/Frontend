import Header from '../components/Header';

// 메인(동네 찾기) 화면. 지금은 상단바만 노출한다.
// TODO: 동네 둘러보기 본문 — PRD/기능명세서에 없는 기능이라 팀 확인 후 착수 (README 참고)
export default function Home() {
  return (
    <div className="page page--home">
      <Header />
    </div>
  );
}
