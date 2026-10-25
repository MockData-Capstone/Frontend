import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import SignupComplete from './pages/SignupComplete';
import KakaoCallback from './pages/KakaoCallback';
import KakaoSignup from './pages/KakaoSignup';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/signup/complete" element={<SignupComplete />} />
      <Route path="/signup/kakao" element={<KakaoSignup />} />
      {/* 카카오 디벨로퍼스·백엔드(oauth.kakao.redirect-uri)에 등록한 Redirect URI와 같아야 한다 */}
      <Route path="/oauth/kakao/callback" element={<KakaoCallback />} />
    </Routes>
  );
}

export default App;
