import { supabase } from '../src/lib/supabase';
import { loadRemoteItems, setItemStorageLocation } from '../src/services/supabaseData';
import { itemImportLabel, itemPlacementLabel } from '../src/services/inventoryDetails';

jest.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getUser: jest.fn(), updateUser: jest.fn() }, from: jest.fn() },
}));
const query = {
  select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(), order: jest.fn(),
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'owner', user_metadata: {
    item_storage_locations: { other: '客廳層架', item: '舊位置' }, item_dispositions: { item: 'sell' },
  } } }, error: null } as any);
  jest.mocked(supabase.auth.updateUser).mockResolvedValue({ error: null } as any);
  jest.mocked(supabase.from).mockReturnValue(query as any);
  query.maybeSingle.mockResolvedValue({ data: { id: 'item' }, error: null });
});

test('location changes require ownership and preserve locations of other items', async () => {
  expect(await setItemStorageLocation('item', '  主臥衣櫃上層  ')).toBe('主臥衣櫃上層');
  expect(query.eq).toHaveBeenCalledWith('user_id', 'owner');
  expect(query.eq).toHaveBeenCalledWith('id', 'item');
  expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { item_storage_locations: { other: '客廳層架', item: '主臥衣櫃上層' } } });
  expect(itemPlacementLabel('主臥衣櫃上層')).toBe('已定位');
});

test('clearing a location returns the item to pending without changing disposition', async () => {
  expect(await setItemStorageLocation('item', ' ')).toBe('');
  expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { item_storage_locations: { other: '客廳層架' } } });
  expect(itemPlacementLabel('')).toBe('待整理');
});

test('invalid length and unavailable items never write metadata', async () => {
  await expect(setItemStorageLocation('item', 'a'.repeat(101))).rejects.toThrow('100');
  expect(supabase.auth.getUser).not.toHaveBeenCalled();
  query.maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(setItemStorageLocation('foreign-item', '客廳')).rejects.toThrow('找不到');
  expect(supabase.auth.updateUser).not.toHaveBeenCalled();
});

test('restored inventory uses actual cloud location, import source and timestamp', async () => {
  query.order.mockResolvedValue({ data: [{ id: 'item', name: '書本', category: '書籍', quantity: 1, image_path: null, source: 'ai', created_at: '2026-10-10T17:00:00Z' }], error: null });
  const [item] = await loadRemoteItems();
  expect(item.storageLocation).toBe('舊位置');
  expect(item.disposition).toBe('sell');
  expect(itemImportLabel(item.created_at, item.source)).toContain('2026/10/11');
  expect(itemImportLabel(item.created_at, item.source)).toContain('照片辨識匯入');
  expect(itemImportLabel('invalid', 'ai')).toBe('');
});
