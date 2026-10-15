import {tr} from "../src/i18n/language";
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as api from './data.generated';
import { useMarketNotifications } from '../src/services/useMarketNotifications';
import { enableWebPush, disableWebPush, webPushConfigured } from './push';
export function openNotifications() {
  window.dispatchEvent(new Event('sorti-notifications'));
}
export default function Notifications({
  accountId,
  openTarget,
}: {
  accountId: string;
  openTarget: (target: api.MarketNotification['target']) => Promise<void>;
}) {
  const n = useMarketNotifications(accountId, api),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState('');
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('sorti-notifications', show);
    return () => window.removeEventListener('sorti-notifications', show);
  }, []);
  useEffect(() => {
    setOpen(false);
    setStatus('');
  }, [accountId]);
  const initialNotification = useRef(false);
  useEffect(() => {
    const id = new URL(location.href).searchParams.get('sortiNotification');
    if (!accountId || !n.ready || !id || initialNotification.current) return;
    initialNotification.current = true;
    const item = n.items.find(i => i.id === id);
    if (item) select(item);
    else setOpen(true);
    const url = new URL(location.href);
    url.searchParams.delete('sortiNotification');
    history.replaceState(null, '', url);
  }, [accountId, n.ready, n.items]);
  if (!accountId) return null;
  async function select(item: api.MarketNotification) {
    try {
      await n.read(item);
      await openTarget(item.target);
      setOpen(false);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '無法開啟通知');
    }
  }
  return (
    <>

      {tr(n.toast && (
        <button
          className="notification-toast"
          role="alert"
          onClick={() => {
            if (n.toast) select(n.toast);
          }}
        >
          <strong>{tr(n.toast.title)}</strong>
          <span>{tr(n.toast.body)}</span>
        </button>
      ))}
      {open &&
        createPortal(
          <div className="notification-backdrop">
            <section
              role="dialog"
              aria-modal="true"
              aria-label={tr("通知與設定")}
              className="notification-dialog"
            >
              <button autoFocus onClick={() => setOpen(false)}>{tr("關閉")}</button>
              <h1>{tr("通知與設定")}</h1>
              {tr((['chat', 'orders'] as const).map(kind => (
                <label key={kind}>
                  <input
                    type="checkbox"
                    disabled={!n.ready || n.saving}
                    checked={n.prefs[kind]}
                    onChange={e => {
                      n.update({ ...n.prefs, [kind]: e.target.checked });
                    }}
                  />
                  {tr(kind === 'chat' ? '聊天訊息通知' : '訂單互動通知')}
                </label>
              )))}
              <p>{tr("開關控制使用中提醒及背景推播；通知紀錄仍保留。iPhone 請從主畫面開啟 PWA 後允許通知。")}</p>
              <button
                disabled={!webPushConfigured() || !n.ready || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await enableWebPush();
                    setStatus(
                      '此裝置已登記接收通知；實際送達仍需後端服務啟用。',
                    );
                  } catch (e) {
                    setStatus(e instanceof Error ? e.message : '啟用失敗');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {tr(busy ? '處理中…' : '允許此裝置背景通知')}
              </button>
              {tr(!webPushConfigured() && (
                <p>{tr("Firebase 尚未設定，背景推播尚未啟用。")}</p>
              ))}
              {tr(webPushConfigured() && (
                <button
                  disabled={!n.ready || busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await disableWebPush();
                      setStatus('此裝置已停止接收背景通知。');
                    } catch (e) {
                      setStatus(e instanceof Error ? e.message : '停用失敗');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >{tr("停止此裝置背景通知")}</button>
              ))}
              {tr((status || n.error) && <p role="alert">{tr(status || n.error)}</p>)}
              {tr(n.ready && !n.items.length && <p>{tr("目前沒有通知")}</p>)}
              {n.items.map(item => (
                <button
                  className="notification-item"
                  key={item.id}
                  onClick={() => select(item)}
                >
                  <strong>
                    {tr(!item.read_at ? '● ' : '')}
                    {item.title}
                  </strong>
                  <span>{tr(item.body)}</span>
                  <small>
                    {tr(new Date(item.created_at).toLocaleString('zh-TW'))}
                  </small>
                </button>
              ))}
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
