const PURCHASE_SECTION_TITLES = [
  '建議採購',
  '建議採買',
  '建議補充',
  '建議購買',
];

type ParsedAdvice = {
  mainAdvice: string;
  purchaseItems: string[];
};

export function normalizeAdviceText(text: string): string {
  return (text || '')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/\\r\\n|\\n/g, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*```(?:markdown|md|text)?\s*\n/i, '')
    .replace(/\n\s*```\s*$/, '')
    .trim();
}

function plainInline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(
      /\*\*([^*]+)\*\*|__([^_]+)__/g,
      (_match, bold, underline) => bold || underline,
    )
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}

export type AdviceBlock = {
  kind: 'heading' | 'paragraph' | 'list';
  text: string;
};
export function adviceBlocks(text: string): AdviceBlock[] {
  const blocks: AdviceBlock[] = [];
  for (const rawLine of normalizeAdviceText(text).split('\n')) {
    const line = rawLine.trim();
    if (!line || /^(?:[-*_]\s*){3,}$/.test(line) || /^```/.test(line)) continue;
    const heading = line.match(/^#{1,6}\s*(.+)$/);
    const plain = plainInline(line);
    if (
      heading ||
      /^(空間與動線|整理步驟|如何收納|收納建議)[:：]?$/.test(plain)
    ) {
      blocks.push({
        kind: 'heading',
        text: plainInline(heading?.[1] || line).replace(/[:：]$/, ''),
      });
    } else if (/^(?:[-*•]\s+|\d+[.)、]\s*)/.test(line)) {
      blocks.push({
        kind: 'list',
        text: plainInline(line.replace(/^[-*•]\s+/, '• ')),
      });
    } else {
      blocks.push({ kind: 'paragraph', text: plain });
    }
  }
  return blocks;
}

export type AdviceStep = {
  kind: 'step';
  number: number;
  title: string;
  description: string;
};
export type AdviceSection = {
  title: string;
  blocks: (AdviceBlock | AdviceStep)[];
};

/** Display structure only: retain every sentence of new and historical advice. */
export function advicePresentation(text: string): AdviceSection[] {
  const sections: AdviceSection[] = [];
  let section: AdviceSection = { title: '', blocks: [] };
  let stepNumber = 0;
  for (const block of adviceBlocks(text)) {
    if (block.kind === 'heading') {
      if (section.title || section.blocks.length) sections.push(section);
      section = { title: block.text, blocks: [] };
      stepNumber = 0;
      continue;
    }
    const numbered = block.text.match(/^\d+[.)、]\s*(.+)$/);
    const isSteps =
      /整理步驟|如何收納|收納建議/.test(section.title) || !section.title;
    if (isSteps && (numbered || block.kind === 'list')) {
      const content = numbered?.[1] || block.text.replace(/^•\s*/, '');
      const titled = content.match(/^([^：:\n]{1,24})[：:]\s*(.+)$/);
      const sentence = content.match(/^([^。！？]{1,24})[。！？]\s*(.+)$/);
      const split = titled || sentence;
      stepNumber = numbered ? parseInt(block.text, 10) : stepNumber + 1;
      section.blocks.push({
        kind: 'step',
        number: stepNumber,
        title: split ? split[1] : content,
        description: split ? split[2] : '',
      });
    } else {
      const previous = section.blocks[section.blocks.length - 1];
      if (isSteps && block.kind === 'paragraph' && previous?.kind === 'step') {
        previous.description += (previous.description ? '\n' : '') + block.text;
      } else section.blocks.push(block);
    }
  }
  if (section.title || section.blocks.length) sections.push(section);
  return sections;
}

export const parseAdvice = (adviceText: string): ParsedAdvice => {
  if (!adviceText?.trim()) {
    return {
      mainAdvice: '',
      purchaseItems: [],
    };
  }

  adviceText = normalizeAdviceText(adviceText);
  const lines = adviceText.split('\n');

  const sectionIndex = lines.findIndex(line =>
    PURCHASE_SECTION_TITLES.some(title =>
      new RegExp(`^(#+\\s*)?${title}(\\s*[:：])?$`, 'i').test(
        plainInline(line),
      ),
    ),
  );

  if (sectionIndex === -1) {
    return {
      mainAdvice: adviceText.trim(),
      purchaseItems: [],
    };
  }

  const mainAdvice = lines.slice(0, sectionIndex).join('\n').trim();

  const purchaseItems: string[] = [];

  for (let index = sectionIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (!line) {
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      break;
    }

    const bulletMatch = line.match(/^(?:[-*•]|\d+[.)])\s*(.+)$/);

    const candidate = plainInline(bulletMatch?.[1] ?? line);

    if (
      !candidate ||
      candidate === '無' ||
      candidate.toLowerCase() === 'none' ||
      candidate === '目前不需要添購' ||
      candidate === '目前沒有需要補充的收納用品'
    ) {
      continue;
    }

    purchaseItems.push(candidate);
  }

  return {
    mainAdvice: mainAdvice || adviceText.trim(),
    purchaseItems: [...new Set(purchaseItems)],
  };
};
