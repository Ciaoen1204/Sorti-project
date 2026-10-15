import { normalizeAdviceText } from './adviceSections';

export function chatPresentation(text: string) {
  const normalized = normalizeAdviceText(text);
  const marker = normalized.match(/(?:^|\n)\s*(?:#{1,6}\s*)?(?:【(選項|可選操作|延伸問題)】|(延伸問題)[:：]?)\s*\n/);
  const body = marker ? normalized.slice(0, marker.index).trim() : normalized;
  const kind = marker?.[1] || marker?.[2] || '';
  // Historical follow-up questions remain readable, but no longer drive a question loop.
  const questions = marker && kind === '選項' ? normalized.slice(marker.index! + marker[0].length).split('\n')
    .map(line => line.replace(/^\s*(?:[-*•]|\d+[.)、])\s*/, '').trim())
    .filter(Boolean).filter(q => q.length <= 60).slice(0, 2) : [];
  return { body, questions, clarification: kind === '選項' };
}

/** Keep a bounded conversation so typed questions and next-step choices retain context. */
export function chatHistory(messages: {sender:string;text:string}[], replyContext = ''): {role:'user'|'assistant';content:string}[] {
 const turns=messages.filter(m=>m.sender==='user'||m.sender==='ai'||m.sender==='assistant').slice(-8).map(m=>({role:m.sender==='user'?'user' as const:'assistant' as const,content:m.text.slice(0,1200)}));
 if(replyContext&&turns[turns.length-1]?.content!==replyContext.slice(0,1200)) turns.push({role:'assistant',content:replyContext.slice(0,1200)});
 return turns.slice(-8);
}
