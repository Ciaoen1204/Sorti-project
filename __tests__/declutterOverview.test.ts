import { declutterOverview } from '../src/services/declutterOverview';

test('shows concrete AI disposal assessment rather than object count', () => {
  const text = '### 空間與動線\n桌面堆積\n### 斷捨離\n- 用過衛生紙：丟入一般垃圾。\n- 線材：測試後確認去留。\n### 整理步驟\n1. 歸位：整理抽屜。';
  const result = declutterOverview([{ count: 21 }], text);
  expect(result).toContain('用過衛生紙');
  expect(result).toContain('線材');
  expect(result).not.toContain('歸位');
  expect(result).not.toContain('21');
});
test('missing assessment does not manufacture disposable objects', () => {
  expect(declutterOverview([{count: 21}], '整理抽屜')).toContain('沒有列出具體去留判斷');
});
