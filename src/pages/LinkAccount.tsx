import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../app/providers/useAuth';
import { getErrorCode, linkSocialAccount, type AccountLinkRequiredInfo } from '../lib/authApi';
import './Auth.css';

type LinkState = AccountLinkRequiredInfo & { provider: 'kakao' | 'google' };

const PROVIDER_LABEL: Record<LinkState['provider'], string> = {
  kakao: '카카오',
  google: '구글',
};

// AUTH-08: 소셜 로그인 중 같은 이메일의 자체 가입 계정이 있을 때(409 ACCOUNT_LINK_REQUIRED)
// 기존 계정 비밀번호를 받아 연동을 마무리한다. KakaoCallback이 navigate state로 넘겨준다.
export default function LinkAccount() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const link = useLocation().state as LinkState | null;

  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 새로고침 등으로 연동 정보가 없으면 로그인부터 다시 한다.
  if (!link) {
    return <Navigate to="/login" replace />;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!password) {
      setError('비밀번호를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const tokens = await linkSocialAccount(link!.provider, link!.linkToken, password);
      signIn(tokens);
      navigate('/', { replace: true });
    } catch (err) {
      const code = getErrorCode(err);
      if (code === 'INVALID_CREDENTIALS') {
        setError('비밀번호가 올바르지 않습니다.');
      } else if (code === 'INVALID_SIGNUP_TOKEN' || code === 'ACCOUNT_LINK_REQUIRED') {
        setError('연동 정보가 만료되었어요. 처음부터 다시 시도해주세요.');
      } else {
        setError('연동에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <Header />
      <div className="auth-page__content">
        <div className="auth-card">
          <h1 className="auth-card__title">계정 연동</h1>
          <p className="auth-card__subtitle">
            <strong>{link.email}</strong>로 이미 가입된 계정이 있어요.
            <br />
            비밀번호를 입력하면 {PROVIDER_LABEL[link.provider]} 로그인과 연동됩니다.
          </p>

          {error && <p className="auth-error">{error}</p>}

          <form onSubmit={handleSubmit} noValidate>
            <label className="auth-field">
              <span className="auth-field__label">비밀번호</span>
              <input
                type="password"
                className="auth-field__input"
                placeholder="기존 계정 비밀번호를 입력해주세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                autoFocus
              />
            </label>

            <button type="submit" className="auth-button" disabled={isSubmitting}>
              {isSubmitting ? '연동 중...' : '연동하고 로그인'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
