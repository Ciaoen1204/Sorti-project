import {
  availableChannels,
  validateChannelRecipient,
  type ChannelRecipient,
} from './deliveryChannels';
import { marketRequestId } from './marketplaceOrder';
import type {
  DeliverySettings,
  DeliveryMethod,
  Transaction,
  TransactionAction,
} from './marketplaceOrder';
import { supabase, googleLoginEnabled } from '../lib/supabase';
import type { ChatItem } from '../types/ai';
import { assertTodayCheckIn } from './checkInDate';
import { normalizeStorageLocation } from './inventoryDetails';

export const nativeGoogleRedirect = 'sorti://auth/callback';

export async function createGoogleLoginUrl(
  redirectTo: string,
): Promise<string> {
  if (!(await googleLoginEnabled()))
    throw new Error(
      'Google 登入尚未啟用，請先完成 Supabase 的 Google 供應商設定。',
    );
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('無法開啟 Google 登入，請稍後重試。');
  return data.url;
}

const completedOAuthCodes = new Set<string>();
export async function completeNativeGoogleLogin(url: string): Promise<boolean> {
  const callback = new URL(url);
  if (
    callback.protocol !== 'sorti:' ||
    callback.hostname !== 'auth' ||
    callback.pathname !== '/callback'
  )
    return false;
  if (callback.searchParams.has('error'))
    throw new Error('Google 登入已取消或未完成，請重試。');
  const code = callback.searchParams.get('code');
  if (!code) throw new Error('Google 登入未取得驗證碼，請重新登入。');
  if (completedOAuthCodes.has(code)) return true;
  completedOAuthCodes.add(code);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    completedOAuthCodes.delete(code);
    throw new Error('Google 登入驗證失敗，請重新嘗試。');
  }
  return true;
}

export async function authenticatedStartScreen(
  userId: string,
): Promise<'Home' | 'Quiz'> {
  const { data, error } = await supabase
    .from('user_personas')
    .select('persona_name')
    .eq('user_id', userId)
    .maybeSingle();
  // Network failure must not turn a retained session into a forced login or quiz.
  if (error) return 'Home';
  return data?.persona_name ? 'Home' : 'Quiz';
}

export type ProductRecord = DeliverySettings & {
  version?: number;
  id: string;
  title: string;
  price: number;
  location: string;
  img: string;
  description: string;
  sellerId: string;
  category: string;
  status: string;
  createdAt?: string;
};

export type MarketplaceMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: number;
};

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('請先登入後再操作');
  return data.user.id;
}

