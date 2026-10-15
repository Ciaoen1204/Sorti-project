import {setPolicyReviewed} from '../src/services/legalReview';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';
import LegalConsentScreen from '../src/screens/LegalConsentScreen';
import { acceptLegalPolicies } from '../src/services/supabaseData';
jest.mock('../src/services/supabaseData', () => ({
  acceptLegalPolicies: jest.fn(),
}));
jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      background: '#fff',
      textMain: '#111',
      textSub: '#555',
      primary: '#333',
      onPrimary: '#fff',
    },
  }),
}));
test('native checks default off and failed persistence does not release service', async () => {
  const accepted = jest.fn(),
    navigate = jest.fn();
  let view!: Renderer.ReactTestRenderer;
  (acceptLegalPolicies as jest.Mock).mockRejectedValue(
    new Error('確認紀錄未保存'),
  );
  await act(async () => {
    view = Renderer.create(
      <LegalConsentScreen navigation={{ navigate }} onAccepted={accepted} />,
    );
  });
  const checks = () =>
    view.root
      .findAllByType(TouchableOpacity)
      .filter(n => n.props.accessibilityRole === 'checkbox');
  expect(checks().map(n => n.props.accessibilityState.checked)).toEqual([
    false,
    false,
  ]);
  const submit = () =>
    view.root
      .findAllByType(TouchableOpacity)
      .find(n => n.props.disabled !== undefined && n.props.accessibilityRole!=='checkbox')!;
  expect(submit().props.disabled).toBe(true);
  await act(async () => {
    checks()[0].props.onPress();
    checks()[1].props.onPress();
  });
  expect(checks()[1].props.accessibilityState.checked).toBe(false);
  await act(async()=>{setPolicyReviewed('terms',true);setPolicyReviewed('privacy',true);});
  expect(checks()[1].props.disabled).toBe(false);
  await act(async()=>{checks()[1].props.onPress();
  });
  await act(async () => {
    await submit().props.onPress();
  });
  expect(accepted).not.toHaveBeenCalled();
  expect(JSON.stringify(view.toJSON())).toContain('確認紀錄未保存');
  (acceptLegalPolicies as jest.Mock).mockResolvedValue(undefined);
  await act(async () => {
    await submit().props.onPress();
  });
  expect(accepted).toHaveBeenCalledTimes(1);
  await act(async () => view.unmount());
});
