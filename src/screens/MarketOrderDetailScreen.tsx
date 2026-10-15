import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from "../components/LocalizedUI";
import { shipmentDate } from '../services/shipmentDate';
import { channelLabel } from '../services/deliveryChannels';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import MarketImage from '../components/MarketImage';
import * as data from '../services/supabaseData';
import { currency } from '../services/marketplace';
import {
  deliveryLabel,
  transactionActions,
  transactionActionLabels,
  transactionNext,
  transactionStatus,
  transactionProgress,
  type TransactionAction,
} from '../services/marketplaceOrder';

export default function MarketOrderDetailScreen({ route, navigation }: any) {
  const { theme } = useTheme(),
    focused = useIsFocused();
  const [order, setOrder] = useState<data.MarketOrder | null>(null),
    [viewer, setViewer] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [form, setForm] = useState<TransactionAction | null>(null),
    [values, setValues] = useState<Record<string, string>>({});
  const lock = useRef(false),
    generation = useRef(0);
  const reload = useCallback(async () => {
    const g = ++generation.current;
    try {
      const [o, u] = await Promise.all([
        data.loadMarketOrder(route.params.orderId),
        supabase.auth.getUser(),
      ]);
      if (g === generation.current) {
        setOrder(o);
        setViewer(u.data.user?.id || '');
      }
    } catch (e) {
      if (g === generation.current)
        setError(e instanceof Error ? e.message : '無法讀取訂單。');
    }
  }, [route.params.orderId]);
  useEffect(() => {
    if (!focused) return;
    void reload();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active' && !lock.current) void reload();
    }, 10000);
    const listener = AppState.addEventListener('change', s => {
      if (s === 'active') void reload();
    });
    const invalidate = () => {
      generation.current++;
    };
    return () => {
      invalidate();
      clearInterval(timer);
      listener.remove();
    };
  }, [focused, reload]);
  const text = { color: theme.textMain, fontSize: 16 };
  const card = {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardBg,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  };
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
        opacity: busy || disabled ? 0.6 : 1,
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
  async function execute(
    action: TransactionAction,
    payload: Record<string, unknown> = {},
  ) {
    if (!order || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await data.actOnMarketOrder(order, action, payload);
      setForm(null);
      setValues({});
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失敗，請重試。');
    } finally {
      await reload();
      lock.current = false;
      setBusy(false);
    }
  }
  function act(action: TransactionAction) {
    if (!order) return;
    if (['ship', 'open_issue', 'reject', 'request_cancel'].includes(action)) {
      setForm(action);
      setValues({});
      return;
    }
    const payload =
      action === 'confirm_meetup'
        ? { proposal_version: order.meetup?.version }
        : action === 'resolve_issue'
        ? { issue_id: order.order_issues?.find(i => !i.resolved_at)?.id }
        : {};
    Alert.alert(
      action === 'handover'
        ? viewer === order.seller_id
          ? '確認交付商品'
          : '確認收到商品'
        : transactionActionLabels[action],
      action === 'handover' || action === 'receive'
        ? '請確認已實際交付／收到商品。此操作不代表平台驗證付款。'
        : action === 'accept'
        ? '接受後將保留整筆商品，其他購買請求會失效。'
        : '確定執行此操作？',
      [
        { text: '返回', style: 'cancel' },
        { text: '確認', onPress: () => void execute(action, payload) },
      ],
    );
  }
  const fields =
    form === 'ship'
      ? [
          ['dispatched_at', '實際寄件日期（YYYY-MM-DD）'],
          ['carrier', '物流商（選填）'],
          ['tracking_number', '追蹤碼（選填）'],
          ['note', '備註（選填）'],
        ]
      : form === 'open_issue'
      ? [['details', '交易問題說明']]
      : [['reason', '原因']];
  function submitForm() {
    const payload: Record<string, unknown> = { ...values };
    try {
      if (form === 'ship') {
        const k = 'dispatched_at';
        payload[k] = shipmentDate(values[k] || '');
      }
      if (form) void execute(form, payload);
    } catch (e) {
      setError((e as Error).message);
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
          {button('返回我的交易', () =>
            navigation.navigate('MarketplaceWorkspace', {
              role: viewer === order?.seller_id ? 'seller' : 'buyer',
              tab: 'orders',
            }),
          )}
          <Text style={[text, { fontSize: 24, fontWeight: '700' }]}>
            訂單詳情
          </Text>
          {!!error && (
            <View>
              <Text accessibilityRole="alert" style={text}>
                {error}
              </Text>
              {button('重新載入', () => {
                setError('');
                void reload();
              })}
            </View>
          )}
          {!order && !error && <ActivityIndicator color={theme.primary} />}
          {order && (
            <>
              <View style={card}>
                <Text style={[text, { fontSize: 22, fontWeight: '700' }]}>
                  {order.workflow_version === 2
                    ? transactionStatus(order)
                    : data.orderStatusLabel[order.status] || order.status}
                </Text>
                <Text style={text}>
                  {order.workflow_version === 2
                    ? transactionNext(order, viewer)
                    : '既有訂單：交付方式未記錄，付款狀態未經平台驗證。'}
                </Text>
                <Text style={text}>
                  {deliveryLabel(order.delivery_method)} ·{' '}
                  {new Date(order.created_at).toLocaleString('zh-TW')}
                </Text>
                {!!order.decision_reason && (
                  <Text style={text}>{order.decision_reason}</Text>
                )}
              </View>
              {order.workflow_version === 2 && (
                <View style={card}>
                  <Text style={text}>交易進度</Text>
                  <View accessibilityLabel="交易進度">
                    {transactionProgress(order).map((step, i) => (
                      <View
                        key={step.label}
                        style={{
                          flexDirection: 'row',
                          minHeight: 64,
                          alignItems: 'stretch',
                        }}
                      >
                        <View style={{ width: 32, alignItems: 'center' }}>
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              borderWidth: 2,
                              borderColor:
                                step.state === 'upcoming'
                                  ? theme.border
                                  : theme.primary,
                              backgroundColor:
                                step.state === 'done'
                                  ? theme.primary
                                  : theme.cardBg,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text
                              style={{
                                color:
                                  step.state === 'done'
                                    ? '#fff'
                                    : theme.primary,
                                fontSize: 14,
                              }}
                            >
                              {step.state === 'done'
                                ? '✓'
                                : step.state === 'current'
                                ? '●'
                                : ''}
                            </Text>
                          </View>
                          {i < 3 && (
                            <View
                              style={{
                                width: 2,
                                flex: 1,
                                backgroundColor:
                                  step.state === 'done'
                                    ? theme.primary
                                    : theme.border,
                              }}
                            />
                          )}
                        </View>
                        <View
                          style={{
                            flex: 1,
                            paddingLeft: 10,
                            paddingBottom: 16,
                          }}
                        >
                          <Text
                            style={[
                              text,
                              {
                                fontWeight:
                                  step.state === 'current' ? '700' : '400',
                                color:
                                  step.state === 'upcoming'
                                    ? theme.textSub
                                    : theme.textMain,
                              },
                            ]}
                          >
                            {step.label}
                          </Text>
                          <Text
                            style={{
                              color: theme.textSub,
                              fontSize: 12,
                              marginTop: 4,
                            }}
                          >
                            {step.state === 'done'
                              ? '已完成'
                              : step.state === 'current'
                              ? '目前階段'
                              : '尚未到達'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {order.order_items.map(i => (
                <View key={i.listing_id} style={card}>
                  {!!i.image_path_snapshot && (
                    <MarketImage
                      uri={data.getPublicImageUrl(
                        'product-photos',
                        i.image_path_snapshot,
                      )}
                      style={{ width: 100, height: 100, borderRadius: 12 }}
                    />
                  )}
                  <Text style={[text, { fontSize: 20, fontWeight: '700' }]}>
                    {i.title_snapshot}
                  </Text>
                  <Text style={text}>
                    {currency(Number(i.price_snapshot))} · 數量 1 ·{' '}
                    {i.condition_snapshot || '狀況未記錄'}
                  </Text>
                  <Text style={text}>
                    {i.delivery_terms_snapshot?.location}{' '}
                    {order.delivery_method === 'meetup'
                      ? i.delivery_terms_snapshot?.meetup_note
                      : i.delivery_terms_snapshot?.shipping_note}
                  </Text>
                  {button('查看商品', () => {
                    data
                      .loadProduct(i.listing_id)
                      .then(product =>
                        navigation.navigate('ProductDetail', { product }),
                      )
                      .catch(e => setError(e.message));
                  })}
                  {button('聯絡交易對象', () => {
                    data
                      .orderConversation(order, i.listing_id)
                      .then(c =>
                        navigation.navigate('Chat', {
                          product: c.product,
                          conversationId: c.id,
                          orderId: order.id,
                          since: order.accepted_at || undefined,
                        }),
                      )
                      .catch(e => setError(e.message));
                  })}
                </View>
              ))}
              <Text style={text}>
                運費 {currency(Number(order.shipping_fee))} · 合計{' '}
                {currency(Number(order.total_amount))}
              </Text>
              {order.delivery_method === 'shipping' && (
                <View style={card}>
                  <Text style={text}>
                    寄送管道：{channelLabel(order.shipping_channel)}
                  </Text>
                  {order.pickup_store && (
                    <Text style={text}>
                      取貨門市：{order.pickup_store.name} · 店號{' '}
                      {order.pickup_store.code}
                    </Text>
                  )}
                </View>
              )}
              {order.delivery_method === 'shipping' && (
                <View style={card}>
                  <Text style={text}>
                    {order.recipient_name} · {order.recipient_phone}
                  </Text>
                  <Text style={text}>{order.shipping_address}</Text>
                  <Text style={text}>
                    自行安排貨到付款；平台不代收或核對付款。
                  </Text>
                </View>
              )}
              {order.delivery_method === 'meetup' &&
                order.status !== 'requested' && (
                  <View style={card}>
                    <Text style={text}>
                      賣家交付：
                      {order.seller_handed_over_at ? '已確認' : '尚未確認'}
                    </Text>
                    <Text style={text}>
                      買家收貨：
                      {order.buyer_received_at ? '已確認' : '尚未確認'}
                    </Text>
                    {order.workflow_version === 2 &&
                      ['accepted', 'fulfilling'].includes(order.status) &&
                      !(viewer === order.seller_id
                        ? order.seller_handed_over_at
                        : order.buyer_received_at) && (
                        <>
                          {button(
                            viewer === order.seller_id
                              ? '我已交付商品'
                              : '我已收到商品',
                            () => act('handover'),
                            true,
                            !transactionActions(order, viewer).includes(
                              'handover',
                            ),
                          )}
                          {!transactionActions(order, viewer).includes(
                            'handover',
                          ) && (
                            <Text style={text}>
                              {transactionNext(order, viewer)}
                            </Text>
                          )}
                        </>
                      )}
                  </View>
                )}
              {order.shipment && (
                <View style={card}>
                  <Text style={text}>賣家填寫的寄件資訊（非物流商驗證）</Text>
                  <Text style={text}>
                    {order.shipment.carrier || '未填物流商'} ·{' '}
                    {new Date(order.shipment.dispatched_at).toLocaleDateString(
                      'zh-TW',
                    )}
                  </Text>
                  <Text style={text}>
                    追蹤碼：{order.shipment.tracking_number || '未提供'}
                  </Text>
                  <Text style={text}>{order.shipment.note}</Text>
                </View>
              )}
              {order.order_issues?.map(i => (
                <View key={i.id} style={card}>
                  <Text style={text}>
                    {i.resolved_at ? '已共同解決' : '待協調問題'}：{i.details}
                  </Text>
                  <Text style={text}>平台未提供仲裁或退款服務。</Text>
                </View>
              ))}
              {order.workflow_version === 2
                ? transactionActions(order, viewer)
                    .filter(a => !['handover'].includes(a))
                    .map(a => (
                      <View key={a}>
                        {button(
                          a === 'handover'
                            ? viewer === order.seller_id
                              ? '我已交付商品'
                              : '我已收到商品'
                            : transactionActionLabels[a],
                          () => act(a),
                          !['open_issue', 'request_cancel', 'reject'].includes(
                            a,
                          ),
                        )}
                      </View>
                    ))
                : data
                    .orderActions(
                      viewer === order.seller_id ? 'seller' : 'buyer',
                      order.status,
                    )
                    .map(a => (
                      <View key={a}>
                        {button(data.orderActionLabel[a], () =>
                          Alert.alert(
                            data.orderActionLabel[a],
                            '請確認操作符合實際交易情況。',
                            [
                              { text: '返回' },
                              {
                                text: '確認',
                                onPress: () => {
                                  if (lock.current) return;
                                  lock.current = true;
                                  setBusy(true);
                                  data
                                    .transitionMarketOrder(order.id, a)
                                    .then(reload)
                                    .catch(e => setError(e.message))
                                    .finally(() => {
                                      lock.current = false;
                                      setBusy(false);
                                    });
                                },
                              },
                            ],
                          ),
                        )}
                      </View>
                    ))}
              {form && (
                <View style={card}>
                  <Text style={text}>{transactionActionLabels[form]}</Text>
                  {fields.map(([key, label]) => (
                    <View key={key}>
                      <Text style={text}>{label}</Text>
                      <TextInput
                        accessibilityLabel={label}
                        editable={!busy}
                        value={values[key] || ''}
                        onChangeText={v =>
                          setValues(prev => ({ ...prev, [key]: v }))
                        }
                        style={[
                          text,
                          {
                            borderWidth: 1,
                            borderColor: theme.border,
                            borderRadius: 12,
                            padding: 14,
                            minHeight: 48,
                          },
                        ]}
                      />
                    </View>
                  ))}
                  {error && (
                    <Text
                      accessibilityRole="alert"
                      style={[text, { color: '#B23C3C' }]}
                    >
                      {error}
                    </Text>
                  )}
                  {button(
                    busy
                      ? '正在送出，請稍候…'
                      : form === 'ship'
                      ? '確認已實際寄件並送出'
                      : '確認送出',
                    submitForm,
                    true,
                  )}
                  {button('返回修改', () => setForm(null))}
                </View>
              )}
              {!!order.order_events?.length && (
                <View style={card}>
                  <Text style={text}>交易紀錄</Text>
                  {[...order.order_events]
                    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
                    .map(e => (
                      <Text key={e.id} style={text}>
                        {new Date(e.occurred_at).toLocaleString('zh-TW')} ·{' '}
                        {transactionActionLabels[
                          e.event_type as TransactionAction
                        ] ||
                          data.orderStatusLabel[e.event_type] ||
                          e.event_type}
                      </Text>
                    ))}
                </View>
              )}
            </>
          )}
          {busy && <ActivityIndicator color={theme.primary} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
