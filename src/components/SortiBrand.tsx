import BearMark from './BearMark';
import { LocalizedText as Text } from "./LocalizedUI";
import { useScreenStyles } from '../design/useScreenStyles';
import React from 'react';
import { StyleSheet, View, Image } from 'react-native';
import { useSortiTheme } from '../design/sortiTheme';

export default function SortiBrand({ compact = false }: { compact?: boolean }) {
  const { theme } = useSortiTheme();
  const styles = useScreenStyles(baseStyles, theme);
  return (
    <View style={styles.row} accessibilityLabel="拾序 收納生活">
      <BearMark size={44} label="拾序 熊抱收納盒 Logo"/>
      <View>
        <Text style={[styles.name, { color: theme.textMain }]}>拾序</Text>
        {!compact && (
          <Text style={[styles.caption, { color: theme.textSub }]}>
            收納管理
          </Text>
        )}
      </View>
    </View>
  );
}
const baseStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  caption: { fontSize: 10, letterSpacing: 1, marginTop: 3 },
});
