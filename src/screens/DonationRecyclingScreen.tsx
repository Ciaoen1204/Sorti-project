import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from "../components/LocalizedUI";
import React, { useEffect, useState } from 'react';
import { Modal, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import {
  disposalAdvice,
  filterDisposalResources,
  guideCheckedAt,
  guideConditions,
  guideRegions,
  guideDistricts,
  guideMapUrl,
  guideLocation,
  addressMapUrl,
  inferGuideCategory,
  itemCategories,
} from '../data/disposalGuide';
import type {
  GuideCategory,
  GuideCondition,
  GuideKind,
} from '../data/disposalGuide';

export default function DonationRecyclingScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const [category, setCategory] = useState<GuideCategory>(() =>
    inferGuideCategory(route.params?.itemCategory),
  );
  const [condition, setCondition] = useState<GuideCondition>(
    route.params?.condition ?? 'unsure',
  );
  const [region, setRegion] = useState('全台');
  const [district, setDistrict] = useState('');
  const [includeOtherDistricts, setIncludeOtherDistricts] = useState(false);
  const [selector, setSelector] = useState<'region' | 'district' | null>(null);
  const [kind, setKind] = useState<GuideKind>(route.params?.kind ?? 'all');
  useEffect(() => {
    setCategory(inferGuideCategory(route.params?.itemCategory));
    setCondition(route.params?.condition ?? 'unsure');
    setKind(route.params?.kind ?? 'all');
  }, [route.params?.itemCategory, route.params?.condition, route.params?.kind]);
  const effectiveKind: GuideKind = condition === 'broken' ? 'recycle' : kind;
  const resources = filterDisposalResources(
    category,
    region,
    effectiveKind,
    district,
    includeOtherDistricts,
  );
  async function open(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('無法開啟連結', '請檢查網路，或稍後重新開啟。');
    }
  }
  const button = (label: string, onPress: () => void, selected = false) => (
    <TouchableOpacity
      key={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.button,
        {
          borderColor: theme.border,
          backgroundColor: selected ? theme.primary : theme.cardBg,
        },
      ]}
    >
      <Text style={{ color: selected ? theme.onPrimary : theme.textMain }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
  const card = [
    styles.card,
    { backgroundColor: theme.cardBg, borderColor: theme.border },
  ];
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        {button('返回', () => navigation.goBack())}
        <Text style={[styles.title, { color: theme.textMain }]}>
          捐贈與回收
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={{ color: theme.textSub, lineHeight: 24 }}>
          讓用不到的物品，找到下一個去處。
        </Text>
        <Text style={[styles.label, { color: theme.textMain }]}>物品類別</Text>
        <View style={styles.row}>
          {itemCategories.map(([value, label]) =>
            button(label, () => setCategory(value), category === value),
          )}
        </View>
        <Text style={[styles.label, { color: theme.textMain }]}>物品狀況</Text>
        <View style={styles.row}>
          {guideConditions.map(([value, label]) =>
            button(
              label,
              () => {
                setCondition(value);
                setKind(value === 'broken' ? 'recycle' : 'all');
              },
              condition === value,
            ),
          )}
        </View>
        <Text style={[styles.label, { color: theme.textMain }]}>所在地區</Text>
        <View style={styles.row}>
          {button(region, () => setSelector('region'))}
          {region !== '全台' &&
            button(district || '全部鄉鎮市區', () => setSelector('district'))}
        </View>
        {district &&
          button(
            includeOtherDistricts
              ? '已顯示同縣市其他區據點'
              : '也顯示同縣市其他區據點',
            () => setIncludeOtherDistricts(!includeOtherDistricts),
            includeOtherDistricts,
          )}
        {button(
          condition === 'broken'
            ? '在地圖查附近回收／清運單位'
            : '在地圖查附近捐贈／回收單位',
          () => open(guideMapUrl(region, district, category, effectiveKind)),
        )}
        <Text style={{ color: theme.textSub }}>
          地圖搜尋所選地區周邊，結果由地圖提供，請向單位確認接收條件。
        </Text>
        {district &&
          !resources.some(resource => resource.district === district) && (
            <Text style={{ color: theme.textSub }}>
              這個區尚無符合條件的已查核據點。可聯絡縣市窗口或用地圖查附近單位。
            </Text>
          )}
        <View style={card}>
          <Text style={[styles.label, { color: theme.textMain }]}>
            處理建議
          </Text>
          <Text style={{ color: theme.textSub, lineHeight: 24 }}>
            {disposalAdvice(category, condition)}
          </Text>
          {condition === 'usable' &&
            button('刊登二手商品', () => navigation.navigate('AddProduct'))}
        </View>
        <View style={styles.row}>
          {(
            [
              ['all', '全部管道'],
              ['donation', '捐贈'],
              ['recycle', '回收／清運'],
            ] as const
          )
            .filter(([value]) => condition !== 'broken' || value === 'recycle')
            .map(([value, label]) =>
              button(label, () => setKind(value), kind === value),
            )}
        </View>
        <Text style={{ color: theme.textSub }}>
          共 {resources.length} 個資訊管道 · 區級據點與縣市窗口分別標示
        </Text>
        <Text style={{color:theme.textSub,lineHeight:23}}>標示「諮詢／轉介」的窗口，需先電話確認收件品項、新舊限制及交付方式，請勿直接寄送。</Text>
        {resources.map(resource => (
          <View key={resource.id} style={card}>
            <Text style={{ color: theme.primary }}>
              {resource.kind === 'donation' ? '捐贈' : '回收／清運'} ·{' '}
              {guideLocation(resource)}{resource.serviceType?` · ${resource.serviceType}`:''}
            </Text>
            <Text style={[styles.label, { color: theme.textMain }]}>
              {resource.title}
            </Text>
            {resource.address && (
              <Text style={{ color: theme.textMain }}>{resource.address}</Text>
            )}
            {resource.phone && (
              <Text style={{ color: theme.textMain }}>
                電話：{resource.phoneLabel || resource.phone}
              </Text>
            )}
            <Text style={{ color: theme.textSub, lineHeight: 24 }}>
              {resource.description}
            </Text>
            {!resource.serviceType&&<Text style={{ color: theme.textMain, lineHeight: 24 }}>
              {resource.preparation}
            </Text>}
            <Text style={{ color: theme.textSub, fontSize: 12 }}>
              來源：{resource.provider} · 查核：{resource.checkedAt || guideCheckedAt}
            </Text>
            <View style={styles.row}>
              {button('查看官方資訊', () => open(resource.url))}
              {resource.address &&
                button('查看位置', () =>
                  open(addressMapUrl(resource.address!)),
                )}
              {resource.phone &&
                button('撥打諮詢電話', () => open(`tel:${resource.phone}`))}
            </View>
          </View>
        ))}
        {!resources.length && (
          <Text style={{ color: theme.textSub }}>
            目前沒有符合條件的管道，請切換至全部物品或全部管道。
          </Text>
        )}
        <Text style={{ color: theme.textSub, lineHeight: 22 }}>
          資訊依政府與機構官網整理；接收條件、服務地區與時間可能調整，出發或寄送前請向提供單位確認。此頁提供資訊查詢，預約與捐贈由提供單位辦理。
        </Text>
      </ScrollView>
      <Modal
        visible={selector !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelector(null)}
      >
        <SafeAreaView
          style={[styles.container, { backgroundColor: theme.background }]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.textMain }]}>
              {selector === 'region' ? '選擇縣市' : '選擇鄉鎮市區'}
            </Text>
            {button('關閉', () => setSelector(null))}
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {(selector === 'region'
              ? guideRegions
              : ['全部鄉鎮市區', ...guideDistricts(region)]
            ).map(value =>
              button(value, () => {
                if (selector === 'region') {
                  setRegion(value);
                  setDistrict('');
                  setIncludeOtherDistricts(false);
                } else {
                  setDistrict(value === '全部鄉鎮市區' ? '' : value);
                }
                setSelector(null);
              }),
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', gap: 14, padding: 16, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 12 },
  label: { fontSize: 17, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 6,
  },
});
