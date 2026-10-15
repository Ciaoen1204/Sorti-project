import { LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from "../components/LocalizedUI";
import DeliverySelect from '../components/DeliverySelect';
import {
  channelLabel,
  deliveryChannels,
  deliverySummary,
  type DeliveryOption,
} from '../services/deliveryChannels';
import {
  itemConditions,
  validateDelivery,
  marketRequestId,
} from '../services/marketplaceOrder';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useTheme } from '../context/ThemeContext';
import MarketImage from '../components/MarketImage';
import * as data from '../services/supabaseData';
import {
  currency,
  listingCategories,
  validateListing,
} from '../services/marketplace';

type InventoryItem = Awaited<ReturnType<typeof data.loadRemoteItems>>[number];
export default function AddProductScreen({ route, navigation }: any) {
  const editing: data.ProductRecord | undefined = route.params?.product;
  const { theme } = useTheme();
  const [step, setStep] = useState(
    editing || route.params?.itemName ? 'form' : 'source',
  );
  const [showPreview, setShowPreview] = useState(false);
  const [title, setTitle] = useState(
    editing?.title ?? route.params?.itemName ?? '',
  );
  const [category, setCategory] = useState(
    editing?.category || route.params?.itemCategory || '其他',
  );
  const [price, setPrice] = useState(editing ? String(editing.price) : '');
  const [location, setLocation] = useState(editing?.location || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [imageUri, setImageUri] = useState(
    editing?.img || route.params?.itemImageUri || '',
  );
  const [items, setItems] = useState<InventoryItem[]>([]),
    [showItems, setShowItems] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [published, setPublished] = useState<data.ProductRecord | null>(null);
  const [condition, setCondition] = useState(editing?.condition || '');
  const [defects, setDefects] = useState(editing?.defects || '');
  const requestId = useRef(marketRequestId());
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>(
    editing?.deliveryOptions ||
      (editing ? [] : [{ channel: 'meetup', fee: 0, note: '' }]),
  );
  const { allowMeetup, allowShipping, meetupNote, shippingNote, shippingFee } =
    deliverySummary(deliveryOptions);
  const updateDeliveryOptions = setDeliveryOptions;
  const delivery = { condition, defects, ...deliverySummary(deliveryOptions) };
  const lock = useRef(false);
  const text = { color: theme.textMain };
  const button = (label: string, action: () => void, primary = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={busy}
      onPress={action}
      style={[
        styles.button,
        {
          backgroundColor: primary ? theme.primary : theme.cardBg,
          borderColor: theme.border,
          opacity: busy ? 0.65 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: primary ? theme.onPrimary : theme.textMain,
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
  const input = (
    label: string,
    value: string,
    change: (v: string) => void,
    numeric = false,
    multiline = false,
  ) => (
    <View style={styles.field}>
      <Text style={text}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={change}
        editable={!busy}
        multiline={multiline}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        style={[
          styles.input,
          text,
          { backgroundColor: theme.background, borderColor: theme.border },
          multiline && styles.multiline,
        ]}
      />
    </View>
  );
  async function choosePhoto(camera: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const response = camera
        ? await launchCamera({
            mediaType: 'photo',
            cameraType: 'back',
            quality: 0.8,
          })
        : await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
      if (response.errorCode)
        throw new Error(
          response.errorMessage || '無法取得照片，請檢查相機或相簿權限。',
        );
      if (response.assets?.[0]?.uri) setImageUri(response.assets[0].uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法取得照片。');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function chooseInventory() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setShowItems(true);
    try {
      setItems(await data.loadRemoteItems());
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法載入我的物品。');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function preview() {
    try {
      validateListing({ title, category, price, location, imageUri });
      setError('');
      validateDelivery(delivery);
      setShowPreview(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function publish() {
    if (lock.current) return;
    try {
      validateListing({ title, category, price, location, imageUri });
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const values = {
        ...delivery,
        requestId: requestId.current,
        title: title.trim(),
        category,
        price: Number(price),
        location: location.trim(),
        description: description.trim(),
        imageUri,
      };
      let saved: data.ProductRecord;
      if (editing) {
        await data.updateProduct(editing.id, {
          ...values,
          imageUri: imageUri === editing.img ? undefined : imageUri,
        });
        saved = await data.loadProduct(editing.id);
      } else saved = await data.createProduct(values);
      setPublished(saved);
      setStep('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : '刊登失敗，請稍後重試。');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        {button('返回', () => {
          if (showPreview) setShowPreview(false);
          else if (step === 'delivery') setStep('form');
          else if (step === 'form' && !editing) setStep('source');
          else navigation.goBack();
        })}
        <Text style={[styles.heading, text]}>
          {editing ? '編輯商品' : '刊登商品'}
        </Text>
      </View>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {step !== 'success' && (
            <Text style={{ color: theme.textSub }}>
              1 選擇照片　›　2 商品資訊　›　3 交易與刊登
            </Text>
          )}
          {step === 'source' && (
            <>
              {!!imageUri && <MarketImage uri={imageUri} />}
              {button('拍攝照片', () => {
                void choosePhoto(true);
              })}
              {button(
                '下一步：商品資訊',
                () => {
                  if (imageUri) {
                    setError('');
                    setStep('form');
                  } else setError('請先拍攝或選擇商品照片。');
                },
                true,
              )}
              <Text style={[styles.heading, text]}>想出售哪件物品？</Text>
              {button(
                '從我的物品中選擇',
                () => {
                  void chooseInventory();
                },
                true,
              )}
              {button('拍照或相簿新增', () => {
                setShowItems(false);
                void choosePhoto(false);
              })}
              <Text style={{ color: theme.textSub }}>
                既有物品會帶入名稱、分類與照片，刊登前請確認內容。
              </Text>
              {showItems && !busy && !items.length && !error && (
                <Text style={text}>目前沒有物品，可以拍照新增商品。</Text>
              )}
              {showItems &&
                items.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    disabled={busy}
                    onPress={() => {
                      setTitle(item.name);
                      setCategory(item.category || '其他');
                      setImageUri(item.imageUri || '');
                      setStep('form');
                    }}
                    style={[
                      styles.inventory,
                      {
                        backgroundColor: theme.cardBg,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <MarketImage uri={item.imageUri} style={styles.thumb} />
                    <View style={styles.container}>
                      <Text style={text} localize={false}>{item.name}</Text>
                      <Text style={{ color: theme.textSub }}>
                        {item.category}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
            </>
          )}
          {step === 'form' && (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ]}
            >
              {!!imageUri && <MarketImage uri={imageUri} />}
              <View style={styles.row}>
                {button('拍攝照片', () => {
                  void choosePhoto(true);
                })}
                {button('從相簿選擇', () => {
                  void choosePhoto(false);
                })}
              </View>
              {input('商品名稱', title, setTitle)}
              <Text style={text}>分類</Text>
              <ScrollView horizontal contentContainerStyle={styles.row}>
                {Array.from(new Set([...listingCategories, category])).map(
                  c => (
                    <View key={c}>
                      {button(c, () => setCategory(c), category === c)}
                    </View>
                  ),
                )}
              </ScrollView>
              <Text style={text}>使用狀況</Text>
              {itemConditions.map(c => (
                <View key={c}>
                  {button(c, () => setCondition(c), condition === c)}
                </View>
              ))}
              {input('瑕疵說明', defects, setDefects, false, true)}
              {input('商品描述', description, setDescription, false, true)}
              <Text style={{ color: theme.textSub }}>
                請描述使用狀況、瑕疵與尺寸。照片確認刊登後會公開。
              </Text>
              {input('價格（NT$）', price, setPrice, true)}
              {input('面交或寄出地點', location, setLocation)}
              <Text style={{ color: theme.textSub }}>
                刊登照片會公開；交易方式於下一步設定。
              </Text>
              {button(
                '下一步：交易方式',
                () => {
                  try {
                    validateListing({
                      title,
                      category,
                      price,
                      location,
                      imageUri,
                    });
                    setError('');
                    setStep('delivery');
                  } catch (e) {
                    setError((e as Error).message);
                  }
                },
                true,
              )}
            </View>
          )}
          {step === 'delivery' && !showPreview && (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.heading, text]}>交易方式</Text>
              {editing && !editing.deliveryOptions && (
                <Text style={text}>
                  舊商品請重新選擇提供的交易管道與運費後儲存。
                </Text>
              )}
              {deliveryOptions.map((o, i) => (
                <View key={i}>
                  <DeliverySelect
                    label={`交易方式 ${i + 1}`}
                    value={o.channel}
                    options={deliveryChannels.filter(
                      c =>
                        c.id === o.channel ||
                        !deliveryOptions.some(v => v.channel === c.id),
                    )}
                    disabled={busy}
                    onChange={v =>
                      updateDeliveryOptions(
                        deliveryOptions.map((option, j) =>
                          i === j
                            ? {
                                ...option,
                                channel: v as DeliveryOption['channel'],
                                fee: v === 'meetup' ? 0 : option.fee,
                              }
                            : option,
                        ),
                      )
                    }
                  />
                  {o.channel !== 'meetup' &&
                    input(
                      '運費（0 為免運）',
                      Number.isNaN(o.fee) ? '' : String(o.fee),
                      v =>
                        updateDeliveryOptions(
                          deliveryOptions.map((option, j) =>
                            i === j
                              ? { ...option, fee: v.trim() ? Number(v) : NaN }
                              : option,
                          ),
                        ),
                      true,
                    )}
                  {input('說明（選填）', o.note, v =>
                    updateDeliveryOptions(
                      deliveryOptions.map((option, j) =>
                        i === j ? { ...option, note: v } : option,
                      ),
                    ),
                  )}
                  {button('移除這個方式', () =>
                    updateDeliveryOptions(
                      deliveryOptions.filter((_, j) => i !== j),
                    ),
                  )}
                </View>
              ))}
              {deliveryOptions.length < 6 &&
                button('新增交易方式', () => {
                  const c = deliveryChannels.find(
                    c => !deliveryOptions.some(o => o.channel === c.id),
                  );
                  if (c)
                    updateDeliveryOptions([
                      ...deliveryOptions,
                      { channel: c.id, fee: 0, note: '' },
                    ]);
                })}
              <Text style={text}>
                至少開放一種方式。平台不代收付款、不提供物流保障。同賣家同方式合單取最高一件運費。
              </Text>
              {button('預覽商品', preview, true)}
            </View>
          )}
          {step === 'delivery' && showPreview && (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.heading, text]}>確認商品資訊</Text>
              <MarketImage uri={imageUri} />
              <Text style={[styles.heading, { color: theme.primary }]}>
                {currency(Number(price))}
              </Text>
              <Text style={[styles.heading, text]}>{title}</Text>
              <Text style={{ color: theme.textSub }}>
                {category} · {location}
              </Text>
              <Text style={[styles.description, text]}>
                {description || '尚未提供描述'}
              </Text>
              <Text style={text}>
                {condition} · {defects || '瑕疵說明未提供'}
              </Text>
              <Text style={text}>
                {allowMeetup ? '面交 ' : ''}
                {allowShipping ? `寄送 · 運費 NT$ ${shippingFee}` : ''}
              </Text>
              {deliveryOptions.map(o => (
                <Text key={o.channel} style={text}>
                  {channelLabel(o.channel)}
                  {o.channel === 'meetup' ? '' : ` · 運費 NT$ ${o.fee}`}
                </Text>
              ))}
              <Text style={text}>
                {meetupNote} {shippingNote}
              </Text>
              {button('返回修改', () => setShowPreview(false))}
              {button(
                editing ? '儲存修改' : '確認上架',
                () => {
                  void publish();
                },
                true,
              )}
            </View>
          )}
          {step === 'success' && published && (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.heading, text]}>
                {editing ? '商品修改成功' : '商品刊登成功'}
              </Text>
              <Text style={text}>照片與商品資訊已儲存。</Text>
              {button(
                '查看商品',
                () =>
                  navigation.navigate('ProductDetail', { product: published }),
                true,
              )}
              {button('返回市集', () => navigation.navigate('Market'))}
              {button('管理我的刊登', () =>
                navigation.navigate('MarketplaceWorkspace', {
                  role: 'seller',
                  tab: 'products',
                }),
              )}
            </View>
          )}
          {busy && (
            <>
              <ActivityIndicator color={theme.primary} />
              <Text style={text}>
                {step === 'preview' ? '正在上傳照片與儲存商品…' : '正在載入…'}
              </Text>
            </>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={text}>
              {error}
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  heading: { fontSize: 22, fontWeight: '700', lineHeight: 30 },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 16 },
  button: { borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 48 },
  field: { gap: 8 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8 },
  description: { lineHeight: 25 },
  inventory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  thumb: { width: 72 },
});
