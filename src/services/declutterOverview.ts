import { normalizeAdviceText, adviceBlocks } from './adviceSections';

/** Show actual AI disposal assessment; never infer garbage from item counts. */
export function declutterOverview(_items: { count?: number }[], advice = ''): string {
  const text = normalizeAdviceText(advice);
  const section = text.match(/(?:^|\n)#{1,6}\s*斷捨離\s*\n([\s\S]*?)(?=\n#{1,6}\s|$)/);
  if (section?.[1]?.trim()) {
    return adviceBlocks(section[1]).map(block => block.text).join('\n\n');
  }
  // Older reports may have disposal assessments within their organizing steps.
  const relevant = adviceBlocks(text).filter(block =>
    block.kind !== 'heading' && /丟棄|丟掉|回收|捐贈|轉售|去留|斷捨離/.test(block.text),
  );
  if (relevant.length) return relevant.map(block => block.text).join('\n\n');
  return text
    ? '這份建議沒有列出具體去留判斷，請重新產生建議；不會僅憑物品數量認定應丟棄。'
    : '產生建議後，這裡會列出可丟棄、可回收及需確認的具體物品。';
}
