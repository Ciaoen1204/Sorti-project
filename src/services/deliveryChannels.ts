export const deliveryChannels = [
  { id: 'meetup', label: '面交' },
  { id: 'seven_eleven', label: '7-ELEVEN' },
  { id: 'family_mart', label: '全家' },
  { id: 'hi_life', label: '萊爾富' },
  { id: 'ok_mart', label: 'OK 超商' },
  { id: 'home_delivery', label: '宅配' },
] as const;
export type DeliveryChannel = (typeof deliveryChannels)[number]['id'];
export type DeliveryOption = {
  channel: DeliveryChannel;
  fee: number;
  note: string;
};
export const channelLabel = (channel?: string) =>
  deliveryChannels.find(c => c.id === channel)?.label || '一般寄送';
export const storeChannel = (channel?: string) =>
  !!channel && !['meetup', 'home_delivery', 'shipping'].includes(channel);
export function validateOptions(options: DeliveryOption[]) {
  if (
    !options.length ||
    new Set(options.map(o => o.channel)).size !== options.length
  )
    throw new Error('請選擇至少一種交易方式，且不可重複。');
  for (const o of options) {
    if (
      !deliveryChannels.some(c => c.id === o.channel) ||
      !Number.isSafeInteger(o.fee) ||
      o.fee < 0 ||
      o.fee > 9999999999
    )
      throw new Error('請選擇有效管道，並填寫非負整數運費。');
    if (o.channel === 'meetup' && o.fee !== 0)
      throw new Error('面交不收寄送運費。');
  }
}
export function deliverySummary(options: DeliveryOption[]) {
  return {
    deliveryOptions: options,
    allowMeetup: options.some(o => o.channel === 'meetup'),
    allowShipping: options.some(o => o.channel !== 'meetup'),
    meetupNote: options.find(o => o.channel === 'meetup')?.note || '',
    shippingNote: options
      .filter(o => o.channel !== 'meetup')
      .map(o => `${channelLabel(o.channel)}${o.note ? '：' + o.note : ''}`)
      .join('、'),
    shippingFee: Math.max(
      0,
      ...options.filter(o => o.channel !== 'meetup').map(o => o.fee),
    ),
  };
}
export type ChannelProduct = {
  deliveryOptions?: DeliveryOption[];
  allowMeetup?: boolean;
  allowShipping?: boolean;
  shippingFee?: number;
  shippingNote?: string;
  meetupNote?: string;
};
export function availableChannels(p: ChannelProduct) {
  if (p.deliveryOptions?.length) return p.deliveryOptions;
  return [
    ...(p.allowMeetup
      ? [{ channel: 'meetup', fee: 0, note: p.meetupNote || '' }]
      : []),
    ...(p.allowShipping
      ? [
          {
            channel: 'shipping',
            fee: p.shippingFee || 0,
            note: p.shippingNote || '',
          },
        ]
      : []),
  ];
}
export type ChannelRecipient = {
  name: string;
  phone: string;
  address: string;
  stores?: Record<string, { name: string; code: string; address: string }>;
};
export function validateChannelRecipient(
  channels: string[],
  recipient: ChannelRecipient,
) {
  if (channels.every(c => c === 'meetup')) return;
  if (!recipient.name.trim() || !recipient.phone.trim())
    throw new Error('請填寫收件人與電話。');
  for (const c of new Set(channels)) {
    if (c === 'meetup') continue;
    if (storeChannel(c)) {
      const s = recipient.stores?.[c];
      if (!s?.name.trim() || !s.code.trim() || !s.address.trim())
        throw new Error(`請填寫${channelLabel(c)}的門市名稱、店號及地址。`);
    } else if (!recipient.address.trim()) throw new Error('請填寫收件地址。');
  }
}

export function sellerChannelGroups<
  T extends Parameters<typeof availableChannels>[0] & { sellerId: string },
>(items: T[]) {
  const sellers = new Map<string, T[]>();
  items.forEach(p =>
    sellers.set(p.sellerId, [...(sellers.get(p.sellerId) || []), p]),
  );
  return [...sellers].map(([sellerId, products]) => ({
    sellerId,
    products,
    options: availableChannels(products[0]).filter(o =>
      products.every(p =>
        availableChannels(p).some(c => c.channel === o.channel),
      ),
    ),
  }));
}
