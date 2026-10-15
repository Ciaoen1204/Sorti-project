import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from "./LocalizedUI";
import React, { useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
export default function DeliverySelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const text = { color: theme.textMain, fontSize: 16 };
  const item = {
    padding: 16,
    minHeight: 48,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 12,
  };
  return (
    <View>
      <Text style={text}>{label}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        style={item}
        onPress={() => setOpen(true)}
      >
        <Text style={text}>
          {options.find(o => o.id === value)?.label || '請選擇'} ▾
        </Text>
      </TouchableOpacity>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: 24,
            backgroundColor: 'rgba(0,0,0,.45)',
          }}
        >
          <View
            style={{
              backgroundColor: theme.cardBg,
              padding: 16,
              borderRadius: 16,
              maxHeight: '80%',
            }}
          >
            <Text style={text}>{label}</Text>
            <ScrollView>
              {options.map(o => (
                <TouchableOpacity
                  key={o.id}
                  accessibilityRole="button"
                  style={item}
                  onPress={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                >
                  <Text style={text}>
                    {o.id === value ? '✓ ' : ''}
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={item} onPress={() => setOpen(false)}>
              <Text style={text}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
