import { LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from "../components/LocalizedUI";
import {advicePresentation} from '../services/adviceSections';
import {chatHistory,chatPresentation} from '../services/chatPresentation';
import ChatAdvice from '../components/ChatAdvice';
import { displayPersona } from '../design/personaLabel';
import { useScreenStyles } from '../design/useScreenStyles';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, Image, View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../context/ThemeContext';
import { sendMessageToAI } from '../services/aiApi';
import {
  loadAiChatMessages,
  saveAiChatMessage,
} from '../services/supabaseData';
import type { ChatItem } from '../types/ai';

type MessageSender = 'user' | 'ai' | 'loading';

const PERSONA_ALIASES: Record<string, string> = {
  遮醜結果師: '遮醜結界師',
  遮醜結介師: '遮醜結界師',
  遮醜結界士: '遮醜結界師',
  首席秩序官員: '首席秩序官',
  時光展覽師: '時光展覽家',
};

function normalizePersona(persona: string | null | undefined): string {
  if (!persona) return '未提供收納人格';

  const cleanedPersona = persona.replace('🔮', '').replace('人格：', '').trim();
  return PERSONA_ALIASES[cleanedPersona] ?? cleanedPersona;
}

interface Message {
  id: string;
  sender: MessageSender;
  text: string;
  createdAt: number;
}

const AIChatScreen = ({ route, navigation }: any) => {
  const routeParams = route?.params ?? {};
  const { theme } = useTheme();
  const styles = useScreenStyles(baseStyles, theme);
  const listRef = useRef<FlatList<Message>>(null);
  const inputRef = useRef<TextInput>(null);
  const [inputText, setInputText] = useState('');
  const [followupContext,setFollowupContext]=useState('');
  const [loading, setLoading] = useState(false);
  const [userPersona, setUserPersona] = useState('未提供收納人格');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: '你好，想整理哪個空間？你可以描述目前的狀況，或詢問物品分類與收納方式。',
      createdAt: Date.now(),
    },
  ]);

  const [contextCleared, setContextCleared] = useState(false);
  useEffect(() => {
    setContextCleared(false);
  }, [routeParams.detectedItems]);
  const detectedItems: ChatItem[] =
    !contextCleared && Array.isArray(routeParams.detectedItems)
      ? routeParams.detectedItems.filter((item: unknown): item is ChatItem => {
          if (!item || typeof item !== 'object') return false;
          const candidate = item as ChatItem;
          return (
            typeof candidate.name === 'string' &&
            typeof candidate.category === 'string'
          );
        })
      : [];

  const routePersona = routeParams?.userPersona ?? routeParams?.persona;

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadPersona = async () => {
        try {
          const [savedPersona, remoteMessages] = await Promise.all([
            AsyncStorage.getItem('user_magic_identity'),
            loadAiChatMessages().catch(() => []),
          ]);
          if (!active) return;

          setUserPersona(normalizePersona(routePersona ?? savedPersona));
          if (remoteMessages.length > 0) setMessages(remoteMessages);
        } catch (error) {
          if (!active) return;
          console.log('讀取收納人格失敗', error);
          setUserPersona('未提供收納人格');
        }
      };

      loadPersona();

      return () => {
        active = false;
      };
    }, [routePersona]),
  );

  // 將所有動態主題樣式抽離至 dynamicStyles，避免 JSX 內聯物件觸發 ESLint 警告
  const dynamicStyles = useMemo(
    () => ({
      container: { backgroundColor: theme.background },
      hero: { backgroundColor: theme.cardBg, borderBottomColor: theme.border },
      title: { color: theme.textMain },
      subtitle: { color: theme.textSub },
      metaPill: { backgroundColor: theme.background },
      metaPillText: { color: theme.textSub },
      userText: { color: theme.onPrimary },
      aiText: { color: theme.textMain },
      inputRow: { backgroundColor: theme.cardBg, borderTopColor: theme.border },
      input: {
        backgroundColor: theme.background,
        borderColor: theme.border,
        color: theme.textMain,
      },
      sendButton: { backgroundColor: theme.primary },
      sendText: { color: theme.onPrimary },
    }),
    [theme],
  );

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  };

  const formatTime = (timestamp: number) => {
    const now = new Date(timestamp);
    return `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  };

  const handleSend = async (question?: string, replyContext?: string) => {
    const trimmedInput = (question ?? inputText).trim();
    if (!trimmedInput || loading) return;

    const contextForReply=replyContext || followupContext;
    setFollowupContext('');
    const now = Date.now();
    const userMessage: Message = {
      id: `${now}-user`,
      sender: 'user',
      text: trimmedInput,
      createdAt: now,
    };

    const loadingMessage: Message = {
      id: `${now}-loading`,
      sender: 'loading',
      text: '正在回覆…',
      createdAt: now,
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInputText('');
    setLoading(true);
    scrollToBottom();

    try {
      await saveAiChatMessage('user', trimmedInput, detectedItems);
      const result = await sendMessageToAI({
        message: trimmedInput,
        history: chatHistory(messages.filter(m=>m.id!=='welcome'),contextForReply),
        items: detectedItems,
        user_persona:
          userPersona === '未提供收納人格'
            ? undefined
            : normalizePersona(userPersona),
      });

      const aiMessage: Message = {
        id: `${Date.now()}-ai`,
        sender: 'ai',
        text: result.reply,
        createdAt: Date.now(),
      };

      await saveAiChatMessage('assistant', result.reply, detectedItems);

      setMessages(prev =>
        prev
          .filter(message => message.id !== loadingMessage.id)
          .concat(aiMessage),
      );
    } catch (error) {
      const errorMessage: Message = {
        id: `${Date.now()}-error`,
        sender: 'ai',
        text:
          error instanceof Error
            ? `目前無法取得回覆：${error.message}`
            : '目前 AI 小助手暫時無法回覆，請稍後再試。',
        createdAt: Date.now(),
      };

      setMessages(prev =>
        prev
          .filter(message => message.id !== loadingMessage.id)
          .concat(errorMessage),
      );
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const renderItem = ({ item }: ListRenderItemInfo<Message>) => {
    const isUser = item.sender === 'user';
    const isLoading = item.sender === 'loading';
    const hasSteps=!isUser&&!isLoading&&advicePresentation(chatPresentation(item.text).body).some(section=>section.blocks.some(block=>block.kind==='step'));

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.userRow : styles.aiRow,
          isLoading && styles.loadingRow,
        ]}
      >
        {!isUser&&<Image source={require('../assets/images/sorti-logo.png')} style={{width:28,height:28,marginRight:7,marginTop:4}}/>}
        <View
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.aiBubble,
            isLoading && styles.loadingBubble,
            {backgroundColor:isUser?theme.primary:theme.cardBg,borderColor:theme.border},
            hasSteps&&{backgroundColor:'transparent',borderWidth:0,padding:0,maxWidth:'88%'},
          ]}
        >
          {isLoading ? (
            <View style={styles.loadingContent}>
              <ActivityIndicator size="small" color="#5c5c5c" />
              <Text style={styles.loadingText} localize={false}>{item.text}</Text>
            </View>
          ) : (
            isUser ? <Text style={[styles.userText,dynamicStyles.userText]} localize={false}>{item.text}</Text> :
            <ChatAdvice text={item.text} interactive={!loading&&item.id===messages[messages.length-1]?.id&&item.id!=='welcome'} onChoose={question=>{void handleSend(question,item.text);}} onCustomInput={()=>{setFollowupContext(item.text);inputRef.current?.focus();}}/>
          )}
          <Text
            style={[styles.timeText, isUser ? styles.userTime : styles.aiTime, {color:isUser?theme.onPrimary:theme.textSub}]}
          >
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.hero, dynamicStyles.hero]}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
            >
              <Icon name="chevron-back" size={28} color={theme.textMain} />
            </TouchableOpacity>
            <Image source={require('../assets/images/sorti-logo.png')} style={{width:42,height:42,marginRight:12}}/>
            <View style={styles.heroTitleBlock}>
              <Text style={[styles.title, dynamicStyles.title]}>收納助理</Text>
              <Text style={[styles.subtitle, dynamicStyles.subtitle]}>
                步驟一次看清楚，有問題隨時問
              </Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          {!!detectedItems.length && (
            <TouchableOpacity onPress={() => setContextCleared(true)}>
              <Text style={{ color: theme.primary }}>清除物品背景</Text>
            </TouchableOpacity>
          )}
          <View style={styles.metaPills}>
            <View style={[styles.metaPill, dynamicStyles.metaPill]}>
              <Text style={[styles.metaPillText, dynamicStyles.metaPillText]}>
                偏好：{displayPersona(userPersona)}
              </Text>
            </View>

            <View style={[styles.metaPill, dynamicStyles.metaPill]}>
              <Text style={[styles.metaPillText, dynamicStyles.metaPillText]}>
                {detectedItems.length > 0
                  ? `已帶入 ${detectedItems.length} 個物品`
                  : '可直接描述你的空間'}
              </Text>
            </View>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={scrollToBottom}
          keyboardShouldPersistTaps="handled"
        />

        <View style={[styles.inputRow, dynamicStyles.inputRow]}>
          <TextInput ref={inputRef}
            style={[styles.input, dynamicStyles.input]}
            value={inputText}
            onChangeText={setInputText}
            accessibilityLabel="你的問題"
            placeholder="哪一步有問題？直接問我"
            placeholderTextColor={theme.placeholder}
            multiline
            editable={!loading}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              dynamicStyles.sendButton,
              (loading || !inputText.trim()) && styles.sendButtonDisabled,
            ]}
            accessibilityRole="button" accessibilityLabel="送出訊息"
            onPress={() => {void handleSend();}}
            disabled={loading || !inputText.trim()}
          >
            {loading?<ActivityIndicator color={theme.onPrimary}/>:<Icon name="arrow-up" size={23} color={theme.onPrimary}/>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    paddingVertical: 5,
    paddingRight: 14,
    zIndex: 10,
  },
  heroTitleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 20,
  },
  headerSpacer: {
    width: 32,
  },
  metaPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metaPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    flexGrow: 1,
  },
  messageRow: {
    width: '100%',
    marginBottom: 12,
    flexDirection: 'row',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  loadingRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    padding: 14,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: '#c6f0d6',
    borderBottomRightRadius: 6,
  },
  aiBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: '#e7dfd0',
  },
  loadingBubble: {
    backgroundColor: '#f2f2f2',
  },
  userText: {
    fontSize: 16,
    lineHeight: 23,
    color: '#2f2a26',
  },
  aiText: {
    fontSize: 16,
    lineHeight: 23,
    color: '#2f2a26',
  },
  timeText: {
    marginTop: 6,
    fontSize: 11,
  },
  userTime: {
    color: '#6d665c',
    textAlign: 'right',
  },
  aiTime: {
    color: '#8b7e6f',
    textAlign: 'left',
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    flexShrink: 1,
    color: '#5e5e5e',
    fontSize: 15,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'android' ? 28 : 12,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
  },
  sendButton: {
    marginLeft: 10,
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
  sendText: {
    fontWeight: '700',
  },
});

export default AIChatScreen;
