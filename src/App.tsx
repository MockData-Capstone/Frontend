import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import SignupComplete from './pages/SignupComplete';
import KakaoCallback from './pages/KakaoCallback';
import WorkspaceList from './pages/WorkspaceList';
import WorkspaceCreate from './pages/WorkspaceCreate';
import WorkspaceInvitePage from './pages/WorkspaceInvite';
import InvitePage from './pages/Invite';
import WorkspaceSearch from './pages/search/WorkspaceSearch';
import CandidateDetail from './pages/candidates/CandidateDetail';
import Account from './pages/Account';
import Conditions from './pages/Conditions';
import WorkspaceSettings from './pages/WorkspaceSettings';
import PasswordReset from './pages/PasswordReset';
import MiniGamePage from './pages/minigame/MiniGamePage';
import GameResultPage from './pages/minigame/GameResult';
import TourViewerPage from './pages/tour/TourViewer';
import TourVisitorPage from './pages/tour/TourVisitor';
import LinkAccount from './pages/LinkAccount';
import KakaoSignup from './pages/KakaoSignup';
import RequireAuth from './components/RequireAuth';
import WorkspaceLayout, { WorkspaceIndexRedirect } from './components/WorkspaceLayout';
import './App.css';


function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/login/link-account" element={<LinkAccount />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/signup/complete" element={<SignupComplete />} />
      <Route path="/signup/kakao" element={<KakaoSignup />} />
      {/* 카카오 디벨로퍼스·백엔드(oauth.kakao.redirect-uri)에 등록한 Redirect URI와 같아야 한다 */}
      <Route path="/oauth/kakao/callback" element={<KakaoCallback />} />
      {/* 04 초대 링크 진입 — 로그인 없이 초대 정보를 보여주고, 로그인 뒤 참여를 이어간다 */}
      <Route path="/invite/:token" element={<InvitePage />} />

      {/* 01 비밀번호 재설정 요청·새 비밀번호 (AUTH-07, 메일 링크 /password-reset?token=) */}
      <Route path="/password-reset" element={<PasswordReset />} />
      {/* 12 내 정보 · 탈퇴 */}
      <Route
        path="/account"
        element={
          <RequireAuth>
            <Account />
          </RequireAuth>
        }
      />
      {/* 04 내 그룹 목록 */}
      <Route
        path="/workspaces"
        element={
          <RequireAuth>
            <WorkspaceList />
          </RequireAuth>
        }
      />
      {/* 09 새 그룹 만들기 */}
      <Route
        path="/workspaces/new"
        element={
          <RequireAuth>
            <WorkspaceCreate />
          </RequireAuth>
        }
      />
      {/* 10 그룹 생성 완료·친구 초대 — 그룹 헤더(C)가 아니라 내 그룹 쪽 헤더라 레이아웃 밖에 둔다 */}
      <Route
        path="/workspaces/:workspaceId/invite"
        element={
          <RequireAuth>
            <WorkspaceInvitePage />
          </RequireAuth>
        }
      />
      {/* 24 방문자 송출 — 휴대폰 전체 화면이라 그룹 헤더(레이아웃) 없이 띄운다 */}
      <Route
        path="/workspaces/:workspaceId/tour/broadcast"
        element={
          <RequireAuth>
            <TourVisitorPage />
          </RequireAuth>
        }
      />
      {/* 그룹 안 — 들어가면 11 그룹 홈(함께 찾기)으로 보낸다 */}
      <Route
        path="/workspaces/:workspaceId"
        element={
          <RequireAuth>
            <WorkspaceLayout />
          </RequireAuth>
        }
      >
        <Route index element={<WorkspaceIndexRedirect />} />
        {/* 06 그룹 홈: [대화 | 후보지 | ZIPFIT AI] 탭. 후보지 탭(08)은 주소만 다르고 같은 화면이다 */}
        <Route path="search" element={<WorkspaceSearch />} />
        <Route path="candidates" element={<WorkspaceSearch tab="candidates" />} />
        {/* 10 조건 확정 · 매물 검색 링크 */}
        <Route path="conditions" element={<Conditions />} />
        {/* 11 그룹 설정 · 멤버 */}
        <Route path="settings" element={<WorkspaceSettings />} />
        <Route path="candidates/:candidateId" element={<CandidateDetail />} />
        {/* 19 방문자 정하기 → 20 가위바위보 / 21 룰렛 (진행 상태에 따라 같은 주소에서 바뀐다) */}
        <Route path="minigame" element={<MiniGamePage />} />
        {/* 22 방문자 선정 결과 */}
        <Route path="minigame/:gameId" element={<GameResultPage />} />
        {/* 23 실시간 집보기 시청 */}
        <Route path="tour" element={<TourViewerPage />} />
      </Route>
    </Routes>
  );
}

export default App;