function mimeTypeForUri(uri: string): string {
  const normalized = uri.toLowerCase();
  if (normalized.includes('.png')) return 'image/png';
  if (normalized.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function photoStorageError(bucket: string, error: { message: string }): Error {
  if (/bucket.*not found/i.test(error.message)) {
    return new Error(
      `照片儲存空間尚未設定（${bucket}），請管理者完成設定後再重試。`,
    );
  }
  return new Error(error.message);
}

export async function uploadUserImage(
  bucket: string,
  uri: string,
  folder?: string,
): Promise<string> {
  const userId = await requireUserId();
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;

  const mimeType = mimeTypeForUri(uri);
  let bytes: ArrayBuffer;
  if (uri.startsWith('data:image/jpeg;base64,')) {
    const alphabet =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const encoded = uri
      .slice('data:image/jpeg;base64,'.length)
      .replace(/=+$/, '');
    const decoded: number[] = [];
    let buffer = 0,
      bits = 0;
    for (const character of encoded) {
      const value = alphabet.indexOf(character);
      if (value < 0) throw new Error('物品照片格式無效');
      buffer = (buffer << 6) | value;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        decoded.push((buffer >> bits) & 255);
      }
    }
    bytes = Uint8Array.from(decoded).buffer;
  } else {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('無法讀取照片檔案');
    bytes = await response.arrayBuffer();
  }
  const objectPath = `${folder ?? userId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}.${extensionForMimeType(mimeType)}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, bytes, {
      contentType: mimeType,
      upsert: false,
    });
  if (error) throw photoStorageError(bucket, error);
  return objectPath;
}

export function getPublicImageUrl(bucket: string, path: string | null): string {
  if (!path) return '';
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('file://')
  ) {
    return path;
  }
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function getPrivateImageUrl(
  bucket: string,
  path: string | null,
): Promise<string> {
  if (!path) return '';
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('file://')
  ) {
    return path;
  }
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);
  if (error) throw photoStorageError(bucket, error);
  return data.signedUrl;
}

export async function loadRemoteCheckIns(): Promise<Record<string, string>> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('check_ins')
    .select('check_in_date,photo_path')
    .eq('user_id', userId);
  if (error) throw error;

  const entries = await Promise.all(
    (data ?? []).map(
      async row =>
        [
          row.check_in_date,
          await getPrivateImageUrl('check-in-photos', row.photo_path),
        ] as const,
    ),
  );
  return Object.fromEntries(entries);
}

export async function saveRemoteCheckIn(
  date: string,
  photoUri: string,
): Promise<string> {
  const recordKey = date.split('-').map(Number).join('-');
  assertTodayCheckIn(recordKey);
  const userId = await requireUserId();
  const photoPath = await uploadUserImage('check-in-photos', photoUri);
  assertTodayCheckIn(recordKey);
  const { error } = await supabase
    .from('check_ins')
    .upsert(
      { user_id: userId, check_in_date: date, photo_path: photoPath },
      { onConflict: 'user_id,check_in_date' },
    );
  if (error) throw error;
  return getPrivateImageUrl('check-in-photos', photoPath);
}

export async function saveRemoteAnalysis(input: {
  photoUri: string | null;
  detectedItems: ChatItem[];
  adviceText: string;
  summary: string;
  itemPhotos?: { name: string; category: string; photoUri: string }[];
}): Promise<{ id: string; createdAt: number; photoUri: string }> {
  const expectedCount = input.detectedItems.reduce(
    (sum, item) => sum + (item.count ?? 0),
    0,
  );
  if (
    expectedCount > 0 &&
    (!input.itemPhotos?.length || input.itemPhotos.length !== expectedCount)
  )
    throw new Error('缺少完整的單件裁切照片，請重新分析再匯入。');
  const userId = await requireUserId();
  const photoPath = input.photoUri
    ? await uploadUserImage('analysis-photos', input.photoUri)
    : '';
  const totalDetections = input.detectedItems.reduce(
    (sum, item) => sum + (item.count ?? 0),
    0,
  );
  const itemRows = input.itemPhotos?.length
    ? await Promise.all(
        input.itemPhotos.map(async item => ({
          name: item.name,
          category: item.category,
          quantity: 1,
          image_path: await uploadUserImage(
            'analysis-photos',
            item.photoUri,
            `${userId}/items`,
          ),
        })),
      )
    : input.detectedItems.map(item => ({
        name: item.name,
        category: item.category || '未分類',
        quantity: Math.max(1, item.count ?? 1),
        image_path: photoPath || null,
      }));
  const { data: analysis, error } = await supabase
    .from('ai_analyses')
    .insert({
      user_id: userId,
      photo_path: photoPath,
      total_detections: totalDetections,
      summary: input.summary,
      advice_text: input.adviceText,
      status: 'completed',
    })
    .select('id,created_at')
    .single();
  if (error) throw error;

  if (itemRows.length > 0) {
    const { error: itemsError } = await supabase.from('items').insert(
      itemRows.map(item => ({
        user_id: userId,
        analysis_id: analysis.id,
        ...item,
        source: 'ai',
      })),
    );
    if (itemsError) throw itemsError;
  }

  return {
    id: analysis.id,
    createdAt: new Date(analysis.created_at).getTime(),
    photoUri: await getPrivateImageUrl('analysis-photos', photoPath),
  };
}

export async function loadRemoteItems() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('請先登入後再操作');
  const userId = auth.user.id;
  const dispositions = auth.user.user_metadata.item_dispositions || {};
  const locations = auth.user.user_metadata.item_storage_locations || {};
  const { data, error } = await supabase
    .from('items')
    .select('id,name,category,quantity,image_path,created_at,source')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return Promise.all(
    (data ?? []).map(async item => ({
      ...item,
      disposition: normalizeItemDisposition(dispositions[item.id]),
      storageLocation: normalizeStorageLocation(locations[item.id]),
      imageUri: item.image_path
        ? await getPrivateImageUrl('analysis-photos', item.image_path)
        : '',
    })),
  );
}

export async function loadRemoteAnalyses() {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('ai_analyses')
    .select(
      'id,photo_path,summary,advice_text,created_at,items(name,category,quantity)',
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async row => ({
      id: row.id,
      createdAt: new Date(row.created_at).getTime(),
      photoUri: row.photo_path
        ? await getPrivateImageUrl('analysis-photos', row.photo_path)
        : null,
      detectedItems: (row.items ?? []).map((item: any) => ({
        name: item.name,
        category: item.category,
        count: item.quantity,
      })),
      adviceText: row.advice_text ?? '',
      summary: row.summary ?? '',
    })),
  );
}

export async function savePersona(input: {
  personaName: string;
  visualPreference: 'rich' | 'minimal';
  detailPreference: 'simple' | 'detailed';
  visualScore: number;
  detailScore: number;
}): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('user_personas').upsert({
    user_id: userId,
    persona_name: input.personaName,
    visual_preference: input.visualPreference,
    detail_preference: input.detailPreference,
    visual_score: input.visualScore,
    detail_score: input.detailScore,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export type ProductQuery = {
  sellerId?: string;
  query?: string;
  category?: string;
  sort?: 'newest' | 'priceAsc' | 'priceDesc';
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
  status?: string;
};
export const marketPageSize = 20;
function pageRange(options: ProductQuery) {
  const size = Math.min(
    50,
    Math.max(1, Math.floor(options.pageSize || marketPageSize)),
  );
  const start = Math.max(0, Math.floor(options.page || 0)) * size;
  return [start, start + size - 1] as const;
}
export async function loadProducts(
  options: ProductQuery = {},
): Promise<ProductRecord[]> {
  let query = supabase.from('listings').select('*').eq('status', 'active');
  if (options.sellerId) query = query.eq('seller_id', options.sellerId);
  // Escape PostgREST syntax and LIKE wildcards; query matches all eligible rows before pagination.
  const term = options.query
    ?.trim()
    .replace(/[%,_()\"\\]/g, ' ')
    .trim();
  if (term)
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  if (options.category && options.category !== '全部')
    query = query.eq('category', options.category);
  if (options.minPrice !== undefined)
    query = query.gte('price', options.minPrice);
  if (options.maxPrice !== undefined)
    query = query.lte('price', options.maxPrice);
  query =
    options.sort === 'priceAsc' || options.sort === 'priceDesc'
      ? query.order('price', { ascending: options.sort === 'priceAsc' })
      : query.order('created_at', { ascending: false });
  const { data, error } = await query
    .order('id', { ascending: false })
    .range(...pageRange(options));
  if (error) throw error;
  return (data ?? []).map(mapProduct);
}
export async function loadProduct(id: string): Promise<ProductRecord> {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return mapProduct(data);
}
export async function loadMyProductCounts(): Promise<Record<string, number>> {
  const userId = await requireUserId();
  const pairs = await Promise.all(
    ['active', 'reserved', 'archived', 'sold'].map(async status => {
      const { count, error } = await supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', userId)
        .eq('status', status);
      if (error) throw error;
      return [status, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(pairs);
}

export async function createProduct(
  input: DeliverySettings & {
    requestId?: string;
    title: string;
    description: string;
    category?: string;
    price: number;
    location: string;
    imageUri: string;
  },
): Promise<ProductRecord> {
  const userId = await requireUserId();
  if (input.requestId) {
    const existing = await supabase
      .from('listings')
      .select('*')
      .eq('seller_id', userId)
      .eq('client_request_id', input.requestId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return mapProduct(existing.data);
  }
  const imagePath = await uploadUserImage('product-photos', input.imageUri);
  const { data, error } = await supabase
    .from('listings')
    .insert({
      seller_id: userId,
      title: input.title,
      description: input.description,
      category: input.category ?? '其他',
      price: input.price,
      location: input.location,
      image_path: imagePath,
      status: 'active',
      ...deliveryColumns(input),
      client_request_id: input.requestId,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapProduct(data);
}

export async function loadCart() {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('cart_items')
    .select('listing:listings(*)')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? [])
    .map((row: any) => row.listing)
    .filter((row: any) => row?.status === 'active')
    .map((row: any) => ({ ...mapProduct(row), quantity: 1 }));
}

export async function addCartItem(listingId: string): Promise<void> {
  const userId = await requireUserId();
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('seller_id,status')
    .eq('id', listingId)
    .single();
  if (listingError) throw listingError;
  if (listing.seller_id === userId) throw new Error('不能購買自己刊登的商品。');
  if (listing.status !== 'active')
    throw new Error('商品已下架或售出，請重新選擇。');
  const { error } = await supabase
    .from('cart_items')
    .upsert(
      { user_id: userId, listing_id: listingId },
      { onConflict: 'user_id,listing_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function removeCartItem(listingId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('user_id', userId)
    .eq('listing_id', listingId);
  if (error) throw error;
}

export async function clearRemoteCart(): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}

export async function createOrdersFromCart(
  cartItems: Array<{
    id: string;
    sellerId: string;
    title: string;
    price: number;
  }>,
  paymentMethod: 'magic_coin' | 'cod',
  recipient: { name: string; phone: string; address: string },
): Promise<void> {
  await requireUserId();
  if (paymentMethod !== 'cod') {
    throw new Error('點數付款尚未啟用，請選擇貨到付款。');
  }
  const { error } = await supabase.rpc('create_orders_from_cart', {
    p_listing_ids: cartItems.map(item => item.id),
    p_recipient_name: recipient.name,
    p_recipient_phone: recipient.phone,
    p_shipping_address: recipient.address,
  });
  if (error) throw error;
}

export async function getOrCreateConversation(
  product: ProductRecord,
): Promise<string> {
  const userId = await requireUserId();
  if (userId === product.sellerId)
    throw new Error('不能和自己刊登的商品建立買賣對話');
  const { data, error } = await supabase
    .from('conversations')
    .upsert(
      { listing_id: product.id, buyer_id: userId, seller_id: product.sellerId },
      { onConflict: 'listing_id,buyer_id,seller_id' },
    )
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function loadMarketplaceMessages(
  conversationId: string,
  since?: string,
): Promise<MarketplaceMessage[]> {
  let query = supabase
    .from('messages')
    .select('id,sender_id,content,created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (since) query = query.gte('created_at', since);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    senderId: row.sender_id,
    text: row.content,
    createdAt: new Date(row.created_at).getTime(),
  }));
}

export async function sendMarketplaceMessage(
  conversationId: string,
  content: string,
  requestId: string = marketRequestId(),
) {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('messages')
    .upsert(
      {
        conversation_id: conversationId,
        sender_id: userId,
        content,
        message_type: 'text',
        client_request_id: requestId,
      },
      { onConflict: 'sender_id,client_request_id', ignoreDuplicates: true },
    )
    .select('id,sender_id,content,created_at')
    .maybeSingle();
  if (error) throw error;
  let saved = data;
  if (!saved) {
    const original = await supabase
      .from('messages')
      .select('id,sender_id,content,created_at')
      .eq('sender_id', userId)
      .eq('client_request_id', requestId)
      .single();
    if (original.error) throw original.error;
    saved = original.data;
  }
  if (saved.content !== content)
    throw new Error('訊息內容已變更，請重新送出。');
  return {
    id: saved.id,
    senderId: saved.sender_id,
    text: saved.content,
    createdAt: new Date(saved.created_at).getTime(),
  };
}

export async function loadAiChatMessages() {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('ai_chat_messages')
    .select('id,role,content,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: String(row.id),
    sender: row.role === 'assistant' ? ('ai' as const) : ('user' as const),
    text: row.content,
    createdAt: new Date(row.created_at).getTime(),
  }));
}

export async function saveAiChatMessage(
  role: 'user' | 'assistant',
  content: string,
  detectedItems: ChatItem[] = [],
): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('ai_chat_messages').insert({
    user_id: userId,
    role,
    content,
    detected_items: detectedItems,
  });
  if (error) throw error;
}

export type MarketRole = 'buyer' | 'seller';
export type MarketOrder = Transaction & {
  shipping_channel?: string;
  pickup_store?: { name: string; code: string; address: string } | null;
  version?: number;
  decision_reason?: string;
  order_events?: Array<{ id: string; event_type: string; occurred_at: string }>;
  id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  total_amount: number;
  shipping_fee: number;
  created_at: string;
  recipient_name: string;
  recipient_phone: string;
  shipping_address: string;
  order_items: Array<{
    image_path_snapshot?: string;
    condition_snapshot?: string;
    delivery_terms_snapshot?: {
      location?: string;
      meetup_note?: string;
      shipping_note?: string;
    };
    title_snapshot: string;
    price_snapshot: number;
    listing_id: string;
  }>;
};
export const orderStatusLabel: Record<string, string> = {
  requested: '等待賣家確認',
  accepted: '賣家已接受',
  fulfilling: '交付中',
  rejected: '已拒絕',
  pending: '待出貨（既有訂單）',
  paid: '待出貨',
  shipped: '已出貨',
  completed: '已完成',
  cancelled: '已取消',
};
export function orderActions(
  role: MarketRole,
  status: string,
): Array<'ship' | 'complete' | 'cancel'> {
  if (status === 'pending')
    return role === 'seller' ? ['ship', 'cancel'] : ['cancel'];
  if (status === 'shipped' && role === 'buyer') return ['complete'];
  return [];
}
export const orderActionLabel = {
  ship: '確認出貨',
  complete: '確認收貨',
  cancel: '取消訂單',
};

function mapProduct(row: any): ProductRecord {
  return {
    id: row.id,
    sellerId: row.seller_id,
    title: row.title,
    description: row.description ?? '',
    category: row.category,
    price: Number(row.price),
    location: row.location,
    img: getPublicImageUrl('product-photos', row.image_path),
    status: row.status,
    createdAt: row.created_at,
    version: row.version,
    condition: row.condition,
    defects: row.defects,
    allowMeetup: row.allow_meetup,
    allowShipping: row.allow_shipping,
    deliveryOptions: row.delivery_options || undefined,
    meetupNote: row.meetup_note,
    shippingNote: row.shipping_note,
    shippingFee: Number(row.shipping_fee || 0),
  };
}
export async function loadMyProducts(
  options: ProductQuery = {},
): Promise<ProductRecord[]> {
  const userId = await requireUserId();
  let query = supabase.from('listings').select('*').eq('seller_id', userId);
  if (options.status && options.status !== 'all')
    query = query.eq('status', options.status);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(...pageRange(options));
  if (error) throw error;
  return (data ?? []).map(mapProduct);
}
export async function updateProduct(
  id: string,
  input: DeliverySettings & {
    title: string;
    description: string;
    price: number;
    location: string;
    category?: string;
    imageUri?: string;
  },
): Promise<void> {
  const userId = await requireUserId();
  const imagePath = input.imageUri
    ? await uploadUserImage('product-photos', input.imageUri)
    : undefined;
  const { data, error } = await supabase
    .from('listings')
    .update({
      title: input.title,
      description: input.description,
      price: input.price,
      location: input.location,
      ...deliveryColumns(input),
      ...(input.category ? { category: input.category } : {}),
      ...(imagePath ? { image_path: imagePath } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('seller_id', userId)
    .in('status', ['active', 'archived'])
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('商品已售出或無法編輯，請重新整理。');
}
export async function setProductVisibility(
  id: string,
  status: 'active' | 'archived',
): Promise<void> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('listings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('seller_id', userId)
    .in('status', ['active', 'archived'])
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('商品狀態已改變，請重新整理。');
}
export async function loadMarketOrders(
  role: MarketRole,
  options: ProductQuery = {},
): Promise<MarketOrder[]> {
  const userId = await requireUserId();
  let query = supabase
    .from('orders')
    .select('*,order_items(*)')
    .eq(role === 'buyer' ? 'buyer_id' : 'seller_id', userId);
  if (
    ['waitMeetup', 'waitShip', 'waitReceive'].includes(options.status || '')
  ) {
    query = query
      .eq('workflow_version', 2)
      .in('status', ['accepted', 'fulfilling']);
    if (options.status === 'waitMeetup')
      query = query
        .eq('delivery_method', 'meetup')
        .is('seller_handed_over_at', null);
    if (options.status === 'waitShip')
      query = query.eq('delivery_method', 'shipping').is('shipment', null);
    if (options.status === 'waitReceive')
      query = query
        .is('buyer_received_at', null)
        .or('shipment.not.is.null,seller_handed_over_at.not.is.null');
  } else if (options.status && options.status !== 'all')
    query =
      options.status === 'pending'
        ? query.in('status', ['pending', 'paid'])
        : query.eq('status', options.status);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(...pageRange(options));
  if (error) throw error;
  return (data ?? []) as unknown as MarketOrder[];
}
export async function transitionMarketOrder(
  orderId: string,
  action: 'ship' | 'complete' | 'cancel',
): Promise<void> {
  const { error } = await supabase.rpc('transition_market_order', {
    p_order_id: orderId,
    p_action: action,
  });
  if (error) throw new Error(error.message);
}
export type MarketConversation = {
  id: string;
  buyer_id: string;
  seller_id: string;
  last_message_at: string;
  listing: ProductRecord | null;
  viewerRole: MarketRole;
  latestMessage: string;
};
export async function loadMarketConversations(
  role?: MarketRole,
  options: ProductQuery = {},
): Promise<MarketConversation[]> {
  const userId = await requireUserId();
  let query = supabase
    .from('conversations')
    .select(
      'id,buyer_id,seller_id,last_message_at,listing:listings(*),messages(content,created_at)',
    );
  query = role
    ? query.eq(role === 'buyer' ? 'buyer_id' : 'seller_id', userId)
    : query.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
  const { data, error } = await query
    .order('last_message_at', { ascending: false })
    .order('id', { ascending: false })
    .order('created_at', { referencedTable: 'messages', ascending: false })
    .limit(1, { referencedTable: 'messages' })
    .range(...pageRange(options));
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    buyer_id: row.buyer_id,
    seller_id: row.seller_id,
    last_message_at: row.last_message_at,
    viewerRole: row.buyer_id === userId ? 'buyer' : 'seller',
    latestMessage: row.messages?.[0]?.content ?? '',
    listing: row.listing ? mapProduct(row.listing) : null,
  }));
}

// Shared account behavior: exported to PWA by pwa:prepare.
export async function updateAccountProfile(input: {
  displayName: string;
  username: string;
  email: string;
  gender: string;
  password?: string;
}) {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getUser();
  if (sessionError) throw sessionError;
  if (!sessionData.user) throw new Error('請先登入。');
  if (!input.displayName.trim() || !input.username.trim())
    throw new Error('請填寫姓名與使用者名稱。');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
    throw new Error('請輸入有效的電子郵件。');
  if (input.password && input.password.length < 8)
    throw new Error('密碼至少需要 8 個字元。');
  const { error } = await supabase.auth.updateUser({
    data: {
      display_name: input.displayName.trim(),
      username: input.username.trim(),
      gender: input.gender.trim(),
    },
    ...(input.email.trim() !== sessionData.user.email
      ? { email: input.email.trim() }
      : {}),
    ...(input.password ? { password: input.password } : {}),
  });
  if (error) throw error;
}

export async function saveAccountAvatar(uri: string) {
  const userId = await requireUserId();
  const path = await uploadUserImage(
    'analysis-photos',
    `${userId}/avatar`,
    uri,
  );
  const { error } = await supabase.auth.updateUser({
    data: { avatar_path: path },
  });
  if (error) throw error;
  return getPrivateImageUrl('analysis-photos', path);
}

export async function setDailyReminder(enabled: boolean) {
  const { error } = await supabase.auth.updateUser({
    data: { daily_reminder: enabled },
  });
  if (error) throw error;
}

export async function loadStorageProfile() {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('user_personas')
    .select('persona_name,visual_preference,detail_preference')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as {
    persona_name: string;
    visual_preference: 'rich' | 'minimal';
    detail_preference: 'simple' | 'detailed';
  } | null;
}

// Personal inventory states belong to the account, separate from marketplace status.
export type ItemDisposition = 'keep' | 'discard' | 'sell';
export const itemDispositionLabels: Record<ItemDisposition, string> = {
  keep: '保留中',
  discard: '待丟棄',
  sell: '待售',
};
export function normalizeItemDisposition(value: unknown): ItemDisposition {
  return value === 'discard' || value === 'sell' ? value : 'keep';
}
export async function createRemoteItem(input: {
  name: string;
  category: string;
  quantity: number;
  photoUri?: string;
}) {
  const name = input.name.trim();
  const category = input.category.trim();
  if (!name || name.length > 60)
    throw new Error('請輸入 1 至 60 字的物品名稱。');
  if (!category || category.length > 30)
    throw new Error('請輸入 1 至 30 字的分類。');
  if (
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > 9999
  )
    throw new Error('數量必須是 1 至 9999 的整數。');
  const userId = await requireUserId();
  const photoPath = input.photoUri
    ? await uploadUserImage(
        'analysis-photos',
        input.photoUri,
        `${userId}/items`,
      )
    : null;
  const { error } = await supabase.from('items').insert({
    user_id: userId,
    name,
    category,
    quantity: input.quantity,
    source: 'manual',
    image_path: photoPath,
  });
  if (error) throw error;
}
export async function deleteRemoteItem(id: string) {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
export async function setItemDisposition(
  id: string,
  disposition: ItemDisposition,
) {
  if (!['keep', 'discard', 'sell'].includes(disposition))
    throw new Error('物品狀態無效。');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('請先登入後再操作');
  const { data: item, error: itemError } = await supabase
    .from('items')
    .select('id')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!item) throw new Error('找不到這件物品，請重新載入。');
  const statuses = { ...(auth.user.user_metadata.item_dispositions || {}) };
  if (disposition === 'keep') delete statuses[id];
  else statuses[id] = disposition;
  const { error } = await supabase.auth.updateUser({
    data: { item_dispositions: statuses },
  });
  if (error) throw error;
}

export async function setItemStorageLocation(id: string, value: string) {
  if (value.trim().length > 100) throw new Error('存放位置最多 100 字。');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('請先登入後再操作');
  const { data: item, error: itemError } = await supabase
    .from('items')
    .select('id')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!item) throw new Error('找不到這件物品，請重新載入。');
  const locations = {
    ...(auth.user.user_metadata.item_storage_locations || {}),
  };
  const location = normalizeStorageLocation(value);
  if (location) locations[id] = location;
  else delete locations[id];
  const { error } = await supabase.auth.updateUser({
    data: { item_storage_locations: locations },
  });
  if (error) throw error;
  return location;
}

function deliveryColumns(input: DeliverySettings) {
  return Object.fromEntries(
    Object.entries({
      condition: input.condition,
      defects: input.defects,
      allow_meetup: input.allowMeetup,
      allow_shipping: input.allowShipping,
      meetup_note: input.meetupNote,
      shipping_note: input.shippingNote,
      shipping_fee: input.shippingFee,
      delivery_options: input.deliveryOptions,
    }).filter(([, v]) => v !== undefined),
  );
}
export async function createMarketRequests(
  batchId: string,
  products: ProductRecord[],
  methods: Record<string, DeliveryMethod>,
  recipient: ChannelRecipient,
  channels: Record<string, string> = {},
): Promise<string[]> {
  await requireUserId();
  const chosenChannels = products.map(p => channels[p.id] || methods[p.id]);
  validateChannelRecipient(chosenChannels, recipient);
  products.forEach((p, i) => {
    if (!availableChannels(p).some(o => o.channel === chosenChannels[i]))
      throw new Error('商品交易管道已變更，請重新確認。');
  });
  const { data, error } = await supabase.rpc('create_market_requests', {
    p_batch: batchId,
    p_items: products.map(p => ({
      id: p.id,
      method: methods[p.id],
      channel: channels[p.id] || methods[p.id],
      version: p.version,
    })),
    p_recipient: recipient,
  });
  if (error) throw new Error(error.message);
  return data as string[];
}
export async function loadMarketOrder(id: string): Promise<MarketOrder> {
  await requireUserId();
  const { data, error } = await supabase
    .from('orders')
    .select('*,order_items(*),order_issues(*),order_events(*)')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data as MarketOrder;
}
export async function actOnMarketOrder(
  order: MarketOrder,
  action: TransactionAction,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.rpc('market_order_action', {
    p_order_id: order.id,
    p_action: action,
    p_version: order.version,
    p_payload: payload,
  });
  if (error) throw new Error(error.message);
}
export async function loadRelatedMarketOrders(
  conversationId: string,
): Promise<MarketOrder[]> {
  const { data: c, error } = await supabase
    .from('conversations')
    .select('listing_id,buyer_id,seller_id')
    .eq('id', conversationId)
    .single();
  if (error) throw new Error(error.message);
  const { data: orders, error: e } = await supabase
    .from('orders')
    .select('*,order_items!inner(*)')
    .eq('buyer_id', c.buyer_id)
    .eq('seller_id', c.seller_id)
    .eq('order_items.listing_id', c.listing_id)
    .order('created_at', { ascending: false })
    .limit(20);
  if (e) throw new Error(e.message);
  return orders as MarketOrder[];
}
export async function orderConversation(
  order: MarketOrder,
  listingId: string,
): Promise<{ id: string; product: ProductRecord }> {
  const product = await loadProduct(listingId);
  const user = await requireUserId();
  if (user !== order.buyer_id && user !== order.seller_id)
    throw new Error('無法存取此訂單');
  if (user === order.buyer_id)
    return { id: await getOrCreateConversation(product), product };
  // Seller cannot create conversations as the buyer. The request creates no fake messages.
  const { data: c, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('listing_id', listingId)
    .eq('buyer_id', order.buyer_id)
    .eq('seller_id', order.seller_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) {
    const { data: id, error: e } = await supabase.rpc(
      'market_order_conversation',
      { p_order_id: order.id, p_listing_id: listingId },
    );
    if (e) throw new Error(e.message);
    return { id, product };
  }
  return { id: c.id, product };
}
import type {
  MarketNotification,
  NotificationPreferences,
} from './notificationTypes';
export type {
  MarketNotification,
  NotificationPreferences,
} from './notificationTypes';
export async function loadMarketNotifications(): Promise<MarketNotification[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('market_notifications')
    .select('id,kind,title,body,target,created_at,read_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error('通知服務尚未啟用或暫時無法連線，請稍後重試。');
  return data || [];
}
export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('chat,orders')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || { chat: true, orders: true };
}
export async function saveNotificationPreferences(
  value: NotificationPreferences,
) {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: userId, ...value });
  if (error) throw new Error(error.message);
}
export async function markNotificationRead(id: string) {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('market_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}
export async function registerPushDevice(
  token: string,
  platform: 'android' | 'web',
) {
  const userId = await requireUserId();
  const { error } = await supabase.from('push_devices').upsert({
    user_id: userId,
    token,
    platform,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
export async function unregisterPushDevice(token: string) {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('push_devices')
    .delete()
    .eq('token', token)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

// Legal records are authoritative on the server; never use local storage as consent.
let pendingLegalRegistration: Promise<void> | null = null;
async function readLegalAcceptance(): Promise<boolean> {
  const {data,error}=await supabase.rpc('has_current_legal_acceptance');
  if(error) throw new Error('無法讀取政策確認紀錄，請連線後重試。');
  if(typeof data!=='boolean') throw new Error('政策確認紀錄格式錯誤。');
  return data;
}
export async function acceptLegalPolicies(adult:boolean,agreed:boolean):Promise<void>{
  if(!adult || !agreed) throw new Error('請完成兩項確認。');
  const {error}=await supabase.rpc('accept_current_policies',{
    p_terms_version:'v1.1',p_privacy_version:'v1.1',p_adult:adult,p_agreed:agreed,
  });
  if(error) throw new Error('確認紀錄未保存，請重試；目前尚未開通服務。');
  if(!await readLegalAcceptance()) throw new Error('未取得有效確認紀錄，請重試。');
}

export async function loadLegalAcceptance():Promise<boolean>{
 if(pendingLegalRegistration) await pendingLegalRegistration;
 return readLegalAcceptance();
}
export async function registerWithLegalConfirmation(email:string,password:string,metadata:{display_name:string;username:string},adult:boolean,agreed:boolean){
 if(!adult||!agreed)throw new Error('請完成兩項使用確認。');
 let done!:()=>void;
 const pending=new Promise<void>(resolve=>{done=resolve;});pendingLegalRegistration=pending;
 try{
  const result=await supabase.auth.signUp({email,password,options:{data:metadata}});
  if(!result.error && result.data.session)await acceptLegalPolicies(adult,agreed);
  return result;
 } finally {if(pendingLegalRegistration===pending)pendingLegalRegistration=null;done();}
}
