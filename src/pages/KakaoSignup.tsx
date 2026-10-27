import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../app/providers/useAuth';
import { getErrorCode, getFieldErrors, signupSocial, type FieldError, type SocialSignupInfo } from '../lib/authApi';
import { useNicknameAvailability } from '../hooks/useNicknameAvailability';
import NicknameHint from '../components/NicknameHint';
import './Auth.css';

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;

// AUTH-02 카카오 최초 가입: 개인정보 수집·이용 동의 + 닉네임 확정.
// 카카오 닉네임을 기본값으로 채우고, 이미 사용 중이면 새 닉네임을 입력받는다.
// KakaoCallback이 navigate state로 가입 정보(SocialSignupInfo)를 넘겨준다.
export default function KakaoSignup() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const signup = useLocation().state as SocialSignupInfo | null;

  const [nickname, setNickname] = useState(signup?.nickname ?? '');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    signup && signup.nickname && !signup.nicknameAvailable
      ? '카카오 닉네임이 이미 사용 중이에요. 다른 닉네임을 입력해주세요.'
      : null,
  );
  const [expired, setExpired] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const nicknameStatus = useNicknameAvailability(nickname);

  function fieldError(field: string) {
    return fieldErrors.find((e) => e.field === field)?.message;
  }

  // 새로고침 등으로 가입 정보가 없으면 카카오 로그인부터 다시 한다.
  if (!signup) {
    return <Navigate to="/login" replace />;
  }

  function validate(): string | null {
    const trimmed = nickname.trim();
    if (trimmed.length < NICKNAME_MIN || trimmed.length > NICKNAME_MAX)
      return `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 입력해주세요.`;
    if (nicknameStatus === 'unavailable') return '이미 사용 중인 닉네임이에요.';
    if (!agreedToTerms || !agreedToPrivacy) return '필수 약관에 모두 동의해주세요.';
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
      const tokens = await signupSocial({
        signupToken: signup!.signupToken,
        nickname: nickname.trim(),
        privacyAgreed: agreedToPrivacy,
      });
      signIn(tokens);
      navigate('/signup/complete', { replace: true });
    } catch (err) {
      const code = getErrorCode(err);
      if (code === 'DUPLICATE_NICKNAME') {
        setError('이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해주세요.');
      } else if (code === 'INVALID_SIGNUP_TOKEN' || code === 'ALREADY_REGISTERED') {
        setExpired(true);
        setError('가입 정보가 만료되었어요. 카카오 로그인부터 다시 진행해주세요.');
      } else if (code === 'INVALID_INPUT') {
        setFieldErrors(getFieldErrors(err));
      } else {
        setError('가입에 실패했습니다. 잠시 후 다시 시도해주세요.');
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
          <h1 className="auth-card__title">카카오로 가입하기</h1>
          <p className="auth-card__subtitle">그룹에서 사용할 닉네임을 확인해주세요.</p>

          {error && <p className="auth-error">{error}</p>}

          {expired ? (
            <Link to="/login" className="auth-button" style={{ display: 'block', textAlign: 'center' }}>
              로그인 화면으로
            </Link>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {signup.profileImageUrl && (
                <img
                  src={signup.profileImageUrl}
                  alt=""
                  width={64}
                  height={64}
                  style={{ display: 'block', margin: '0 auto 16px', borderRadius: '50%', objectFit: 'cover' }}
                />
              )}

              <label className="auth-field">
                <span className="auth-field__label">닉네임</span>
                <input
                  type="text"
                  className="auth-field__input"
                  placeholder={`${NICKNAME_MIN}~${NICKNAME_MAX}자`}
                  value={nickname}
                  maxLength={NICKNAME_MAX}
                  onChange={(e) => setNickname(e.target.value)}
                  autoComplete="nickname"
                />
                {fieldError('nickname') ? (
                  <p className="auth-field__error">{fieldError('nickname')}</p>
                ) : (
                  <NicknameHint status={nicknameStatus} />
                )}
              </label>

              {signup.email && (
                <label className="auth-field">
                  <span className="auth-field__label">이메일</span>
                  <input type="email" className="auth-field__input" value={signup.email} disabled />
                </label>
              )}

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
          )}
        </div>
      </div>
    </div>
  );
}
