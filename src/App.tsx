import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import SignupComplete from './pages/SignupComplete';
import KakaoCallback from './pages/KakaoCallback';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/signup/complete" element={<SignupComplete />} />
      <Route path="/auth/kakao/callback" element={<KakaoCallback />} />
    </Routes>
  );
}

export default App;
