import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(__SUPABASE_URL__, __SUPABASE_KEY__, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

export async function googleLoginEnabled(): Promise<boolean> {
  const response = await fetch(`${__SUPABASE_URL__}/auth/v1/settings`, {
    headers: { apikey: __SUPABASE_KEY__ },
  });
  if (!response.ok) throw new Error('無法確認 Google 登入服務，請稍後重試。');
  return !!(await response.json()).external?.google;
}
