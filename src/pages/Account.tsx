import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/providers/useAuth';
import Avatar from '../components/Avatar';
import Dialog from '../components/Dialog';
import Header from '../components/Header';
import NicknameHint from '../components/NicknameHint';
import ProfileCropDialog from '../components/ProfileCropDialog';
import { useToast } from '../components/Toast/useToast';
import { useNicknameAvailability } from '../hooks/useNicknameAvailability';
import { validateNewPassword, validateProfileImage } from '../lib/accountValidation';
import { getErrorCode, getErrorMessage } from '../lib/authApi';
import { cropToBlob, type CropArea } from '../lib/cropImage';
import { beginOAuth } from '../lib/oauth';
import { POLICY_DOCS, POLICY_INFO } from '../lib/policy';
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
// 프로필(사진·닉네임) / 로그인 방법(연결된 계정, 비밀번호 변경, 카카오 연결, 로그아웃) / 약관 및 정책 / 회원 탈퇴
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
  // 자르기 팝업에 띄울 사진(브라우저 안 임시 주소)과 팝업 안 오류
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropError, setCropError] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  // 탈퇴 팝업의 "안내를 확인했어요" 체크 — 체크해야 [탈퇴하기]가 켜진다
  const [withdrawChecked, setWithdrawChecked] = useState(false);
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

  // 사진을 고르면 바로 올리지 않고 자르기 팝업을 연다 (AUTH-05)
  const changePhoto = (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    const invalid = validateProfileImage(file);
    if (invalid) {
      setProfileError(invalid);
      return;
    }
    setProfileError(null);
    setCropError(null);
    setCropSrc(URL.createObjectURL(file));
  };

  const closeCrop = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCropError(null);
  };

  // 고른 영역만 잘라 올린다. 실패하면 팝업을 열어 둔 채 안내해 다시 시도할 수 있게 한다.
  const uploadCropped = async (area: CropArea) => {
    if (!cropSrc) return;
    setPhotoBusy(true);
    setCropError(null);
    try {
      const blob = await cropToBlob(cropSrc, area);
      updateMe(await updateProfileImage(blob));
      closeCrop();
      showToast('프로필 사진을 바꿨어요.');
    } catch (err) {
      setCropError(getErrorMessage(err, '사진을 올리지 못했어요.'));
    } finally {
      setPhotoBusy(false);
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
                onChange={(event) => changePhoto(event.target.files?.[0])}
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

        <section className="card account-card" aria-labelledby="policy-title">
          <h2 id="policy-title" className="card__subtitle">
            약관 및 정책
          </h2>
          <Link to={POLICY_DOCS.terms.path} className="button button--outline button--block account-card__row">
            {POLICY_DOCS.terms.title}
          </Link>
          <Link to={POLICY_DOCS.privacy.path} className="button button--outline button--block account-card__row">
            {POLICY_DOCS.privacy.title}
          </Link>
          <p className="account-card__desc account-card__version">
            버전 {POLICY_INFO.version} · 시행일 {POLICY_INFO.effectiveDate}
          </p>
        </section>

        <section className="card account-card" aria-labelledby="withdraw-title">
          <h2 id="withdraw-title" className="card__subtitle">
            회원 탈퇴
          </h2>
          <p className="account-card__desc">
            탈퇴하면 계정과 프로필이 바로 지워지고, 보낸 대화는 내용 없이 '탈퇴한 사용자의 메시지'로 남아요. 다른 멤버가 있는
            그룹의 호스트라면 먼저 호스트를 넘겨주세요.
          </p>
          {withdrawError && (
            <p className="field__error" role="alert">
              {withdrawError}
            </p>
          )}
          <button
            type="button"
            className="button button--secondary button--block"
            onClick={() => {
              setWithdrawChecked(false);
              setWithdrawOpen(true);
            }}
          >
            회원 탈퇴
          </button>
        </section>
      </main>

      <ProfileCropDialog
        imageSrc={cropSrc}
        busy={photoBusy}
        error={cropError}
        onConfirm={(area) => void uploadCropped(area)}
        onClose={closeCrop}
      />

      <Dialog
        open={withdrawOpen}
        title="정말 탈퇴할까요?"
        description="탈퇴하면 되돌릴 수 없어요."
        confirmLabel="탈퇴하기"
        busyLabel="탈퇴하는 중"
        tone="danger"
        busy={withdrawing}
        confirmDisabled={!withdrawChecked}
        onConfirm={() => void doWithdraw()}
        onClose={() => setWithdrawOpen(false)}
      >
        {/* 지워지는 정보와 남는 정보 (개인정보 처리방침 제3조와 같은 내용) */}
        <div className="withdraw-info">
          <p className="withdraw-info__title">바로 지워져요</p>
          <ul>
            <li>계정(이메일·닉네임·비밀번호)과 프로필 사진</li>
            <li>카카오 연결, 내 투표, 알림</li>
            <li>나 혼자 있는 그룹과 그 그룹의 모든 기록</li>
          </ul>
          <p className="withdraw-info__title">그룹에 남아요</p>
          <ul>
            <li>내가 보낸 대화: 내용이 지워지고 '탈퇴한 사용자의 메시지'로 표시돼요</li>
            <li>내가 추가한 후보지: 추가한 사람 표시 없이 남아요</li>
            <li>미니게임·집보기 기록의 닉네임: 그룹이 삭제될 때 함께 지워져요</li>
          </ul>
          <label className="withdraw-info__check">
            <input
              type="checkbox"
              checked={withdrawChecked}
              onChange={(event) => setWithdrawChecked(event.target.checked)}
              disabled={withdrawing}
            />
            <span>안내를 확인했고 탈퇴에 동의해요</span>
          </label>
          <Link to={`${POLICY_DOCS.privacy.path}#privacy-retention`} className="withdraw-info__link">
            개인정보 처리방침에서 자세히 보기
          </Link>
        </div>
      </Dialog>
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
