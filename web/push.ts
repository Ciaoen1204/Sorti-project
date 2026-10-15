import { initializeApp, getApps } from 'firebase/app';
import {
  getMessaging,
  getToken,
  deleteToken,
  isSupported,
} from 'firebase/messaging';
import { registerPushDevice, unregisterPushDevice } from './data.generated';
declare const __FIREBASE_CONFIG__: Record<string, string>;
declare const __FIREBASE_VAPID__: string;
export function webPushConfigured() {
  return !!__FIREBASE_CONFIG__.projectId && !!__FIREBASE_VAPID__;
}
export async function enableWebPush() {
  if (!webPushConfigured())
    throw new Error('尚未設定 Firebase 網頁推播，完成設定後即可啟用。');
  if (!window.isSecureContext || !(await isSupported()))
    throw new Error(
      '此瀏覽器尚不支援推播；iPhone 請先將網站加入主畫面後開啟。',
    );
  const permission = await Notification.requestPermission();
  if (permission !== 'granted')
    throw new Error('通知權限未允許，請到系統設定開啟。');
  const app = getApps()[0] || initializeApp(__FIREBASE_CONFIG__);
  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), {
    vapidKey: __FIREBASE_VAPID__,
    serviceWorkerRegistration: registration,
  });
  await registerPushDevice(token, 'web');
  localStorage.setItem('sorti-push-token', token);
  return token;
}
export async function disableWebPush() {
  const token = localStorage.getItem('sorti-push-token');
  if (!token) return;
  await unregisterPushDevice(token);
  if (webPushConfigured() && (await isSupported())) {
    const app = getApps()[0] || initializeApp(__FIREBASE_CONFIG__);
    await deleteToken(getMessaging(app));
  }
  localStorage.removeItem('sorti-push-token');
}
