import { supabase } from '../src/lib/supabase';
import {
  loadProducts,
  loadMyProducts,
  loadMyProductCounts,
  loadMarketConversations,
  loadMarketOrders,
} from '../src/services/supabaseData';
import {
  currency,
  priceRange,
  validateListing,
} from '../src/services/marketplace';
jest.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}));
const query = {
  select: jest.fn(),
  eq: jest.fn(),
  or: jest.fn(),
  order: jest.fn(),
  range: jest.fn(),
  limit: jest.fn(),
  gte: jest.fn(),
  lte: jest.fn(),
  in: jest.fn(),
};
beforeEach(() => {
  jest.clearAllMocks();
  Object.values(query).forEach(fn => fn.mockReturnValue(query));
  query.range.mockResolvedValue({ data: [], error: null });
  jest.mocked(supabase.from).mockReturnValue(query as any);
  jest
    .mocked(supabase.auth.getUser)
    .mockResolvedValue({ data: { user: { id: 'owner' } }, error: null } as any);
});
test('search, category, prices and deterministic sorting precede bounded backend pagination', async () => {
  await loadProducts({
    query: '桌子',
    category: '大型家具',
    minPrice: 20,
    maxPrice: 300,
    sort: 'priceAsc',
    page: 2,
  });
  expect(query.or).toHaveBeenCalledWith(
    'title.ilike.%桌子%,description.ilike.%桌子%',
  );
  expect(query.eq).toHaveBeenCalledWith('status', 'active');
  expect(query.eq).toHaveBeenCalledWith('category', '大型家具');
  expect(query.gte).toHaveBeenCalledWith('price', 20);
  expect(query.lte).toHaveBeenCalledWith('price', 300);
  expect(query.order).toHaveBeenCalledWith('price', { ascending: true });
  expect(query.range).toHaveBeenCalledWith(40, 59);
});
test('own listings remain owner-scoped and status-filtered', async () => {
  await loadMyProducts({ status: 'archived', page: 1 });
  expect(query.eq).toHaveBeenCalledWith('seller_id', 'owner');
  expect(query.eq).toHaveBeenCalledWith('status', 'archived');
  expect(query.range).toHaveBeenCalledWith(20, 39);
});
test('listing counts are exact HEAD queries rather than loaded-page lengths', async () => {
  query.eq.mockResolvedValue({ count: 27, error: null });
  // First ownership filter still returns the query; second status filter resolves it.
  query.eq.mockImplementation((field: string) =>
    field === 'seller_id' ? query : Promise.resolve({ count: 27, error: null }),
  );
  expect(await loadMyProductCounts()).toEqual({
    active: 27,
    reserved: 27,
    archived: 27,
    sold: 27,
  });
  expect(query.select).toHaveBeenCalledWith('id', {
    count: 'exact',
    head: true,
  });
});
test('unified inbox queries both participant roles with a single latest message per conversation', async () => {
  query.range.mockResolvedValue({
    data: [
      {
        id: 'c',
        buyer_id: 'other',
        seller_id: 'owner',
        listing: null,
        messages: [{ content: '真實訊息' }],
      },
    ],
    error: null,
  });
  const [conversation] = await loadMarketConversations();
  expect(query.or).toHaveBeenCalledWith('buyer_id.eq.owner,seller_id.eq.owner');
  expect(query.limit).toHaveBeenCalledWith(1, { referencedTable: 'messages' });
  expect(conversation.viewerRole).toBe('seller');
  expect(conversation.latestMessage).toBe('真實訊息');
});
test('pending and paid COD orders share the awaiting-shipment filter', async () => {
  await loadMarketOrders('buyer', { status: 'pending' });
  expect(query.eq).toHaveBeenCalledWith('buyer_id', 'owner');
  expect(query.in).toHaveBeenCalledWith('status', ['pending', 'paid']);
});
test('price validation accepts free items and two decimals, rejects overflow and malformed ranges', () => {
  expect(priceRange('0', '450.50')).toEqual({ minPrice: 0, maxPrice: 450.5 });
  for (const value of ['-1', 'Infinity', '1e3', '12.345', '10000000000'])
    expect(() => priceRange(value, '')).toThrow();
  expect(() => priceRange('100', '50')).toThrow('最低');
  expect(() =>
    validateListing({
      title: '桌',
      category: '其他',
      price: '0',
      location: '台北',
      imageUri: 'photo',
    }),
  ).not.toThrow();
  expect(() =>
    validateListing({
      title: '桌',
      category: '其他',
      price: '',
      location: '台北',
      imageUri: 'photo',
    }),
  ).toThrow('價格');
  expect(currency(null)).toBe('價格未提供');
  expect(currency(450.5)).toBe('NT$ 450.5');
});
