import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  deleteToken,
  onTokenRefresh,
  onNotificationOpenedApp,
  getInitialNotification,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import { registerPushDevice, unregisterPushDevice } from './supabaseData';
export function nativePushConfigured() {
  return Platform.OS === 'android' && getApps().length > 0;
}
export async function enableNativePush() {
  if (!nativePushConfigured())
    throw new Error(
      '尚未設定 Firebase；完成設定並更新 App 後即可啟用背景通知。',
    );
  if (Number(Platform.Version) >= 33) {
    const p = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (p !== PermissionsAndroid.RESULTS.GRANTED)
      throw new Error('通知權限未允許，請到手機設定開啟。');
  }
  const token = await getToken(getMessaging());
  await registerPushDevice(token, 'android');
  await AsyncStorage.setItem('sorti-push-token', token);
  return token;
}
export async function disableNativePush() {
  if (!nativePushConfigured()) return;
  const m = getMessaging();
  const token = await AsyncStorage.getItem('sorti-push-token');
  if (!token) return;
  await unregisterPushDevice(token);
  await deleteToken(m);
  await AsyncStorage.removeItem('sorti-push-token');
}
export function listenNativePush(open: (data: Record<string, string>) => void) {
  if (!nativePushConfigured()) return () => {};
  const m = getMessaging();
  const refresh = onTokenRefresh(m, t => {
    AsyncStorage.getItem('sorti-push-token')
      .then(async old => {
        if (!old) return;
        await registerPushDevice(t, 'android');
        if (old !== t) await unregisterPushDevice(old);
        await AsyncStorage.setItem('sorti-push-token', t);
      })
      .catch(() => {});
  });
  const tap = onNotificationOpenedApp(m, r =>
    open((r.data || {}) as Record<string, string>),
  );
  getInitialNotification(m)
    .then(r => {
      if (r) open((r.data || {}) as Record<string, string>);
    })
    .catch(() => {});
  return () => {
    refresh();
    tap();
  };
}
