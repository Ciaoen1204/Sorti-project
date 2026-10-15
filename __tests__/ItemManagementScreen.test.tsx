import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Alert, Modal, Text, TextInput, TouchableOpacity } from 'react-native';
import ItemManagementScreen from '../src/screens/ItemManagementScreen';
import {
  createRemoteItem,
  deleteRemoteItem,
  setItemStorageLocation,
} from '../src/services/supabaseData';

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      background: '#fff',
      cardBg: '#fff',
      textMain: '#222',
      textSub: '#666',
      primary: '#35634b',
      primarySoft: '#eee',
      border: '#ddd',
    },
  }),
}));
jest.mock('../src/services/supabaseData', () => ({
  loadRemoteItems: jest.fn(async () => [
    {
      id: 'item-1',
      name: '鉛筆',
      category: '文具',
      quantity: 1,
      imageUri: '',
      disposition: 'keep',
      storageLocation: '',
      created_at: '2026-10-11T01:00:00Z',
      source: 'ai',
    },
  ]),
  createRemoteItem: jest.fn(async () => {}),
  deleteRemoteItem: jest.fn(async () => {}),
  setItemDisposition: jest.fn(async () => {}),
  setItemStorageLocation: jest.fn(async (_id: string, location: string) => location.trim()),
  itemDispositionLabels: { keep: '保留中', discard: '待丟棄', sell: '待售' },
}));
let renderer: Renderer.ReactTestRenderer;
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
function button(label: string) {
  return renderer.root
    .findAllByType(TouchableOpacity)
    .find(node =>
      node.findAllByType(Text).some(text => text.props.children === label),
    )!;
}
beforeEach(async () => {
  jest.clearAllMocks();
  await act(async () => {
    renderer = Renderer.create(
      <ItemManagementScreen
        navigation={{ navigate: jest.fn(), goBack: jest.fn() }}
      />,
    );
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});
test('manual item entry submits name, category and quantity without requiring a photo', async () => {
  await act(async () => button('＋ 新增').props.onPress());
  await act(async () => {
    renderer.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === '物品名稱')!
      .props.onChangeText('耳機');
    renderer.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === '分類')!
      .props.onChangeText('3C');
    renderer.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === '數量')!
      .props.onChangeText('2');
  });
  await act(async () => button('儲存物品').props.onPress());
  expect(createRemoteItem).toHaveBeenCalledWith({
    name: '耳機',
    category: '3C',
    quantity: 2,
    photoUri: undefined,
  });
  expect(renderer.root.findAllByType(Modal)[0].props.visible).toBe(false);
});
test('deletion waits for confirmation and removes only the chosen item', async () => {
  await act(async () => button('刪除物品').props.onPress());
  expect(deleteRemoteItem).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0][2]!;
  await act(async () =>
    buttons.find(action => action.text === '確認刪除')!.onPress!(),
  );
  expect(deleteRemoteItem).toHaveBeenCalledWith('item-1');
  expect(
    renderer.root
      .findAllByType(Text)
      .some(node => node.props.children === '鉛筆'),
  ).toBe(false);
});

test('storage location updates placement and supports restored pending/placed filters', async () => {
  await act(async () => button('設定存放位置').props.onPress());
  await act(async () => renderer.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === '存放位置')!.props.onChangeText('書桌抽屜'));
  await act(async () => button('儲存位置').props.onPress());
  expect(setItemStorageLocation).toHaveBeenCalledWith('item-1', '書桌抽屜');
  await act(async () => renderer.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityLabel === '整理進度：待整理')!.props.onPress());
  expect(button('設定存放位置')).toBeUndefined();
  await act(async () => renderer.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityLabel === '整理進度：已定位')!.props.onPress());
  expect(button('設定存放位置')).toBeDefined();
});
