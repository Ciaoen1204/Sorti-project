import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import HomeScreen from '../src/screens/HomeScreen';
import { loadStorageProfile } from '../src/services/supabaseData';
import { academyResults } from '../src/data/storagePersonas';
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    theme: require('../src/design/platformAppearance').appearance.light,
    isDarkMode: false,
  }),
}));
jest.mock('../src/services/supabaseData', () => ({
  loadStorageProfile: jest.fn(),
  loadRemoteItems:jest.fn(async()=>[]),
}));
jest.mock('../src/services/photoTempStore', () => ({
  loadCheckInRecords: jest.fn(async () => ({})),
}));
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(async () => ({ data: { user: { user_metadata: {} } } })),
    },
  },
}));
test.each(Object.values(academyResults))(
  '$name opens original traits from the home badge',
  async persona => {
    jest.mocked(loadStorageProfile).mockResolvedValue({
      persona_name: persona.name,
      visual_preference: 'rich',
      detail_preference: 'simple',
    });
    const navigation = { navigate: jest.fn(), openDrawer: jest.fn() };
    let renderer!: Renderer.ReactTestRenderer;
    await act(async () => {
      renderer = Renderer.create(<HomeScreen navigation={navigation} />);
    });
    await act(async () => {
      renderer.root
        .findAllByType(TouchableOpacity)
        .find(node => node.props.accessibilityLabel === '查看收納人格特質')!
        .props.onPress();
    });
    expect(
      renderer.root
        .findAllByType(Text)
        .some(node => node.props.children === persona.feature),
    ).toBe(true);
    expect(
      renderer.root
        .findAllByType(Text)
        .some(node => node.props.children === persona.desc),
    ).toBe(true);
    const retest = renderer.root.findAll(
      node =>
        node.props.accessibilityLabel === '重新測驗整理偏好' &&
        typeof node.props.onPress === 'function',
    )[0];
    await act(async () => retest.props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith('Quiz');
    await act(async () => renderer.unmount());
  },
);
test('unconfigured profile offers the original quiz', async () => {
  jest.mocked(loadStorageProfile).mockResolvedValue(null);
  let renderer!: Renderer.ReactTestRenderer;
  await act(async () => {
    renderer = Renderer.create(
      <HomeScreen
        navigation={{ navigate: jest.fn(), openDrawer: jest.fn() }}
      />,
    );
  });
  await act(async () => {
    renderer.root
      .findAllByType(TouchableOpacity)
      .find(node => node.props.accessibilityLabel === '查看收納人格特質')!
      .props.onPress();
  });
  expect(
    renderer.root
      .findAllByType(Text)
      .some(node => node.props.children === '開始收納測驗'),
  ).toBe(true);
  await act(async () => renderer.unmount());
});
