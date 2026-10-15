import { LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from "../components/LocalizedUI";
import DeliverySelect from '../components/DeliverySelect';
import {
  sellerChannelGroups,
  validateChannelRecipient,
  availableChannels,
  channelLabel,
  storeChannel,
  type ChannelRecipient,
} from '../services/deliveryChannels';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import * as data from '../services/supabaseData';
import { currency } from '../services/marketplace';
import {
  checkoutGroups,
  marketRequestId,
  type DeliveryMethod,
} from '../services/marketplaceOrder';
export default function CheckoutScreen({ route, navigation }: any) {
  const { theme } = useTheme(),
    { cartItems, refreshCart } = useCart();
  const [products, setProducts] = useState<data.ProductRecord[]>([]),
    [methods, setMethods] = useState<Record<string, DeliveryMethod>>({}),
    [channels, setChannels] = useState<Record<string, string>>({}),
    [selected, setSelected] = useState<Record<string, boolean>>({}),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState<string[]>([]);
  const [recipient, setRecipient] = useState<ChannelRecipient>({
    name: '',
    phone: '',
    address: '',
  });
  const batch = useRef(marketRequestId()),
    submitted = useRef(false),
    lock = useRef(false);
  const direct = route.params?.listingId;
  useEffect(() => {
    let active = true;
    setLoading(true);
    (direct
      ? data.loadProduct(direct).then(p => [p])
      : Promise.all(cartItems.map(p => data.loadProduct(p.id)))
    )
      .then(ps => {
        if (active && !submitted.current) {
          setProducts(ps);
          setSelected(Object.fromEntries(ps.map(p => [p.id, true])));
          setChannels(
            Object.fromEntries(
              ps.map(p => [p.id, availableChannels(p)[0]?.channel || '']),
            ),
          );
          setMethods(
            Object.fromEntries(
              ps
                .filter(p => p.allowMeetup || p.allowShipping)
                .map(p => [
                  p.id,
                  availableChannels(p)[0]?.channel === 'meetup'
                    ? 'meetup'
                    : 'shipping',
                ]),
            ),
          );
        }
      })
      .catch(e => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [direct, cartItems]);
  const chosen = products.filter(p => selected[p.id]);
  const groups = checkoutGroups(chosen, methods, p => p.id, channels),
    shipping = chosen.some(p => methods[p.id] === 'shipping');
  const text = { color: theme.textMain, fontSize: 16 };
  const button = (
    label: string,
    fn: () => void,
    primary = false,
    disabled = false,
  ) => (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={fn}
      style={{
        minHeight: 48,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: primary ? theme.primary : theme.cardBg,
        opacity: busy || disabled ? 0.5 : 1,
      }}
    >
      <Text
        style={{
          color: primary ? theme.onPrimary : theme.textMain,
          fontSize: 16,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
  function change(fn: () => void) {
    if (submitted.current) return;
    batch.current = marketRequestId();
    fn();
  }
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (!chosen.length || chosen.some(p => !methods[p.id]))
        throw new Error('請選擇商品，並確認賣家已設定交易方式。');
      validateChannelRecipient(
        chosen.map(p => channels[p.id] || methods[p.id]),
        recipient,
      );
      submitted.current = true;
      const ids = await data.createMarketRequests(
        batch.current,
        chosen,
        methods,
        recipient,
        channels,
      );
      setSuccess(ids);
      await refreshCart().catch(() => {});
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : '請求失敗。請以相同內容重試，避免重複建立。',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 36 }}
        >
          {button('返回', () => navigation.goBack())}
          <Text style={[text, { fontSize: 24, fontWeight: '700' }]}>
            {success.length ? '已送出購買請求' : '確認購買'}
          </Text>
          {loading && <ActivityIndicator color={theme.primary} />}
          {!!error && (
            <Text accessibilityRole="alert" style={text}>
              {error}
            </Text>
          )}
          {success.length ? (
            <>
              <Text style={text}>
                等待賣家確認，確認後即可進行後續交易。目前尚未保留商品。
              </Text>
              {success.map(id => (
                <View key={id}>
                  {button(
                    '查看訂單 ' + id.slice(0, 8),
                    () =>
                      navigation.replace('MarketOrderDetail', { orderId: id }),
                    true,
                  )}
                </View>
              ))}
              {button('返回市集', () => navigation.navigate('Market'))}
            </>
          ) : (
            <>
              {sellerChannelGroups(chosen)
                .filter(g => g.products.length > 1)
                .map(g => (
                  <View
                    key={g.sellerId}
                    style={{
                      padding: 16,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: 18,
                      gap: 10,
                    }}
                  >
                    <Text style={text}>
                      同賣家一起購買 · {g.products.length} 件
                    </Text>
                    {g.options.length ? (
                      <DeliverySelect
                        label="合併交易方式"
                        disabled={busy || submitted.current}
                        value={
                          g.products.every(
                            p => channels[p.id] === channels[g.products[0].id],
                          )
                            ? channels[g.products[0].id]
                            : ''
                        }
                        options={g.options.map(o => ({
                          id: o.channel,
                          label: channelLabel(o.channel),
                        }))}
                        onChange={c =>
                          change(() => {
                            setChannels(v => ({
                              ...v,
                              ...Object.fromEntries(
                                g.products.map(p => [p.id, c]),
                              ),
                            }));
                            setMethods(v => ({
                              ...v,
                              ...Object.fromEntries(
                                g.products.map(p => [
                                  p.id,
                                  c === 'meetup' ? 'meetup' : 'shipping',
                                ]),
                              ),
                            }));
                          })
                        }
                      />
                    ) : (
                      <Text style={text}>
                        這些商品沒有共同交易方式，請分別選擇，系統會分開建立訂單。
                      </Text>
                    )}
                    <Text style={text}>
                      同賣家、同管道合併成一張訂單，運費取商品中最高的一筆。
                    </Text>
                  </View>
                ))}
              {products.map(p => (
                <View
                  key={p.id}
                  style={{
                    padding: 16,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: theme.border,
                    backgroundColor: theme.cardBg,
                    gap: 10,
                  }}
                >
                  {!direct &&
                    button(`${selected[p.id] ? '☑' : '☐'} 選取商品`, () =>
                      change(() =>
                        setSelected(prev => ({ ...prev, [p.id]: !prev[p.id] })),
                      ),
                    )}
                  <Text style={[text, { fontSize: 20 }]}>{p.title}</Text>
                  <Text style={text}>{currency(p.price)} · 數量 1</Text>
                  {!p.allowMeetup && !p.allowShipping && (
                    <Text style={text}>
                      賣家尚未設定交易方式，請先聯絡賣家。
                    </Text>
                  )}
                  <DeliverySelect
                    label="交易方式"
                    value={channels[p.id] || ''}
                    options={availableChannels(p).map(o => ({
                      id: o.channel,
                      label: `${channelLabel(o.channel)}${
                        o.channel === 'meetup'
                          ? ''
                          : ` · 運費 ${currency(o.fee)}`
                      }`,
                    }))}
                    disabled={busy || submitted.current}
                    onChange={c =>
                      change(() => {
                        setChannels(v => ({ ...v, [p.id]: c }));
                        setMethods(v => ({
                          ...v,
                          [p.id]: c === 'meetup' ? 'meetup' : 'shipping',
                        }));
                      })
                    }
                  />
                  <Text style={text}>
                    {methods[p.id] === 'meetup'
                      ? `${p.location} ${p.meetupNote || ''}`
                      : `${p.shippingNote || ''} · 運費 ${currency(
                          availableChannels(p).find(
                            o => o.channel === channels[p.id],
                          )?.fee || 0,
                        )}`}
                  </Text>
                </View>
              ))}
              {shipping &&
                (['name', 'phone', 'address'] as const)
                  .filter(
                    k =>
                      k !== 'address' ||
                      chosen.some(
                        p =>
                          methods[p.id] === 'shipping' &&
                          !storeChannel(channels[p.id]),
                      ),
                  )
                  .map((k, i) => (
                    <View key={k}>
                      <Text style={text}>{['收件人', '電話', '地址'][i]}</Text>
                      <TextInput
                        editable={!busy && !submitted.current}
                        accessibilityLabel={['收件人', '電話', '地址'][i]}
                        value={recipient[k]}
                        onChangeText={v =>
                          change(() =>
                            setRecipient(prev => ({ ...prev, [k]: v })),
                          )
                        }
                        style={[
                          text,
                          {
                            padding: 14,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: theme.border,
                            minHeight: 48,
                          },
                        ]}
                      />
                    </View>
                  ))}
              {[
                ...new Set(
                  chosen.map(p => channels[p.id]).filter(storeChannel),
                ),
              ].map(c => (
                <View key={c}>
                  <Text style={text}>
                    {channelLabel(c)}取貨門市（請確認資料正確）
                  </Text>
                  {(['name', 'code', 'address'] as const).map((k, i) => (
                    <View key={k}>
                      <Text style={text}>
                        {['門市名稱', '門市店號', '門市地址'][i]}
                      </Text>
                      <TextInput
                        style={[
                          text,
                          {
                            minHeight: 48,
                            padding: 14,
                            borderWidth: 1,
                            borderColor: theme.border,
                            borderRadius: 12,
                          },
                        ]}
                        accessibilityLabel={`${channelLabel(c)}${
                          ['門市名稱', '門市店號', '門市地址'][i]
                        }`}
                        editable={!busy && !submitted.current}
                        value={recipient.stores?.[c]?.[k] || ''}
                        onChangeText={value =>
                          change(() =>
                            setRecipient(v => ({
                              ...v,
                              stores: {
                                ...v.stores,
                                [c]: {
                                  name: '',
                                  code: '',
                                  address: '',
                                  ...v.stores?.[c],
                                  [k]: value,
                                },
                              },
                            })),
                          )
                        }
                      />
                    </View>
                  ))}
                </View>
              ))}
              {groups.map((g, i) => (
                <View key={i}>
                  <Text style={text}>
                    第 {i + 1} 筆請求 · {channelLabel(g.channel)} ·{' '}
                    {g.items.map(p => p.title).join('、')}
                  </Text>
                  <Text style={text}>
                    小計 {currency(g.subtotal)} · 運費 {currency(g.fee)} · 合計{' '}
                    {currency(g.subtotal + g.fee)}
                  </Text>
                </View>
              ))}
              <Text style={text}>
                同賣家同方式合單；寄送運費取同組最高一件，面交免運。平台未提供代收付款、物流保障。面交自行付款，寄送由賣家自行安排貨到付款。
              </Text>
              {button(
                busy ? '正在送出…' : `送出 ${groups.length} 筆購買請求`,
                () => void submit(),
                true,
                loading || !chosen.length,
              )}
              {submitted.current && !!error && (
                <>
                  <Text style={text}>
                    內容已鎖定以避免重複建立。請以相同內容重試，或先到我的購買確認結果。
                  </Text>
                  {button('查看我的購買', () =>
                    navigation.navigate('MarketplaceWorkspace', {
                      role: 'buyer',
                      tab: 'orders',
                    }),
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
