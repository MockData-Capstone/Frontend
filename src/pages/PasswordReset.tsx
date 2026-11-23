import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import PolicyFooter from '../components/PolicyFooter';
import { validateNewPassword } from '../lib/accountValidation';
import { confirmPasswordReset, getErrorMessage, requestPasswordReset } from '../lib/authApi';
import './Auth.css';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 비밀번호 재설정 (AUTH-07). 로그인 화면의 [비밀번호를 잊으셨나요?]에서 이메일을 받아 메일을 보내고,
// 메일 링크(/password-reset?token=…)로 오면 새 비밀번호를 정한다.
export default function PasswordReset() {
  const [params] = useSearchParams();
  const token = params.get('token');
  return (
    <div className="auth-page">
      <Header />
      <div className="auth-page__content">
        <div className="auth-card">{token ? <ConfirmForm token={token} /> : <RequestForm />}</div>
      </div>
      <PolicyFooter />
    </div>
  );
}

function RequestForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setError('이메일 형식을 확인해주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err, '메일을 보내지 못했어요. 잠시 후 다시 시도해주세요.'));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <>
        <h1 className="auth-card__title">메일을 확인해주세요</h1>
        <p className="auth-card__subtitle">
          가입한 이메일이면 비밀번호 재설정 링크를 보냈어요. 링크는 30분 동안 쓸 수 있어요.
        </p>
        <Link to="/login" className="auth-button" style={{ display: 'inline-flex', justifyContent: 'center', textDecoration: 'none' }}>
          로그인 화면으로
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="auth-card__title">비밀번호 재설정</h1>
      <p className="auth-card__subtitle">가입한 이메일로 재설정 링크를 보내 드려요.</p>
      {error && <p className="auth-error">{error}</p>}
      <form onSubmit={submit} noValidate>
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
        </label>
        <button type="submit" className="auth-button" disabled={busy}>
          {busy ? '보내는 중...' : '재설정 링크 받기'}
        </button>
      </form>
      <p className="auth-footer">
        비밀번호가 기억났나요? <Link to="/login">로그인</Link>
      </p>
    </>
  );
}

function ConfirmForm({ token }: { token: string }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const invalid = validateNewPassword(password, confirm);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await confirmPasswordReset(token, password);
      navigate('/login', { replace: true, state: { notice: '비밀번호를 바꿨어요. 새 비밀번호로 로그인해주세요.' } });
    } catch (err) {
      setError(getErrorMessage(err, '링크가 만료되었거나 이미 사용됐어요. 다시 요청해주세요.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="auth-card__title">새 비밀번호 설정</h1>
      <p className="auth-card__subtitle">영문과 숫자를 포함해 8자 이상으로 정해주세요.</p>
      {error && <p className="auth-error">{error}</p>}
      <form onSubmit={submit} noValidate>
        <label className="auth-field">
          <span className="auth-field__label">새 비밀번호</span>
          <input
            type="password"
            className="auth-field__input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <label className="auth-field">
          <span className="auth-field__label">새 비밀번호 확인</span>
          <input
            type="password"
            className="auth-field__input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <button type="submit" className="auth-button" disabled={busy}>
          {busy ? '바꾸는 중...' : '비밀번호 바꾸기'}
        </button>
      </form>
      <p className="auth-footer">
        <Link to="/password-reset">재설정 링크 다시 받기</Link>
      </p>
    </>
  );
}
