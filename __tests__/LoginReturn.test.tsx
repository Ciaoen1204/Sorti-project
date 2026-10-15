import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { AppState, Linking, TextInput, TouchableOpacity, type AppStateStatus } from 'react-native';
import LoginScreen from '../src/screens/LoginScreen';
import { supabase } from '../src/lib/supabase';
jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('../src/design/platformAppearance').appearance.light, isDarkMode: false }),
}));
jest.mock('../src/services/supabaseData', () => ({
  nativeGoogleRedirect: 'sorti://auth/callback',
  createGoogleLoginUrl: jest.fn(async () => 'https://example.test/authorize'),
}));
jest.mock('../src/lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: jest.fn(async () => ({ data: { session: {}, user: {} }, error: null })) } },
}));

test('returning while browser launch is pending enables password login and Google retry', async () => {
  let resume!: (state: AppStateStatus) => void;
  let finish!: () => void;
  const open = jest.spyOn(Linking, 'openURL').mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    resume = callback;
    return { remove: jest.fn() };
  });
  let renderer!: Renderer.ReactTestRenderer;
  await act(async () => { renderer = Renderer.create(<LoginScreen navigation={{} as any} route={{} as any} />); });
  const google = () => renderer.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityLabel === '使用 Google 登入')!;
  await act(async () => { void google().props.onPress(); });
  expect(google().props.disabled).toBe(true);
  await act(async () => resume('active'));
  expect(google().props.disabled).toBe(false);
  await act(async () => {
    renderer.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === '電子郵件')!.props.onChangeText('test@example.com');
    renderer.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === '密碼')!.props.onChangeText('password');
  });
  await act(async () => renderer.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === '密碼')!.props.onSubmitEditing());
  expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'test@example.com', password: 'password' });
  await act(async () => finish());
  await act(async () => renderer.unmount());
  open.mockRestore();
  listener.mockRestore();
});
