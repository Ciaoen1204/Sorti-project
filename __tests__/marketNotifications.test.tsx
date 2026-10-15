import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { useMarketNotifications } from '../src/services/useMarketNotifications';
import type { MarketNotification } from '../src/services/notificationTypes';
test('historical notifications do not popup; new events respect category settings and account reset', async () => {
  jest.useFakeTimers();
  let rows: MarketNotification[] = [
    {
      id: 'old',
      kind: 'chat',
      title: 'old',
      body: 'old',
      target: {},
      created_at: new Date().toISOString(),
      read_at: null,
    },
  ];
  let prefs = { chat: true, orders: false };
  const api = {
    loadMarketNotifications: jest.fn(async () => rows),
    loadNotificationPreferences: jest.fn(async () => prefs),
    saveNotificationPreferences: jest.fn(async next => {
      prefs = next;
    }),
    markNotificationRead: jest.fn(async () => {}),
  };
  let result: ReturnType<typeof useMarketNotifications>;
  function Probe({ id }: { id: string }) {
    result = useMarketNotifications(id, api);
    return null;
  }
  let renderer: Renderer.ReactTestRenderer;
  await act(async () => {
    renderer = Renderer.create(<Probe id="one" />);
  });
  expect(result!.toast).toBeNull();
  expect(result!.unread).toBe(1);
  rows = [{ ...rows[0], id: 'muted', kind: 'orders' }, ...rows];
  await act(async () => {
    jest.advanceTimersByTime(15000);
  });
  expect(result!.toast).toBeNull();
  rows = [{ ...rows[0], id: 'new', kind: 'chat' }, ...rows];
  await act(async () => {
    jest.advanceTimersByTime(15000);
  });
  expect(result!.toast?.id).toBe('new');
  await act(async () => {
    await result!.read(rows[0]);
  });
  expect(api.markNotificationRead).toHaveBeenCalledWith('new');
  expect(result!.toast).toBeNull();
  await act(async () => {
    renderer!.update(<Probe id="" />);
  });
  expect(result!.items).toEqual([]);
  await act(async () => renderer!.unmount());
  jest.useRealTimers();
});
