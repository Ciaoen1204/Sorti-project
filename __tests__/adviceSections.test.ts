import {
  adviceBlocks,
  advicePresentation,
  normalizeAdviceText,
  parseAdvice,
} from '../src/services/adviceSections';
test('fenced Markdown advice becomes readable headings and steps without changing Chinese content', () => {
  const parsed = parseAdvice(
    '```markdown\n### 空間與動線\n保持**走道**淨空。\n### 整理步驟\n1. 將文具放入抽屜。\n### **建議採購：**\n- **分隔板**：固定分類\n```',
  );
  expect(parsed.purchaseItems).toEqual(['分隔板：固定分類']);
  expect(adviceBlocks(parsed.mainAdvice)).toEqual([
    { kind: 'heading', text: '空間與動線' },
    { kind: 'paragraph', text: '保持走道淨空。' },
    { kind: 'heading', text: '整理步驟' },
    { kind: 'list', text: '1. 將文具放入抽屜。' },
  ]);
});

test('step cards keep short titles, multiline descriptions, layout and purchasing separate', () => {
  const parsed = parseAdvice(
    '### 空間與動線\n保留門前通道。\n### 整理步驟\n1. **先清空桌面**：移走散落文具。\n常用的保留在手邊。\n2. 按用途分類\n把書與文具分開。\n### 建議採購\n- 文件盒：分類文件',
  );
  expect(advicePresentation(parsed.mainAdvice)).toEqual([
    {
      title: '空間與動線',
      blocks: [{ kind: 'paragraph', text: '保留門前通道。' }],
    },
    {
      title: '整理步驟',
      blocks: [
        {
          kind: 'step',
          number: 1,
          title: '先清空桌面',
          description: '移走散落文具。\n常用的保留在手邊。',
        },
        {
          kind: 'step',
          number: 2,
          title: '按用途分類',
          description: '把書與文具分開。',
        },
      ],
    },
  ]);
  expect(parsed.purchaseItems).toEqual(['文件盒：分類文件']);
});

test('historical single-line and bulleted steps remain complete without invented headings', () => {
  expect(advicePresentation('1. 將文具放入抽屜。')[0].blocks).toEqual([
    { kind: 'step', number: 1, title: '將文具放入抽屜。', description: '' },
  ]);
  expect(
    advicePresentation('整理步驟\n- 把文件分類：依年份放入現有文件夾。')[0]
      .blocks,
  ).toEqual([
    {
      kind: 'step',
      number: 1,
      title: '把文件分類',
      description: '依年份放入現有文件夾。',
    },
  ]);
  expect(advicePresentation('保持走道淨空。')[0].blocks).toEqual([
    { kind: 'paragraph', text: '保持走道淨空。' },
  ]);
});
test('legacy escaped line breaks and Unicode become normal text, ordinary Chinese is preserved', () => {
  expect(normalizeAdviceText(String.raw`### 整理步驟\n1. \u6536\u7d0d`)).toBe(
    '### 整理步驟\n1. 收納',
  );
  expect(normalizeAdviceText('常用物品放在抽屜。')).toBe('常用物品放在抽屜。');
  expect(
    parseAdvice('### 整理步驟\n1. 使用現有櫃子\n### 建議採購\n- 無')
      .purchaseItems,
  ).toEqual([]);
});
