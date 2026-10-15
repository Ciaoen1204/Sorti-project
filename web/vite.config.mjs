import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), '');
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY)
    throw Error('Missing Supabase configuration');
  return {
    root,
    define: {
      __FIREBASE_CONFIG__: JSON.stringify({
        apiKey: env.FIREBASE_WEB_API_KEY || '',
        projectId: env.FIREBASE_PROJECT_ID || '',
        appId: env.FIREBASE_WEB_APP_ID || '',
        messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || '',
      }),
      __FIREBASE_VAPID__: JSON.stringify(env.FIREBASE_WEB_VAPID_KEY || ''),
      __SUPABASE_URL__: JSON.stringify(env.SUPABASE_URL),
      __SUPABASE_KEY__: JSON.stringify(env.SUPABASE_PUBLISHABLE_KEY),
    },
    resolve: {
      alias: [
        { find: /^\.\.\/lib\/supabase$/, replacement: root + 'supabase.ts' },
      ],
    },
    build: {
      outDir: '../dist-pwa',
      emptyOutDir: true,
      target: 'safari16',
      sourcemap: false,
    },
  };
});
