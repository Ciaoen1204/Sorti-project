import React, { useRef, useState } from 'react';
import { usePolicyReview, setPolicyReviewed } from '../services/legalReview';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import policies from '../data/legalPolicies.json';
export default function LegalPolicyScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const scroll = useRef<ScrollView>(null);
  const [readingChecked, setReadingChecked] = useState(false);
  const kind = route.params?.kind === 'privacy' ? 'privacy' : 'terms';
  const jump = () => scroll.current?.scrollToEnd({ animated: true });
  const doc = policies[route.params?.kind === 'privacy' ? 'privacy' : 'terms'];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => navigation.goBack()}
        style={{ padding: 20 }}
      >
        <Text style={{ color: theme.primary, fontSize: 18 }}>‹ 返回</Text>
      </TouchableOpacity>
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ padding: 24, paddingBottom: 110 }}
      >
        <Text
          style={{
            fontSize: 28,
            fontWeight: '700',
            color: theme.textMain,
            marginBottom: 20,
          }}
        >
          {doc.title} v1.1
        </Text>
        {doc.blocks.map((block, i) => (
          <Text
            key={i}
            style={{
              fontSize: 16,
              lineHeight: 28,
              color: theme.textMain,
              marginBottom: 16,
              fontWeight: /^[一二三四五六七八九十]+、/.test(block)
                ? '700'
                : '400',
            }}
          >
            {block.split(/(https?:\/\/[^\s，。；）]+)/g).map((part, j) =>
              part.startsWith('http') ? (
                <Text
                  key={j}
                  accessibilityRole="link"
                  style={{
                    color: theme.primary,
                    textDecorationLine: 'underline',
                  }}
                  onPress={() =>
                    Linking.openURL(part).catch(() =>
                      Alert.alert('無法開啟連結', part),
                    )
                  }
                >
                  {part}
                </Text>
              ) : (
                part
              ),
            )}
          </Text>
        ))}
        <View
          style={{
            backgroundColor: theme.cardBg,
            padding: 18,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.border,
            gap: 16,
          }}
        >
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: readingChecked }}
            onPress={() => setReadingChecked(!readingChecked)}
          >
            <Text
              style={{ color: theme.textMain, fontSize: 16, lineHeight: 28 }}
            >
              {readingChecked ? '☑' : '☐'}{' '}
              {kind === 'terms'
                ? '我已閱讀並同意服務條款'
                : '我已閱讀隱私權政策'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!readingChecked}
            onPress={() => {
              if (readingChecked) {
                setPolicyReviewed(kind, true);
                navigation.goBack();
              }
            }}
            style={{
              backgroundColor: theme.primary,
              opacity: readingChecked ? 1 : 0.4,
              padding: 16,
              borderRadius: 18,
            }}
          >
            <Text style={{ color: theme.onPrimary, textAlign: 'center' }}>
              確認並返回
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={jump}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 20,
          padding: 14,
          borderRadius: 20,
          backgroundColor: theme.primary,
          borderWidth: 1,
          borderColor: theme.primary,
          elevation:6,
          shadowColor:'#000',shadowOpacity:0.2,shadowRadius:8,shadowOffset:{width:0,height:3},
        }}
      >
        <Text style={{ color: theme.onPrimary,fontSize:17,fontWeight:'700' }}>滑到底部 ↓</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
