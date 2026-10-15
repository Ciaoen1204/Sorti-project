import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  Linking,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTheme } from '../context/ThemeContext';
export default function ContactScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [status, setStatus] = useState('');
  const email = 'amanda.pan1204@gmail.com';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 22 }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: theme.primary }}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 28, color: theme.textMain }}>聯絡我們</Text>
        <Text style={{ color: theme.textMain, lineHeight: 28 }}>
          如需服務協助、問題回報，或申請刪除帳號及個人資料，請寄信至
          amanda.pan1204@gmail.com。
        </Text>
        <TextInput
          value={email}
          editable={false}
          selectTextOnFocus
          style={{ color: theme.textMain, fontSize: 18 }}
        />
        <TouchableOpacity
          onPress={() =>
            Linking.openURL('mailto:' + email).catch(() =>
              setStatus('無法開啟郵件程式，請複製信箱後自行寄信。'),
            )
          }
        >
          <Text style={{ color: theme.primary, padding: 12 }}>
            開啟郵件程式
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            try {
              Clipboard.setString(email);
              setStatus('已複製 Email 地址。');
            } catch {
              setStatus('無法自動複製，請長按上方信箱自行複製。');
            }
          }}
        >
          <Text style={{ color: theme.primary, padding: 12 }}>
            複製 Email 地址
          </Text>
        </TouchableOpacity>
        <Text style={{ color: theme.textSub, lineHeight: 26 }}>
          請自行填寫並確認郵件內容；請勿提供密碼或非必要證件。帳號及資料刪除由團隊人工受理，開啟郵件或複製信箱不代表申請已送出。處理方式及保存期限請見隱私權政策。
        </Text>
        <Text accessibilityRole="alert" style={{ color: theme.textMain }}>
          {status}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
