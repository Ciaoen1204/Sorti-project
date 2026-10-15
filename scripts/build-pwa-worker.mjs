import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const root = new URL('../dist-pwa/', import.meta.url);
async function files(dir = '') {
  const entries = await readdir(new URL(dir || '.', root), {
    withFileTypes: true,
  });
  const result = [];
  for (const entry of entries) {
    const name = join(dir, entry.name).replaceAll('\\', '/');
    if (entry.isDirectory()) result.push(...(await files(name + '/')));
    else if (name !== 'sw.js') result.push('/' + name);
  }
  return result;
}
const assets = await files();
const hash = createHash('sha256');
for (const asset of assets)
  hash.update(await readFile(new URL(asset.slice(1), root)));
const cache = 'sorti-shell-' + hash.digest('hex').slice(0, 12);
await writeFile(
  new URL('sw.js', root),
  `
self.addEventListener('push', event => {
  let payload;try{payload=event.data.json();}catch{return;}
  if(!payload?.notification)return;
  event.waitUntil(self.registration.showNotification(payload.notification.title || '拾序', {body:payload.notification.body || '',icon:'/icons/icon-192.png',tag:payload.data?.notificationId,data:payload.data || {}}));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const id=event.notification.data?.notificationId;
  const url=self.location.origin+'/?sortiNotification='+encodeURIComponent(id || '');
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
    const client=clients.find(c=>new URL(c.url).origin===self.location.origin);
    if(client){await client.navigate(url);return client.focus();}
    return self.clients.openWindow(url);
  }));
});
const CACHE = ${JSON.stringify(cache)};
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('sorti-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')));
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
  }
});
`,
);
console.log(
  'Offline app shell generated; authenticated API and cloud photos are not cached.',
);
