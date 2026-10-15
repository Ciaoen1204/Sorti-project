import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const workspace = fileURLToPath(new URL('..', import.meta.url));
try {
  process.loadEnvFile(resolve(workspace, '.env'));
} catch {}
const root = resolve(workspace, 'dist-pwa');
const port = Number(process.env.PWA_PORT || 4173);
const backend = 'http://127.0.0.1:8000';
const upstreamAuth = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!upstreamAuth || !publishableKey)
  throw Error('Supabase environment is missing');
const apiRoutes = new Map([
  ['/api/chat', '/chat'],
  ['/api/detect', '/detect-items'],
  ['/api/crop-items', '/crop-items'],
  ['/api/daily-task', '/daily-task'],
  ['/api/daily-task/feedback', '/daily-task/feedback'],
]);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};
const limits = new Map();
const security = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data: https:; connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://firebaseinstallations.googleapis.com https://fcmregistrations.googleapis.com; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
};
function json(res, status, body) {
  res.writeHead(status, {
    ...security,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}
export const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const upstreamPath = apiRoutes.get(url.pathname);
      if (!upstreamPath) return json(res, 404, { detail: '找不到此服務。' });
      if (req.method !== 'POST')
        return json(res, 405, { detail: '不支援此操作。' });
      const authorization = req.headers.authorization;
      if (!authorization?.startsWith('Bearer '))
        return json(res, 401, { detail: '請先登入。' });
      const auth = await fetch(upstreamAuth + '/auth/v1/user', {
        headers: { Authorization: authorization, apikey: publishableKey },
        signal: AbortSignal.timeout(15000),
      });
      if (!auth.ok)
        return json(res, 401, { detail: '登入已過期，請重新登入。' });
      const user = await auth.json();
      if (!user.id) return json(res, 401, { detail: '請重新登入。' });
      const consent=await fetch(upstreamAuth+'/rest/v1/rpc/has_current_legal_acceptance',{method:'POST',headers:{Authorization:authorization,apikey:publishableKey,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
      if(!consent.ok || await consent.json()!==true)return json(res,403,{detail:'請先完成政策確認；無法讀取紀錄時不開放服務。'});
      const now = Date.now();
      const record = limits.get(user.id) || { start: now, count: 0 };
      if (now - record.start > 60000) {
        record.start = now;
        record.count = 0;
      }
      if (++record.count > 20)
        return json(res, 429, { detail: '操作次數過多，請稍候再試。' });
      limits.set(user.id, record);
      if (limits.size > 1000)
        for (const [key, value] of limits)
          if (now - value.start > 60000) limits.delete(key);
      const maximum = 8 * 1024 * 1024;
      if (Number(req.headers['content-length'] || 0) > maximum)
        return json(res, 413, { detail: '照片過大，請重新拍攝。' });
      const chunks = [];
      let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > maximum)
          return json(res, 413, { detail: '照片過大，請重新拍攝。' });
        chunks.push(chunk);
      }
      const upstream = await fetch(backend + upstreamPath, {
        method: 'POST',
        headers: {
          'Content-Type': req.headers['content-type'] || 'application/json',
          Authorization:authorization,
        },
        body: Buffer.concat(chunks),
        signal: AbortSignal.timeout(150000),
      });
      res.writeHead(upstream.status, {
        ...security,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(await upstream.text());
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD')
      return json(res, 405, { detail: '不支援此操作。' });
    if (url.pathname === '/health') {
      try {
        const check = await fetch(backend, {
          signal: AbortSignal.timeout(3000),
        });
        return json(res, check.ok ? 200 : 503, {
          status: check.ok ? 'ok' : 'backend-unavailable',
        });
      } catch {
        return json(res, 503, { status: 'backend-unavailable' });
      }
    }
    const name = decodeURIComponent(
      (url.pathname === '/' || ['/legal/terms','/legal/privacy','/legal/contact'].includes(url.pathname)) ? '/index.html' : url.pathname,
    );
    const file = resolve(root, '.' + name);
    if (!file.startsWith(root + sep))
      return json(res, 404, { detail: '找不到此頁面。' });
    try {
      if (!(await stat(file)).isFile())
        return json(res, 404, { detail: '找不到此頁面。' });
    } catch {
      return json(res, 404, { detail: '找不到此頁面。' });
    }
    const cache = name.startsWith('/assets/')
      ? 'public,max-age=31536000,immutable'
      : 'no-cache';
    res.writeHead(200, {
      ...security,
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Cache-Control': cache,
    });
    res.end(req.method === 'HEAD' ? undefined : await readFile(file));
  } catch {
    if (!res.headersSent)
      json(res, 503, { detail: '目前無法連線到服務，請稍後重試。' });
    else res.end();
  }
});
server.listen(port, '127.0.0.1', () =>
  console.log(`SORTI PWA: http://127.0.0.1:${server.address().port}`),
);
