import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity, LocalizedAlert as Alert } from "./LocalizedUI";
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, View, Switch } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import * as api from '../services/supabaseData';
import { useMarketNotifications } from '../services/useMarketNotifications';
import {
  enableNativePush,
  disableNativePush,
  listenNativePush,
  nativePushConfigured,
} from '../services/nativePush';
const listeners = new Set<() => void>();
export function openNotificationCenter() {
  listeners.forEach(fn => fn());
}
export default function MarketNotifications({
  accountId,
  openTarget,
}: {
  accountId: string | null | undefined;
  openTarget: (target: api.MarketNotification['target']) => Promise<void>;
}) {
  const { theme } = useTheme(),
    n = useMarketNotifications(accountId, api);
  const [open, setOpen] = useState(false),
    [pushBusy, setPushBusy] = useState(false),
    [pushStatus, setPushStatus] = useState('');
  useEffect(() => {
    const fn = () => setOpen(true);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  useEffect(() => {
    setOpen(false);
    setPushStatus('');
    if (!accountId) return;
    return listenNativePush(target => {
      openTarget(target).catch(e => Alert.alert('無法開啟', e.message));
    });
  }, [accountId, openTarget]);
  if (!accountId) return null;
  const text = { color: theme.textMain, fontSize: 16 };
  async function select(item: api.MarketNotification) {
    try {
      await n.read(item);
      await openTarget(item.target);
      setOpen(false);
    } catch (e) {
      Alert.alert(
        '無法開啟通知',
        e instanceof Error ? e.message : '請稍後重試',
      );
    }
  }
  return (
    <>
      {!!n.toast && (
        <TouchableOpacity
          accessibilityRole="alert"
          onPress={() => {
            if (n.toast) select(n.toast);
          }}
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: 64,
            padding: 18,
            borderRadius: 16,
            backgroundColor: theme.cardBg,
            borderWidth: 1,
            borderColor: theme.primary,
          }}
        >
          <Text style={[text, { fontWeight: '700' }]}>{n.toast.title}</Text>
          <Text style={text}>{n.toast.body}</Text>
        </TouchableOpacity>
      )}
      <Modal
        visible={open}
        onRequestClose={() => setOpen(false)}
        animationType="slide"
      >
        <ScrollView
          contentContainerStyle={{
            padding: 24,
            paddingTop: 48,
            gap: 16,
            backgroundColor: theme.background,
            flexGrow: 1,
          }}
        >
          <TouchableOpacity
            onPress={() => setOpen(false)}
            accessibilityRole="button"
          >
            <Text style={text}>返回</Text>
          </TouchableOpacity>
          <Text style={[text, { fontSize: 24, fontWeight: '700' }]}>
            通知與設定
          </Text>
          <Text style={text}>聊天及交易互動通知</Text>
          {(['chat', 'orders'] as const).map(kind => (
            <View
              key={kind}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={text}>
                {kind === 'chat' ? '聊天訊息通知' : '訂單互動通知'}
              </Text>
              <Switch
                accessibilityLabel={
                  kind === 'chat' ? '聊天訊息通知' : '訂單互動通知'
                }
                disabled={!n.ready || n.saving}
                value={n.prefs[kind]}
                onValueChange={v => {
                  n.update({ ...n.prefs, [kind]: v });
                }}
              />
            </View>
          ))}
          <Text style={{ color: theme.textSub }}>
            開關控制使用中提醒及背景推播；通知紀錄仍保留。背景推播需完成服務設定並允許手機通知。
          </Text>
          <TouchableOpacity
            disabled={pushBusy || !n.ready || !nativePushConfigured()}
            onPress={async () => {
              setPushBusy(true);
              try {
                await enableNativePush();
                setPushStatus(
                  '此裝置已登記接收通知；實際送達仍需後端服務啟用。',
                );
              } catch (e) {
                setPushStatus(e instanceof Error ? e.message : '啟用失敗');
              } finally {
                setPushBusy(false);
              }
            }}
          >
            <Text style={text}>
              {pushBusy ? '處理中…' : '允許此手機背景通知'}
            </Text>
          </TouchableOpacity>
          {!nativePushConfigured() && (
            <Text style={{ color: theme.textSub }}>
              Firebase 尚未設定，背景推播尚未啟用。
            </Text>
          )}
          {nativePushConfigured() && (
            <TouchableOpacity
              disabled={pushBusy || !n.ready}
              onPress={async () => {
                setPushBusy(true);
                try {
                  await disableNativePush();
                  setPushStatus('此裝置已停止接收背景通知。');
                } catch (e) {
                  setPushStatus(e instanceof Error ? e.message : '停用失敗');
                } finally {
                  setPushBusy(false);
                }
              }}
            >
              <Text style={text}>停止此手機背景通知</Text>
            </TouchableOpacity>
          )}
          {!!pushStatus && (
            <Text accessibilityRole="alert" style={text}>
              {pushStatus}
            </Text>
          )}
          {!!n.error && (
            <Text accessibilityRole="alert" style={text}>
              {n.error}
            </Text>
          )}
          {n.ready && !n.items.length && <Text style={text}>目前沒有通知</Text>}
          {n.items.map(item => (
            <TouchableOpacity
              key={item.id}
              onPress={() => select(item)}
              style={{
                padding: 16,
                borderWidth: 1,
                borderColor: item.read_at ? theme.border : theme.primary,
                borderRadius: 14,
                backgroundColor: theme.cardBg,
              }}
            >
              <Text style={[text, { fontWeight: '700' }]}>
                {!item.read_at ? '● ' : ''}
                {item.title}
              </Text>
              <Text style={text}>{item.body}</Text>
              <Text style={{ color: theme.textSub }}>
                {new Date(item.created_at).toLocaleString('zh-TW')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Modal>
    </>
  );
}
