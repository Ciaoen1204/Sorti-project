import {
  availableChannels,
  validateOptions,
  type DeliveryOption,
} from './deliveryChannels';
export type DeliveryMethod = 'meetup' | 'shipping';
export type DeliverySettings = {
  deliveryOptions?: DeliveryOption[];
  condition?: string;
  defects?: string;
  allowMeetup?: boolean;
  allowShipping?: boolean;
  meetupNote?: string;
  shippingNote?: string;
  shippingFee?: number;
};
export const itemConditions = ['全新', '近全新', '正常使用', '有瑕疵但可使用'];
export function validateDelivery(v: DeliverySettings) {
  if (v.deliveryOptions !== undefined) validateOptions(v.deliveryOptions);
  if (!v.condition || !itemConditions.includes(v.condition))
    throw new Error('請選擇商品使用狀況。');
  if (v.condition === '有瑕疵但可使用' && !v.defects?.trim())
    throw new Error('請填寫瑕疵說明。');
  if (!v.allowMeetup && !v.allowShipping)
    throw new Error('請至少開放面交或寄送一種方式。');
  if (
    v.allowShipping &&
    (!v.shippingNote?.trim() ||
      !Number.isFinite(v.shippingFee) ||
      v.shippingFee! < 0 ||
      v.shippingFee! > 9999999999.99 ||
      Math.abs(v.shippingFee! * 100 - Math.round(v.shippingFee! * 100)) >
        0.00001)
  )
    throw new Error('請填寫自行寄送方式及有效運費（最多兩位小數）。');
}
export const deliveryLabel = (method?: string) =>
  method === 'meetup'
    ? '面交'
    : method === 'shipping'
    ? '寄送'
    : '既有訂單・交付方式未記錄';
export const transactionLabels: Record<string, string> = {
  requested: '等待賣家確認',
  accepted: '賣家已接受',
  fulfilling: '交付中',
  completed: '已完成',
  rejected: '已拒絕',
  cancelled: '已取消',
};
export type Transaction = {
  accepted_at?: string | null;
  workflow_version?: number;
  status: string;
  delivery_method?: DeliveryMethod;
  buyer_id: string;
  seller_id: string;
  seller_handed_over_at?: string | null;
  buyer_received_at?: string | null;
  cancel_requested_by?: string | null;
  meetup?: {
    version: number;
    proposed_by: string;
    starts_at: string;
    place: string;
    notes: string;
    confirmed: boolean;
  } | null;
  shipment?: {
    carrier?: string;
    dispatched_at: string;
    tracking_number?: string;
    note?: string;
  } | null;
  order_issues?: Array<{
    id: string;
    resolved_at: string | null;
    buyer_resolved_at?: string | null;
    seller_resolved_at?: string | null;
    details: string;
  }>;
};
export type TransactionAction =
  | 'accept'
  | 'reject'
  | 'cancel'
  | 'request_cancel'
  | 'agree_cancel'
  | 'decline_cancel'
  | 'propose_meetup'
  | 'confirm_meetup'
  | 'handover'
  | 'ship'
  | 'receive'
  | 'open_issue'
  | 'resolve_issue';
