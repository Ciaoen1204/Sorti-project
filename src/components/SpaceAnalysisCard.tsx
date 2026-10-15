import { LocalizedText as Text } from "./LocalizedUI";
import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { SpaceAnalysis } from '../types/ai';
import { useTheme } from '../context/ThemeContext';
export default function SpaceAnalysisCard({
  space,
  notice,
}: {
  space?: SpaceAnalysis | null;
  notice?: string;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.cardBg, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.title, { color: theme.textMain }]}>空間分布</Text>
      {!!notice && <Text style={{ color: theme.textSub }}>{notice}</Text>}
      {space && (
        <>
          <Text style={{ color: theme.textMain }}>
            {space.room_type} · {space.summary}
          </Text>

          {space.regions.map((region, index) => (
            <Text key={region.id} style={{ color: theme.textMain }}>
              {index + 1}. {region.name}：{region.observation}
            </Text>
          ))}
          {!!space.storage_units.length && (
            <Text style={[styles.title, { color: theme.textMain }]}>
              現有收納空間
            </Text>
          )}
          {space.storage_units.map((unit, index) => (
            <Text key={index} style={{ color: theme.textMain }}>
              {unit.name}：{unit.observation}
            </Text>
          ))}
          {space.circulation.map((line, i) => (
            <Text key={`flow-${i}`} style={{ color: theme.textMain }}>
              動線：{line}
            </Text>
          ))}
          {space.limitations.map((line, i) => (
            <Text key={`limit-${i}`} style={{ color: theme.textSub }}>
              待確認：{line}
            </Text>
          ))}
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, margin: 16, gap: 8 },
  title: { fontSize: 18, fontWeight: '700', marginVertical: 6 },
  image: { width: '100%', height: 240 },
});
