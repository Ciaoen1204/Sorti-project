import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity, LocalizedAlert as Alert } from "../components/LocalizedUI";
import { availableChannels, channelLabel } from '../services/deliveryChannels';
import { useScreenStyles } from '../design/useScreenStyles';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, ScrollView, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useCart } from '../context/CartContext'; // 關鍵修正：已將 .tsx 副檔名移除以符合標準 TS 引入規範
import { supabase } from '../lib/supabase';
import { loadProduct } from '../services/supabaseData';
import MarketImage from '../components/MarketImage';
import { currency, productShareText } from '../services/marketplace';

const ProductDetailScreen = ({ route, navigation }: any) => {
  const { theme } = useTheme();
  const styles = useScreenStyles(baseStyles, theme);
  const { addToCart } = useCart(); // 拿取全域加入購物車功能
  const [product, setProduct] = useState(route.params.product);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    loadProduct(route.params.product.id)
      .then(p => {
        if (active) setProduct(p);
      })
      .catch(e => {
        if (active) setLoadError(e.message || '無法載入商品，請重試。');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [route.params.product.id, refresh]);
  const [userId, setUserId] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const locked = useRef(false);
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? '');
    });
    return () => {
      active = false;
    };
  }, []);
  const ownProduct = userId === product.sellerId;
  const hasDelivery = Boolean(product.allowMeetup || product.allowShipping);
  async function buyNow(checkout = true) {
    if (
      locked.current ||
      loading ||
      !!loadError ||
      ownProduct ||
      !hasDelivery ||
      product.status !== 'active'
    )
      return;
    locked.current = true;
    setBuying(true);
    try {
      if (checkout) navigation.navigate('Checkout', { listingId: product.id });
      else await addToCart(product);
    } catch (e) {
      Alert.alert(
        '無法購買',
        e instanceof Error ? e.message : '請重新整理後再試',
      );
    } finally {
      locked.current = false;
      setBuying(false);
    }
  }

  // 抽離按鈕動態文字樣式，避免 ESLint 警告
  const actionBtnTextStyle = [styles.actionBtnText, { color: theme.onPrimary }];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* 頂部導覽列 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevron-back" size={28} color={theme.textMain} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textMain }]}>
          商品詳情
        </Text>
        <TouchableOpacity
          accessibilityLabel="分享商品"
          style={styles.shareBtn}
          onPress={() => {
            Share.share({ message: productShareText(product) }).catch(() =>
              Alert.alert('分享失敗', '請稍後重試'),
            );
          }}
        >
          <Icon name="share-social-outline" size={24} color={theme.textMain} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <Text style={{ color: theme.textSub, padding: 16 }}>
            正在載入商品…
          </Text>
        )}
        {!!loadError && (
          <View style={{ padding: 16 }}>
            <Text style={{ color: theme.danger }}>{loadError}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setRefresh(v => v + 1)}
            >
              <Text style={{ color: theme.primary, paddingVertical: 16 }}>
                重新載入商品
              </Text>
            </TouchableOpacity>
          </View>
        )}
        <MarketImage uri={product.img} style={styles.productImg} />

        <View style={[styles.infoCard, { backgroundColor: theme.cardBg }]}>
          <Text style={[styles.price, { color: theme.primary }]}>
            {currency(product.price)}
          </Text>
          <Text style={[styles.title, { color: theme.textMain }]} localize={false}>
            {product.title}
          </Text>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.metaRow}>
            <Icon name="location-outline" size={16} color={theme.textSub} />
            <Text style={[styles.metaText, { color: theme.textSub }]}>
              地區：{product.location}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Icon name="time-outline" size={16} color={theme.textSub} />
            <Text style={[styles.metaText, { color: theme.textSub }]}>
              分類：{product.category || '未分類'}
            </Text>
          </View>
          <Text style={{ color: theme.textMain }}>
            {product.condition || '狀況未填'} ·{' '}
            {product.defects || '瑕疵說明未提供'}
          </Text>
          <Text style={{ color: theme.textSub }}>
            交易方式：{product.allowMeetup ? '面交 ' : ''}
            {product.allowShipping ? '寄送' : ''}
            {!product.allowMeetup && !product.allowShipping
              ? '賣家尚未設定'
              : ''}
          </Text>
          <Text style={{ color: theme.textSub }}>
            {availableChannels(product)
              .map(
                o =>
                  `${channelLabel(o.channel)}${
                    o.channel === 'meetup' ? '' : ` · 運費 NT$ ${o.fee}`
                  }${o.note ? ' · ' + o.note : ''}`,
              )
              .join('\n')}
          </Text>
          {!!product.createdAt && (
            <Text style={{ color: theme.textSub }}>
              上架日期：
              {new Date(product.createdAt).toLocaleDateString('zh-TW')}
            </Text>
          )}
          <Text style={{ color: theme.textSub }}>
            賣家 · 可透過聊聊詢問商品詳情
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={{
              padding: 14,
              minHeight: 48,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 12,
            }}
            onPress={() =>
              navigation.navigate('SellerStore', { sellerId: product.sellerId })
            }
          >
            <Text style={{ color: theme.textMain }}>逛逛賣家賣場</Text>
          </TouchableOpacity>
          {!hasDelivery && (
            <Text style={{ color: theme.primary }}>
              賣家尚未設定交易方式，請先詢問賣家。
            </Text>
          )}
          {product.status !== 'active' && (
            <Text style={{ color: theme.textSub }}>這件商品目前無法購買。</Text>
          )}
        </View>

        <View
          style={[styles.descriptionCard, { backgroundColor: theme.cardBg }]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textMain }]}>
            商品描述
          </Text>
          <Text style={[styles.descriptionText, { color: theme.textSub }]}>
            {product.description ||
              '賣家尚未提供商品描述，可透過聊聊詢問商品狀況與配送方式。'}
          </Text>
        </View>
      </ScrollView>

      {/* 底部工具列 */}
      <View
        style={[
          styles.bottomBar,
          { backgroundColor: theme.cardBg, borderTopColor: theme.border },
        ]}
      >
        {/* 關鍵修改：點擊聊聊按鈕直接進去 Chat 聊天室 */}
        {ownProduct ? (
          <TouchableOpacity
            style={[
              styles.buyBtn,
              {
                backgroundColor: theme.primary,
                opacity:
                  !ownProduct && (!hasDelivery || product.status !== 'active')
                    ? 0.5
                    : 1,
              },
            ]}
            onPress={() =>
              !hasDelivery
                ? navigation.navigate('AddProduct', { product })
                : navigation.navigate('MarketplaceWorkspace', {
                    role: 'seller',
                    tab: 'products',
                  })
            }
          >
            <Text style={actionBtnTextStyle}>
              {hasDelivery ? '管理我的刊登' : '補充交易方式'}
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              disabled={userId === null}
              style={[styles.iconBtn, { borderColor: theme.border }]}
              onPress={() => navigation.navigate('Chat', { product })}
            >
              <Icon
                name="chatbubbles-outline"
                size={20}
                color={theme.textMain}
              />
              <Text style={[styles.iconBtnText, { color: theme.textMain }]}>
                詢問賣家
              </Text>
            </TouchableOpacity>

            {/* 加入購物車按鈕 */}
            <TouchableOpacity
              disabled={
                loading ||
                !!loadError ||
                userId === null ||
                buying ||
                !hasDelivery ||
                product.status !== 'active'
              }
              style={[styles.cartBtn, { borderColor: theme.primary }]}
              onPress={() => buyNow(false)}
            >
              <Icon name="cart-outline" size={20} color={theme.primary} />
              <Text style={[styles.cartBtnText, { color: theme.primary }]}>
                加入購物車
              </Text>
            </TouchableOpacity>

            {/* 關鍵修改：點擊立即購買按鈕直接進入 Checkout 購買頁面 */}
            <TouchableOpacity
              disabled={
                loading ||
                !!loadError ||
                userId === null ||
                buying ||
                !hasDelivery ||
                product.status !== 'active'
              }
              style={[
                styles.buyBtn,
                {
                  backgroundColor: theme.primary,
                  opacity:
                    !ownProduct && (!hasDelivery || product.status !== 'active')
                      ? 0.5
                      : 1,
                },
              ]}
              onPress={() => buyNow(true)}
            >
              <Text style={actionBtnTextStyle}>
                {hasDelivery ? '立即購買' : '尚未開放購買'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const baseStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: { paddingVertical: 5, paddingRight: 15, zIndex: 10 },
  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
  },
  shareBtn: { padding: 4 },
  scrollContent: { paddingBottom: 100 },
  productImg: { width: '100%', aspectRatio: 1, borderRadius: 0 },
  infoCard: {
    padding: 20,
    marginHorizontal: 16,
    borderRadius: 20,
    marginTop: -20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  price: { fontSize: 28, fontWeight: '700', marginBottom: 10 },
  title: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
  divider: { height: 1, marginVertical: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  metaText: { fontSize: 14, marginLeft: 8, fontWeight: '500' },
  descriptionCard: {
    padding: 20,
    marginHorizontal: 16,
    borderRadius: 20,
    marginTop: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  descriptionText: { fontSize: 15, lineHeight: 24, textAlign: 'justify' },

  bottomBar: {
    width: '100%',
    minHeight: 80,
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 15,
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 56,
    width: 60,
    marginRight: 8,
  },
  iconBtnText: { fontSize: 11, marginTop: 2, fontWeight: '500' },
  cartBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    minHeight: 56,
    marginRight: 8,
  },
  cartBtnText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
    flexShrink: 1,
  },
  buyBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 15, fontWeight: '600' },
});

export default ProductDetailScreen;
