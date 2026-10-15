import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { acceptLegalPolicies } from '../services/supabaseData';
import LegalChecks from '../components/LegalChecks';
export default function LegalConsentScreen({ navigation, onAccepted }: any) {
  const { theme } = useTheme();
  const [adult, setAdult] = useState(false),
    [agreed, setAgreed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit() {
    if (busy || !adult || !agreed) return;
    setBusy(true);
    setError('');
    try {
      await acceptLegalPolicies(adult, agreed);
      onAccepted();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失敗，請重試。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }}>
        <Text
          style={{ fontSize: 28, fontWeight: '700', color: theme.textMain }}
        >
          使用拾序前，請先確認
        </Text>
        <LegalChecks
          {...{ adult, setAdult, agreed, setAgreed }}
          open={kind => navigation.navigate('LegalPolicy', { kind })}
        />
        <Text accessibilityRole="alert" style={{ color: theme.textMain }}>
          {error}
        </Text>
        <TouchableOpacity
          disabled={!adult || !agreed || busy}
          onPress={submit}
          style={{
            padding: 18,
            borderRadius: 20,
            backgroundColor: theme.primary,
            opacity: !adult || !agreed || busy ? 0.4 : 1,
          }}
        >
          <Text style={{ color: theme.onPrimary, textAlign: 'center' }}>
            {busy ? '保存中…' : '確認並繼續'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Contact')}>
          <Text style={{ color: theme.primary, padding: 12 }}>聯絡我們</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            supabase.auth.signOut().then(({ error: e }) => {
              if (e) setError('登出失敗，請重試。');
            })
          }
        >
          <Text style={{ color: theme.primary, padding: 12 }}>登出帳號</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
