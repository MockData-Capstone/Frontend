import { useCallback, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/providers/useAuth';
import Header from '../components/Header';
import Avatar from '../components/Avatar';
import Dialog from '../components/Dialog';
import { ErrorNotice, FeaturePage } from '../components/FeatureUI';
import { useResource } from '../hooks/useResource';
import { useTask } from '../hooks/useTask';
import { getMe } from '../lib/authApi';
import { changePassword, linkSocialAccount, resetProfileImage, updateNickname, updateProfileImage, withdraw } from '../lib/userApi';
import { beginOAuth, type SocialProvider } from '../lib/oauth';
import { validateNewPassword, validateProfileImage } from '../lib/accountValidation';
import { setTokens } from '../lib/api';
import type { MeResponse } from '../types';

export default function Account() {
  const profile = useResource(useCallback(() => getMe(), []));
  const { updateMe } = useAuth();
  return <div className="page"><Header /><FeaturePage title="내 정보" description="프로필과 로그인 방법을 관리하세요."><ErrorNotice message={profile.error} retry={() => { void profile.reload(); }} />
    {profile.data ? <AccountForm profile={profile.data} onChange={(value) => { profile.setData(value); updateMe(value); }} /> : !profile.error && <p>불러오는 중...</p>}
  </FeaturePage></div>;
}
function AccountForm({ profile, onChange }: { profile: MeResponse; onChange: (value: MeResponse) => void }) {
  const [nickname, setNickname] = useState(profile.nickname);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [notice, setNotice] = useState('');
  const task = useTask();
  const navigate = useNavigate();
  const location = useLocation();
  const socialLink = (location.state as { socialLink?: { provider: SocialProvider; code: string } } | null)?.socialLink;
  const changed = (value: MeResponse) => { onChange(value); setNotice('변경사항을 저장했어요.'); };
  const passwordSubmit = (event: FormEvent) => {
    event.preventDefault(); const invalid = validateNewPassword(password, confirmation); if (invalid) { task.setError(invalid); return; }
    void task.run(() => changePassword(currentPassword, password), (value) => { changed(value); setCurrentPassword(''); setPassword(''); setConfirmation(''); });
  };
  return <><ErrorNotice message={task.error} />{notice && <p role="status" className="feature-success">{notice}</p>}
    <div className="feature-grid"><section className="feature-card"><h2>프로필</h2><Avatar nickname={profile.nickname} profileImageUrl={profile.profileImageUrl} /><p>{profile.email ?? '등록된 이메일 없음'}</p>
      <form className="feature-form" onSubmit={(event) => { event.preventDefault(); void task.run(() => updateNickname(nickname.trim()), changed); }}><label>닉네임<input value={nickname} required minLength={2} maxLength={20} onChange={(event) => setNickname(event.target.value)} /></label><button className="button button--primary" disabled={task.busy || nickname.trim() === profile.nickname}>닉네임 저장</button></form>
      <div className="feature-form"><label>프로필 사진 (JPG·PNG·WebP, 5MB 이하)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={task.busy} onChange={(event) => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
        const invalid = validateProfileImage(file); if (invalid) { task.setError(invalid); return; }
        void task.run(() => updateProfileImage(file), changed);
      }} /></label><button type="button" className="button button--secondary" disabled={task.busy || !profile.profileImageUrl} onClick={() => void task.run(resetProfileImage, changed)}>기본 사진으로 변경</button></div>
    </section><section className="feature-card"><h2>비밀번호 변경</h2>{profile.hasPassword ? <form className="feature-form" onSubmit={passwordSubmit}>
      <label>현재 비밀번호<input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
      <label>새 비밀번호<input type="password" autoComplete="new-password" required minLength={8} maxLength={64} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <label>새 비밀번호 확인<input type="password" autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
      <button className="button button--primary" disabled={task.busy}>비밀번호 변경</button></form> : <p>소셜 로그인으로 가입한 계정은 연결된 서비스에서 비밀번호를 관리해주세요.</p>}</section></div>
    <section className="feature-card"><h2>연결된 로그인</h2><p>{profile.providers.join(' · ')}</p>
      {profile.hasPassword && <div className="feature-actions">{(['kakao', 'google'] as const).map((provider) => <button className="button button--secondary" key={provider} disabled={task.busy || profile.providers.includes(provider === 'kakao' ? 'KAKAO' : 'GOOGLE')} onClick={() => void task.run(() => beginOAuth(provider, 'link'))}>{provider === 'kakao' ? '카카오' : '구글'} 계정 연결</button>)}</div>}
      {socialLink && <form className="feature-form" onSubmit={(event) => { event.preventDefault(); void task.run(() => linkSocialAccount(socialLink.provider, socialLink.code, linkPassword), (value) => { changed(value); setLinkPassword(''); navigate('/account', { replace: true, state: null }); }); }}><p>인증한 {socialLink.provider === 'kakao' ? '카카오' : '구글'} 계정을 연결하려면 현재 비밀번호를 확인해주세요.</p><label>현재 계정 비밀번호<input type="password" required autoComplete="current-password" value={linkPassword} onChange={(event) => setLinkPassword(event.target.value)} /></label><button className="button button--primary" disabled={task.busy}>계정 연결 확인</button></form>}
    </section><section className="feature-card"><h2>회원 탈퇴</h2><p>회원 정보와 작성한 대화 내용이 삭제됩니다. 다른 멤버가 있는 그룹의 호스트라면 먼저 권한을 위임해주세요.</p><button className="button button--danger" onClick={() => { task.setError(null); setDeleteOpen(true); }}>회원 탈퇴</button></section>
    <Dialog open={deleteOpen} title="회원 탈퇴" description="삭제 후 복구할 수 없습니다. 계속하려면 '탈퇴'를 입력해주세요." confirmLabel="탈퇴하기" tone="danger" busy={task.busy} confirmDisabled={deleteText !== '탈퇴'} onClose={() => setDeleteOpen(false)} onConfirm={() => void task.run(withdraw, () => { setTokens(null); navigate('/', { replace: true }); })}><label className="feature-form">확인 문구<input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} /></label><ErrorNotice message={task.error} /></Dialog>
  </>;
}
