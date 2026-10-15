import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from "../components/LocalizedUI";
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, PermissionsAndroid, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import BottomNav from '../components/BottomNav';
import { useTheme } from '../context/ThemeContext';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import {
  createRemoteItem,
  deleteRemoteItem,
  itemDispositionLabels,
  loadRemoteItems,
  setItemDisposition,
  setItemStorageLocation,
} from '../services/supabaseData';
import type { ItemDisposition } from '../services/supabaseData';
import {
  itemImportLabel,
  itemPlacementLabel,
} from '../services/inventoryDetails';

export default function ItemManagementScreen({ navigation }: any) {
  const { theme,isDarkMode } = useTheme();
  const focused = useIsFocused();
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof loadRemoteItems>>
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [category, setCategory] = useState('全部');
  const [status, setStatus] = useState('all');
  const [adding, setAdding] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [statusTarget, setStatusTarget] = useState<
    (typeof items)[number] | null
  >(null);
  const [name, setName] = useState('');
  const [newCategory, setNewCategory] = useState('生活用品');
  const [quantity, setQuantity] = useState('1');
  const [photo, setPhoto] = useState<string | undefined>();
  const [mutationBusy, setMutationBusy] = useState(false);
  const [placement, setPlacement] = useState('全部');
  const [locationTarget, setLocationTarget] = useState<
    (typeof items)[number] | null
  >(null);
  const [location, setLocation] = useState('');
  const categories = [
    ...new Set([
      '文具',
      '3C',
      '書籍',
      '生活用品',
      '美妝',
      ...items.map(item => item.category),
    ]),
  ];
  const visible = items.filter(
    item =>
      (item.name + item.category + (item.storageLocation || ''))
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (category === '全部' || item.category === category) &&
      (status === 'all' || item.disposition === status) &&
      (placement === '全部' ||
        itemPlacementLabel(item.storageLocation) === placement),
  );
  async function saveLocation() {
    if (!locationTarget || mutationBusy) return;
    setMutationBusy(true);
    try {
      const value = await setItemStorageLocation(locationTarget.id, location);
      setItems(rows =>
        rows.map(item =>
          item.id === locationTarget.id
            ? { ...item, storageLocation: value }
            : item,
        ),
      );
      setLocationTarget(null);
    } catch (reason) {
      Alert.alert(
        '儲存失敗',
        reason instanceof Error ? reason.message : '請稍後重試。',
      );
    } finally {
      setMutationBusy(false);
    }
  }
  async function pickPhoto(useCamera = false) {
    try {
      if (
        useCamera &&
        Platform.OS === 'android' &&
        !(await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA))
      ) {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );
        if (permission !== PermissionsAndroid.RESULTS.GRANTED)
          throw new Error('請允許相機權限，或改從相簿選擇照片。');
      }
      const selected = await (useCamera ? launchCamera : launchImageLibrary)({
        mediaType: 'photo',
        selectionLimit: 1,
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.8,
      });
      if (selected.errorCode)
        throw new Error(selected.errorMessage || '無法開啟相簿。');
      if (selected.assets?.[0]?.uri) setPhoto(selected.assets[0].uri);
    } catch (reason) {
      Alert.alert(
        '照片選取失敗',
        reason instanceof Error ? reason.message : '請稍後重試。',
      );
    }
  }
  async function add() {
    if (mutationBusy) return;
    setMutationBusy(true);
    try {
      await createRemoteItem({
        name,
        category: newCategory,
        quantity: Number(quantity),
        photoUri: photo,
      });
      setAdding(false);
      setName('');
      setNewCategory('生活用品');
      setQuantity('1');
      setPhoto(undefined);
      setCategory('全部');
      setStatus('all');
      setPlacement('全部');
      setQuery('');
      setRefresh(value => value + 1);
    } catch (reason) {
      Alert.alert(
        '新增失敗',
        reason instanceof Error ? reason.message : '請稍後重試。',
      );
    } finally {
      setMutationBusy(false);
    }
  }
  function remove(item: (typeof items)[number]) {
    Alert.alert(
      `刪除「${item.name}」？`,
      '將從物品管理移除，分析紀錄與已刊登商品會保留。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確認刪除',
          style: 'destructive',
          onPress: async () => {
            if (mutationBusy) return;
            setMutationBusy(true);
            try {
              await deleteRemoteItem(item.id);
              setItems(rows => rows.filter(row => row.id !== item.id));
            } catch (reason) {
              Alert.alert(
                '刪除失敗',
                reason instanceof Error ? reason.message : '請稍後重試。',
              );
            } finally {
              setMutationBusy(false);
            }
          },
        },
      ],
    );
  }
  async function changeStatus(value: ItemDisposition) {
    if (!statusTarget || mutationBusy) return;
    setMutationBusy(true);
    try {
      await setItemDisposition(statusTarget.id, value);
      setItems(rows =>
        rows.map(row =>
          row.id === statusTarget.id ? { ...row, disposition: value } : row,
        ),
      );
      setStatusTarget(null);
    } catch (reason) {
      Alert.alert(
        '儲存失敗',
        reason instanceof Error ? reason.message : '請稍後重試。',
      );
    } finally {
      setMutationBusy(false);
    }
  }
  useEffect(() => {
    if (!focused) return;
    let active = true;
    setBusy(true);
    setError('');
    loadRemoteItems()
      .then(value => {
        if (active) setItems(value);
      })
      .catch(reason => {
        if (active)
          setError(reason instanceof Error ? reason.message : '無法載入物品');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [focused, refresh]);
  const button = (label: string, action: () => void) => (
    <TouchableOpacity
      accessibilityRole="button"
      style={[styles.button, { borderColor: theme.border }]}
      onPress={action}
      disabled={mutationBusy}
    >
      <Text style={{ color: theme.primary }}>{label}</Text>
    </TouchableOpacity>
  );
  const dispose = (
    item: (typeof items)[number],
    condition: 'usable' | 'broken',
    kind: 'donation' | 'recycle',
  ) =>
    navigation.navigate('DonationRecycling', {
      itemCategory: item.category + ' ' + item.name,
      condition,
      kind,
    });
  const choose = (item: (typeof items)[number]) =>
    Alert.alert('物品目前的狀況', item.name, [
      {
        text: '還能使用',
        onPress: () =>
          Alert.alert('選擇處理方式', item.name, [
            {
              text: '出售',
              onPress: () =>
                navigation.navigate('AddProduct', {
                  itemName: item.name,
                  itemCategory: item.category,
                  itemImageUri: item.imageUri,
                }),
            },
            {
              text: '捐贈',
              onPress: () => dispose(item, 'usable', 'donation'),
            },
            {
              text: '回收／清運',
              onPress: () => dispose(item, 'usable', 'recycle'),
            },
          ]),
      },
      {
        text: '已損壞／無法使用',
        onPress: () => dispose(item, 'broken', 'recycle'),
      },
      { text: '取消', style: 'cancel' },
    ]);
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        {button('返回', () => navigation.goBack())}
        <Text style={[styles.title, { color: theme.textMain }]}>物品管理</Text>
        {button('＋ 新增', () => setAdding(true))}
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {button('拍照辨識並匯入物品', () =>
          navigation.navigate('AIAnalysisCapture'),
        )}
        {button('捐贈與回收', () =>
          navigation.navigate('DonationRecycling', {
            condition: 'unsure',
            kind: 'all',
            itemCategory: undefined,
          }),
        )}
        <TextInput
          accessibilityLabel="搜尋物品"
          placeholder="搜尋物品"
          placeholderTextColor={theme.textSub}
          value={query}
          onChangeText={setQuery}
          style={[
            styles.search,
            {
              color: theme.textMain,
              borderColor: theme.border,
              backgroundColor: theme.cardBg,
            },
          ]}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {['全部', ...categories].map(value => (
            <TouchableOpacity
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: category === value }}
              onPress={() => setCategory(value)}
              style={[
                styles.tab,
                {
                  backgroundColor:
                    category === value ? (isDarkMode?theme.primary:theme.primarySoft) : theme.cardBg,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={{
                  color: category === value ? (isDarkMode?theme.onPrimary:theme.primary) : theme.textMain,
                  fontWeight: category === value ? '700' : '400',
                }}
              >
                {value}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.actions}>
          {['全部', '待整理', '已定位'].map(value => (
            <TouchableOpacity
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`整理進度：${value}`}
              accessibilityState={{ selected: placement === value }}
              onPress={() => setPlacement(value)}
              style={[
                styles.tab,
                {
                  backgroundColor:
                    placement === value ? (isDarkMode?theme.primary:theme.primarySoft) : theme.cardBg,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={{ color: placement === value ? (isDarkMode?theme.onPrimary:theme.primary) : theme.textMain,fontWeight:placement === value ? '700':'400' }}>{value}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {button(
          `篩選狀態：${
            status === 'all'
              ? '全部'
              : itemDispositionLabels[status as ItemDisposition]
          }`,
          () => setFiltering(true),
        )}
        {busy && <ActivityIndicator color={theme.primary} />}
        {!!error && (
          <View>
            <Text style={{ color: theme.textMain }}>{error}</Text>
            {button('重新載入', () => setRefresh(refresh + 1))}
          </View>
        )}
        {visible.map(item => (
          <View
            key={item.id}
            style={[
              styles.card,
              { backgroundColor: theme.cardBg, borderColor: theme.border },
            ]}
          >
            <View style={styles.itemRow}>
              {item.imageUri ? (
                <Image
                  source={{ uri: item.imageUri }}
                  accessibilityLabel={`${item.name}物品照片`}
                  resizeMode="contain"
                  style={styles.photo}
                />
              ) : (
                <View
                  style={[
                    styles.photo,
                    styles.placeholder,
                    { backgroundColor: theme.primarySoft },
                  ]}
                >
                  <Text style={{ color: theme.textSub }}>物品</Text>
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text style={[styles.title, { color: theme.textMain }]} localize={false}>
                  {item.name}
                </Text>
                <Text style={{ color: theme.textSub }}>
                  分類：{item.category} · {item.quantity} 件
                </Text>
              </View>
              <TouchableOpacity
                disabled={mutationBusy}
                onPress={() => setStatusTarget(item)}
                accessibilityLabel={`管理狀態：${item.name}`}
                style={[
                  styles.badge,
                  {
                    backgroundColor:
                      item.disposition === 'keep'
                        ? '#afd2b4'
                        : item.disposition === 'discard'
                        ? '#efb2b7'
                        : '#e6d8a3',
                  },
                ]}
              >
                <Text style={styles.badgeText}>
                  {itemDispositionLabels[item.disposition]}
                </Text>
              </TouchableOpacity>
            </View>
            {item.disposition === 'sell' && (
              <Text style={{ color: theme.textSub }}>
                待售是管理標記，出售前請另外刊登商品。
              </Text>
            )}
            <Text style={{ color: theme.textSub }}>
              {itemPlacementLabel(item.storageLocation)} · 存放位置：
              {item.storageLocation || '尚未指定'}
            </Text>
            {!!itemImportLabel(item.created_at, item.source) && (
              <Text style={{ color: theme.textSub }}>
                {itemImportLabel(item.created_at, item.source)}
              </Text>
            )}
            <View style={styles.actions}>
              {button('設定存放位置', () => {
                setLocationTarget(item);
                setLocation(item.storageLocation || '');
              })}
              {button('處理物品', () => choose(item))}
              {button('刪除物品', () => remove(item))}
            </View>
          </View>
        ))}
        {!busy && !error && !!items.length && !visible.length && (
          <Text style={{ color: theme.textSub }}>
            沒有符合搜尋或篩選條件的物品。
          </Text>
        )}
        {!busy && !error && !items.length && (
          <View>
            <Text style={{ color: theme.textSub }}>
              尚未加入物品。可手動新增，或拍照分析後匯入。
            </Text>
            {button('拍照分析', () => navigation.navigate('AIAnalysisCapture'))}
          </View>
        )}
      </ScrollView>
      <Modal
        visible={adding}
        animationType="slide"
        onRequestClose={() => {
          if (!mutationBusy) setAdding(false);
        }}
      >
        <SafeAreaView
          style={[styles.container, { backgroundColor: theme.background }]}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.title, { color: theme.textMain }]}>
              新增物品
            </Text>
            <Text style={{ color: theme.textMain }}>物品名稱</Text>
            <TextInput
              accessibilityLabel="物品名稱"
              value={name}
              onChangeText={setName}
              maxLength={60}
              editable={!mutationBusy}
              style={[
                styles.search,
                { color: theme.textMain, borderColor: theme.border },
              ]}
            />
            <Text style={{ color: theme.textMain }}>分類</Text>
            <TextInput
              accessibilityLabel="分類"
              value={newCategory}
              onChangeText={setNewCategory}
              maxLength={30}
              editable={!mutationBusy}
              style={[
                styles.search,
                { color: theme.textMain, borderColor: theme.border },
              ]}
            />
            <Text style={{ color: theme.textMain }}>數量</Text>
            <TextInput
              accessibilityLabel="數量"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              editable={!mutationBusy}
              style={[
                styles.search,
                { color: theme.textMain, borderColor: theme.border },
              ]}
            />
            {!!photo && (
              <Image
                source={{ uri: photo }}
                style={styles.formPhoto}
                resizeMode="contain"
              />
            )}
            {button('拍攝物品照片（選填）', () => pickPhoto(true))}
            {button('從相簿選擇照片（選填）', () => pickPhoto())}
            {!!photo && button('移除照片', () => setPhoto(undefined))}
            {button(mutationBusy ? '儲存中…' : '儲存物品', add)}
            {button('取消新增', () => {
              setAdding(false);
              setPhoto(undefined);
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={!!locationTarget}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!mutationBusy) setLocationTarget(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.title, { color: theme.textMain }]}>
              設定存放位置：{locationTarget?.name}
            </Text>
            <Text style={{ color: theme.textSub }}>
              填入位置後標記為已定位；清空則回到待整理。
            </Text>
            <TextInput
              accessibilityLabel="存放位置"
              value={location}
              onChangeText={setLocation}
              maxLength={100}
              editable={!mutationBusy}
              placeholder="例如：主臥衣櫃上層"
              placeholderTextColor={theme.textSub}
              style={[
                styles.search,
                { color: theme.textMain, borderColor: theme.border },
              ]}
            />
            {button(mutationBusy ? '儲存中…' : '儲存位置', saveLocation)}
            {button('取消設定位置', () => setLocationTarget(null))}
          </View>
        </View>
      </Modal>
      <Modal
        visible={filtering || !!statusTarget}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!mutationBusy) {
            setFiltering(false);
            setStatusTarget(null);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.title, { color: theme.textMain }]}>
              {statusTarget ? `管理狀態：${statusTarget.name}` : '篩選物品狀態'}
            </Text>
            {!statusTarget &&
              button('全部狀態', () => {
                setStatus('all');
                setFiltering(false);
              })}
            {(
              Object.entries(itemDispositionLabels) as [
                ItemDisposition,
                string,
              ][]
            ).map(([value, label]) => (
              <View key={value}>
                {button(label, () => {
                  if (statusTarget) changeStatus(value);
                  else {
                    setStatus(value);
                    setFiltering(false);
                  }
                })}
              </View>
            ))}
            {button('取消', () => {
              setFiltering(false);
              setStatusTarget(null);
            })}
          </View>
        </View>
      </Modal>
      <BottomNav navigation={navigation} active="ItemManagement" />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: 16,
  },
  title: { fontSize: 20, fontWeight: '600' },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  button: {
    padding: 12,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: { padding: 12, minHeight: 48, borderWidth: 1, borderRadius: 12 },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 12 },
  photo: { width: 96, height: 96, borderRadius: 12 },
  formPhoto: { width: '100%', height: 200, borderRadius: 12 },
  tabs: { gap: 8 },
  tab: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  itemRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  itemInfo: { flex: 1, paddingTop: 22, gap: 8 },
  badge: {
    position: 'absolute',
    right: 0,
    top: 0,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: { color: '#243026', fontSize: 12 },
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#0008',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { padding: 20, borderRadius: 16, gap: 12 },
});
