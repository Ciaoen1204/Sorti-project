// Existing listing categories; arbitrary legacy/item categories remain selectable.
export const listingCategories = ['大型家具', '桌上收納', '收納盒/籃', '其他'];
export const marketSorts = [
  ['newest', '最新上架'],
  ['priceAsc', '價格由低到高'],
  ['priceDesc', '價格由高到低'],
] as const;
export function currency(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `NT$ ${value.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}`
    : '價格未提供';
}
export function priceRange(min: string, max: string) {
  const valid = (v: string) =>
    !v.trim() ||
    (/^\d+(\.\d{1,2})?$/.test(v.trim()) && Number(v) <= 9999999999.99);
  if (!valid(min) || !valid(max))
    throw new Error('請輸入有效的價格，最多兩位小數。');
  const minPrice = min.trim() ? Number(min) : undefined;
  const maxPrice = max.trim() ? Number(max) : undefined;
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)
    throw new Error('最低價格不能高於最高價格。');
  return { minPrice, maxPrice };
}
export function validateListing(input: {
  title: string;
  category: string;
  price: string;
  location: string;
  imageUri: string;
}) {
  if (!input.imageUri) throw new Error('請先拍攝或選擇商品照片。');
  if (!input.title.trim()) throw new Error('請填寫商品名稱。');
  if (!input.category.trim()) throw new Error('請選擇商品分類。');
  if (!input.price.trim()) throw new Error('請填寫商品價格。');
  priceRange(input.price, '');
  if (!input.location.trim()) throw new Error('請填寫面交或寄出地點。');
}
export function productShareText(product: {
  title: string;
  price: number;
  location: string;
}) {
  return `拾序二手市集｜${product.title}\n${currency(product.price)}${
    product.location ? `\n${product.location}` : ''
  }`;
}
