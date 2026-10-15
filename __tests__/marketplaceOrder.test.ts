import {
  checkoutGroups,
  transactionActions,
  transactionNext,
  validateDelivery,
  type Transaction,
} from '../src/services/marketplaceOrder';
const order: Transaction = {
  workflow_version: 2,
  status: 'accepted',
  delivery_method: 'meetup',
  buyer_id: 'b',
  seller_id: 's',
};
test('only the recipient of a purchasing request can accept it', () => {
  expect(transactionActions({ ...order, status: 'requested' }, 'b')).toEqual([
    'cancel',
  ]);
  expect(transactionActions({ ...order, status: 'requested' }, 's')).toEqual([
    'accept',
    'reject',
  ]);
  expect(
    transactionActions({ ...order, status: 'requested' }, 'outsider'),
  ).toEqual([]);
});
test('a single handover is not a completed transaction and cannot be cancelled', () => {
  const o = {
    ...order,
    status: 'fulfilling',
    meetup: {
      version: 1,
      proposed_by: 's',
      starts_at: '2026-10-15',
      place: '公開地點',
      notes: '',
      confirmed: true,
    },
    seller_handed_over_at: 'now',
  };
  expect(transactionActions(o, 's')).not.toContain('handover');
  expect(transactionActions(o, 'b')).toContain('handover');
  expect(transactionActions(o, 'b')).not.toContain('request_cancel');
  expect(transactionNext(o, 'b')).toContain('實際收到');
});
test('the buyer cannot confirm a shipment that has not been marked sent', () => {
  const o = { ...order, delivery_method: 'shipping' as const };
  expect(transactionActions(o, 'b')).not.toContain('receive');
  expect(transactionActions(o, 's')).toContain('ship');
  const shipped = { ...o, shipment: { dispatched_at: 'now' } };
  expect(transactionActions(shipped, 'b')).toContain('receive');
  expect(transactionActions(shipped, 's')).not.toContain('receive');
  expect(transactionActions(shipped, 'b')).not.toContain('request_cancel');
});
test('issues and cancellation proposals prevent conflicting handover actions', () => {
  expect(
    transactionActions(
      {
        ...order,
        order_issues: [{ id: 'i', resolved_at: null, details: '尚未收到' }],
      },
      'b',
    ),
  ).toEqual(['resolve_issue']);
  expect(
    transactionActions({ ...order, cancel_requested_by: 'b' }, 'b'),
  ).toEqual([]);
  expect(
    transactionActions({ ...order, cancel_requested_by: 'b' }, 's'),
  ).toEqual(['agree_cancel', 'decline_cancel']);
});
test('orders split by seller and delivery method, with highest shipping fee per group', () => {
  const items = [
    { id: '1', sellerId: 's', price: 100, shippingFee: 60 },
    { id: '2', sellerId: 's', price: 200, shippingFee: 80 },
    { id: '3', sellerId: 's', price: 300, shippingFee: 99 },
  ];
  const groups = checkoutGroups(
    items,
    { '1': 'shipping', '2': 'shipping', '3': 'meetup' },
    p => p.id,
  );
  expect(groups.map(g => [g.method, g.subtotal, g.fee])).toEqual([
    ['shipping', 300, 80],
    ['meetup', 300, 0],
  ]);
});
test('delivery validation requires actual usable terms and honest defect descriptions', () => {
  expect(() => validateDelivery({ condition: '正常使用' })).toThrow('至少');
  expect(() =>
    validateDelivery({ condition: '有瑕疵但可使用', allowMeetup: true }),
  ).toThrow('瑕疵');
  expect(() =>
    validateDelivery({
      condition: '正常使用',
      allowShipping: true,
      shippingFee: 0,
    }),
  ).toThrow('寄送');
  expect(() =>
    validateDelivery({
      condition: '正常使用',
      allowShipping: true,
      shippingNote: '自行安排貨到付款',
      shippingFee: 0,
    }),
  ).not.toThrow();
  expect(() =>
    validateDelivery({
      condition: '正常使用',
      allowShipping: true,
      shippingNote: '自寄',
      shippingFee: 1.234,
    }),
  ).toThrow('運費');
});

test('meetup has no appointment requirement and seller hands over before buyer receives', () => {
  expect(transactionActions(order, 's')).toContain('handover');
  expect(transactionActions(order, 'b')).not.toContain('handover');
  for (const actor of ['s', 'b']) {
    expect(transactionActions(order, actor)).not.toContain('propose_meetup');
    expect(transactionActions(order, actor)).not.toContain('confirm_meetup');
  }
  expect(
    transactionActions({ ...order, seller_handed_over_at: 'now' }, 'b'),
  ).toContain('handover');
});

test('seller checkout offers only channels shared by every selected product', () => {
  const { sellerChannelGroups } = require('../src/services/deliveryChannels');
  const p = (sellerId: string, channels: string[]) => ({
    sellerId,
    deliveryOptions: channels.map(channel => ({ channel, fee: 60, note: '' })),
  });
  const groups = sellerChannelGroups([
    p('a', ['meetup', 'seven_eleven']),
    p('a', ['seven_eleven', 'home_delivery']),
    p('b', ['meetup']),
  ]);
  expect(groups[0].options.map((o: any) => o.channel)).toEqual([
    'seven_eleven',
  ]);
  expect(groups[1].options.map((o: any) => o.channel)).toEqual(['meetup']);
  expect(
    sellerChannelGroups([p('a', ['meetup']), p('a', ['home_delivery'])])[0]
      .options,
  ).toEqual([]);
});

test('progress distinguishes completed, current and upcoming stages', () => {
 const {transactionProgress}=require('../src/services/marketplaceOrder');
 expect(transactionProgress({...order,status:'accepted'}).map((s:any)=>s.state)).toEqual(['done','current','upcoming','upcoming']);
 expect(transactionProgress({...order,status:'completed'}).every((s:any)=>s.state==='done')).toBe(true);
 expect(transactionProgress({...order,status:'cancelled'}).some((s:any)=>s.state==='current')).toBe(false);
});
