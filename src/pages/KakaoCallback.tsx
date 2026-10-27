import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../app/providers/useAuth';
import { exchangeKakaoCode, getAccountLinkInfo } from '../lib/authApi';
import './Auth.css';

// 카카오가 이 경로로 code를 돌려준다 (GET /api/auth/kakao/authorize-url 의 redirect_uri).
// AUTH-02: code를 백엔드로 넘겨 로그인한다.
// - 처음 온 회원 → 카카오 가입 화면(/signup/kakao)
// - 같은 이메일의 자체 가입 회원이 있음(409 ACCOUNT_LINK_REQUIRED) → 계정 연동 화면(/login/link-account)
export default function KakaoCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn } = useAuth();
  const code = searchParams.get('code');
  // 사용자가 카카오 동의 화면에서 취소하면 code 없이 error 파라미터로 돌아온다.
  const [error, setError] = useState<string | null>(
    code ? null : '카카오 로그인이 취소되었거나 인증 정보가 없습니다. 다시 시도해주세요.',
  );
  // 인가 코드는 한 번만 쓸 수 있어서 StrictMode의 이중 실행을 막는다.
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current || !code) return;
    hasRun.current = true;

    exchangeKakaoCode(code)
      .then((result) => {
        if (result.status === 'SIGNUP_REQUIRED') {
          navigate('/signup/kakao', { replace: true, state: result.signup });
          return;
        }
        signIn(result.tokens);
        navigate('/', { replace: true });
      })
      .catch((err) => {
        const linkInfo = getAccountLinkInfo(err);
        if (linkInfo) {
          navigate('/login/link-account', { replace: true, state: { provider: 'kakao', ...linkInfo } });
          return;
        }
        setError('카카오 로그인에 실패했습니다. 다시 시도해주세요.');
      });
  }, [code, signIn, navigate]);

  return (
    <div className="auth-page">
      <Header />
      <div className="auth-page__content">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          {error ? (
            <>
              <h1 className="auth-card__title">로그인 실패</h1>
              <p className="auth-card__subtitle" style={{ marginBottom: 20 }}>
                {error}
              </p>
              <button
                type="button"
                className="auth-button"
                onClick={() => navigate('/login')}
              >
                로그인 화면으로
              </button>
            </>
          ) : (
            <p className="auth-card__subtitle">카카오 로그인 처리 중입니다...</p>
          )}
        </div>
      </div>
    </div>
  );
}
