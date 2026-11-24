import { getErrorCode } from './authApi';
import { registerPushSubscription, unregisterPushSubscription } from './notificationApi';

export function supportsPush(): boolean {
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
function applicationKey(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}
export async function enablePush(publicKey: string): Promise<PushSubscription> {
  if (!supportsPush()) throw new Error('이 브라우저에서는 알림 구독을 사용할 수 없어요.');
  if (await Notification.requestPermission() !== 'granted') throw new Error('브라우저 알림 권한이 허용되지 않았어요. 브라우저 설정에서 변경할 수 있어요.');
  await navigator.serviceWorker.register('/push-sw.js');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('브라우저 알림 준비 시간이 초과됐어요. 다시 시도해주세요.')), 10000); }),
  ]).finally(() => clearTimeout(timer));
  const previous = await registration.pushManager.getSubscription();
  const subscription = previous ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(publicKey) });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.auth || !json.keys.p256dh) throw new Error('브라우저 구독 정보를 확인하지 못했어요.');
  try { await registerPushSubscription({ endpoint: json.endpoint, keys: { auth: json.keys.auth, p256dh: json.keys.p256dh } }); }
  catch (error) { if (!previous) await subscription.unsubscribe().catch(() => false); throw error; }
  return subscription;
}
export async function disablePush(subscription: PushSubscription): Promise<void> {
  try { await unregisterPushSubscription(subscription.endpoint); }
  catch (error) { if (getErrorCode(error) !== 'PUSH_SUBSCRIPTION_NOT_FOUND') throw error; }
  if (!await subscription.unsubscribe()) throw new Error('브라우저 구독 해제를 다시 시도해주세요.');
}
