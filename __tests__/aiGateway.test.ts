import { AI_API_BASE_URL } from '@env';
import { supabase } from '../src/lib/supabase';
import { detectItemsFromPhoto, postAiJson } from '../src/services/aiApi';

jest.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn() } },
}));
const originalFetch = globalThis.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { access_token: 'test-token' } },
    error: null,
  });
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      reply: 'ok',
      detected_items: [],
      total_detections: 0,
    }),
  })) as any;
});
afterAll(() => {
  globalThis.fetch = originalFetch;
});
const gateway = AI_API_BASE_URL?.replace(/\/$/, '').endsWith('/api');
test('AI JSON requests use the configured endpoint and attach gateway authentication', async () => {
  await postAiJson('/chat', { message: '整理桌面' });
  const [url, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
  expect(url).toContain('/chat');
  expect(JSON.parse(options.body)).toEqual({ message: '整理桌面',language:'zh-TW' });
  expect(options.headers.Authorization).toBe(
    gateway ? 'Bearer test-token' : undefined,
  );
});
test('photo requests map the detection route and preserve multipart boundaries', async () => {
  await detectItemsFromPhoto('file://photo.jpg');
  const [url, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
  expect(url.endsWith(gateway ? '/api/detect' : '/detect-items')).toBe(true);
  expect(options.body).toBeInstanceOf(FormData);
  expect(options.headers['Content-Type']).toBeUndefined();
  expect(options.headers.Authorization).toBe(
    gateway ? 'Bearer test-token' : undefined,
  );
});
test('gateway requests reject signed-out users before sending photos', async () => {
  if (!gateway) return; // Direct local development does not require the gateway.
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: null },
    error: null,
  });
  await expect(detectItemsFromPhoto('file://photo.jpg')).rejects.toThrow(
    '請先登入',
  );
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('proxy HTML failure reports a readable connection reason with status', async () => {
  globalThis.fetch = jest.fn(async () => ({ ok: false, status: 502, json: async () => { throw SyntaxError('Unexpected token <'); } })) as any;
  await expect(postAiJson('/chat', {message:'整理建議'})).rejects.toThrow('AI 服務連線中斷');
});
test('backend actionable error is retained and validation arrays stay readable', async () => {
  globalThis.fetch = jest.fn(async () => ({ok:false,status:503,json:async()=>({detail:'目前無法產生收納建議，請稍後重試。'})})) as any;
  await expect(postAiJson('/chat',{})).rejects.toThrow('目前無法產生收納建議');
  globalThis.fetch = jest.fn(async () => ({ok:false,status:422,json:async()=>({detail:[{loc:['body'],msg:'invalid'}]})})) as any;
  await expect(postAiJson('/chat',{})).rejects.toThrow('HTTP 422');
});
