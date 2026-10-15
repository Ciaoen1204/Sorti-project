import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { usePolicyReview, resetPolicyReview } from '../services/legalReview';
export default function LegalChecks({
  adult,
  agreed,
  setAdult,
  setAgreed,
  open,
}: {
  adult: boolean;
  agreed: boolean;
  setAdult: (v: boolean) => void;
  setAgreed: (v: boolean) => void;
  open: (kind: 'terms' | 'privacy') => void;
}) {
  const { theme } = useTheme();
  const review = usePolicyReview();
  useEffect(() => {
    resetPolicyReview();
  }, []);
  useEffect(() => {
    if (!review.terms || !review.privacy) setAgreed(false);
  }, [review.terms, review.privacy, setAgreed]);
  const check = (
    value: boolean,
    toggle: () => void,
    label: string,
    disabled = false,
  ) => (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => {
        if (!disabled) toggle();
      }}
      hitSlop={8}
      style={{ width:20,height:20,justifyContent:'center',alignItems:'center',padding:0,borderWidth:1.5,borderRadius:2,borderColor:theme.primary,backgroundColor:value?theme.primary:theme.cardBg }}
    >
      <Text style={{ color: theme.onPrimary, fontSize:16,lineHeight:18 }}>
        {value ? '✓' : ''}
      </Text>
    </TouchableOpacity>
  );
  return (
    <View
      style={{
        backgroundColor: theme.cardBg,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 20,
        padding: 16,
        gap: 12,
        marginVertical: 20,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {check(adult, () => setAdult(!adult), '我確認已年滿 18 歲。')}
        <Text style={{ flex:1,color: theme.textMain, fontSize: 11,lineHeight:22 }}>
          我確認已年滿 18 歲。
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {check(
          agreed,
          () => setAgreed(!agreed),
          '我同意服務條款，並已閱讀隱私權政策。',
          !review.terms || !review.privacy,
        )}
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: theme.textSub, fontSize: 11,lineHeight:22 }}>我同意 </Text>
          <TouchableOpacity
            accessibilityRole="link"
            onPress={() => open('terms')}
            hitSlop={8}
            style={{ paddingVertical: 0, paddingHorizontal: 0 }}
          >
            <Text
              style={{
                color: theme.primary,
                fontWeight: '600',
                textDecorationLine: 'underline',
              }}
            >
              服務條款
            </Text>
          </TouchableOpacity>
          <Text style={{ color: theme.textSub, fontSize: 11 }}>
            ，並已閱讀{' '}
          </Text>
          <TouchableOpacity
            accessibilityRole="link"
            onPress={() => open('privacy')}
            hitSlop={8}
            style={{ paddingVertical: 0, paddingHorizontal: 0 }}
          >
            <Text
              style={{
                color: theme.primary,
                fontWeight: '600',
                textDecorationLine: 'underline',
              }}
            >
              隱私權政策
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      {(!review.terms || !review.privacy) && (
        <Text style={{ color: theme.textSub, fontSize: 13, lineHeight: 21 }}>
          請先開啟兩份文件，勾選後按「確認並返回」，再勾選同意。
        </Text>
      )}
    </View>
  );
}
