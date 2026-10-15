import assert from 'node:assert/strict';
import { once } from 'node:events';

// Mock remote authentication and AI, but exercise the actual HTTP gateway.
process.env.PWA_PORT = '0';
const realFetch = globalThis.fetch;
const forwarded = [];
globalThis.fetch = async (url, options) => {
  if (String(url).endsWith('/auth/v1/user')) {
    return Response.json({ id: 'gateway-test-user' });
  }
  if (String(url).startsWith('http://127.0.0.1:8000/')) {
    forwarded.push({ url: String(url), options });
    if (String(url).endsWith('/detect-items')) {
      assert.match(
        options.headers['Content-Type'],
        /^multipart\/form-data; boundary=/,
      );
      assert.ok(options.body.includes(Buffer.from('name="image"')));
      return Response.json({ detected_items: [], total_detections: 0 });
    }
    return Response.json({ reply: 'test reply' });
  }
  return realFetch(url, options);
};
const { server } = await import('./serve-pwa.mjs');
if (!server.listening) await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const form = new FormData();
  form.append(
    'image',
    new Blob(['test-photo'], { type: 'image/png' }),
    'photo.png',
  );
  const response = await realFetch(base + '/api/detect', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-session' },
    body: form,
  });
  assert.equal(response.status, 200);
  assert.equal(forwarded[0].url, 'http://127.0.0.1:8000/detect-items');
  assert.deepEqual(await response.json(), {
    detected_items: [],
    total_detections: 0,
  });
  assert.equal(
    (await realFetch(base + '/api/detect', { method: 'POST' })).status,
    401,
  );
  assert.equal(
    (await realFetch(base + '/api/docs', { method: 'POST' })).status,
    404,
  );
  console.log(
    'Gateway regression passed: photo route, multipart forwarding, authentication and route restriction.',
  );
} finally {
  globalThis.fetch = realFetch;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
