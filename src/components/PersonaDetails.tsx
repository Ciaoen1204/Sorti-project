import { LocalizedText as Text } from "./LocalizedUI";
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { storagePersona } from '../data/storagePersonas';

export default function PersonaDetails({
  visible,
  identity,
  onClose,
  onQuiz,
}: {
  visible: boolean;
  identity: string;
  onClose: () => void;
  onQuiz: () => void;
}) {
  const { theme } = useTheme();
  const persona = storagePersona(identity);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="關閉整理偏好說明背景"
      >
        <Pressable
          style={[styles.card, { backgroundColor: theme.cardBg }]}
          onPress={() => {}}
          accessibilityViewIsModal
        >
          <ScrollView contentContainerStyle={styles.content}>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: theme.textMain }]}
            >
              {persona?.name || '尚未設定整理偏好'}
            </Text>
            {persona ? (
              <>
                <Text style={[styles.body, { color: theme.primary }]}>
                  {persona.vLabel}
                  {'\n'}
                  {persona.dLabel}
                </Text>
                <Text style={[styles.heading, { color: theme.textMain }]}>
                  你的整理特質
                </Text>
                <Text style={[styles.body, { color: theme.textMain }]}>
                  {persona.feature}
                </Text>
                <Text style={[styles.body, { color: theme.textSub }]}>
                  {persona.desc}
                </Text>
              </>
            ) : (
              <Text style={[styles.body, { color: theme.textSub }]}>
                完成收納測驗，就能查看你的整理人格與特質。
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={persona ? '重新測驗整理偏好' : '開始收納測驗'}
              onPress={onQuiz}
              style={[styles.button, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.buttonText, { color: theme.onPrimary }]}>
                {persona ? '重新測驗整理偏好' : '開始收納測驗'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={[
                styles.button,
                { borderWidth: 1, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.buttonText, { color: theme.textMain }]}>
                關閉
              </Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#0008',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '85%',
    borderRadius: 20,
    alignSelf: 'center',
  },
  content: { padding: 22, gap: 14 },
  title: { fontSize: 22, lineHeight: 32, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 25 },
  button: {
    minHeight: 50,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
});
