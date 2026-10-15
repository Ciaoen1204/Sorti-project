import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { useAccountSession } from '../src/services/useAccountSession';
import { supabase } from '../src/lib/supabase';
import { loadLegalAcceptance, authenticatedStartScreen } from '../src/services/supabaseData';

jest.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() } },
}));
jest.mock('../src/services/supabaseData', () => ({
  authenticatedStartScreen: jest.fn(),
  loadLegalAcceptance:jest.fn(),
  completeNativeGoogleLogin: jest.fn(),
}));
let current: ReturnType<typeof useAccountSession>;
let listener: (event: string, session: any) => void;
let renderer: Renderer.ReactTestRenderer;
function Probe() {
  current = useAccountSession();
  return null;
}
beforeEach(() => {
  jest.clearAllMocks();
  (loadLegalAcceptance as jest.Mock).mockResolvedValue(true);
  (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation(
    callback => {
      listener = callback;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    },
  );
  (authenticatedStartScreen as jest.Mock).mockResolvedValue('Home');
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
test('restored session enters Home and token refresh does not restart navigation', async () => {
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { user: { id: 'existing' } } },
    error: null,
  });
  await act(async () => {
    renderer = Renderer.create(<Probe />);
  });
  expect(current.initialScreen).toBe('Home');
  expect(current.accountId).toBe('existing');
  await act(async () =>
    listener('TOKEN_REFRESHED', { user: { id: 'existing' } }),
  );
  expect(authenticatedStartScreen).toHaveBeenCalledTimes(1);
  await act(async () => listener('SIGNED_OUT', null));
  expect(current.initialScreen).toBe('Welcome');
});
test('new account retains the original first-time quiz', async () => {
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: null },
    error: null,
  });
  (authenticatedStartScreen as jest.Mock).mockResolvedValue('Quiz');
  await act(async () => {
    renderer = Renderer.create(<Probe />);
  });
  expect(current.initialScreen).toBe('Welcome');
  await act(async () => listener('SIGNED_IN', { user: { id: 'new' } }));
  expect(current.initialScreen).toBe('Quiz');
});
test('temporary restore failure offers retry without discarding stored credentials', async () => {
  (supabase.auth.getSession as jest.Mock)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({
      data: { session: { user: { id: 'existing' } } },
      error: null,
    });
  await act(async () => {
    renderer = Renderer.create(<Probe />);
  });
  expect(current.initialScreen).toBeUndefined();
  expect(current.error).toContain('重試');
  await act(async () => current.retry());
  expect(current.initialScreen).toBe('Home');
});

test.each([false, 'failure'])('unconfirmed or unavailable server record never opens Home: %s',async value=>{
 (supabase.auth.getSession as jest.Mock).mockResolvedValue({data:{session:{user:{id:'existing'}}},error:null});
 if(value==='failure')(loadLegalAcceptance as jest.Mock).mockRejectedValue(new Error('offline'));else(loadLegalAcceptance as jest.Mock).mockResolvedValue(false);
 await act(async()=>{renderer=Renderer.create(<Probe/>);});
 expect(current.initialScreen).toBe('LegalConsent');expect(authenticatedStartScreen).not.toHaveBeenCalled();
});
