import {getLanguage} from '../i18n/language';
import { readAiResponse } from './aiResponse';
import { NativeModules, Platform } from 'react-native';
import { AI_API_BASE_URL as ENV_AI_API_BASE_URL } from '@env';
import { supabase } from '../lib/supabase';

import type {
  AskQuestionRequest,
  AskQuestionResponse,
  ChatRequest,
  ChatResponse,
  DetectItemsResponse,
} from '../types/ai';

const DEFAULT_BASE_URL =
  Platform.OS === 'ios' ? 'http://localhost:8000' : 'http://10.0.2.2:8000';

function getMetroDevHost(): string | null {
  const scriptURL = NativeModules?.SourceCode?.scriptURL as string | undefined;

  if (!scriptURL) {
    return null;
  }

  try {
    const host = new URL(scriptURL).hostname;
    return host || null;
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function resolveAiApiBaseUrl(): string {
  const configuredBaseUrl = ENV_AI_API_BASE_URL?.trim();

  if (!configuredBaseUrl) {
    const devHost = Platform.OS === 'android' ? getMetroDevHost() : null;

    return devHost ? `http://${devHost}:8000` : DEFAULT_BASE_URL;
  }

  if (Platform.OS !== 'android') {
    return configuredBaseUrl.replace(/\/$/, '');
  }

  try {
    const parsedUrl = new URL(configuredBaseUrl);

    if (!isLoopbackHost(parsedUrl.hostname)) {
      return configuredBaseUrl.replace(/\/$/, '');
    }

    const devHost = getMetroDevHost();

    if (!devHost || isLoopbackHost(devHost)) {
      return configuredBaseUrl.replace(/\/$/, '');
    }

    const portPart = parsedUrl.port ? `:${parsedUrl.port}` : '';

    const rebuilt =
      `${parsedUrl.protocol}//${devHost}${portPart}` +
      `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;

    return rebuilt.replace(/\/$/, '');
  } catch {
    return configuredBaseUrl.replace(/\/$/, '');
  }
}

const AI_API_BASE_URL = resolveAiApiBaseUrl();

function buildAiUrl(path: string): string {
  return `${AI_API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

async function gatewayHeaders(): Promise<Record<string, string>> {
  // Every backend route verifies the caller and server-side policy record.
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) throw new Error('請先登入。');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

async function requestJson<TResponse>(
  path: string,
  init: Omit<RequestInit, 'body' | 'method'> & {
    method?: 'GET' | 'POST';
    body?: unknown;
  } = {},
): Promise<TResponse> {
  const requestUrl = buildAiUrl(
    resolveAiApiBaseUrl().endsWith('/api') && path === '/detect-items'
      ? '/detect'
      : path,
  );
  const authorization = await gatewayHeaders();
  let response: Response;

  try {
    response = await fetch(requestUrl, {
      ...init,
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authorization,
        ...(init.headers ?? {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';

    throw new Error(`Network request failed (${requestUrl}) - ${reason}`);
  }

  return readAiResponse<TResponse>(response);
}

async function requestMultipart<TResponse>(
  path: string,
  formData: FormData,
  signal?: AbortSignal,
): Promise<TResponse> {
  const requestUrl = buildAiUrl(
    resolveAiApiBaseUrl().endsWith('/api') && path === '/detect-items'
      ? '/detect'
      : path,
  );
  const authorization = await gatewayHeaders();
  let response: Response;

  try {
    response = await fetch(requestUrl, {
      method: 'POST',
      body: formData,
      headers: authorization,
      signal,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';

    throw new Error(`Network request failed (${requestUrl}) - ${reason}`);
  }

  return readAiResponse<TResponse>(response);
}

export function getAiJson<TResponse>(
  path: string,
  init: Omit<RequestInit, 'body' | 'method'> = {},
): Promise<TResponse> {
  return requestJson<TResponse>(path, {
    ...init,
    method: 'GET',
  });
}

export function postAiJson<TResponse, TBody>(
  path: string,
  body: TBody,
  init: Omit<RequestInit, 'body' | 'method'> = {},
): Promise<TResponse> {
  return requestJson<TResponse>(path, {
    ...init,
    method: 'POST',
    body:body&&typeof body==='object'&&['/chat','/daily-task'].includes(path)?{...body,language:getLanguage()}:body,
  });
}

/**
 * 一般聊天與照片分析都會呼叫後端 /chat。
 * 後端依照 payload.mode 選擇不同 Prompt。
 */
export function sendMessageToAI(payload: ChatRequest): Promise<ChatResponse> {
  return postAiJson<ChatResponse, ChatRequest>('/chat', {...payload,language:getLanguage()});
}

/**
 * 照片分析畫面使用。
 */
export async function askAiQuestion(
  payload: AskQuestionRequest,
): Promise<AskQuestionResponse> {
  const response = await sendMessageToAI({
    message: payload.question,
    items: payload.detectedItems,
    user_persona: payload.userPersona,
    space_analysis: payload.spaceAnalysis
      ? { ...payload.spaceAnalysis, overlay_uri: undefined }
      : undefined,
    storage_preferences: payload.storagePreferences,

    // 將照片分析模式傳給後端。
    mode: payload.mode ?? 'photo_analysis',
  });

  return {
    reply: response.reply,
    retrievedTitles: response.retrieved_titles,
    retrievedSources: response.retrieved_sources,
    notice: response.notice,
  };
}

export function detectItemsFromPhoto(
  photoUri: string,
): Promise<DetectItemsResponse> {
  const formData = new FormData();

  formData.append('image', {
    uri: photoUri,
    name: `analysis-${Date.now()}.jpg`,
    type: 'image/jpeg',
  } as any);

  return requestMultipart<DetectItemsResponse>('/detect-items', formData);
}

export function cropItemsFromPhoto(
  photoUri: string,
  boxes: import('../types/ai').DetectionBox[],
) {
  const form = new FormData();
  form.append('image', {
    uri: photoUri,
    name: 'items.jpg',
    type: 'image/jpeg',
  } as any);
  form.append('boxes', JSON.stringify(boxes));
  return requestMultipart<{
    items: { name: string; category: string; photoUri: string }[];
  }>('/crop-items', form);
}

export function getTaskPhotoFeedback(
  date: string,
  task: string,
  photoUri: string,
  signal?: AbortSignal,
): Promise<{ feedback: string }> {
  const formData = new FormData();
  formData.append('date', date);
  formData.append('task', task);
  formData.append('image', {
    uri: photoUri,
    name: 'daily-task.jpg',
    type: 'image/jpeg',
  } as any);
  formData.append('language',getLanguage());
  return requestMultipart('/daily-task/feedback', formData, signal);
}
