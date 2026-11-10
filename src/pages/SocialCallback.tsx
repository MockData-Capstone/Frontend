import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../app/providers/useAuth';
import Header from '../components/Header';
import { ErrorNotice, FeaturePage } from '../components/FeatureUI';
import { exchangeSocialCode, getAccountLinkInfo, getErrorMessage } from '../lib/authApi';
import { consumeOAuthIntent, type SocialProvider } from '../lib/oauth';

export default function SocialCallback({ provider }: { provider: SocialProvider }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signIn, accessToken } = useAuth();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const intent = consumeOAuthIntent(provider, params.get('state'));
        const code = params.get('code');
        if (!code || params.has('error')) throw new Error('소셜 인증을 완료하지 못했어요. 다시 시도해주세요.');
        if (intent.mode === 'link') {
          if (!accessToken) throw new Error('다시 로그인한 뒤 계정 연결을 시작해주세요.');
          navigate('/account', { replace: true, state: { socialLink: { provider, code } } });
          return;
        }
        const result = await exchangeSocialCode(provider, code);
        if (result.status === 'SIGNUP_REQUIRED') {
          navigate('/signup/social', { replace: true, state: { ...result.signup, provider } });
        } else { signIn(result.tokens); navigate('/workspaces', { replace: true }); }
      } catch (err) {
        const link = getAccountLinkInfo(err);
        if (link) navigate('/login/link-account', { replace: true, state: { provider, ...link } });
        else setError(getErrorMessage(err, err instanceof Error ? err.message : '소셜 인증에 실패했어요.'));
      }
    })();
  }, [provider, params, accessToken, signIn, navigate]);
  return <div className="page"><Header /><FeaturePage title="소셜 인증"><ErrorNotice message={error} />{error ? <div className="feature-actions"><Link to="/login">로그인으로</Link><Link to="/account">내 정보로</Link></div> : <p>인증을 확인하고 있어요...</p>}</FeaturePage></div>;
}
