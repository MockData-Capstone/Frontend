import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import SignupComplete from './pages/SignupComplete';
import KakaoCallback from './pages/KakaoCallback';
import KakaoSignup from './pages/KakaoSignup';
import LinkAccount from './pages/LinkAccount';
import WorkspaceList from './pages/WorkspaceList';
import CandidateList from './pages/candidates/CandidateList';
import CandidateDetail from './pages/candidates/CandidateDetail';
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

      {/* 08 내 그룹 목록 */}
      <Route
        path="/workspaces"
        element={
          <RequireAuth>
            <WorkspaceList />
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
        <Route path="candidates" element={<CandidateList />} />
        <Route path="candidates/:candidateId" element={<CandidateDetail />} />
      </Route>
    </Routes>
  );
}

export default App;
