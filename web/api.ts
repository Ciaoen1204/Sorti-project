import {getLanguage,translateText} from '../src/i18n/language';
import { readAiResponse } from '../src/services/aiResponse';
import { supabase } from './supabase';
export async function api<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw Error('請先登入。');
  const form = body instanceof FormData;
  if(form && path==='/daily-task/feedback') body.set('language',getLanguage());
  const requestBody=!form&&body&&typeof body==='object'&&['/chat','/daily-task'].includes(path)?{...body,language:getLanguage()}:body;
  const response = await fetch('/api' + path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      ...(!form ? { 'Content-Type': 'application/json' } : {}),
    },
    body: form ? body as FormData : JSON.stringify(requestBody),
    signal: AbortSignal.timeout(150000),
  });
  return readAiResponse<T>(response);
}
export function taipeiDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day']
    .map(type => parts.find(part => part.type === type)!.value)
    .join('-');
}
export function errorText(error: unknown): string {
  return error instanceof Error
    ? translateText(error.message)
    : String(
        (error as { message?: string })?.message || '操作失敗，請稍後重試。',
      );
}
