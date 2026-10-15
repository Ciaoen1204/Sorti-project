import BearMark from '../components/BearMark';
import {tr} from '../i18n/language';
import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from "../components/LocalizedUI";
import DraggableAssistant from '../components/DraggableAssistant';
import PersonaDetails from '../components/PersonaDetails';
import {getPrivateImageUrl,loadRemoteItems} from '../services/supabaseData';
import { loadStorageProfile } from '../services/supabaseData';
import BottomNav from '../components/BottomNav';
import { displayPersona } from '../design/personaLabel';
import { useScreenStyles } from '../design/useScreenStyles';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Image, View, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { useSortiTheme } from '../design/sortiTheme';
import SortiBrand from '../components/SortiBrand';
import { loadCheckInRecords } from '../services/photoTempStore';
import { checkInDateKey } from '../services/checkInDate';
import { supabase } from '../lib/supabase';

const HomeScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useSortiTheme();
  const styles = useScreenStyles(baseStyles, theme);
  const [nickname,setNickname]=useState('');
  const [avatar,setAvatar]=useState('');
  const [itemCount,setItemCount]=useState<number|null>(null);
  const [pendingCount,setPendingCount]=useState(0);
  const [sellingCount,setSellingCount]=useState(0);
  const [identity, setIdentity] = useState('收納新手');
  const [showPersona, setShowPersona] = useState(false);
  const [checkInDays, setCheckInDays] = useState(0);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [dailyReminder, setDailyReminder] = useState(false);
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused) {
      return;
    }
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        setDailyReminder(!!data.user?.user_metadata.daily_reminder);
        const meta=data.user?.user_metadata||{};
        setNickname(meta.display_name||meta.full_name||meta.username||'');
        setAvatar(meta.avatar_url||meta.picture||'');
        if(meta.avatar_path)getPrivateImageUrl('analysis-photos',meta.avatar_path).then(uri=>{if(active)setAvatar(uri);}).catch(()=>{});
      })
      .catch(() => {});
    loadRemoteItems().then(items=>{if(active){setItemCount(items.length);setPendingCount(items.filter(i=>!i.storageLocation).length);setSellingCount(items.filter(i=>i.disposition==='sell').length);}}).catch(()=>{if(active)setItemCount(null);});
    loadStorageProfile()
      .then(profile => {
        if (active) setIdentity(profile?.persona_name || '收納新手');
      })
      .catch(async () => {
        const value = await AsyncStorage.getItem('user_magic_identity').catch(
          () => null,
        );
        if (active) setIdentity(value || '收納新手');
      });
    loadCheckInRecords()
      .then(records => {
        if (!active) {
          return;
        }
        const today = new Date();
        const validDates = Object.keys(records).filter(key => {
          const [year, month, day] = key.split('-').map(Number);
          return new Date(year, month - 1, day) <= today;
        });
        setCheckInDays(validDates.length);
        setCheckedInToday(!!records[checkInDateKey()]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isFocused]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityLabel="開啟選單"
          style={[
            styles.iconButton,
            { backgroundColor: theme.cardBg, borderColor: theme.border },
          ]}
          onPress={() => navigation.openDrawer()}
        >
          <Icon name="menu-outline" size={23} color={theme.textMain} />
        </TouchableOpacity>
        <View style={{marginLeft:'auto'}}><SortiBrand compact /></View>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="編輯暱稱與頭貼" onPress={()=>navigation.navigate('EditProfile')} style={{flexDirection:'row',alignItems:'center',gap:14,marginBottom:20}}>
          {avatar?<Image source={{uri:avatar}} style={{width:60,height:60,borderRadius:30}}/>:<View style={{width:60,height:60,borderRadius:30,backgroundColor:theme.primarySoft,alignItems:'center',justifyContent:'center'}}><Icon name="person-outline" size={30} color={theme.primary}/></View>}
          <View style={{flex:1}}><Text style={{color:theme.textMain,fontSize:21,fontWeight:'700'}} localize={false}><Text>你好，</Text><Text localize={false}>{nickname||tr('收納新手')}</Text></Text><Text style={{color:theme.textSub,marginTop:5,lineHeight:22}}>今天，讓家裡輕鬆一點</Text></View><Icon name="chevron-forward" size={18} color={theme.textSub}/>
        </TouchableOpacity>
        {dailyReminder && !checkedInToday && (
          <TouchableOpacity
            style={[
              styles.smallCard,
              { backgroundColor: theme.cardBg, borderColor: theme.border },
            ]}
            onPress={() => navigation.navigate('CalendarCheckIn')}
          >
            <Text style={[styles.smallTitle, { color: theme.textMain }]}>
              今天的整理提醒
            </Text>
            <Text style={[styles.smallDescription, { color: theme.textSub }]}>
              每天留一點時間，完成一件整理小任務。
            </Text>
          </TouchableOpacity>
        )}
        <View style={styles.welcome}>
          <View style={styles.greetingRow}>
            
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="查看收納人格特質"
              accessibilityHint="顯示你的收納人格與特質"
              onPress={() => setShowPersona(true)}
              style={[styles.badge, { backgroundColor: theme.accentSoft }]}
            >
              <Text style={[styles.badgeText, { color: theme.accent }]}>
                收納人格特質：{displayPersona(identity)}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.headline, { color: theme.textMain }]}>
            讓整理，從一個角落開始
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSub }]}>
            依照你的收納偏好，找到適合自己的整理方式
          </Text>
        </View>
        <TouchableOpacity
          accessibilityLabel="拍照分析空間"
          activeOpacity={0.9}
          style={[
            styles.hero,
            { backgroundColor: theme.primarySoft, borderColor: theme.border },
          ]}
          onPress={() => navigation.navigate('AIAnalysisCapture')}
        >
          <View style={styles.heroBody}>
            <Text style={[styles.overline, { color: theme.primary }]}>
              AI 空間分析
            </Text>
            <Text style={[styles.heroTitle, { color: theme.textMain }]}>
              拍下想整理的角落
            </Text>
            <Text style={[styles.heroDescription, { color: theme.textSub }]}>
              辨識照片中的物品，查看整理建議。
            </Text>
            <View
              style={[styles.heroAction, { backgroundColor: theme.primary }]}
            >
              <Icon name="camera-outline" size={20} color={theme.onPrimary} />
              <Text style={[styles.heroActionText, { color: theme.onPrimary }]}>
                開始整理
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        {itemCount!==null&&<TouchableOpacity accessibilityRole="button" onPress={()=>navigation.navigate('ItemManagement')} style={{backgroundColor:theme.cardBg,borderColor:theme.border,borderWidth:1,borderRadius:20,padding:18,marginBottom:20}}><Text style={{color:theme.textMain,fontWeight:'700',fontSize:16}}>你的整理成果</Text><Text style={{color:theme.primary,marginTop:10,lineHeight:25}}>管理 {itemCount} 件物品 · 累積打卡 {checkInDays} 天</Text>{(pendingCount>0||sellingCount>0)&&<Text style={{color:theme.textSub,marginTop:6,lineHeight:24}}>{pendingCount} 件尚待定位 · {sellingCount} 件準備出售</Text>}</TouchableOpacity>}
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: theme.textMain }]}>
            今天的小步驟
          </Text>
        </View>
        <View style={styles.cardRow}>
          <TouchableOpacity
            accessibilityLabel="每日任務"
            style={[
              styles.smallCard,
              { backgroundColor: theme.cardBg, borderColor: theme.border },
            ]}
            onPress={() => navigation.navigate('CalendarCheckIn')}
          >
            <View
              style={[styles.smallIcon, { backgroundColor: theme.primarySoft }]}
            >
              <Icon name="leaf-outline" size={23} color={theme.primary} />
            </View>
            <Text style={[styles.smallTitle, { color: theme.textMain }]}>
              每日任務
            </Text>
            <Text style={[styles.smallDescription, { color: theme.textSub }]}>
              {checkedInToday ? '今日已完成' : '花 5 分鐘，選一個角落開始'}
            </Text>
            <View style={styles.cardFooter}>
              <Text style={[styles.cardLink, { color: theme.primary }]}>
                {checkedInToday ? '查看任務' : '選一個任務'}
              </Text>
              <Icon name="arrow-forward" size={17} color={theme.primary} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="分析歷史紀錄"
            style={[
              styles.smallCard,
              { backgroundColor: theme.cardBg, borderColor: theme.border },
            ]}
            onPress={() => navigation.navigate('AIAnalysisHistory')}
          >
            <View
              style={[styles.smallIcon, { backgroundColor: theme.accentSoft }]}
            >
              <Icon name="albums-outline" size={23} color={theme.accent} />
            </View>
            <Text style={[styles.smallTitle, { color: theme.textMain }]}>
              整理紀錄
            </Text>
            <Text style={[styles.smallDescription, { color: theme.textSub }]}>
              累積打卡 {checkInDays} 天
            </Text>
            <View style={styles.cardFooter}>
              <Text style={[styles.cardLink, { color: theme.primary }]}>
                回顧整理紀錄
              </Text>
              <Icon name="arrow-forward" size={17} color={theme.primary} />
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: theme.textMain }]}>
            用不到的物品
          </Text>
        </View>
        <View style={styles.cardRow}>
          {[
            {
              title: '二手市集',
              description: '買賣物品、訂單與交易訊息',
              icon: 'storefront-outline',
              screen: 'Market',
            },
            {
              title: '捐贈與回收',
              description: '找捐贈單位、回收與清運服務',
              icon: 'leaf-outline',
              screen: 'DonationRecycling',
            },
          ].map(entry => (
            <TouchableOpacity
              key={entry.screen}
              accessibilityRole="button"
              accessibilityLabel={entry.title}
              style={[
                styles.smallCard,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ]}
              onPress={() =>
                navigation.navigate(
                  entry.screen,
                  entry.screen === 'DonationRecycling'
                    ? {
                        itemCategory: undefined,
                        condition: 'unsure',
                        kind: 'all',
                      }
                    : undefined,
                )
              }
            >
              <Icon name={entry.icon} size={24} color={theme.primary} />
              <Text style={[styles.smallTitle, { color: theme.textMain }]}>
                {entry.title}
              </Text>
              <Text style={[styles.smallDescription, { color: theme.textSub }]}>
                {entry.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <PersonaDetails
        visible={showPersona}
        identity={identity}
        onClose={() => setShowPersona(false)}
        onQuiz={() => {
          setShowPersona(false);
          navigation.navigate('Quiz');
        }}
      />
      <DraggableAssistant><TouchableOpacity accessibilityRole="button" accessibilityLabel="開啟收納助理" onPress={()=>navigation.navigate('AIChat')} style={styles.assistantFloat}>
        <View style={{backgroundColor:theme.cardBg,borderColor:theme.primary,borderWidth:1,borderRadius:14,paddingHorizontal:10,paddingVertical:7,alignItems:'center'}}><Text style={{color:theme.primary,fontSize:12,fontWeight:'700'}}>收納助理</Text><View style={{position:'absolute',bottom:-5,width:8,height:8,backgroundColor:theme.cardBg,borderRightWidth:1,borderBottomWidth:1,borderColor:theme.primary,transform:[{rotate:'45deg'}]}}/></View>
        <BearMark size={62} top={6}/>
      </TouchableOpacity></DraggableAssistant>
      <BottomNav navigation={navigation} active="Home" />
    </SafeAreaView>
  );
};
const baseStyles = StyleSheet.create({
  assistantFloat:{width:86,minHeight:104,alignItems:'center',justifyContent:'center',zIndex:20},
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 104,
    maxWidth: 620,
    width: '100%',
    alignSelf: 'center',
  },
  welcome: { marginBottom: 20 },
  greetingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  greeting: { fontSize: 13 },
  badge: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  headline: {
    fontSize: 34,
    lineHeight: 46,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 16,
  },
  subtitle: { fontSize: 13, lineHeight: 22, marginTop: 9 },
  hero: { borderRadius: 28, borderWidth: 1, overflow: 'hidden' },
  heroVisual: { height: 160 },
  heroImage: { width: '100%', height: '100%' },
  photoBadge: {
    position: 'absolute',
    left: 16,
    top: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoBadgeText: { fontSize: 11, fontWeight: '600' },
  heroBody: { padding: 22 },
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  heroTitle: { fontSize: 23, fontWeight: '700', marginTop: 9 },
  heroDescription: { fontSize: 13, lineHeight: 22, marginTop: 8 },
  heroAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 15,
    minHeight: 50,
    marginTop: 20,
    padding: 12,
  },
  heroActionText: { fontSize: 15, fontWeight: '700' },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 22,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  sectionCaption: { fontSize: 11 },
  cardRow: { flexDirection: 'row', gap: 12 },
  smallCard: { flex: 1, padding: 16, borderWidth: 1, borderRadius: 22 },
  smallIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallTitle: { fontSize: 15, fontWeight: '700', marginTop: 12 },
  smallDescription: { fontSize: 12, lineHeight: 19, marginTop: 7 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    gap: 4,
  },
  cardLink: { fontSize: 11, fontWeight: '700' },
  helperCard: {
    padding: 18,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  helperText: { flex: 1 },
  footerNote: { fontSize: 11, textAlign: 'center', marginTop: 24 },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 3, minHeight: 52 },
  navIcon: {
    width: 48,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: { fontSize: 10, fontWeight: '600' },
});
export default HomeScreen;
