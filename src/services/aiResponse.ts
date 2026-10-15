/** Shared Native/PWA handling for JSON APIs and proxy HTML error pages. */
export function aiStatusMessage(status: number): string {
  const messages: Record<number, string> = {
    401: '登入已過期，請重新登入後再產生建議。',
    403: 'AI 服務拒絕連線，請稍後重試。',
    404: '找不到 AI 服務，請更新 App 或重新整理網頁。',
    413: '傳送的照片或分析資料過大，請縮小後再試。',
    422: '分析資料格式不正確，請返回確認物品與空間分布。',
    429: 'AI 請求次數過多，請稍候再試。',
    502: 'AI 服務連線中斷，請確認電腦服務仍開啟後重試。',
    503: 'AI 服務暫時無法使用，請保留分析結果並稍後重試。',
    504: 'AI 回覆逾時，請保留分析結果並稍後重試。',
    522: 'AI 服務連線逾時，請確認電腦服務仍開啟。',
    524: 'AI 回覆逾時，請保留分析結果並稍後重試。',
    530: '測試連結暫時無法連線，請確認電腦與 HTTPS 通道仍開啟。',
  };
  return `${messages[status] || 'AI 服務請求失敗，請保留分析結果並稍後重試。'}（HTTP ${status}）`;
}

export async function readAiResponse<T>(response: Response): Promise<T> {
  let body: any;
  try {
    body = await response.json();
  } catch {
    // Cloudflare/proxy failures may return HTML instead of backend JSON.
    if (!response.ok) throw Error(aiStatusMessage(response.status));
    throw Error('AI 服務回傳格式異常，請保留分析結果並稍後重試。');
  }
  if (!response.ok) {
    const detail = [body?.detail, body?.message, body?.error].find(
      value => typeof value === 'string' && value.trim(),
    );
    throw Error(detail || aiStatusMessage(response.status));
  }
  if (body === null || typeof body !== 'object')
    throw Error('AI 服務回傳格式異常，請保留分析結果並稍後重試。');
  return body as T;
}
