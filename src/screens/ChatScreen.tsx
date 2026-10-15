import { LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity, LocalizedAlert as Alert } from "../components/LocalizedUI";
import { marketRequestId } from '../services/marketplaceOrder';
import { useScreenStyles } from '../design/useScreenStyles';
import React, { useRef, useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ListRenderItemInfo, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import {
  getOrCreateConversation,
  loadMarketplaceMessages,
  sendMarketplaceMessage,
  loadRelatedMarketOrders,
  orderStatusLabel,
  type MarketOrder,
} from '../services/supabaseData';

// 定義單條對話的型別
interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: number;
}

const ChatScreen = ({ route, navigation }: any) => {
  const { theme } = useTheme();
  const styles = useScreenStyles(baseStyles, theme);
  const listRef = useRef<FlatList<Message>>(null);
  const [relatedOrders, setRelatedOrders] = useState<MarketOrder[]>([]);
  const messageRequest = useRef(marketRequestId());
  const sendLock = useRef(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [conversationId, setConversationId] = useState('');

  // 取得從商品詳情頁傳過來的商品資料
  const product = route?.params?.product;
  const existingConversationId = route?.params?.conversationId;

  // 模擬像蝦皮一樣的對話紀錄
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    let active = true;
    if (!product)
      return () => {
        active = false;
      };
    const initialize = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const id =
          existingConversationId ?? (await getOrCreateConversation(product));
        const records = await loadMarketplaceMessages(id, route.params?.since);
        if (!active) return;
        setCurrentUserId(data.user?.id ?? '');
        setConversationId(id);
        setMessages(records);
      } catch (error) {
        Alert.alert(
          '無法開啟對話',
          error instanceof Error ? error.message : '請稍後再試',
        );
      }
    };
    initialize();
    return () => {
      active = false;
    };
  }, [product, existingConversationId, route.params?.since]);

  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    loadRelatedMarketOrders(conversationId)
      .then(setRelatedOrders)
      .catch(() => {});
    const timer = setInterval(() => {
      loadRelatedMarketOrders(conversationId)
        .then(records => {
          if (active) setRelatedOrders(records);
        })
        .catch(() => {});
      loadMarketplaceMessages(conversationId, route.params?.since)
        .then(records => {
          if (active) setMessages(records);
        })
        .catch(() => {});
    }, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [conversationId, route.params?.since]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  };

  // 傳送訊息
  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || !conversationId || sendLock.current) return;
    sendLock.current = true;
    setSending(true);
    try {
      const message = await sendMarketplaceMessage(
        conversationId,
        trimmedInput,
        messageRequest.current,
      );
      setMessages(prev => [...prev, message]);
      setInput('');
      messageRequest.current = marketRequestId();
      scrollToBottom();
    } catch (error) {
      Alert.alert(
        '傳送失敗',
        error instanceof Error ? error.message : '請稍後再試',
      );
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  };

  // 💡 關鍵優化：將所有動態樣式全部抽離，徹底消除 ESLint 警告 💡

  // 1. 導覽列與背景樣式
  const containerStyle = [
    styles.container,
    { backgroundColor: theme.background },
  ];
  const headerStyle = [
    styles.header,
    { borderBottomColor: theme.border, backgroundColor: theme.background },
  ];
  const headerTitleStyle = [styles.headerTitle, { color: theme.textMain }];

  // 2. 頂部商品橫條
  const miniHeaderStyle = [
    styles.productMiniHeader,
    { backgroundColor: theme.cardBg, borderBottomColor: theme.border },
  ];
  const miniTitleStyle = [styles.miniTitle, { color: theme.textMain }];
  const miniPriceStyle = [styles.miniPrice, { color: theme.primary }];
  const actionBtnStyle = [styles.actionBtn, { borderColor: theme.primary }];
  const actionBtnTextStyle = [styles.actionBtnText, { color: theme.primary }];

  // 3. 聊天氣泡
  const buyerBubbleStyle = [
    styles.buyerBubble,
    { backgroundColor: theme.primary },
  ];
  const sellerBubbleStyle = [
    styles.sellerBubble,
    { backgroundColor: theme.cardBg, borderColor: theme.border },
  ];

  const buyerTextStyle = [styles.bubbleText, { color: theme.onPrimary }];
  const sellerTextStyle = [styles.bubbleText, { color: theme.textMain }];

  // 4. 底部輸入框與按鈕
  const inputRowStyle = [
    styles.inputRow,
    { backgroundColor: theme.cardBg, borderTopColor: theme.border },
  ];
  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.background,
      borderColor: theme.border,
      color: theme.textMain,
    },
  ];
  const sendButtonStyle = [
    styles.sendButton,
    { backgroundColor: theme.primary },
    !input.trim() && styles.sendButtonDisabled,
  ];

  const renderItem = ({ item, index }: ListRenderItemInfo<Message>) => {
    const isBuyer = item.senderId === currentUserId;
    const sentAt = new Date(item.createdAt);
    const time = `${sentAt.getHours().toString().padStart(2, '0')}:${sentAt
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    return (
      <View
        style={[
          styles.messageRow,
          isBuyer ? styles.buyerRow : styles.sellerRow,
        ]}
      >
        {!isBuyer && (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: theme.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
            }}
          >
            <Icon name="person-outline" size={18} color={theme.textSub} />
          </View>
        )}
        {/* 對話氣泡 */}
        <View style={styles.bubbleContainer}>
          <View
            style={[
              styles.bubble,
              isBuyer ? buyerBubbleStyle : sellerBubbleStyle,
            ]}
          >
            <Text style={isBuyer ? buyerTextStyle : sellerTextStyle} localize={false}>
              {item.text}
            </Text>
          </View>
          <Text
            style={[
              styles.timeText,
              isBuyer ? styles.buyerTime : styles.sellerTime,
              { color: theme.textSub },
            ]}
          >
            {index === 0 ||
            new Date(messages[index - 1].createdAt).toDateString() !==
              sentAt.toDateString()
              ? sentAt.toLocaleDateString('zh-TW') + ' · '
              : ''}
            {time}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={containerStyle}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {relatedOrders.map(o => (
          <TouchableOpacity
            key={o.id}
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('MarketOrderDetail', { orderId: o.id })
            }
            style={{ padding: 14, backgroundColor: theme.cardBg }}
          >
            <Text style={{ color: theme.textMain }}>
              查看訂單 {o.id.slice(0, 8)} ·{' '}
              {orderStatusLabel[o.status] || o.status}
            </Text>
          </TouchableOpacity>
        ))}
        {route.params?.orderId && !relatedOrders.length && (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('MarketOrderDetail', {
                orderId: route.params.orderId,
              })
            }
            style={{ padding: 14 }}
          >
            <Text style={{ color: theme.textMain }}>返回訂單</Text>
          </TouchableOpacity>
        )}
        {/* 頂部導覽列 */}
        <View style={headerStyle}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Icon name="chevron-back" size={28} color={theme.textMain} />
          </TouchableOpacity>
          <Text style={headerTitleStyle}>
            {currentUserId === product?.sellerId ? '買家對話' : '賣家對話'}
          </Text>
          <View style={styles.headerPlaceholder} />
        </View>

        {/* 頂部商品迷你資訊欄 */}
        {product?.img && (
          <View style={miniHeaderStyle}>
            <Image source={{ uri: product.img }} style={styles.miniImg} />
            <View style={styles.miniInfo}>
              <Text style={miniTitleStyle} numberOfLines={1} localize={false}>
                {product.title}
              </Text>
              <Text style={miniPriceStyle}>${product.price}</Text>
            </View>
            <TouchableOpacity
              style={actionBtnStyle}
              onPress={() => navigation.navigate('ProductDetail', { product })}
            >
              <Text style={actionBtnTextStyle}>查看商品</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 對話訊息列表 */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={scrollToBottom}
          keyboardShouldPersistTaps="handled"
        />

        {/* 底部輸入列 */}
        <View style={inputRowStyle}>
          <TextInput
            style={inputStyle}
            value={input}
            editable={!sending}
            onChangeText={v => {
              setInput(v);
              messageRequest.current = marketRequestId();
            }}
            accessibilityLabel="訊息"
            placeholder="輸入訊息…"
            placeholderTextColor={theme.textSub}
            multiline
          />

          <TouchableOpacity
            style={sendButtonStyle}
            onPress={handleSend}
            accessibilityLabel="送出訊息"
            disabled={sending || !input.trim() || !conversationId}
          >
            <Icon
              name={sending ? 'ellipsis-horizontal' : 'arrow-up'}
              size={24}
              color={theme.onPrimary}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const baseStyles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  header: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: { paddingVertical: 5, paddingRight: 15, zIndex: 10 },
  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  headerPlaceholder: { width: 32 },

  // 商品迷你橫條樣式
  productMiniHeader: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  miniImg: {
    width: 45,
    height: 45,
    borderRadius: 8,
  },
  miniInfo: {
    flex: 1,
    marginLeft: 12,
  },
  miniTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  miniPrice: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },

  messageList: { paddingHorizontal: 16, paddingVertical: 18, flexGrow: 1 },
  messageRow: { width: '100%', marginBottom: 14, flexDirection: 'row' },
  buyerRow: { justifyContent: 'flex-end' },
  sellerRow: { justifyContent: 'flex-start' },

  bubbleContainer: { flexDirection: 'column', maxWidth: '82%' },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  buyerBubble: {
    borderBottomRightRadius: 4,
  },
  sellerBubble: {
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  timeText: {
    fontSize: 12,
    color: '#a89d9d',
    marginTop: 4,
  },
  buyerTime: { alignSelf: 'flex-end', marginRight: 4 },
  sellerTime: { alignSelf: 'flex-start', marginLeft: 4 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 15,
    borderWidth: 1,
  },
  sendButton: {
    marginLeft: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendText: { fontWeight: '700', fontSize: 14 },
});

export default ChatScreen;
