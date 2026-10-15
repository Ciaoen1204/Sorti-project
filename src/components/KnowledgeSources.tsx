import { LocalizedAlert as Alert, LocalizedText as Text } from "./LocalizedUI";
import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { KnowledgeSource } from '../types/ai';
export default function KnowledgeSources({
  sources,
}: {
  sources: KnowledgeSource[];
}) {
  const [open, setOpen] = useState(false);
  const { theme } = useTheme();
  if (!sources.length) return null;
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.cardBg, borderColor: theme.border },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(value => !value)}
        style={styles.toggle}
      >
        <Text style={[styles.title, { color: theme.textMain }]}>
          參考整理技巧 · {open ? '收起' : '查看來源'}
        </Text>
      </Pressable>
      {open && (
        <>
          <Text style={[styles.body, { color: theme.textSub }]}>
            參考《怦然心動的人生整理魔法》作者官方公開的 KonMari
            技巧摘要，搭配你的測驗偏好與空間條件。
          </Text>
          {sources.map(source => (
            <Pressable
              key={source.title}
              accessibilityRole="link"
              onPress={() =>
                Linking.openURL(source.url).catch(() =>
                  Alert.alert('無法開啟來源', '請確認網路後再試。'),
                )
              }
              style={styles.link}
            >
              <Text style={[styles.body, { color: theme.primary }]}>
                {source.title}
              </Text>
              <Text style={[styles.label, { color: theme.textSub }]}>
                {source.source_label}
              </Text>
            </Pressable>
          ))}
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
    gap: 12,
  },
  toggle: { minHeight: 44, justifyContent: 'center' },
  title: { fontSize: 15, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 24 },
  label: { fontSize: 12, lineHeight: 20 },
  link: { minHeight: 48, paddingVertical: 8 },
});
