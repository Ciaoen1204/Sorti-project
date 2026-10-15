import { LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from "../components/LocalizedUI";
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import BottomNav from '../components/BottomNav';
import MarketImage from '../components/MarketImage';
import { loadProducts, type ProductQuery } from '../services/supabaseData';
import {
  currency,
  listingCategories,
  marketSorts,
  priceRange,
} from '../services/marketplace';
import { useMarketPage } from '../services/useMarketPage';

export default function MarketScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { cartItems } = useCart();
  const focused = useIsFocused();
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('全部');
  const [sort, setSort] = useState<ProductQuery['sort']>('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [min, setMin] = useState(''),
    [max, setMax] = useState(''),
    [filterError, setFilterError] = useState('');
  const [range, setRange] = useState<{ minPrice?: number; maxPrice?: number }>(
    {},
  );
  const result = useMarketPage(loadProducts, {
    query,
    category,
    sort,
    ...range,
  });
  const { retry } = result;
  // Refresh when returning from publishing, checkout or listing management.
  useEffect(() => {
    if (focused) retry();
  }, [focused, retry]);
  const text = { color: theme.textMain };
  const button = (label: string, action: () => void, selected = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      key={label}
      accessibilityState={{ selected }}
      onPress={action}
      style={[
        styles.button,
        {
          backgroundColor: selected ? theme.primary : theme.cardBg,
          borderColor: theme.border,
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
  const header = (
    <View style={styles.controls}>
      <View
        style={[
          styles.search,
          { backgroundColor: theme.cardBg, borderColor: theme.border },
        ]}
      >
        <Icon name="search-outline" size={20} color={theme.textSub} />
        <TextInput
          style={[styles.input, text]}
          value={query}
          onChangeText={setQuery}
          placeholder="搜尋二手商品、品牌或關鍵字"
          placeholderTextColor={theme.textSub}
          returnKeyType="search"
        />
        {!!query && (
          <TouchableOpacity
            accessibilityLabel="清除搜尋"
            onPress={() => setQuery('')}
            style={styles.icon}
          >
            <Icon name="close" size={22} color={theme.textMain} />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {['全部', ...listingCategories].map(c =>
          button(c, () => setCategory(c), category === c),
        )}
      </ScrollView>
      <View style={styles.row}>
        {button('我的交易', () =>
          navigation.navigate('MarketplaceWorkspace', {
            role: 'buyer',
            tab: 'orders',
          }),
        )}
        {button('篩選與排序', () => setFiltersOpen(!filtersOpen), filtersOpen)}
      </View>
      {filtersOpen && (
        <View
          style={[
            styles.filters,
            { borderColor: theme.border, backgroundColor: theme.cardBg },
          ]}
        >
          <ScrollView horizontal contentContainerStyle={styles.chips}>
            {marketSorts.map(([v, label]) =>
              button(label, () => setSort(v), sort === v),
            )}
          </ScrollView>
          <Text style={text}>價格區間（NT$）</Text>
          <View style={styles.row}>
            <TextInput
              accessibilityLabel="最低價格"
              placeholder="最低價格"
              placeholderTextColor={theme.textSub}
              value={min}
              onChangeText={setMin}
              keyboardType="decimal-pad"
              style={[styles.priceInput, text, { borderColor: theme.border }]}
            />
            <TextInput
              accessibilityLabel="最高價格"
              placeholder="最高價格"
              placeholderTextColor={theme.textSub}
              value={max}
              onChangeText={setMax}
              keyboardType="decimal-pad"
              style={[styles.priceInput, text, { borderColor: theme.border }]}
            />
          </View>
          {!!filterError && <Text style={text}>{filterError}</Text>}
          <View style={styles.row}>
            {button(
              '套用價格',
              () => {
                try {
                  setRange(priceRange(min, max));
                  setFilterError('');
                } catch (e) {
                  setFilterError((e as Error).message);
                }
              },
              true,
            )}
            {button('清除篩選', () => {
              setMin('');
              setMax('');
              setRange({});
              setCategory('全部');
              setSort('newest');
              setFilterError('');
            })}
          </View>
        </View>
      )}
      <Text style={{ color: theme.textSub }}>
        已載入 {result.value.length} 件 ·{' '}
        {marketSorts.find(([v]) => v === sort)?.[1]}
        {range.minPrice !== undefined || range.maxPrice !== undefined
          ? ` · ${min || '0'}～${max || '不限'} 元`
          : ''}
      </Text>
    </View>
  );
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.top}>
        <Text style={[styles.title, text]}>二手市集</Text>
        <View style={styles.row}>
          <TouchableOpacity
            accessibilityLabel="訊息中心"
            onPress={() =>
              navigation.navigate('MarketplaceWorkspace', { tab: 'inbox' })
            }
            style={styles.icon}
          >
            <Icon name="chatbubbles-outline" size={24} color={theme.textMain} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel={`購物車，${cartItems.length} 件`}
            onPress={() => navigation.navigate('Cart')}
            style={styles.icon}
          >
            <Icon name="cart-outline" size={24} color={theme.textMain} />
            {!!cartItems.length && (
              <Text style={{ color: theme.primary }}>{cartItems.length}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        refreshing={result.busy && !result.value.length}
        onRefresh={result.retry}
        data={result.value}
        numColumns={2}
        keyExtractor={p => p.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.columns}
        renderItem={({ item: p }) => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${p.title}，${currency(p.price)}`}
            onPress={() => navigation.navigate('ProductDetail', { product: p })}
            style={[
              styles.card,
              { backgroundColor: theme.cardBg, borderColor: theme.border },
            ]}
          >
            <MarketImage uri={p.img} />
            <View style={styles.cardText}>
              <Text numberOfLines={2} style={[styles.name, text]}>
                {p.title}
              </Text>
              <Text style={[styles.price, { color: theme.primary }]}>
                {currency(p.price)}
              </Text>
              <Text style={{ color: theme.textSub }}>
                {p.condition || '狀況未填'} · {p.allowMeetup ? '面交 ' : ''}
                {p.allowShipping ? '寄送' : ''}
              </Text>
              <Text numberOfLines={1} style={{ color: theme.textSub }}>
                {[p.category, p.location].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !result.busy && !result.error ? (
            <View style={styles.empty}>
              <Icon name="search-outline" size={36} color={theme.textSub} />
              <Text style={text}>
                {query || category !== '全部' || Object.keys(range).length
                  ? '沒有符合條件的商品，試試其他關鍵字或清除篩選。'
                  : '目前沒有上架商品，成為第一位刊登者吧。'}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.empty}>
            {result.busy && (
              <>
                <ActivityIndicator color={theme.primary} />
                <Text style={text}>正在搜尋商品…</Text>
              </>
            )}
            {!!result.error && (
              <>
                <Text style={text}>{result.error}</Text>
                {button('重新載入', result.retry)}
              </>
            )}
            {result.hasMore &&
              !result.busy &&
              !result.error &&
              button('載入更多商品', result.more)}
          </View>
        }
      />
      <View style={styles.publishDock}>
        {button('＋刊登商品', () => navigation.navigate('AddProduct'), true)}
      </View>
      <BottomNav navigation={navigation} active="Market" />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: { fontSize: 24, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  icon: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  controls: { gap: 12, marginBottom: 16 },
  search: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    paddingLeft: 12,
  },
  input: { flex: 1, minHeight: 50, fontSize: 14, paddingHorizontal: 8 },
  chips: { gap: 8 },
  button: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  publishDock: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  list: { padding: 16, paddingBottom: 24 },
  columns: { gap: 12 },
  card: {
    flex: 1,
    maxWidth: '48.5%',
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
  },
  cardText: { padding: 10, gap: 6 },
  name: { fontSize: 15, lineHeight: 22, minHeight: 44, fontWeight: '600' },
  price: { fontSize: 19, fontWeight: '700' },
  empty: { paddingVertical: 24, alignItems: 'center', gap: 12 },
  filters: { padding: 12, gap: 12, borderWidth: 1, borderRadius: 14 },
  priceInput: {
    flex: 1,
    minWidth: 100,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
});