export const transactionActionLabels: Record<TransactionAction, string> = {
  accept: '接受訂單',
  reject: '拒絕訂單',
  cancel: '取消購買請求',
  request_cancel: '提出取消',
  agree_cancel: '同意取消',
  decline_cancel: '繼續交易',
  propose_meetup: '提出／修改面交安排',
  confirm_meetup: '確認這個安排',
  handover: '確認面交交付',
  ship: '填寫出貨資訊',
  receive: '確認收到商品',
  open_issue: '提出交易問題',
  resolve_issue: '已協調解決',
};
export function transactionActions(
  o: Transaction,
  viewer: string,
): TransactionAction[] {
  if (o.workflow_version !== 2 || ![o.buyer_id, o.seller_id].includes(viewer))
    return [];
  const seller = viewer === o.seller_id;
  if (o.status === 'requested')
    return seller ? ['accept', 'reject'] : ['cancel'];
  if (!['accepted', 'fulfilling'].includes(o.status)) return [];
  if (o.order_issues?.some(i => !i.resolved_at)) return ['resolve_issue'];
  if (o.cancel_requested_by)
    return o.cancel_requested_by === viewer
      ? []
      : ['agree_cancel', 'decline_cancel'];
  const actions: TransactionAction[] = [];
  if (o.delivery_method === 'meetup') {
    if (
      seller
        ? !o.seller_handed_over_at
        : !!o.seller_handed_over_at && !o.buyer_received_at
    )
      actions.push('handover');
  } else if (seller && !o.shipment) actions.push('ship');
  else if (!seller && o.shipment && !o.buyer_received_at)
    actions.push('receive');
  if (!o.shipment && !o.seller_handed_over_at && !o.buyer_received_at)
    actions.push('request_cancel');
  actions.push('open_issue');
  return actions;
}
export function transactionNext(o: Transaction, viewer: string): string {
  if (o.order_issues?.some(i => !i.resolved_at))
    return '有交易問題，請先聯絡對方協調。平台未提供仲裁或退款。';
  if (o.cancel_requested_by)
    return o.cancel_requested_by === viewer
      ? '已提出取消，等待對方同意。'
      : '對方提出取消，請回覆。';
  if (o.status === 'requested')
    return viewer === o.seller_id
      ? '請接受或拒絕購買請求。'
      : '等待賣家接受；目前尚未保留商品。';
  if (o.status === 'completed')
    return '交易已完成。此紀錄不代表平台驗證線下付款。';
  if (o.status === 'rejected' || o.status === 'cancelled')
    return '交易已結束。';
  const seller = viewer === o.seller_id;
  if (o.delivery_method === 'shipping')
    return o.shipment
      ? seller
        ? '已出貨，等待買家收到商品後確認收貨。'
        : '商品已寄出，實際收到後請確認收貨。'
      : seller
      ? '請備貨並實際寄出，再填寫出貨資訊。'
      : '等待賣家出貨。';
  if (o.seller_handed_over_at)
    return seller
      ? '你已確認交付，等待買家確認收貨。'
      : '賣家已交付，實際收到商品後請確認收貨。';
  return seller
    ? '請透過交易聊聊約定面交；實際交付後按「我已交付商品」。'
    : '請透過交易聊聊約定面交，等待賣家交付商品。';
}
export function transactionStatus(o: Transaction): string {
  if (o.workflow_version !== 2) return transactionLabels[o.status] || o.status;
  if (o.status === 'accepted' || o.status === 'fulfilling') {
    if (o.delivery_method === 'shipping')
      return o.shipment ? '已出貨・待收貨' : '待出貨';
    return o.seller_handed_over_at ? '已交付・待收貨' : '待面交';
  }
  return transactionLabels[o.status] || o.status;
}
export function transactionStages(o: Transaction): string[] {
  return [
    '購買請求',
    o.delivery_method === 'shipping' ? '待出貨' : '待面交',
    o.delivery_method === 'shipping' ? '已出貨・待收貨' : '已交付・待收貨',
    '交易完成',
  ];
}
export function checkoutGroups<
  T extends {
    sellerId: string;
    price: number;
    shippingFee?: number;
    deliveryOptions?: DeliveryOption[];
    allowMeetup?: boolean;
    allowShipping?: boolean;
  },
>(
  items: T[],
  methods: Record<string, DeliveryMethod>,
  id: (i: T) => string,
  channels: Record<string, string> = {},
) {
  const groups = new Map<
    string,
    {
      items: T[];
      method: DeliveryMethod;
      channel: string;
      subtotal: number;
      fee: number;
    }
  >();
  for (const i of items) {
    const method = methods[id(i)];
    if (!method) continue;
    const channel = channels[id(i)] || method;
    const key = `${i.sellerId}:${method}:${channel}`;
    const g = groups.get(key) || {
      items: [],
      method,
      channel,
      subtotal: 0,
      fee: 0,
    };
    g.items.push(i);
    g.subtotal = Math.round((g.subtotal + i.price) * 100) / 100;
    g.fee =
      method === 'shipping'
        ? Math.max(
            g.fee,
            availableChannels(i).find(o => o.channel === channel)?.fee ??
              i.shippingFee ??
              0,
          )
        : 0;
    groups.set(key, g);
  }
  return [...groups.values()];
}
// Generated UUID is an idempotency identifier, never an authentication token.
export function marketRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
}

export function transactionProgress(o: Transaction) {
  const index = ['requested', 'accepted', 'fulfilling', 'completed'].indexOf(
    o.status,
  );
  return transactionStages(o).map((label, i) => ({
    label,
    state:
      index === 3 || i < index ? 'done' : i === index ? 'current' : 'upcoming',
  }));
}
