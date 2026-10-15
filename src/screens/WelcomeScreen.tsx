import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from "../components/LocalizedUI";
import React from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';
import { useSortiTheme } from '../design/sortiTheme';

export default function WelcomeScreen({
  navigation,
}: StackScreenProps<RootStackParamList, 'Welcome'>) {
  const { theme } = useSortiTheme();
  return (
    <SafeAreaView style={[styles.page, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image
            source={require('../assets/images/sorti-logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="拾序 熊抱收納盒 Logo"
          />
          <Text style={[styles.brand, { color: theme.textMain }]}>拾序</Text>
          <Text style={{fontSize:20,color:theme.textSub,marginTop:-10}}>收納管理</Text>
          <Text style={[styles.title, { color: theme.textMain }]}>
            讓生活，回到喜歡的樣子
          </Text>
          <Text style={[styles.caption, { color: theme.textSub }]}>
            從整理一件物品，開始你的拾序生活
          </Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => navigation.navigate('Login')}
            style={[styles.button, { backgroundColor: theme.primary }]}
          >
            <Text style={[styles.label, { color: theme.onPrimary }]}>登入</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => navigation.navigate('Register')}
            style={[
              styles.button,
              { borderWidth: 1, borderColor: theme.primary },
            ]}
          >
            <Text style={[styles.label, { color: theme.primary }]}>註冊</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'space-between',
    gap: 32,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  logo: { width: 200, height: 200, maxWidth: '80%' },
  brand: { fontSize: 42, fontWeight: '800', letterSpacing: 5 },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 39,
  },
  caption: { fontSize: 18, textAlign: 'center', lineHeight: 30 },
  actions: { gap: 14, paddingBottom: 16 },
  button: {
    minHeight: 54,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
  },
  label: { fontSize: 18, fontWeight: '700' },
});
