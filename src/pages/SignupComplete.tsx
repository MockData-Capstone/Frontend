import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import './Auth.css';

const REDIRECT_SECONDS = 5;

// 01-C: 회원가입 완료 — N초 후 자동으로 메인(지도)으로 이동
export default function SignupComplete() {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      navigate('/');
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, navigate]);

  return (
    <div className="auth-page">
      <Header />
      <div className="auth-page__content">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div
            aria-hidden="true"
            style={{
              width: 40,
              height: 40,
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: 'var(--accent-bg)',
              color: 'var(--accent)',
              fontSize: 18,
            }}
          >
            ✓
          </div>
          <h1 className="auth-card__title">가입이 완료되었습니다</h1>
          <p className="auth-card__subtitle">zipfit에 오신 것을 환영해요.</p>
          <p className="auth-card__subtitle" style={{ marginBottom: 20 }}>
            {secondsLeft}초 후 메인화면으로 이동합니다.
          </p>
          <button
            type="button"
            className="auth-button"
            onClick={() => navigate('/')}
          >
            메인화면으로 바로 가기
          </button>
        </div>
      </div>
    </div>
  );
}
