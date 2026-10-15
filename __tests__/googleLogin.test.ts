import { googleLoginEnabled, supabase } from '../src/lib/supabase';
import {
  completeNativeGoogleLogin,
  createGoogleLoginUrl,
  nativeGoogleRedirect,
} from '../src/services/supabaseData';
jest.mock('../src/lib/supabase', () => ({
  googleLoginEnabled: jest.fn(),
  supabase: {
    auth: { signInWithOAuth: jest.fn(), exchangeCodeForSession: jest.fn() },
  },
}));
beforeEach(() => {
  jest.clearAllMocks();
});
test('Google OAuth uses the configured redirect without implicit tokens', async () => {
  (googleLoginEnabled as jest.Mock).mockResolvedValue(true);
  (supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValue({
    data: { url: 'https://example.test/authorize' },
    error: null,
  });
  expect(await createGoogleLoginUrl(nativeGoogleRedirect)).toBe(
    'https://example.test/authorize',
  );
  expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
    provider: 'google',
    options: {
      redirectTo: nativeGoogleRedirect,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });
});
test('disabled Google provider stays on login with an actionable error', async () => {
  (googleLoginEnabled as jest.Mock).mockResolvedValue(false);
  await expect(createGoogleLoginUrl(nativeGoogleRedirect)).rejects.toThrow(
    '尚未啟用',
  );
  expect(supabase.auth.signInWithOAuth).not.toHaveBeenCalled();
});
test('only the exact Native callback exchanges a code, once', async () => {
  (supabase.auth.exchangeCodeForSession as jest.Mock).mockResolvedValue({
    error: null,
  });
  expect(
    await completeNativeGoogleLogin('https://example.test/?code=wrong'),
  ).toBe(false);
  expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  await completeNativeGoogleLogin('sorti://auth/callback?code=test-pkce-code');
  await completeNativeGoogleLogin('sorti://auth/callback?code=test-pkce-code');
  expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  await expect(
    completeNativeGoogleLogin('sorti://auth/callback#access_token=untrusted'),
  ).rejects.toThrow('驗證碼');
  await expect(
    completeNativeGoogleLogin('sorti://auth/callback?error=access_denied'),
  ).rejects.toThrow('取消');
});
