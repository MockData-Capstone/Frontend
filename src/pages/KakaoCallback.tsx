import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../app/providers/useAuth';
import { exchangeKakaoCode } from '../lib/authApi';
import './Auth.css';

// 카카오가 이 경로로 code를 돌려준다 (GET /api/auth/kakao/authorize-url 의 redirect_uri).
// AUTH-02: code를 백엔드로 넘겨 로그인/가입을 완료한다.
// TODO(AUTH-08): 409(ACCOUNT_LINK_REQUIRED) 시 비밀번호 입력 후 kakaoLink() 호출하는
// 계정 연동 화면이 아직 없다 — 지금은 안내 메시지만 보여준다.
export default function KakaoCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn } = useAuth();
  const code = searchParams.get('code');
  const [error, setError] = useState<string | null>(
    code ? null : '카카오 인증 정보가 없습니다. 로그인 화면에서 다시 시도해주세요.',
  );
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current || !code) return;
    hasRun.current = true;

    exchangeKakaoCode(code)
      .then((result) => {
        if ('type' in result) {
          // 같은 이메일의 자체 계정이 이미 있는 경우.
          setError(
            '이미 같은 이메일로 가입된 계정이 있어요. 계정 연동 화면은 아직 준비 중입니다 — 이메일 로그인을 이용해주세요.',
          );
          return;
        }
        signIn(result);
        navigate('/', { replace: true });
      })
      .catch(() => {
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
