import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from "../components/LocalizedUI";
import { useScreenStyles } from '../design/useScreenStyles';
import React, { useEffect, useState } from 'react';
import { Image, AppState, Linking, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';

import type { RootStackParamList } from '../../App';
import { useSortiTheme as useTheme } from '../design/sortiTheme';
import SortiBrand from '../components/SortiBrand';
import Icon from 'react-native-vector-icons/Ionicons';
import { supabase } from '../lib/supabase';
import {
  createGoogleLoginUrl,
  nativeGoogleRedirect,
} from '../services/supabaseData';

type LoginScreenProps = StackScreenProps<RootStackParamList, 'Login'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getLoginErrorMessage = (code: string | undefined, message: string) => {
  const normalizedMessage = message.toLowerCase();

  if (
    code === 'email_not_confirmed' ||
    normalizedMessage.includes('email not confirmed')
  ) {
    return '此帳號尚未完成 Email 驗證，請先到信箱點擊驗證連結後再登入。';
  }

  if (
    code === 'invalid_credentials' ||
    normalizedMessage.includes('invalid login credentials')
  ) {
    return 'Email 或密碼不正確，請重新確認後再試。';
  }

  if (
    code === 'over_request_rate_limit' ||
    normalizedMessage.includes('rate limit')
  ) {
    return '嘗試次數過多，請稍候再試。';
  }

  return `登入失敗：${message}`;
};

const LoginScreen = ({ navigation }: LoginScreenProps) => {
  const { theme, isDarkMode } = useTheme();
  const styles = useScreenStyles(baseStyles, theme);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') setGoogleLoading(false);
    });
    return () => subscription.remove();
  }, []);

  const handleLogin = async () => {
    if (loading) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      Alert.alert('資料未填完整', '請輸入 Email 與密碼。');
      return;
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      Alert.alert('Email 格式錯誤', '請輸入有效的 Email。');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        Alert.alert(
          '登入失敗',
          getLoginErrorMessage(error.code, error.message),
        );
        return;
      }

      if (!data.session || !data.user) {
        Alert.alert('登入失敗', '沒有取得有效的登入 Session，請稍後再試。');
        return;
      }

      // The account session gate chooses Home or the first-time quiz.
    } catch {
      Alert.alert('登入失敗', '目前無法連線到登入服務，請檢查網路後再試。');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (loading || googleLoading) return;
    setGoogleLoading(true);
    try {
      const url = await createGoogleLoginUrl(nativeGoogleRedirect);
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(
        'Google 登入',
        error instanceof Error
          ? error.message
          : '無法開啟 Google 登入，請重試。',
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="返回歡迎頁"
              onPress={() => navigation.goBack()}
              style={{
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="chevron-back" size={26} color={theme.textMain} />
            </TouchableOpacity>
            <SortiBrand />
          </View>
          <View style={styles.intro}>
            <Text style={[styles.title, { color: theme.textMain }]}>
              登入 拾序
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSub }]}>
              登入後查看你的物品、任務與整理紀錄。
            </Text>
          </View>
          <View
            style={[
              styles.form,
              {
                backgroundColor: theme.background,
                borderColor: theme.background,
              },
            ]}
          >
            <Text style={[styles.formTitle, { color: theme.textMain }]}>
              歡迎回來
            </Text>
            <Text style={[styles.formSubtitle, { color: theme.textSub }]}>
              請輸入電子郵件與密碼。
            </Text>
            <Text style={[styles.label, { color: theme.textMain }]}>
              電子郵件
            </Text>
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                },
              ]}
            >
              <Icon name="mail-outline" size={20} color={theme.textSub} />
              <TextInput
                accessibilityLabel="電子郵件"
                style={[styles.input, { color: theme.textMain }]}
                value={email}
                onChangeText={setEmail}
                placeholder="你的 Email"
                placeholderTextColor={theme.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                editable={!loading}
              />
            </View>
            <Text style={[styles.label, { color: theme.textMain }]}>密碼</Text>
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                },
              ]}
            >
              <Icon
                name="lock-closed-outline"
                size={20}
                color={theme.textSub}
              />
              <TextInput
                accessibilityLabel="密碼"
                style={[styles.input, { color: theme.textMain }]}
                placeholder="輸入密碼"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor={theme.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                editable={!loading}
                onSubmitEditing={handleLogin}
                returnKeyType="done"
              />
              <TouchableOpacity
                accessibilityLabel={showPassword ? '隱藏密碼' : '顯示密碼'}
                style={styles.eyeButton}
                onPress={() => setShowPassword(value => !value)}
              >
                <Icon
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.textSub}
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              style={[
                styles.loginBtn,
                { backgroundColor: theme.primary },
                loading && styles.disabledButton,
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <>
                  <Text
                    style={[styles.loginBtnText, { color: theme.onPrimary }]}
                  >
                    登入
                  </Text>
                  <Icon
                    name="arrow-forward"
                    size={20}
                    color={theme.onPrimary}
                  />
                </>
              )}
            </TouchableOpacity>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                marginTop: 24,
                marginBottom: 8,
              }}
            >
              <View
                style={{ flex: 1, height: 1, backgroundColor: theme.border }}
              />
              <Text style={{ color: theme.textSub }}>或透過以下方式登入</Text>
              <View
                style={{ flex: 1, height: 1, backgroundColor: theme.border }}
              />
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="使用 Google 登入"
              disabled={loading || googleLoading}
              onPress={handleGoogleLogin}
              style={[
                styles.loginBtn,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.border,
                  borderWidth: 1,
                  marginTop: 12,
                },
              ]}
            >
              <Image source={require('../assets/images/google-g.png')} style={{width:22,height:22}} resizeMode="contain" accessible={false}/>
              <Text style={{ color: theme.textMain, fontWeight: '600' }}>
                使用 Google 登入
              </Text>
            </TouchableOpacity>
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: theme.textSub }]}>
                還沒註冊帳號嗎？
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => navigation.navigate('Register')}
                disabled={loading}
              >
                <Text style={[styles.registerLink, { color: theme.primary }]}>
                  請先完成帳號註冊
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
const baseStyles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 32,
    paddingBottom: 30,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  intro: { marginTop: 20, marginBottom: 16 },
  eyebrow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  eyebrowText: { fontSize: 12, fontWeight: '600' },
  title: {
    fontSize: 32,
    lineHeight: 45,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 18,
  },
  subtitle: { fontSize: 14, lineHeight: 23, marginTop: 12 },
  form: { padding: 0 },
  formTitle: { fontSize: 23, fontWeight: '700' },
  formSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 16,
  },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 9 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 15,
    paddingLeft: 14,
    minHeight: 54,
    marginBottom: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 52,
    paddingVertical: 10,
    paddingRight: 10,
    fontSize: 15,
  },
  eyeButton: {
    width: 44,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtn: {
    minHeight: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 14,
    marginTop: 4,
  },
  loginBtnText: { fontSize: 15, fontWeight: '700' },
  disabledButton: { opacity: 0.6 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 22,
    alignItems: 'center',
  },
  footerText: { fontSize: 13 },
  registerLink: { fontSize: 13, fontWeight: '700', paddingVertical: 8 },
  bottomNote: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  note: { fontSize: 12 },
});
export default LoginScreen;
