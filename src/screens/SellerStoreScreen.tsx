import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from "../components/LocalizedUI";
import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { loadProducts, type ProductRecord } from '../services/supabaseData';
import MarketImage from '../components/MarketImage';
import { currency } from '../services/marketplace';
export default function SellerStoreScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { addToCart, cartItems } = useCart();
  const [items, setItems] = useState<ProductRecord[]>([]),
    [page, setPage] = useState(0),
    [more, setMore] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError('');
    loadProducts({ sellerId: route.params.sellerId, page })
      .then(rows => {
        if (active) {
          setItems(v =>
            page === 0
              ? rows
              : [...v, ...rows.filter(r => !v.some(i => i.id === r.id))],
          );
          setMore(rows.length === 20);
        }
      })
      .catch(e => active && setError(e.message))
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, [route.params.sellerId, page, retry]);
  const text = { color: theme.textMain, fontSize: 16 };
  const button = (label: string, fn: () => void, disabled = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={fn}
      style={{
        padding: 14,
        minHeight: 48,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 12,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={text}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text style={[text, { fontSize: 24, fontWeight: '700' }]}>
          賣家賣場
        </Text>
        <Text style={text}>挑選同一賣家的商品，加入購物車一起結帳。</Text>
        {button('查看購物車', () => navigation.navigate('Cart'))}
        {!!error && (
          <View>
            <Text accessibilityRole="alert" style={text}>
              {error}
            </Text>
            {button('重新載入', () => setRetry(v => v + 1))}
          </View>
        )}
        {items.map(p => (
          <View
            key={p.id}
            style={{
              backgroundColor: theme.cardBg,
              padding: 16,
              gap: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`查看${p.title}`}
              onPress={() => navigation.push('ProductDetail', { product: p })}
            >
              <MarketImage
                uri={p.img}
                style={{ width: '100%', height: 180, borderRadius: 12 }}
              />
              <Text style={text}>{p.title}</Text>
              <Text style={text}>{currency(p.price)}</Text>
            </TouchableOpacity>
            {button(
              cartItems.some(i => i.id === p.id)
                ? '已加入購物車'
                : '加入購物車',
              () => {
                void addToCart(p, { silent: true });
              },
              cartItems.some(i => i.id === p.id),
            )}
          </View>
        ))}
        {busy && <Text style={text}>正在載入…</Text>}
        {!busy && !error && !items.length && (
          <Text style={text}>目前沒有上架商品。</Text>
        )}
        {more &&
          !busy &&
          !error &&
          button('載入更多', () => setPage(v => v + 1))}
      </ScrollView>
    </SafeAreaView>
  );
}
