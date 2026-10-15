import { LocalizedText as Text } from "./LocalizedUI";
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { advicePresentation } from '../services/adviceSections';
import { useTheme } from '../context/ThemeContext';

export default function AdviceText({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <View>
      {advicePresentation(text).map((section, index) => (
        <View key={index} style={styles.section}>
          {!!section.title && (
            <Text
              accessibilityRole="header"
              style={[styles.heading, { color: theme.textMain }]}
            >
              {section.title}
            </Text>
          )}
          {section.blocks.map((block, blockIndex) =>
            block.kind === 'step' ? (
              <View
                key={blockIndex}
                style={[
                  styles.step,
                  { backgroundColor: theme.cardBg, borderColor: theme.border },
                ]}
              >
                <View style={styles.stepHeader}>
                  <View
                    style={[
                      styles.number,
                      { backgroundColor: theme.primarySoft },
                    ]}
                  >
                    <Text
                      accessibilityLabel={`步驟 ${block.number}`}
                      style={[styles.numberText, { color: theme.primary }]}
                    >
                      {block.number}
                    </Text>
                  </View>
                  <Text
                    accessibilityRole="header"
                    style={[styles.stepTitle, { color: theme.textMain }]}
                   localize={false}>
                    {block.title}
                  </Text>
                </View>
                {!!block.description && (
                  <Text style={[styles.description, { color: theme.textSub }]}>
                    {block.description}
                  </Text>
                )}
              </View>
            ) : (
              <View
                key={blockIndex}
                style={[styles.note, { backgroundColor: theme.primarySoft }]}
              >
                <Text style={[styles.text, { color: theme.textMain }]} localize={false}>
                  {block.text}
                </Text>
              </View>
            ),
          )}
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { marginBottom: 20, gap: 12 },
  text: { fontSize: 15, lineHeight: 25 },
  heading: { fontSize: 18, fontWeight: '700', lineHeight: 28 },
  note: { borderRadius: 14, padding: 16 },
  step: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  stepHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  number: {
    minWidth: 32,
    minHeight: 32,
    borderRadius: 16,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { fontSize: 15, lineHeight: 24, fontWeight: '700' },
  stepTitle: { flex: 1, fontSize: 16, lineHeight: 26, fontWeight: '700' },
  description: { fontSize: 15, lineHeight: 25 },
});
