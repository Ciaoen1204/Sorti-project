import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from "./LocalizedUI";
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { primaryNavigation as items } from '../design/platformAppearance';

export default function BottomNav({
  navigation,
  active,
}: {
  navigation: any;
  active: string;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: theme.cardBg, borderColor: theme.border },
      ]}
    >
      {items.map(item => (
        <TouchableOpacity
          key={item.route}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          accessibilityState={{ selected: active === item.route }}
          style={styles.item}
          onPress={() => {
            if (item.route !== active) {
              navigation.navigate(item.route);
            }
          }}
        >
          <Icon
            name={item.icon}
            size={22}
            color={active === item.route ? theme.primary : theme.textSub}
          />
          <Text
            style={[
              styles.label,
              { color: active === item.route ? theme.primary : theme.textSub },
            ]}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1, paddingVertical: 8 },
  item: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: { fontSize: 12, fontWeight: '500' },
});
