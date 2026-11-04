import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../app/providers/useAuth';
import { signUp, getKakaoAuthorizeUrl, getErrorCode, getFieldErrors, type FieldError } from '../lib/authApi';
import { useNicknameAvailability } from '../hooks/useNicknameAvailability';
import NicknameHint from '../components/NicknameHint';
import './Auth.css';

// AUTH-01 자체 회원가입 + AUTH-02 카카오 가입
export default function Signup() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const nicknameStatus = useNicknameAvailability(nickname);

  function fieldError(field: string) {
    return fieldErrors.find((e) => e.field === field)?.message;
  }

  function validate(): string | null {
    if (!nickname.trim()) return '닉네임을 입력해주세요.';
    if (nicknameStatus === 'unavailable') return '이미 사용 중인 닉네임이에요.';
    if (!email.trim()) return '이메일을 입력해주세요.';
    if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
    if (password !== passwordConfirm) return '비밀번호가 일치하지 않습니다.';
    if (!agreedToTerms || !agreedToPrivacy)
      return '필수 약관에 모두 동의해주세요.';
    return null;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setFieldErrors([]);
    try {
      // 가입 성공(201) 응답에 토큰이 바로 온다 (실제 호출로 확인).
      const tokens = await signUp({
        email,
        password,
        nickname,
        privacyAgreed: agreedToPrivacy,
      });
      signIn(tokens);
      navigate('/signup/complete');
    } catch (err) {
      const code = getErrorCode(err);
      if (code === 'DUPLICATE_EMAIL') {
        setError('이미 가입된 이메일입니다.');
      } else if (code === 'DUPLICATE_NICKNAME') {
        setError('이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해주세요.');
      } else if (code === 'PRIVACY_AGREEMENT_REQUIRED') {
        setError('개인정보 수집·이용에 동의해야 가입할 수 있어요.');
      } else if (code === 'INVALID_INPUT') {
        setFieldErrors(getFieldErrors(err));
      } else {
        setError('회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleKakaoSignup() {
    setError(null);
    try {
      const url = await getKakaoAuthorizeUrl();
      window.location.href = url;
    } catch {
      setError('카카오 가입을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  return (
    <div className="auth-page">
      <Header />
      <div className="auth-page__content">
        <div className="auth-card">
          <h1 className="auth-card__title">회원가입</h1>
          <p className="auth-card__subtitle">zipfit에서 나에게 맞는 집을 함께 찾아요.</p>

          {error && <p className="auth-error">{error}</p>}

          <button
            type="button"
            className="auth-button--kakao"
            onClick={handleKakaoSignup}
          >
            카카오로 가입하기
          </button>

          <p className="auth-divider">또는 이메일로 가입</p>

          <form onSubmit={handleSubmit} noValidate>
            <label className="auth-field">
              <span className="auth-field__label">닉네임</span>
              <input
                type="text"
                className="auth-field__input"
                placeholder="그룹에서 사용할 이름"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                autoComplete="nickname"
              />
              {fieldError('nickname') ? (
                <p className="auth-field__error">{fieldError('nickname')}</p>
              ) : (
                <NicknameHint status={nicknameStatus} />
              )}
            </label>

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
                placeholder="영문·숫자를 조합해 8자 이상"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              {fieldError('password') && <p className="auth-field__error">{fieldError('password')}</p>}
            </label>

            <label className="auth-field">
              <span className="auth-field__label">비밀번호 확인</span>
              <input
                type="password"
                className="auth-field__input"
                placeholder="비밀번호를 한 번 더 입력해주세요"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </label>

            <div className="auth-checkboxes">
              <label className="auth-checkbox">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                />
                <span>[필수] 서비스 이용약관 동의</span>
              </label>
              <label className="auth-checkbox">
                <input
                  type="checkbox"
                  checked={agreedToPrivacy}
                  onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                />
                <span>[필수] 개인정보 수집·이용 동의</span>
              </label>
            </div>

            <button type="submit" className="auth-button" disabled={isSubmitting}>
              {isSubmitting ? '가입 중...' : '가입하기'}
            </button>
          </form>

          <p className="auth-footer">
            이미 계정이 있나요? <Link to="/login">로그인</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
