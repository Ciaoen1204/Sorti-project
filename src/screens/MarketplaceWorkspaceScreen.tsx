import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from "../components/LocalizedUI";
import { transactionStatus } from '../services/marketplaceOrder';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import * as market from '../services/supabaseData';
import MarketImage from '../components/MarketImage';
import { currency } from '../services/marketplace';

export default function MarketplaceWorkspaceScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const focused = useIsFocused();
  const [role, setRole] = useState<market.MarketRole>(
    route.params?.role ?? 'buyer',
  );
  const [tab, setTab] = useState<string>(
    route.params?.tab ?? (role === 'seller' ? 'products' : 'orders'),
  );
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0),
    [hasMore, setHasMore] = useState(false);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const chooseFilter = (value: string) => {
    setFilter(value);
    setPage(0);
  };
  const [products, setProducts] = useState<market.ProductRecord[]>([]);
  const [orders, setOrders] = useState<market.MarketOrder[]>([]);
  const [conversations, setConversations] = useState<
    market.MarketConversation[]
  >([]);
  const [busy, setBusy] = useState(false),
    [mutating, setMutating] = useState(false),
    [error, setError] = useState('');
  const [version, setVersion] = useState(0),
    [expanded, setExpanded] = useState('');
  const mutationLock = useRef(false);
  useEffect(() => {
    if (focused) setPage(0);
  }, [focused]);
  const reload = () => {
    setPage(0);
    setVersion(v => v + 1);
  };
  useEffect(() => {
    const nextRole = route.params?.role ?? 'buyer';
    setRole(nextRole);
    setTab(
      route.params?.tab ?? (nextRole === 'seller' ? 'products' : 'orders'),
    );
    setFilter('all');
    setPage(0);
  }, [route.params?.role, route.params?.tab]);
  useEffect(() => {
    if (!focused) return;
    let active = true;
    setBusy(true);
    setError('');
    const load = async () => {
      try {
        if (tab === 'products') {
          const [records, summary] = await Promise.all([
            market.loadMyProducts({ status: filter, page }),
            market.loadMyProductCounts(),
          ]);
          if (active) {
            setProducts(previous =>
              page ? [...previous, ...records] : records,
            );
            setCounts(summary);
            setHasMore(records.length === 20);
          }
        } else if (tab === 'orders') {
          const records = await market.loadMarketOrders(role, {
            status: filter,
            page,
          });
          if (active) {
            setOrders(previous => (page ? [...previous, ...records] : records));
            setHasMore(records.length === 20);
          }
        } else {
          const records = await market.loadMarketConversations(undefined, {
            page,
          });
          if (active) {
            setConversations(previous =>
              page ? [...previous, ...records] : records,
            );
            setHasMore(records.length === 20);
          }
        }
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : '無法載入，請重試。');
      } finally {
        if (active) setBusy(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [focused, role, tab, version, filter, page]);
  const chooseSection = (nextRole: market.MarketRole, nextTab: string) => {
    setRole(nextRole);
    setTab(nextTab);
    setFilter('all');
    setPage(0);
  };
  async function mutate(action: () => Promise<void>) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setMutating(true);
    try {
      await action();
      reload();
    } catch (e) {
      Alert.alert('操作失敗', e instanceof Error ? e.message : '請稍後再試');
    } finally {
      mutationLock.current = false;
      setMutating(false);
    }
  }
  function confirmOrder(
    order: market.MarketOrder,
    action: 'ship' | 'complete' | 'cancel',
  ) {
    Alert.alert(
      market.orderActionLabel[action],
      action === 'ship'
        ? '請確認商品已實際寄出。'
        : action === 'complete'
        ? '請確認已收到商品並檢查無誤。'
        : '取消後商品會重新上架。',
      [
        { text: '返回', style: 'cancel' },
        {
          text: '確認',
          onPress: () =>
            mutate(() => market.transitionMarketOrder(order.id, action)),
        },
      ],
    );
  }
  const button = (
    label: string,
    onPress: () => void,
    selected = false,
    disabled = false,
  ) => (
    <TouchableOpacity
      key={label}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: selected ? theme.primary : theme.cardBg,
          borderColor: theme.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? theme.onPrimary : theme.textMain,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
  const text = { color: theme.textMain };
  const labels: Record<string, string> = {
    active: '上架中',
    reserved: '保留中',
    archived: '已下架',
    sold: '已售出',
  };
  const visibleProducts = products.filter(
    p => filter === 'all' || p.status === filter,
  );
  const visibleOrders = orders.filter(
    o =>
      filter === 'all' ||
      o.status === filter ||
      (filter === 'pending' && o.status === 'paid'),
  );
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        {button('返回市集', () => navigation.navigate('Market'))}
        <Text style={[styles.title, text]}>
          {tab === 'inbox' ? '訊息中心' : '我的交易'}
        </Text>
      </View>
      {tab !== 'inbox' && (
        <ScrollView
          horizontal
          style={{ flexGrow: 0 }}
          contentContainerStyle={styles.row}
        >
          {button(
            '我的購買',
            () => chooseSection('buyer', 'orders'),
            tab === 'orders' && role === 'buyer',
          )}
          {button(
            '我的刊登',
            () => chooseSection('seller', 'products'),
            tab === 'products',
          )}
          {button(
            '銷售訂單',
            () => chooseSection('seller', 'orders'),
            tab === 'orders' && role === 'seller',
          )}
        </ScrollView>
      )}
      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'products' &&
          button('刊登商品', () => navigation.navigate('AddProduct'), true)}
        {tab !== 'inbox' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(tab === 'products'
              ? [['all', '全部'], ...Object.entries(labels)]
              : [
                  ['all', '全部'],
                  ['requested', '待回覆'],
                  ['waitMeetup', '待面交'],
                  ['waitShip', '待出貨'],
                  ['waitReceive', '待收貨'],
                  ['rejected', '已拒絕'],
                  ['pending', '既有待出貨'],
                  ['shipped', '已出貨'],
                  ['completed', '已完成'],
                  ['cancelled', '已取消'],
                ]
            ).map(([value, label]) =>
              button(
                tab === 'products' && value !== 'all'
                  ? `${label}（${counts?.[value] ?? '…'}）`
                  : label,
                () => chooseFilter(value),
                filter === value,
              ),
            )}
          </ScrollView>
        )}
        {busy && <ActivityIndicator color={theme.primary} />}
        {!!error && (
          <View>
            <Text style={text}>{error}</Text>
            {button('重新載入', reload)}
          </View>
        )}
        {!busy &&
          !error &&
          tab === 'products' &&
          visibleProducts.map(p => (
            <View
              key={p.id}
              style={[
                styles.card,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ]}
            >
              <View style={styles.row}>
                <MarketImage uri={p.img} style={styles.photo} />
                <View style={styles.flex}>
                  <Text style={[styles.name, text]}>{p.title}</Text>
                  <Text style={text}>{currency(p.price)}</Text>
                  <Text style={{ color: theme.textSub }}>
                    {labels[p.status]}
                  </Text>
                </View>
              </View>
              {['active', 'archived'].includes(p.status) ? (
                <View style={styles.row}>
                  {button(
                    '編輯商品',
                    () => navigation.navigate('AddProduct', { product: p }),
                    false,
                    mutating,
                  )}
                  {button(
                    p.status === 'active' ? '下架' : '重新上架',
                    () =>
                      Alert.alert(
                        '變更刊登狀態',
                        p.status === 'active'
                          ? '下架後买家將無法購買。'
                          : '確定重新上架？',
                        [
                          { text: '返回', style: 'cancel' },
                          {
                            text: '確認',
                            onPress: () =>
                              mutate(() =>
                                market.setProductVisibility(
                                  p.id,
                                  p.status === 'active' ? 'archived' : 'active',
                                ),
                              ),
                          },
                        ],
                      ),
                    false,
                    mutating,
                  )}
                </View>
              ) : (
                <Text style={{ color: theme.textSub }}>
                  請到銷售訂單查看交易進度。
                </Text>
              )}
            </View>
          ))}
        {!busy &&
          !error &&
          tab === 'orders' &&
          visibleOrders.map(o => (
            <View
              key={o.id}
              style={[
                styles.card,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ]}
            >
              <View style={styles.row}>
                <Text style={[styles.name, text]}>訂單商品</Text>
                <Text style={{ color: theme.primary }}>
                  {o.workflow_version === 2
                    ? transactionStatus(o)
                    : market.orderStatusLabel[o.status] || o.status}
                </Text>
              </View>
              <Text style={{ color: theme.textSub }}>
                {new Date(o.created_at).toLocaleDateString()} ·{' '}
                {o.delivery_method === 'meetup'
                  ? '面交'
                  : o.delivery_method === 'shipping'
                  ? '寄送'
                  : '既有訂單'}
              </Text>
              {o.order_items.map(i => (
                <View
                  key={i.listing_id}
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <MarketImage
                    uri={market.getPublicImageUrl(
                      'product-photos',
                      i.image_path_snapshot || null,
                    )}
                    style={{ width: 80, height: 80, borderRadius: 12 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.line, text]}>
                      品名：{i.title_snapshot}
                    </Text>
                    <Text style={text}>NT$ {i.price_snapshot}</Text>
                  </View>
                </View>
              ))}
              <Text style={[styles.line, text]}>
                運費 NT$ {o.shipping_fee} · 合計 NT$ {o.total_amount}
              </Text>
              {button(
                '查看訂單與下一步',
                () =>
                  navigation.navigate('MarketOrderDetail', { orderId: o.id }),
                true,
              )}
              {button('訂單資訊', () =>
                setExpanded(expanded === o.id ? '' : o.id),
              )}
              {expanded === o.id && (
                <View>
                  <Text selectable style={text}>
                    訂單編號：{o.id.toUpperCase()}
                  </Text>
                  <Text style={text}>
                    {o.recipient_name} · {o.recipient_phone}
                  </Text>
                  <Text style={text}>{o.shipping_address}</Text>
                </View>
              )}
              <View style={styles.row}>
                {(o.workflow_version === 2
                  ? []
                  : market.orderActions(role, o.status)
                ).map(action =>
                  button(
                    market.orderActionLabel[action],
                    () => confirmOrder(o, action),
                    action !== 'cancel',
                    mutating,
                  ),
                )}
              </View>
            </View>
          ))}
        {!busy &&
          !error &&
          tab === 'inbox' &&
          conversations.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.card,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ]}
              onPress={() =>
                navigation.navigate('Chat', {
                  conversationId: c.id,
                  product: c.listing ?? {
                    title: '商品對話',
                    sellerId: c.seller_id,
                  },
                })
              }
            >
              <Text style={[styles.name, text]}>
                {c.listing?.title || '商品對話'}
              </Text>
              <Text numberOfLines={2} style={text}>
                {c.latestMessage || '尚無訊息'}
              </Text>
              <Text style={{ color: theme.textSub }}>
                {c.viewerRole === 'seller'
                  ? `買家 · ${c.buyer_id.slice(0, 8)}`
                  : `賣家 · ${c.seller_id.slice(0, 8)}`}{' '}
                · {new Date(c.last_message_at).toLocaleString()}
              </Text>
            </TouchableOpacity>
          ))}
        {!busy &&
          !error &&
          (tab === 'products'
            ? visibleProducts.length === 0
            : tab === 'orders'
            ? visibleOrders.length === 0
            : conversations.length === 0) && (
            <Text style={[styles.hint, { color: theme.textSub }]}>
              目前沒有
              {tab === 'products'
                ? '這個狀態的商品'
                : tab === 'orders'
                ? '這個狀態的訂單'
                : '對話'}
              。
            </Text>
          )}
        {hasMore &&
          button(
            '載入更多',
            () => setPage(v => v + 1),
            false,
            busy || mutating,
          )}
        {tab !== 'inbox' &&
          button('捐贈與回收資訊', () =>
            navigation.navigate('DonationRecycling'),
          )}
        {button('重新整理', reload, false, busy || mutating)}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 21, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  hint: { paddingHorizontal: 16, paddingVertical: 10, lineHeight: 22 },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 13,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    marginVertical: 4,
  },
  content: { padding: 12, paddingBottom: 32, gap: 10 },
  card: { padding: 14, borderWidth: 1, borderRadius: 14, gap: 12 },
  photo: { width: 74, aspectRatio: 1, borderRadius: 10 },
  flex: { flex: 1, gap: 6 },
  name: { fontSize: 16, fontWeight: '600' },
  line: { lineHeight: 24 },
});
