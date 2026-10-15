import { useEffect, useRef, useState } from 'react';
import type {
  MarketNotification,
  NotificationPreferences,
} from './notificationTypes';
type Api = {
  loadMarketNotifications: () => Promise<MarketNotification[]>;
  loadNotificationPreferences: () => Promise<NotificationPreferences>;
  saveNotificationPreferences: (v: NotificationPreferences) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
};
export function useMarketNotifications(
  accountId: string | null | undefined,
  api: Api,
) {
  const [items, setItems] = useState<MarketNotification[]>([]),
    [prefs, setPrefs] = useState<NotificationPreferences>({
      chat: true,
      orders: true,
    }),
    [error, setError] = useState(''),
    [toast, setToast] = useState<MarketNotification | null>(null),
    [ready, setReady] = useState(false),
    [saving, setSaving] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    let active = true,
      loading = false;
    seen.current = null;
    setItems([]);
    setToast(null);
    setReady(false);
    setError('');
    if (!accountId) return;
    async function refresh() {
      if (loading) return;
      loading = true;
      try {
        const [rows, preferences] = await Promise.all([
          api.loadMarketNotifications(),
          api.loadNotificationPreferences(),
        ]);
        if (!active) return;
        const fresh = seen.current
          ? rows.find(
              n =>
                !seen.current!.has(n.id) && !n.read_at && preferences[n.kind],
            )
          : undefined;
        seen.current = new Set(rows.map(n => n.id));
        if (fresh) setToast(fresh);
        setItems(rows);
        setPrefs(preferences);
        setReady(true);
        setError('');
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : '無法載入通知');
      } finally {
        loading = false;
      }
    }
    void refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [accountId, api]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);
  async function update(next: NotificationPreferences) {
    const previous = prefs;
    setPrefs(next);
    setSaving(true);
    try {
      await api.saveNotificationPreferences(next);
      setPrefs(next);
      setError('');
    } catch (e) {
      setPrefs(previous);
      setError(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  }
  async function read(item: MarketNotification) {
    await api.markNotificationRead(item.id);
    setItems(v =>
      v.map(n =>
        n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n,
      ),
    );
    setToast(null);
  }
  return {
    items,
    prefs,
    error,
    toast,
    ready,
    saving,
    update,
    read,
    setToast,
    unread: items.filter(n => !n.read_at).length,
  };
}
