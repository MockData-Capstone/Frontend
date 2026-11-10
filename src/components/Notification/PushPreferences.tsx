import { useCallback, useState } from 'react';
import { useResource } from '../../hooks/useResource';
import { useTask } from '../../hooks/useTask';
import { getPushPublicKey } from '../../lib/notificationApi';
import { disablePush, enablePush, supportsPush } from '../../lib/push';
import { ErrorNotice } from '../FeatureUI';

export default function PushPreferences() {
  const supported = supportsPush();
  const config = useResource(useCallback(async () => {
    const key = await getPushPublicKey();
    const registration = supported ? await navigator.serviceWorker.getRegistration() : undefined;
    return { key, subscription: await registration?.pushManager.getSubscription() ?? null };
  }, [supported]));
  const task = useTask();
  const [notice, setNotice] = useState('');
  return <section className="feature-card"><h2>브라우저 알림 구독</h2><ErrorNotice message={config.error} retry={() => { void config.reload(); }} /><ErrorNotice message={task.error} />
    {!supported ? <p>브라우저 알림을 지원하는 HTTPS 환경에서 사용할 수 있어요.</p> : !config.loading && !config.data?.key.enabled ? <p>현재 브라우저 알림 발송은 준비 중이에요. 앱 안 알림함을 이용해주세요.</p> : <>
      <p>이 기기의 알림 구독을 현재 로그인한 계정에 연결합니다.</p><div className="feature-actions">
        <button className="button button--primary" disabled={task.busy || !config.data?.key.publicKey} onClick={() => void task.run(() => enablePush(config.data!.key.publicKey!), async () => { setNotice('구독 정보를 저장했어요.'); await config.reload(); })}>{config.data?.subscription ? '현재 계정에 구독 연결' : '브라우저 알림 구독'}</button>
      </div></>}
    {config.data?.subscription && <button className="button button--secondary" disabled={task.busy} onClick={() => void task.run(() => disablePush(config.data!.subscription!), async () => { setNotice('이 기기의 구독을 해제했어요.'); await config.reload(); })}>이 기기 구독 해제</button>}
    {notice && <p role="status" className="feature-success">{notice}</p>}
  </section>;
}
