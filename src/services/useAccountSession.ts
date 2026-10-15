import { useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import {
  authenticatedStartScreen,
  loadLegalAcceptance,
  completeNativeGoogleLogin,
} from './supabaseData';

export function useAccountSession() {
  const [accountId, setAccountId] = useState<string | null | undefined>();
  const [destination, setDestination] = useState<{
    id: string;
    screen: 'Home' | 'Quiz' | 'LegalConsent';
  } | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active) setAccountId(session?.user.id ?? null);
      },
    );
    const restore = () => {
      setError('');
      supabase.auth
        .getSession()
        .then(({ data, error: reason }) => {
          if (!active) return;
          if (reason) {
            setError('無法恢復登入，請檢查網路後重試。');
            return;
          }
          setAccountId(data.session?.user.id ?? null);
        })
        .catch(() => {
          if (active) setError('無法恢復登入，請檢查網路後重試。');
        });
    };
    restore();
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [attempt]);
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    setDestination(null);
    loadLegalAcceptance()
      .then(accepted =>
        accepted
          ? authenticatedStartScreen(accountId)
          : ('LegalConsent' as const),
      )
      .then(screen => {
        if (active) setDestination({ id: accountId, screen });
      })
      .catch(() => {
        if (active) {
          setError('無法讀取政策確認紀錄，請重試。');
          setDestination({ id: accountId, screen: 'LegalConsent' });
        }
      });
    return () => {
      active = false;
    };
  }, [accountId, attempt]);
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url?.startsWith('sorti://auth/callback')) return;
      completeNativeGoogleLogin(url).catch(() =>
        Alert.alert('Google 登入失敗', '驗證未完成或已取消，請重新嘗試。'),
      );
    };
    const listener = Linking.addEventListener('url', event =>
      handle(event.url),
    );
    Linking.getInitialURL()
      .then(handle)
      .catch(() => {});
    return () => listener.remove();
  }, []);
  return {
    accountId,
    error,
    retry: () => setAttempt(value => value + 1),
    initialScreen:
      accountId === null
        ? ('Welcome' as const)
        : destination && destination.id === accountId
        ? destination.screen
        : undefined,
  };
}
