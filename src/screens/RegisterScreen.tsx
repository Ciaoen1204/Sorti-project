import LegalChecks from '../components/LegalChecks';
import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from "../components/LocalizedUI";
import { useScreenStyles } from '../design/useScreenStyles';
import React, { useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';

import type { RootStackParamList } from '../../App';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import SortiBrand from '../components/SortiBrand';
import {
  createGoogleLoginUrl,
  registerWithLegalConfirmation,
  nativeGoogleRedirect,
} from '../services/supabaseData';

type RegisterScreenProps = StackScreenProps<RootStackParamList, 'Register'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const getRegisterErrorMessage = (code: string | undefined, message: string) => {
  const normalizedMessage = message.toLowerCase();

  if (
    code === 'user_already_exists' ||
    normalizedMessage.includes('already registered')
  ) {
    return '此 Email 已註冊，請直接前往登入。';
  }

  if (code === 'weak_password' || normalizedMessage.includes('password')) {
    return '密碼不符合安全要求，請使用至少 8 個字元的密碼。';
  }

  if (
    code === 'over_email_send_rate_limit' ||
    normalizedMessage.includes('rate limit')
  ) {
    return '驗證信寄送次數過多，請稍候再試。';
  }

  if (normalizedMessage.includes('database error saving new user')) {
    return '無法建立使用者資料，Username 可能已被使用，請更換後再試。';
  }

  return `註冊失敗：${message}`;
};

const RegisterScreen = ({ navigation }: RegisterScreenProps) => {
  const { theme } = useTheme();
  const styles = useScreenStyles(baseStyles, theme);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adult,setAdult]=useState(false),[agreed,setAgreed]=useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  async function googleRegister() {
    if (googleBusy || loading) return;
    setGoogleBusy(true);
    try {
      await Linking.openURL(await createGoogleLoginUrl(nativeGoogleRedirect));
    } catch (e) {
      Alert.alert(
        'Google 註冊',
        e instanceof Error ? e.message : '無法開啟，請重試。',
      );
    } finally {
      setGoogleBusy(false);
    }
  }

  const handleRegister = async () => {
    if(!adult||!agreed){Alert.alert('請完成確認','請確認已年滿 18 歲，並同意服務條款及閱讀隱私權政策。');return;}
    if (loading) {
      return;
    }

    const normalizedDisplayName = displayName.trim();
    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (
      !normalizedDisplayName ||
      !normalizedUsername ||
      !normalizedEmail ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert('資料未填完整', '請填寫所有註冊欄位。');
      return;
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      Alert.alert('Email 格式錯誤', '請輸入有效的 Email。');
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert(
        '密碼長度不足',
        `密碼至少需要 ${MIN_PASSWORD_LENGTH} 個字元。`,
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('密碼不一致', '密碼與確認密碼必須相同。');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await registerWithLegalConfirmation(normalizedEmail,password,{username:normalizedUsername,display_name:normalizedDisplayName},adult,agreed);

      if (error) {
        Alert.alert(
          '註冊失敗',
          getRegisterErrorMessage(error.code, error.message),
        );
        return;
      }

      if (data.session) {
        // Authenticated root restricts navigation until server consent is recorded.
        return;
      }

      if (data.user) {
        Alert.alert('註冊成功', '帳號已建立，請使用電子信箱與密碼登入。', [
          {
            text: '回到登入',
            onPress: () => navigation.navigate('Login'),
          },
        ]);
        return;
      }

      Alert.alert('註冊失敗', '沒有取得有效的註冊結果，請稍後再試。');
    } catch {
      Alert.alert('註冊失敗', '目前無法連線到註冊服務，請檢查網路後再試。');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    {
      label: '姓名',
      value: displayName,
      set: setDisplayName,
      placeholder: '請輸入姓名',
      icon: 'person-outline',
      secure: false,
    },
    {
      label: '使用者名稱',
      value: username,
      set: setUsername,
      placeholder: '請輸入使用者名稱',
      icon: 'at-outline',
      secure: false,
    },
    {
      label: '電子信箱',
      value: email,
      set: setEmail,
      placeholder: 'name@example.com',
      icon: 'mail-outline',
      secure: false,
    },
    {
      label: '密碼',
      value: password,
      set: setPassword,
      placeholder: '請輸入密碼',
      icon: 'lock-closed-outline',
      secure: !showPassword,
    },
    {
      label: '確認密碼',
      value: confirmPassword,
      set: setConfirmPassword,
      placeholder: '請再次輸入密碼',
      icon: 'lock-closed-outline',
      secure: !showConfirm,
    },
  ];
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="返回上一頁"
            onPress={() => navigation.goBack()}
            style={styles.backLink}
          >
            <Icon name="chevron-back" size={26} color={theme.textMain} />
          </TouchableOpacity>
          <SortiBrand />
        </View>
        <Text style={[styles.headerTitle, { color: theme.textMain }]}>
          建立帳號
        </Text>
        <Text
          style={{ color: theme.textSub, marginBottom: 14, lineHeight: 24 }}
        >
          開始管理物品，為生活留出更多空間。
        </Text>
        {fields.map((f, index) => (
          <View key={f.label}>
            <Text style={[styles.label, { color: theme.textMain }]}>
              {f.label}
            </Text>
            <View
              style={[
                styles.field,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ]}
            >
              {index >= 2 && <Icon name={index===4 ? "checkmark-outline" : f.icon} size={22} color={theme.textSub} />}
              <TextInput
                accessibilityLabel={f.label}
                style={[styles.input, { color: theme.textMain }]}
                value={f.value}
                onChangeText={f.set}
                placeholder={f.placeholder}
                placeholderTextColor={theme.placeholder}
                secureTextEntry={index >= 3 && f.secure}
                autoCapitalize={index === 0 ? 'words' : 'none'}
                autoCorrect={false}
                keyboardType={index === 2 ? 'email-address' : 'default'}
                autoComplete={
                  index === 2
                    ? 'email'
                    : index >= 3
                    ? 'new-password'
                    : index === 0
                    ? 'name'
                    : 'username-new'
                }
                editable={!loading}
              />
              {index >= 3 && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={(f.secure ? '顯示' : '隱藏') + f.label}
                  onPress={() =>
                    index === 3
                      ? setShowPassword(v => !v)
                      : setShowConfirm(v => !v)
                  }
                  style={styles.backLink}
                >
                  <Icon
                    name={f.secure ? 'eye-outline' : 'eye-off-outline'}
                    size={22}
                    color={theme.textSub}
                  />
                </TouchableOpacity>
              )}
            </View>
            {index === 3 && (
              <Text
                style={{
                  color: theme.textSub,
                  marginTop: -4,
                  marginBottom: 14,
                  fontSize: 13,
                }}
              >
                ✓ 密碼至少 8 個字元
              </Text>
            )}
          </View>
        ))}
        <TouchableOpacity
          accessibilityRole="button"
          style={[
            styles.regBtn,
            { backgroundColor: theme.primary },
            loading && styles.disabledButton,
          ]}
          onPress={handleRegister}
          disabled={loading || !adult || !agreed}
        >
          <Text style={[styles.regBtnText, { color: theme.onPrimary }]}>
            {loading ? '註冊中…' : '建立帳號'}
          </Text>
        </TouchableOpacity>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginVertical: 24,
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
          <Text style={{ color: theme.textSub }}>或透過以下方式註冊</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={googleRegister}
          disabled={loading || googleBusy}
          style={[
            styles.regBtn,
            {
              marginTop: 0,
              flexDirection:'row',gap:12,
              backgroundColor: theme.cardBg,
              borderWidth: 1,
              borderColor: theme.border,
            },
          ]}
        >
          <Image source={require('../assets/images/google-g.png')} style={{width:22,height:22}} resizeMode="contain" accessible={false}/>
          <Text style={[styles.regBtnText, { color: theme.textMain }]}>
            {googleBusy ? '處理中…' : '使用 Google 帳號註冊'}
          </Text>
        </TouchableOpacity>
        <LegalChecks {...{adult,setAdult,agreed,setAgreed}} open={kind=>navigation.navigate('LegalPolicy',{kind})}/>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => navigation.navigate('Login')}
          style={{ padding: 20, alignItems: 'center' }}
        >
          <Text style={{ color: theme.primary, lineHeight: 24 }}>
            已經有帳號了？前往登入
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const baseStyles = StyleSheet.create({
  backLink: {
    width: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'left',
    marginTop: 24,
    marginBottom: 12,
  },
  inputSection: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    fontSize: 16,
    paddingVertical: 14,
  },
  regBtn: {
    minHeight: 54,
    padding: 14,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    alignSelf: 'center',
    marginTop: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  regBtnText: {
    fontSize: 18,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default RegisterScreen;
