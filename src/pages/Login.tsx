import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../app/providers/useAuth';
import { login, getKakaoAuthorizeUrl, getErrorCode, getFieldErrors, type FieldError } from '../lib/authApi';
import './Auth.css';

// AUTH-03 자체 로그인 + AUTH-02 카카오 로그인
export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);

  function fieldError(field: string) {
    return fieldErrors.find((e) => e.field === field)?.message;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setFieldErrors([]);
    try {
      const tokens = await login({ email, password });
      signIn(tokens);
      navigate('/');
    } catch (err) {
      const code = getErrorCode(err);
      if (code === 'INVALID_INPUT') {
        setFieldErrors(getFieldErrors(err));
      } else {
        // AUTH-03 예외 규칙: 어느 쪽이 틀렸는지 밝히지 않는다.
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleKakaoLogin() {
    setError(null);
    try {
      const url = await getKakaoAuthorizeUrl();
      window.location.href = url;
    } catch {
      setError('카카오 로그인을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  return (
    <div className="auth-page">
      <Header />
      <div className="auth-page__content">
        <div className="auth-card">
          <h1 className="auth-card__title">로그인</h1>
          <p className="auth-card__subtitle">zipfit에서 함께 집을 찾아보세요.</p>

          {error && <p className="auth-error">{error}</p>}

          <form onSubmit={handleSubmit} noValidate>
            <label className="auth-field">
              <span className="auth-field__label">이메일</span>
              <input
                type="email"
                className="auth-field__input"
                placeholder="이메일을 입력해주세요"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              {fieldError('email') && <p className="auth-field__error">{fieldError('email')}</p>}
            </label>

            <label className="auth-field">
              <span className="auth-field__label">비밀번호</span>
              <input
                type="password"
                className="auth-field__input"
                placeholder="비밀번호를 입력해주세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              {fieldError('password') && <p className="auth-field__error">{fieldError('password')}</p>}
            </label>

            <button type="submit" className="auth-button" disabled={isSubmitting}>
              {isSubmitting ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="auth-divider">또는</p>

          <button
            type="button"
            className="auth-button--kakao"
            onClick={handleKakaoLogin}
          >
            카카오로 로그인
          </button>

          <p className="auth-footer">
            처음 오셨나요? <Link to="/signup">회원가입</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
