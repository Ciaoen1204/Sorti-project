import {tr} from "../src/i18n/language";
import { shipmentDate, taipeiDay } from '../src/services/shipmentDate';
import {
  sellerChannelGroups,
  validateChannelRecipient,
  availableChannels,
  channelLabel,
  storeChannel,
  type ChannelRecipient,
} from '../src/services/deliveryChannels';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as data from './data.generated';
import { supabase } from './supabase';
import { currency } from '../src/services/marketplace';
import {
  checkoutGroups,
  deliveryLabel,
  marketRequestId,
  transactionActions,
  transactionActionLabels,
  transactionNext,
  transactionStatus,
  transactionProgress,
  type DeliveryMethod,
  type TransactionAction,
} from '../src/services/marketplaceOrder';
const go = (id: string) => {
  sessionStorage.setItem('sorti-order-id', id);
  location.hash = 'market-order';
};
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : '操作失敗，請重試。';
export function WebMarketCheckout() {
  const [products, setProducts] = useState<data.ProductRecord[]>([]),
    [methods, setMethods] = useState<Record<string, DeliveryMethod>>({}),
    [channels, setChannels] = useState<Record<string, string>>({}),
    [selected, setSelected] = useState<Record<string, boolean>>({}),
    [recipient, setRecipient] = useState<ChannelRecipient>({
      name: '',
      phone: '',
      address: '',
      stores: {},
    }),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [orders, setOrders] = useState<string[]>([]);
  const direct = sessionStorage.getItem('sorti-direct-buy'),
    batch = useRef(marketRequestId()),
    lock = useRef(false),
    submitted = useRef(false);
  useEffect(() => {
    let active = true;
    (direct ? data.loadProduct(direct).then(p => [p]) : data.loadCart())
      .then(ps => {
        if (active) {
          setProducts(ps);
          setSelected(Object.fromEntries(ps.map(p => [p.id, true])));
          setChannels(
            Object.fromEntries(
              ps.map(p => [p.id, availableChannels(p)[0]?.channel || '']),
            ),
          );
          setMethods(
            Object.fromEntries(
              ps
                .filter(p => p.allowMeetup || p.allowShipping)
                .map(p => [
                  p.id,
                  availableChannels(p)[0]?.channel === 'meetup'
                    ? 'meetup'
                    : 'shipping',
                ]),
            ),
          );
        }
      })
      .catch(e => active && setError(errorText(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [direct]);
  const chosen = products.filter(p => selected[p.id]),
    groups = checkoutGroups(chosen, methods, p => p.id, channels),
    shipping = chosen.some(p => methods[p.id] === 'shipping');
  function change(fn: () => void) {
    if (submitted.current) return;
    batch.current = marketRequestId();
    fn();
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (!chosen.length || chosen.some(p => !methods[p.id]))
        throw new Error('請選擇商品，並確認賣家已設定交易方式。');
      validateChannelRecipient(
        chosen.map(p => channels[p.id] || methods[p.id]),
        recipient,
      );
      submitted.current = true;
      setOrders(
        await data.createMarketRequests(
          batch.current,
          chosen,
          methods,
          recipient,
          channels,
        ),
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <h1>{tr(orders.length ? '已送出購買請求' : '確認購買')}</h1>
      <button className="button secondary" onClick={() => history.back()}>{tr("返回")}</button>
      {tr(loading && <p role="status">{tr("正在確認商品…")}</p>)}
      {tr(error && <p role="alert">{tr(error)}</p>)}
      {tr(orders.length ? (
        <section className="card">
          <p>{tr("等待賣家確認，確認後即可進行後續交易。目前尚未保留商品。")}</p>
          {tr(orders.map(id => (
            <button className="button" key={id} onClick={() => go(id)}>{tr("查看訂單")}{tr(id.slice(0, 8))}
            </button>
          )))}
          <button
            className="button secondary"
            onClick={() => {
              location.hash = 'market';
            }}
          >{tr("返回市集")}</button>
        </section>
      ) : (
        <form onSubmit={submit}>
          {tr(sellerChannelGroups(chosen)
            .filter(g => g.products.length > 1)
            .map(g => (
              <section className="card" key={g.sellerId}>
                <h2>{tr("同賣家一起購買 ·")}{tr(g.products.length)}{tr("件")}</h2>
                {tr(g.options.length ? (
                  <label>{tr("合併交易方式")}<select
                      aria-label={tr("合併交易方式")}
                      disabled={busy || submitted.current}
                      value={
                        g.products.every(
                          p => channels[p.id] === channels[g.products[0].id],
                        )
                          ? channels[g.products[0].id]
                          : ''
                      }
                      onChange={e => {
                        const c = e.target.value;
                        change(() => {
                          setChannels(v => ({
                            ...v,
                            ...Object.fromEntries(
                              g.products.map(p => [p.id, c]),
                            ),
                          }));
                          setMethods(v => ({
                            ...v,
                            ...Object.fromEntries(
                              g.products.map(p => [
                                p.id,
                                c === 'meetup' ? 'meetup' : 'shipping',
                              ]),
                            ),
                          }));
                        });
                      }}
                    >
                      <option value="" disabled>{tr("請選擇共同交易方式")}</option>
                      {tr(g.options.map(o => (
                        <option key={o.channel} value={o.channel}>
                          {tr(channelLabel(o.channel))}
                        </option>
                      )))}
                    </select>
                  </label>
                ) : (
                  <p>{tr("這些商品沒有共同交易方式，請分別選擇，系統會分開建立訂單。")}</p>
                ))}
                <p>{tr("同賣家、同管道合併成一張訂單，運費取商品中最高的一筆。")}</p>
              </section>
            )))}
          {tr(products.map(p => (
            <section className="card" key={p.id}>
              {tr(!direct && (
                <label>
                  <input
                    type="checkbox"
                    checked={!!selected[p.id]}
                    disabled={busy || submitted.current}
                    onChange={e =>
                      change(() =>
                        setSelected(v => ({ ...v, [p.id]: e.target.checked })),
                      )
                    }
                  />{tr("選取商品")}</label>
              ))}
              <h2>{tr(p.title)}</h2>
              <p>{tr(currency(p.price))}{tr("· 數量 1")}</p>
              {tr(!p.allowMeetup && !p.allowShipping && (
                <p>{tr("賣家尚未設定交易方式，請先聯絡賣家。")}</p>
              ))}
              <label>{tr("交易方式")}<select
                  aria-label={tr("交易方式")}
                  disabled={busy || submitted.current}
                  value={channels[p.id] || ''}
                  onChange={e => {
                    const c = e.target.value;
                    change(() => {
                      setChannels(v => ({ ...v, [p.id]: c }));
                      setMethods(v => ({
                        ...v,
                        [p.id]: c === 'meetup' ? 'meetup' : 'shipping',
                      }));
                    });
                  }}
                >
                  {tr(!availableChannels(p).length && (
                    <option value="">{tr("賣家尚未設定")}</option>
                  ))}
                  {tr(availableChannels(p).map(o => (
                    <option key={o.channel} value={o.channel}>
                      {tr(channelLabel(o.channel))}
                      {tr(o.channel === 'meetup'
                        ? ''
                        : ` · 運費 ${currency(o.fee)}`)}
                    </option>
                  )))}
                </select>
              </label>
              <p>
                {tr(methods[p.id] === 'meetup'
                  ? `${p.location} ${p.meetupNote || ''}`
                  : `${p.shippingNote || ''} · 運費 ${currency(
                      availableChannels(p).find(
                        o => o.channel === channels[p.id],
                      )?.fee || 0,
                    )}`)}
              </p>
            </section>
          )))}
          {tr(shipping && (
            <section className="card">
              {tr((['name', 'phone', 'address'] as const)
                .filter(
                  k =>
                    k !== 'address' ||
                    chosen.some(
                      p =>
                        methods[p.id] === 'shipping' &&
                        !storeChannel(channels[p.id]),
                    ),
                )
                .map((key, i) => (
                  <label key={key}>
                    {tr(['收件人', '電話', '地址'][i])}
                    <input
                      required
                      disabled={busy || submitted.current}
                      value={recipient[key]}
                      onChange={e =>
                        change(() =>
                          setRecipient(v => ({ ...v, [key]: e.target.value })),
                        )
                      }
                    />
                  </label>
                )))}
            </section>
          ))}
          {tr([
            ...new Set(chosen.map(p => channels[p.id]).filter(storeChannel)),
          ].map(c => (
            <section className="card" key={c}>
              <h2>{tr(channelLabel(c))}{tr("取貨門市")}</h2>
              <p>{tr("請手動填寫並確認門市資料正確。")}</p>
              {tr((['name', 'code', 'address'] as const).map((k, i) => (
                <label key={k}>
                  {tr(['門市名稱', '門市店號', '門市地址'][i])}
                  <input
                    required
                    disabled={busy || submitted.current}
                    value={recipient.stores?.[c]?.[k] || ''}
                    onChange={e =>
                      change(() =>
                        setRecipient(v => ({
                          ...v,
                          stores: {
                            ...v.stores,
                            [c]: {
                              name: '',
                              code: '',
                              address: '',
                              ...v.stores?.[c],
                              [k]: e.target.value,
                            },
                          },
                        })),
                      )
                    }
                  />
                </label>
              )))}
            </section>
          )))}
          {tr(groups.map((g, i) => (
            <section className="card" key={i}>
              <h2>{tr("第")}{tr(i + 1)}{tr("筆請求 ·")}{tr(channelLabel(g.channel))}
              </h2>
              <p>{tr(g.items.map(p => p.title).join('、'))}</p>
              <p>{tr("商品")}{tr(currency(g.subtotal))}{tr("· 運費")}{tr(currency(g.fee))}{tr("· 合計")}{tr(' ')}
                {tr(currency(g.subtotal + g.fee))}
              </p>
            </section>
          )))}
          <p>{tr("同賣家同方式合單，寄送運費取同組最高一件。平台不代收付款、不提供物流保障；面交自行付款，寄送由賣家自行安排貨到付款。")}</p>
          <button
            className="button"
            type="submit"
            disabled={busy || loading || !chosen.length}
          >
            {tr(busy ? '正在送出…' : `送出 ${groups.length} 筆購買請求`)}
          </button>
          {tr(submitted.current && error && (
            <p>{tr("內容已鎖定以避免重複建立，請以相同內容重試；也可先到我的購買確認結果。")}</p>
          ))}
        </form>
      ))}
    </>
  );
}
export function WebMarketOrder() {
  const id = sessionStorage.getItem('sorti-order-id') || '';
  const [order, setOrder] = useState<data.MarketOrder | null>(null),
    [viewer, setViewer] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [form, setForm] = useState<TransactionAction | null>(null),
    [confirmation, setConfirmation] = useState<TransactionAction | null>(null),
    [values, setValues] = useState<Record<string, string>>({});
  const lock = useRef(false),
    generation = useRef(0);
  useEffect(() => {
    if (confirmation)
      document
        .querySelector('[aria-label="確認交易操作"]')
        ?.querySelector<HTMLButtonElement>('button')
        ?.focus();
  }, [confirmation]);
  const reload = useCallback(async () => {
    const g = ++generation.current;
    try {
      if (!id) throw new Error('請從我的交易選擇訂單。');
      const [o, u] = await Promise.all([
        data.loadMarketOrder(id),
        supabase.auth.getUser(),
      ]);
      if (g === generation.current) {
        setOrder(o);
        setViewer(u.data.user?.id || '');
      }
    } catch (e) {
      if (g === generation.current) setError(errorText(e));
    }
  }, [id]);
  useEffect(() => {
    void reload();
    const timer = setInterval(() => {
      if (!document.hidden && !lock.current) void reload();
    }, 10000);
    const visible = () => {
      if (!document.hidden) void reload();
    };
    document.addEventListener('visibilitychange', visible);
    const invalidate = () => {
      generation.current++;
    };
    return () => {
      invalidate();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [reload]);
  async function execute(
    action: TransactionAction,
    payload: Record<string, unknown> = {},
  ) {
    if (!order || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await data.actOnMarketOrder(order, action, payload);
      setForm(null);
      setValues({});
    } catch (e) {
      setError(errorText(e));
    } finally {
      await reload();
      lock.current = false;
      setBusy(false);
    }
  }
  function act(a: TransactionAction) {
    if (!order) return;
    if (['ship', 'open_issue', 'reject', 'request_cancel'].includes(a)) {
      setForm(a);
      setValues({});
      return;
    }
    setConfirmation(a);
  }
  function confirmAction() {
    if (!order || !confirmation || lock.current) return;
    const a = confirmation;
    setConfirmation(null);
    void execute(
      a,
      a === 'confirm_meetup'
        ? { proposal_version: order.meetup?.version }
        : a === 'resolve_issue'
        ? { issue_id: order.order_issues?.find(i => !i.resolved_at)?.id }
        : {},
    );
  }
  const fields =
    form === 'ship'
      ? [
          ['dispatched_at', '實際寄件日期', 'date'],
          ['carrier', '物流商（選填）', 'text'],
          ['tracking_number', '追蹤碼（選填）', 'text'],
          ['note', '備註（選填）', 'text'],
        ]
      : form === 'open_issue'
      ? [['details', '交易問題說明', 'text']]
      : [['reason', '原因', 'text']];
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = { ...values };
    try {
      if (form === 'ship') {
        const key = 'dispatched_at';
        payload[key] = shipmentDate(values[key] || '');
      }
      if (form) await execute(form, payload);
    } catch (err) {
      setError(errorText(err));
    }
  }
  const button = (label: string, fn: () => void, secondary = false) => (
    <button
      className={'button' + (secondary ? ' secondary' : '')}
      disabled={busy}
      onClick={fn}
    >
      {tr(label)}
    </button>
  );
  return (
    <>
      <h1>{tr("訂單詳情")}</h1>
      {tr(button(
        '返回我的交易',
        () => {
          location.hash = 'market';
        },
        true,
      ))}
      {tr(error && (
        <p role="alert">
          {tr(error)}
          {tr(button(
            '重新載入',
            () => {
              setError('');
              void reload();
            },
            true,
          ))}
        </p>
      ))}
      {tr(!order && !error && <p role="status">{tr("正在載入…")}</p>)}
      {tr(confirmation &&
        createPortal(
          <div className="transaction-confirm-overlay">
            <section
              className="card transaction-confirm-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-label={tr("確認交易操作")}
            >
              <h2>
                {tr(confirmation === 'handover'
                  ? viewer === order?.seller_id
                    ? '確認交付商品'
                    : '確認收到商品'
                  : transactionActionLabels[confirmation])}
              </h2>
              <p>
                {tr(confirmation === 'handover' || confirmation === 'receive'
                  ? '請確認已實際交付／收到商品。此操作不代表平台驗證付款。'
                  : confirmation === 'accept'
                  ? '接受後將保留整筆商品，其他購買請求會失效。'
                  : '確定執行此操作？')}
              </p>
              {tr(button(
                confirmation === 'handover'
                  ? viewer === order?.seller_id
                    ? '確認已交付商品'
                    : '確認已收到商品'
                  : '確認' + transactionActionLabels[confirmation],
                confirmAction,
              ))}
              {tr(button('返回', () => setConfirmation(null), true))}
            </section>
          </div>,
          document.body,
        ))}
      {order && (
        <>
          <section className="card">
            <h2>
              {tr(order.workflow_version === 2
                ? transactionStatus(order)
                : data.orderStatusLabel[order.status] || order.status)}
            </h2>
            <p>
              {tr(order.workflow_version === 2
                ? transactionNext(order, viewer)
                : '既有訂單：交付方式未記錄，付款未經平台驗證。')}
            </p>
            <p>
              {tr(deliveryLabel(order.delivery_method))} ·{tr(' ')}
              {tr(new Date(order.created_at).toLocaleString('zh-TW'))}
            </p>
            {tr(order.decision_reason && <p>{tr(order.decision_reason)}</p>)}
          </section>
          {tr(order.workflow_version === 2 && (
            <section className="card">
              <h2>{tr("交易進度")}</h2>
              <ol className="transaction-progress" aria-label={tr("交易進度")}>
                {tr(transactionProgress(order).map(step => (
                  <li
                    key={step.label}
                    data-state={step.state}
                    aria-current={step.state === 'current' ? 'step' : undefined}
                  >
                    <span className="progress-dot" aria-hidden="true">
                      {tr(step.state === 'done' ? '✓' : '')}
                    </span>
                    <span>{tr(step.label)}</span>
                    <small>
                      {tr(step.state === 'done'
                        ? '已完成'
                        : step.state === 'current'
                        ? '目前階段'
                        : '尚未到達')}
                    </small>
                  </li>
                )))}
              </ol>
            </section>
          ))}
          {order.order_items.map(i => (
            <section className="card" key={i.listing_id}>
              {tr(i.image_path_snapshot && (
                <img
                  style={{
                    width: 100,
                    height: 100,
                    objectFit: 'cover',
                    borderRadius: 12,
                  }}
                  src={data.getPublicImageUrl(
                    'product-photos',
                    i.image_path_snapshot,
                  )}
                  alt={tr(i.title_snapshot)}
                />
              ))}
              <h2>{tr(i.title_snapshot)}</h2>
              <p>
                {tr(currency(Number(i.price_snapshot)))}{tr("· 數量 1 ·")}{tr(' ')}
                {tr(i.condition_snapshot || '狀況未記錄')}
              </p>
              <p>
                {i.delivery_terms_snapshot?.location}{tr(' ')}
                {tr(order.delivery_method === 'meetup'
                  ? i.delivery_terms_snapshot?.meetup_note
                  : i.delivery_terms_snapshot?.shipping_note)}
              </p>
              {tr(button(
                '查看商品',
                () => {
                  sessionStorage.setItem('sorti-product-id', i.listing_id);
                  location.hash = 'product';
                },
                true,
              ))}
              {button(
                '聯絡交易對象',
                () => {
                  data
                    .orderConversation(order, i.listing_id)
                    .then(c => {
                      sessionStorage.setItem(
                        'sorti-market-thread',
                        JSON.stringify({
                          id: c.id,
                          title: c.product.title,
                          role: viewer === order.seller_id ? 'seller' : 'buyer',
                          productId: c.product.id,
                          orderId: order.id,
                          since: order.accepted_at || undefined,
                        }),
                      );
                      location.hash = 'market-thread';
                    })
                    .catch(e => setError(errorText(e)));
                },
                true,
              )}
            </section>
          ))}
          <section className="card">
            <p>{tr("運費")}{tr(currency(Number(order.shipping_fee)))}{tr("· 合計")}{tr(' ')}
              {tr(currency(Number(order.total_amount)))}
            </p>
            {tr(order.delivery_method === 'shipping' && (
              <>
                <p>
                  {tr(order.recipient_name)} · {tr(order.recipient_phone)}
                </p>
                <p>{tr(order.shipping_address)}</p>
                <p>{tr("自行安排貨到付款；平台不核對付款。")}</p>
              </>
            ))}
          </section>
          {tr(order.delivery_method === 'meetup' &&
            order.status !== 'requested' && (
              <section className="card">
                <p>{tr("賣家交付：")}{tr(order.seller_handed_over_at ? '已確認' : '尚未確認')}
                </p>
                <p>{tr("買家收貨：")}{tr(order.buyer_received_at ? '已確認' : '尚未確認')}
                </p>
                {tr(order.workflow_version === 2 &&
                  ['accepted', 'fulfilling'].includes(order.status) &&
                  !(viewer === order.seller_id
                    ? order.seller_handed_over_at
                    : order.buyer_received_at) && (
                    <>
                      <button
                        className="button"
                        disabled={
                          busy ||
                          !transactionActions(order, viewer).includes(
                            'handover',
                          )
                        }
                        onClick={() => act('handover')}
                      >
                        {tr(viewer === order.seller_id
                          ? '我已交付商品'
                          : '我已收到商品')}
                      </button>
                      {tr(!transactionActions(order, viewer).includes(
                        'handover',
                      ) && <p>{tr(transactionNext(order, viewer))}</p>)}
                    </>
                  ))}
              </section>
            ))}
          {tr(order.delivery_method === 'shipping' && (
            <section className="card">
              <h2>{tr("寄送管道：")}{tr(channelLabel(order.shipping_channel))}</h2>
              {tr(order.pickup_store && (
                <p>{tr("取貨門市：")}{tr(order.pickup_store.name)}{tr("· 店號")}{tr(' ')}
                  {tr(order.pickup_store.code)}
                </p>
              ))}
            </section>
          ))}
          {tr(order.shipment && (
            <section className="card">
              <h2>{tr("賣家填寫的寄件資訊")}</h2>
              <p>{tr("非物流商驗證狀態")}</p>
              <p>
                {tr(order.shipment.carrier || '未填物流商')} ·{tr(' ')}
                {tr(new Date(order.shipment.dispatched_at).toLocaleDateString(
                  'zh-TW',
                ))}
              </p>
              <p>{tr("追蹤碼：")}{tr(order.shipment.tracking_number || '未提供')}</p>
              <p>{tr(order.shipment.note)}</p>
            </section>
          ))}
          {order.order_issues?.map(i => (
            <section className="card" key={i.id}>
              <p>
                {tr(i.resolved_at ? '已共同解決' : '待協調問題')}：{tr(i.details)}
              </p>
              <p>{tr("平台目前未提供仲裁或退款服務。")}</p>
            </section>
          ))}
          {tr((order.workflow_version === 2
            ? transactionActions(order, viewer).filter(a => a !== 'handover')
            : data.orderActions(
                viewer === order.seller_id ? 'seller' : 'buyer',
                order.status,
              )
          ).length > 0 && (
            <section className="card market-actions">
              {tr(order.workflow_version === 2
                ? transactionActions(order, viewer)
                    .filter(a => !['handover'].includes(a))
                    .map(a => (
                      <React.Fragment key={a}>
                        {tr(button(
                          a === 'handover'
                            ? viewer === order.seller_id
                              ? '我已交付商品'
                              : '我已收到商品'
                            : transactionActionLabels[a],
                          () => act(a),
                          ['open_issue', 'request_cancel', 'reject'].includes(
                            a,
                          ),
                        ))}
                      </React.Fragment>
                    ))
                : data
                    .orderActions(
                      viewer === order.seller_id ? 'seller' : 'buyer',
                      order.status,
                    )
                    .map(a => (
                      <React.Fragment key={a}>
                        {tr(button(data.orderActionLabel[a], () => {
                          if (window.confirm('請確認操作符合實際交易情況。'))
                            data
                              .transitionMarketOrder(order.id, a)
                              .then(reload)
                              .catch(e => setError(errorText(e)));
                        }))}
                      </React.Fragment>
                    )))}
            </section>
          ))}
          {tr(form && (
            <form className="card transaction-action-form" onSubmit={submit}>
              <h2>{tr(transactionActionLabels[form])}</h2>
              {tr(fields.map(([key, label, type]) => (
                <label key={key}>
                  {tr(label)}
                  <input
                    disabled={busy}
                    type={type}
                    max={type === 'date' ? taipeiDay() : undefined}
                    onInvalid={e => {
                      if (type === 'date') {
                        e.preventDefault();
                        setError(
                          e.currentTarget.validity.rangeOverflow
                            ? '寄件日期不能晚於今天，請填寫已實際寄出的日期。'
                            : '請選擇有效寄件日期。',
                        );
                      }
                    }}
                    required={!label.includes('選填')}
                    value={values[key] || ''}
                    onChange={e =>
                      setValues(v => ({ ...v, [key]: e.target.value }))
                    }
                  />
                </label>
              )))}
              {tr(error && <p role="alert">{tr(error)}</p>)}
              <button
                className="button"
                type="submit"
                disabled={busy}
                aria-busy={busy}
              >
                {tr(busy
                  ? '正在送出，請稍候…'
                  : form === 'ship'
                  ? '確認已實際寄件並送出'
                  : '確認送出')}
              </button>
              {tr(button('返回修改', () => setForm(null), true))}
            </form>
          ))}
          {tr(!!order.order_events?.length && (
            <section className="card">
              <h2>{tr("交易紀錄")}</h2>
              {tr([...order.order_events]
                .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
                .map(e => (
                  <p key={e.id}>
                    {tr(new Date(e.occurred_at).toLocaleString('zh-TW'))} ·{tr(' ')}
                    {tr(transactionActionLabels[
                      e.event_type as TransactionAction
                    ] ||
                      data.orderStatusLabel[e.event_type] ||
                      e.event_type)}
                  </p>
                )))}
            </section>
          ))}
        </>
      )}
      {tr(busy && <p role="status">{tr("正在儲存…")}</p>)}
    </>
  );
}
