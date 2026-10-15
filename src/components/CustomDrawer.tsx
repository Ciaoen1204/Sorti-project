import SortiBrand from './SortiBrand';
import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from "./LocalizedUI";
import { disableNativePush } from '../services/nativePush';
import { useScreenStyles } from '../design/useScreenStyles';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

const CustomDrawer = (props: any) => {
  const { theme } = useTheme();
  const styles = useScreenStyles(baseStyles, theme);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <DrawerContentScrollView {...props}>
        {/* 選單頂部選單按鈕 */}
        <View style={[styles.menuHeader, { borderBottomColor: theme.border,flexDirection:'row',alignItems:'center',justifyContent:'space-between' }]}>
          <SortiBrand compact/>
          <TouchableOpacity onPress={() => props.navigation.closeDrawer()}>
            <Icon name="menu" size={30} color={theme.textMain} />
          </TouchableOpacity>
        </View>

        {/* 渲染選單項目 */}
        <View style={styles.drawerList}>
          <DrawerItem
            label="首頁"
            icon="home-outline"
            theme={theme}
            onPress={() => props.navigation.navigate('HomeMain')}
          />
          <DrawerItem
            label="物品管理"
            icon="grid-outline"
            theme={theme}
            onPress={() => props.navigation.navigate('ItemManagement')}
          />
          <DrawerItem
            label="每日任務"
            icon="leaf-outline"
            theme={theme}
            onPress={() => props.navigation.navigate('CalendarCheckIn')}
          />
          <DrawerItem
            label="收納測驗"
            icon="albums-outline"
            theme={theme}
            onPress={() => props.navigation.navigate('Quiz')}
          />
          {/* 已修正：將原本的 AIChat 修正為 App.tsx 中註冊的 Chat */}
          <DrawerItem
            label="收納助理"
            icon="chatbubbles-outline"
            theme={theme}
            onPress={() => props.navigation.navigate('AIChat')}
          />
          <DrawerItem
            label="歷史紀錄"
            icon="time-outline"
            theme={theme}
            onPress={() => props.navigation.navigate('AIAnalysisHistory')}
          />
          <DrawerItem
            label="二手市集"
            icon="hammer-outline"
            theme={theme}
            onPress={() => props.navigation.navigate('Market')}
          />

          <DrawerItem
            label="捐贈與回收"
            icon="leaf-outline"
            theme={theme}
            onPress={() =>
              props.navigation.navigate('DonationRecycling', {
                itemCategory: undefined,
                condition: 'unsure',
                kind: 'all',
              })
            }
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <DrawerItem
            label="個人中心"
            icon="person-outline"
            theme={theme}
            onPress={() => props.navigation.navigate('EditProfile')}
          />
          <DrawerItem
            label="設定"
            icon="settings-outline"
            theme={theme}
            onPress={() => props.navigation.navigate('Settings')}
          />
          <DrawerItem
            label="關於我們"
            icon="alert-circle-outline"
            theme={theme}
          />

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <DrawerItem
            label="登出"
            icon="exit-outline"
            theme={theme}
            onPress={async () => {
              try {
                await disableNativePush();
              } catch {
                Alert.alert('登出失敗', '無法取消此裝置推播，請連線後重試。');
                return;
              }
              const { error } = await supabase.auth.signOut();
              if (error) Alert.alert('登出失敗', '請稍後重試。');
            }}
          />
        </View>
      </DrawerContentScrollView>
    </SafeAreaView>
  );
};

// 抽離的選單項目組件，動態吃 theme 屬性，不留行內樣式警告
const DrawerItem = ({ label, icon, onPress, theme }: any) => {
  const styles = useScreenStyles(baseStyles, theme);
  const itemLabelStyle = [styles.itemLabel, { color: theme.textMain }];

  return (
    <TouchableOpacity style={styles.itemRow} onPress={onPress}>
      <Icon name={icon} size={24} color={theme.textSub} style={styles.icon} />
      <Text style={itemLabelStyle}>{label}</Text>
    </TouchableOpacity>
  );
};

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  menuHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  drawerList: {
    paddingTop: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  icon: {
    marginRight: 15,
    width: 25,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: 10,
    marginHorizontal: 20,
  },
});

export default CustomDrawer;
