import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/providers/useAuth';
import Avatar from '../components/Avatar';
import Dialog from '../components/Dialog';
import Header from '../components/Header';
import NicknameHint from '../components/NicknameHint';
import { useToast } from '../components/Toast/useToast';
import { useNicknameAvailability } from '../hooks/useNicknameAvailability';
import { validateNewPassword, validateProfileImage } from '../lib/accountValidation';
import { getErrorCode, getErrorMessage } from '../lib/authApi';
import { beginOAuth } from '../lib/oauth';
import {
  changePassword,
  linkSocialAccount,
  resetProfileImage,
  updateNickname,
  updateProfileImage,
  withdraw,
} from '../lib/userApi';
import './Account.css';

// 12 내 정보 · 탈퇴 (UI v0.4.3, AUTH-04·05·06·08)
// 프로필(사진·닉네임) / 로그인 방법(연결된 계정, 비밀번호 변경, 카카오 연결, 로그아웃) / 회원 탈퇴
export default function Account() {
  const { me, updateMe, signOut } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(me?.nickname ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const trimmed = nickname.trim();
  const nicknameChanged = !!me && trimmed !== me.nickname;
  const availability = useNicknameAvailability(nicknameChanged ? nickname : '');

  if (!me) return null;

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (trimmed.length < 2 || trimmed.length > 20) {
      setProfileError('닉네임은 2~20자로 입력해주세요.');
      return;
    }
    if (availability === 'unavailable') {
      setProfileError('이미 사용 중인 닉네임이에요.');
      return;
    }
    setSavingProfile(true);
    setProfileError(null);
    try {
      updateMe(await updateNickname(trimmed));
      showToast('프로필을 저장했어요.');
    } catch (err) {
      setProfileError(getErrorMessage(err, '프로필을 저장하지 못했어요.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const changePhoto = async (file: File | undefined) => {
    if (!file) return;
    const invalid = validateProfileImage(file);
    if (invalid) {
      setProfileError(invalid);
      return;
    }
    setPhotoBusy(true);
    setProfileError(null);
    try {
      updateMe(await updateProfileImage(file));
      showToast('프로필 사진을 바꿨어요.');
    } catch (err) {
      setProfileError(getErrorMessage(err, '사진을 올리지 못했어요.'));
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const resetPhoto = async () => {
    setPhotoBusy(true);
    setProfileError(null);
    try {
      updateMe(await resetProfileImage());
      showToast('기본 이미지로 바꿨어요.');
    } catch (err) {
      setProfileError(getErrorMessage(err, '기본 이미지로 바꾸지 못했어요.'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const doWithdraw = async () => {
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      await withdraw();
      await signOut().catch(() => {});
      navigate('/', { replace: true });
    } catch (err) {
      setWithdrawOpen(false);
      setWithdrawError(
        getErrorCode(err) === 'HOST_DELEGATION_REQUIRED'
          ? '호스트인 그룹에 다른 멤버가 있어요. 그룹 설정에서 호스트를 넘긴 뒤 탈퇴해주세요.'
          : getErrorMessage(err, '탈퇴하지 못했어요.'),
      );
    } finally {
      setWithdrawing(false);
    }
  };

  const linkState = location.state as { linkProvider?: 'kakao'; code?: string } | null;

  return (
    <div className="page account-page">
      <Header tab="groups" />
      <main className="account-page__main">
        <div className="page-head account-page__head">
          <h1 className="page-head__title">내 정보</h1>
          <p className="page-head__desc">프로필과 로그인 정보를 확인하세요.</p>
        </div>

        <section className="card account-card" aria-label="프로필">
          <form onSubmit={saveProfile} noValidate>
            <div className="account-card__photo">
              <span className="account-card__avatar">
                <Avatar nickname={me.nickname} profileImageUrl={me.profileImageUrl} />
              </span>
              <button
                type="button"
                className="button button--outline"
                onClick={() => fileRef.current?.click()}
                disabled={photoBusy}
              >
                사진 변경
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => void resetPhoto()}
                disabled={photoBusy || !me.profileImageUrl}
              >
                기본 이미지로
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                aria-label="프로필 사진 파일"
                onChange={(event) => void changePhoto(event.target.files?.[0])}
              />
            </div>
            <label className="field account-card__field">
              <span className="field__label">닉네임</span>
              <input
                className="field__input"
                value={nickname}
                maxLength={20}
                onChange={(event) => setNickname(event.target.value)}
                aria-invalid={availability === 'unavailable'}
              />
              {nicknameChanged && <NicknameHint status={availability} />}
            </label>
            {profileError && (
              <p className="field__error" role="alert">
                {profileError}
              </p>
            )}
            <button
              type="submit"
              className="button button--primary button--lg button--block account-card__save"
              disabled={savingProfile || !nicknameChanged || availability === 'checking'}
            >
              {savingProfile ? '저장 중…' : '프로필 저장'}
            </button>
          </form>
        </section>

        <LoginMethods linkState={linkState} />

        <section className="card account-card" aria-labelledby="withdraw-title">
          <h2 id="withdraw-title" className="card__subtitle">
            회원 탈퇴
          </h2>
          <p className="account-card__desc">탈퇴하면 작성한 대화 원본이 삭제돼요. 호스트인 그룹은 먼저 권한을 넘겨주세요.</p>
          {withdrawError && (
            <p className="field__error" role="alert">
              {withdrawError}
            </p>
          )}
          <button type="button" className="button button--secondary button--block" onClick={() => setWithdrawOpen(true)}>
            회원 탈퇴
          </button>
        </section>
      </main>

      <Dialog
        open={withdrawOpen}
        title="정말 탈퇴할까요?"
        description="탈퇴하면 되돌릴 수 없어요. 작성한 대화는 '탈퇴한 사용자'로 표시되고 내용은 지워져요."
        confirmLabel="탈퇴하기"
        busyLabel="탈퇴하는 중"
        tone="danger"
        busy={withdrawing}
        onConfirm={() => void doWithdraw()}
        onClose={() => setWithdrawOpen(false)}
      />
    </div>
  );
}

function LoginMethods({ linkState }: { linkState: { linkProvider?: 'kakao'; code?: string } | null }) {
  const { me, updateMe, signOut } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [pwOpen, setPwOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(linkState?.code ?? null);
  const [linkPassword, setLinkPassword] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  // 연결용 code는 한 번만 쓰므로 주소의 state를 지워 새로고침해도 다시 쓰지 않게 한다
  useEffect(() => {
    if (linkState?.code) navigate('/account', { replace: true, state: null });
  }, [linkState, navigate]);

  if (!me) return null;
  const kakao = me.providers.includes('KAKAO');
  const google = me.providers.includes('GOOGLE');
  const local = me.providers.includes('LOCAL') || me.hasPassword;

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    const invalid = !current ? '현재 비밀번호를 입력해주세요.' : validateNewPassword(next, confirm);
    if (invalid) {
      setPwError(invalid);
      return;
    }
    setBusy(true);
    setPwError(null);
    try {
      updateMe(await changePassword(current, next));
      showToast('비밀번호를 바꿨어요.');
      setPwOpen(false);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setPwError(getErrorMessage(err, '비밀번호를 바꾸지 못했어요.'));
    } finally {
      setBusy(false);
    }
  };

  const submitLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!linkCode) return;
    setBusy(true);
    setLinkError(null);
    try {
      updateMe(await linkSocialAccount('kakao', linkCode, linkPassword));
      showToast('카카오 계정을 연결했어요.');
      setLinkCode(null);
    } catch (err) {
      setLinkError(getErrorMessage(err, '카카오 계정을 연결하지 못했어요. 처음부터 다시 시도해주세요.'));
    } finally {
      setBusy(false);
    }
  };

  const startLink = async () => {
    try {
      await beginOAuth('kakao', 'link');
    } catch (err) {
      setLinkError(getErrorMessage(err, '카카오 연결을 시작하지 못했어요.'));
    }
  };

  const logout = async () => {
    navigate('/', { replace: true });
    try {
      await signOut();
    } catch {
      showToast('로그아웃하지 못했어요. 연결을 확인하고 다시 시도해주세요.');
    }
  };

  return (
    <section className="card account-card" aria-labelledby="login-method-title">
      <h2 id="login-method-title" className="card__subtitle">
        로그인 방법
      </h2>
      <ul className="account-card__methods">
        {kakao && <li>카카오 계정 연결됨</li>}
        {google && <li>구글 계정 연결됨</li>}
        {local && <li>이메일 로그인</li>}
      </ul>
      <p className="account-card__desc">{me.email ? me.email : '이메일 제공 안 함'}</p>

      {local && !kakao && !linkCode && (
        <button type="button" className="button button--outline button--block account-card__row" onClick={() => void startLink()}>
          카카오 계정 연결
        </button>
      )}
      {linkCode && (
        <form className="account-card__subform" onSubmit={submitLink}>
          <p className="account-card__desc">카카오 계정을 연결하려면 지금 비밀번호를 입력해주세요.</p>
          <label className="field">
            <span className="field__label">비밀번호</span>
            <input
              className="field__input"
              type="password"
              autoComplete="current-password"
              value={linkPassword}
              onChange={(event) => setLinkPassword(event.target.value)}
            />
          </label>
          {linkError && (
            <p className="field__error" role="alert">
              {linkError}
            </p>
          )}
          <button type="submit" className="button button--primary button--block" disabled={busy || !linkPassword}>
            연결하기
          </button>
        </form>
      )}
      {!linkCode && linkError && (
        <p className="field__error" role="alert">
          {linkError}
        </p>
      )}

      {me.hasPassword && (
        <>
          <button
            type="button"
            className="button button--outline button--block account-card__row"
            aria-expanded={pwOpen}
            onClick={() => setPwOpen((open) => !open)}
          >
            비밀번호 변경
          </button>
          {pwOpen && (
            <form className="account-card__subform" onSubmit={submitPassword} noValidate>
              <label className="field">
                <span className="field__label">현재 비밀번호</span>
                <input
                  className="field__input"
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(event) => setCurrent(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">새 비밀번호</span>
                <input
                  className="field__input"
                  type="password"
                  autoComplete="new-password"
                  placeholder="영문·숫자를 포함해 8자 이상"
                  value={next}
                  onChange={(event) => setNext(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">새 비밀번호 확인</span>
                <input
                  className="field__input"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </label>
              {pwError && (
                <p className="field__error" role="alert">
                  {pwError}
                </p>
              )}
              <button type="submit" className="button button--primary button--block" disabled={busy}>
                {busy ? '바꾸는 중…' : '비밀번호 바꾸기'}
              </button>
            </form>
          )}
        </>
      )}

      <button type="button" className="button button--outline button--block account-card__row" onClick={() => void logout()}>
        로그아웃
      </button>
    </section>
  );
}
