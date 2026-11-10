import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import { ErrorNotice, FeaturePage } from '../components/FeatureUI';
import { useTask } from '../hooks/useTask';
import { confirmPasswordReset, requestPasswordReset } from '../lib/authApi';
import { setTokens } from '../lib/api';
import { validateNewPassword } from '../lib/accountValidation';

export default function PasswordReset() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [done, setDone] = useState(false);
  const task = useTask();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (token) {
      const invalid = validateNewPassword(password, confirmation); if (invalid) { task.setError(invalid); return; }
      void task.run(() => confirmPasswordReset(token, password), () => { setTokens(null); setDone(true); setPassword(''); setConfirmation(''); });
    } else void task.run(() => requestPasswordReset(email.trim()), () => setDone(true));
  };
  return <div className="page"><Header /><FeaturePage title="비밀번호 재설정" description={token ? '새 비밀번호를 설정해주세요.' : '가입한 이메일로 재설정 안내를 요청하세요.'}>
    <section className="feature-card"><ErrorNotice message={task.error} />
      {done ? <div role="status"><p>{token ? '비밀번호를 변경했어요. 새 비밀번호로 로그인해주세요.' : '가입된 이메일이라면 안내 메일이 전송됩니다. 받은 편지함과 스팸함을 확인해주세요.'}</p><Link to="/login">로그인으로</Link></div> :
        <form className="feature-form" onSubmit={submit}>{token ? <><label>새 비밀번호<input type="password" autoComplete="new-password" required minLength={8} maxLength={64} value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>새 비밀번호 확인<input type="password" autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label></> : <label>이메일<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
          <button className="button button--primary" disabled={task.busy}>{task.busy ? '요청 중...' : token ? '비밀번호 재설정' : '안내 메일 요청'}</button></form>}
      {token && task.error && <Link to="/password-reset">재설정 메일 다시 요청하기</Link>}
    </section></FeaturePage></div>;
}
