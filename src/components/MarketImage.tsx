import { LocalizedText as Text } from "./LocalizedUI";
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

export default function MarketImage({
  uri,
  style,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return (
    <View style={[styles.frame, { backgroundColor: theme.cardBg }, style]}>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={styles.placeholder}>
          <Icon name="image-outline" size={28} color={theme.textSub} />
          <Text style={{ color: theme.textSub }}>照片暫無法顯示</Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: { aspectRatio: 1, overflow: 'hidden', borderRadius: 12 },
  image: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
});
