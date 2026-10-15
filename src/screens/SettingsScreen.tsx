import {useLanguage} from '../i18n/language';
import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from "../components/LocalizedUI";
import { openNotificationCenter } from '../components/MarketNotifications';
import { disableNativePush } from '../services/nativePush';
import { useScreenStyles } from '../design/useScreenStyles';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Switch, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { setDailyReminder } from '../services/supabaseData';
import { appAbout, reminderDescription } from '../data/appSupport';

const SettingsScreen = ({ navigation }: any) => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const {language,setLanguage}=useLanguage();
  const styles = useScreenStyles(baseStyles, theme);
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);

  const [savingReminder, setSavingReminder] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active)
          setIsNotificationEnabled(!!data.user?.user_metadata.daily_reminder);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const toggleNotification = async () => {
    if (savingReminder) return;
    setSavingReminder(true);
    try {
      await setDailyReminder(!isNotificationEnabled);
      setIsNotificationEnabled(value => !value);
    } catch (error) {
      Alert.alert(
        '儲存失敗',
        error instanceof Error ? error.message : '請稍後重試。',
      );
    } finally {
      setSavingReminder(false);
    }
  };
  async function logout() {
    try {
      await disableNativePush();
    } catch {
      Alert.alert(
        '登出失敗',
        '無法取消此裝置推播，請連線後重試，以免其他帳號收到你的通知。',
      );
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('登出失敗', error.message);
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  // 關鍵修正：將動態邊框樣式徹底移出行內標籤，完美避開 ESLint 警告
  const logoutCardStyle = [
    styles.card,
    styles.logoutCard,
    {
      backgroundColor: theme.cardBg,
      borderColor: isDarkMode ? '#423833' : '#fce8e8',
    },
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* 頂部導覽 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeftBtn}
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevron-back" size={28} color={theme.textMain} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textMain }]}>
          設定
        </Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 帳號設定區塊 */}
        <Text style={[styles.sectionTitle, { color: theme.textSub }]}>
          帳號設定
        </Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <View style={styles.itemLeft}>
              <Icon
                name="person-outline"
                size={22}
                color={theme.textSub}
                style={styles.itemIcon}
              />
              <Text style={[styles.itemText, { color: theme.textMain }]}>
                編輯個人資料
              </Text>
            </View>
            <Icon name="chevron-forward" size={20} color={theme.textSub} />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <View style={styles.itemLeft}>
              <Icon
                name="lock-closed-outline"
                size={22}
                color={theme.textSub}
                style={styles.itemIcon}
              />
              <Text style={[styles.itemText, { color: theme.textMain }]}>
                變更密碼
              </Text>
            </View>
            <Icon name="chevron-forward" size={20} color={theme.textSub} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.cardBg }]}
          onPress={() => navigation.navigate('Quiz')}
        >
          <Text style={[styles.itemText, { color: theme.textMain }]}>
            重新進行收納測驗
          </Text>
        </TouchableOpacity>
        {/* 通用設定區塊 */}
        <Text style={[styles.sectionTitle, { color: theme.textSub }]}>
          通用設定
        </Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
          <TouchableOpacity style={styles.itemRow} accessibilityRole="button" accessibilityLabel="語言" onPress={()=>Alert.alert('語言',undefined,[{text:'繁體中文',onPress:()=>{void setLanguage('zh-TW').catch(()=>Alert.alert('儲存失敗'));}},{text:'English',onPress:()=>{void setLanguage('en').catch(()=>Alert.alert('儲存失敗'));}},{text:'取消',style:'cancel'}])}>
            <View style={styles.itemLeft}><Icon name="language-outline" size={22} color={theme.textSub} style={styles.itemIcon}/><Text style={[styles.itemText,{color:theme.textMain}]}>語言</Text></View>
            <Text style={[styles.valueText,{color:theme.textSub}]}>{language==='en'?'English':'繁體中文'}</Text>
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          {/* 主題欄位改為 Switch 開關直接控制全域主題 */}
          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Icon
                name="color-palette-outline"
                size={22}
                color={theme.textSub}
                style={styles.itemIcon}
              />
              <Text style={[styles.itemText, { color: theme.textMain }]}>
                深色模式
              </Text>
            </View>
            <Switch
              trackColor={{ false: '#e0e0e0', true: theme.primary }}
              thumbColor={isDarkMode ? '#fff' : '#f4f3f4'}
              ios_backgroundColor="#e0e0e0"
              onValueChange={toggleTheme}
              value={isDarkMode}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Icon
                name="notifications-outline"
                size={22}
                color={theme.textSub}
                style={styles.itemIcon}
              />
              <Text style={[styles.itemText, { color: theme.textMain }]}>
                每日任務提醒
              </Text>
            </View>
            <Switch
              trackColor={{ false: '#e0e0e0', true: theme.primary }}
              thumbColor={isNotificationEnabled ? '#fff' : '#f4f3f4'}
              ios_backgroundColor="#e0e0e0"
              disabled={savingReminder}
              onValueChange={toggleNotification}
              value={isNotificationEnabled}
            />
          </View>
        </View>

        <Text style={[styles.valueText, { color: theme.textSub }]}>
          {reminderDescription}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={openNotificationCenter}
          style={[styles.card, { backgroundColor: theme.cardBg, padding: 18 }]}
        >
          <Text style={{ color: theme.textMain, fontSize: 16 }}>
            通知中心與通知設定
          </Text>
        </TouchableOpacity>
        {/* 關於與支援區塊 */}
        <Text style={[styles.sectionTitle, { color: theme.textSub }]}>
          關於與支援
        </Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => Alert.alert('關於 拾序', appAbout)}
          >
            <View style={styles.itemLeft}>
              <Icon
                name="information-circle-outline"
                size={22}
                color={theme.textSub}
                style={styles.itemIcon}
              />
              <Text style={[styles.itemText, { color: theme.textMain }]}>
                關於我們
              </Text>
            </View>
            <Icon name="chevron-forward" size={20} color={theme.textSub} />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => navigation.navigate('LegalPolicy',{kind:'privacy'})}
          >
            <View style={styles.itemLeft}>
              <Icon
                name="shield-checkmark-outline"
                size={22}
                color={theme.textSub}
                style={styles.itemIcon}
              />
              <Text style={[styles.itemText, { color: theme.textMain }]}>
                隱私權政策
              </Text>
            </View>
            <Icon name="chevron-forward" size={20} color={theme.textSub} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.itemRow} onPress={()=>navigation.navigate('LegalPolicy',{kind:'terms'})}><Text style={{color:theme.textMain}}>服務條款</Text></TouchableOpacity>
        <TouchableOpacity style={styles.itemRow} onPress={()=>navigation.navigate('Contact')}><Text style={{color:theme.textMain}}>聯絡我們</Text></TouchableOpacity>
        <View style={[styles.card,{backgroundColor:theme.cardBg,padding:18}]}>
          <Text style={{color:theme.textMain,fontSize:18,fontWeight:'700'}}>加入 Android 主畫面</Text>
          <Text style={{color:theme.textSub,lineHeight:25,marginTop:10}}>使用 Chrome 開啟拾序 PWA，點右上角「⋮」，選擇「加到主畫面」或「安裝應用程式」，依指示完成。若在其他 App 內開啟，請先使用 Chrome 開啟。已安裝此 Android App 者可直接從主畫面開啟。</Text>
        </View>
        {/* 登出按鈕 ── 已採用無警告的動態樣式變數 */}
        <TouchableOpacity style={logoutCardStyle} onPress={logout}>
          <View style={styles.logoutContent}>
            <Icon
              name="log-out-outline"
              size={22}
              color="#c94a4a"
              style={styles.itemIcon}
            />
            <Text style={styles.logoutText}>登出帳號</Text>
          </View>
        </TouchableOpacity>

        {/* 底部儲存按鈕 */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: theme.primary }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.saveBtnText}>儲存設定</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerLeftBtn: {
    zIndex: 10,
    paddingVertical: 5,
    paddingRight: 15,
  },
  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '600',
  },
  headerPlaceholder: {
    width: 32,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    marginBottom: 5,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIcon: {
    marginRight: 12,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  valueText: {
    fontSize: 15,
    fontWeight: '500',
  },
  divider: {
    height: 1,
  },
  logoutCard: {
    marginTop: 25,
    borderWidth: 1,
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 16,
    color: '#c94a4a',
    fontWeight: '600',
  },
  saveBtn: {
    height: 52,
    width: '100%',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 35,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  saveBtnText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
  },
});

export default SettingsScreen;
