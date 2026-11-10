import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import WorkspaceSearch from './pages/WorkspaceSearch';
import WorkspaceSettings from './pages/WorkspaceSettings';
import Conditions from './pages/Conditions';
import Comparison from './components/Comparison';
import Vote from './components/Vote';
import Listing from './components/Listing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import SignupComplete from './pages/SignupComplete';
import SocialCallback from './pages/SocialCallback';
import Account from './pages/Account';
import PasswordReset from './pages/PasswordReset';
import KakaoSignup from './pages/KakaoSignup';
import LinkAccount from './pages/LinkAccount';
import WorkspaceList from './pages/WorkspaceList';
import WorkspaceCreate from './pages/WorkspaceCreate';
import WorkspaceInvitePage from './pages/WorkspaceInvite';
import InvitePage from './pages/Invite';
import CandidateList from './pages/candidates/CandidateList';
import CandidateDetail from './pages/candidates/CandidateDetail';
import MiniGamePage from './pages/minigame/MiniGamePage';
import GameResultPage from './pages/minigame/GameResult';
import TourViewerPage from './pages/tour/TourViewer';
import TourVisitorPage from './pages/tour/TourVisitor';
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
      <Route path="/signup/social" element={<KakaoSignup />} />
      <Route path="/password-reset" element={<PasswordReset />} />
      <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
      {/* 카카오 디벨로퍼스·백엔드(oauth.kakao.redirect-uri)에 등록한 Redirect URI와 같아야 한다 */}
      <Route path="/oauth/kakao/callback" element={<SocialCallback provider="kakao" />} />
      <Route path="/oauth/google/callback" element={<SocialCallback provider="google" />} />
      {/* 04 초대 링크 진입 — 로그인 없이 초대 정보를 보여주고, 로그인 뒤 참여를 이어간다 */}
      <Route path="/invite/:token" element={<InvitePage />} />

      {/* 08 내 그룹 목록 */}
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
      {/* 그룹 안(11 그룹 홈은 이번 범위 밖 — 들어가면 바로 14 후보지로 보낸다) */}
      <Route
        path="/workspaces/:workspaceId"
        element={
          <RequireAuth>
            <WorkspaceLayout />
          </RequireAuth>
        }
      >
        <Route index element={<WorkspaceIndexRedirect />} />
        <Route path="search" element={<WorkspaceSearch />} />
        <Route path="settings" element={<WorkspaceSettings />} />
        <Route path="comparisons" element={<Comparison />} />
        <Route path="votes" element={<Vote />} />
        <Route path="conditions" element={<Conditions />} />
        <Route path="listings" element={<Listing />} />
        <Route path="candidates" element={<CandidateList />} />
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
