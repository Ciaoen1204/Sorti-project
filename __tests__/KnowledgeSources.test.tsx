import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Linking, Text } from 'react-native';
import KnowledgeSources from '../src/components/KnowledgeSources';
jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    theme: require('../src/design/platformAppearance').appearance.light,
  }),
}));
test('reference panel expands actual retrieved source and opens official URL', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const source = {
    title: '怦然心動整理法｜同類集中與固定位置',
    url: 'https://konmari.com/marie-kondo-hikidashi-boxes/',
    source_label: 'KonMari 官方整理技巧摘要',
  };
  let renderer!: Renderer.ReactTestRenderer;
  await act(async () => {
    renderer = Renderer.create(<KnowledgeSources sources={[source]} />);
  });
  expect(
    renderer.root
      .findAllByType(Text)
      .some(node => node.props.children === source.title),
  ).toBe(false);
  await act(async () => {
    renderer.root
      .findAll(
        node =>
          node.props.accessibilityRole === 'button' &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress();
  });
  expect(
    renderer.root
      .findAllByType(Text)
      .some(node => node.props.children === source.title),
  ).toBe(true);
  await act(async () => {
    renderer.root
      .findAll(
        node =>
          node.props.accessibilityRole === 'link' &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress();
  });
  expect(open).toHaveBeenCalledWith(source.url);
  await act(async () => renderer.unmount());
  open.mockRestore();
});
test('no retrieved sources does not claim a book reference', async () => {
  let renderer!: Renderer.ReactTestRenderer;
  await act(async () => {
    renderer = Renderer.create(<KnowledgeSources sources={[]} />);
  });
  expect(renderer.toJSON()).toBeNull();
  await act(async () => renderer.unmount());
});
