import {tr} from "../src/i18n/language";
import React from 'react';
import {
  deliveryChannels,
  channelLabel,
  type DeliveryOption,
} from '../src/services/deliveryChannels';
export function DeliveryOptions({
  value,
  onChange,
  disabled,
}: {
  value: DeliveryOption[];
  onChange: (v: DeliveryOption[]) => void;
  disabled: boolean;
}) {
  const update = (i: number, changes: Partial<DeliveryOption>) =>
    onChange(value.map((o, j) => (i === j ? { ...o, ...changes } : o)));
  return (
    <>
      {tr(value.map((o, i) => (
        <div key={i} className="card">
          <label>{tr("交易方式")}{tr(i + 1)}
            <select
              aria-label={tr(`交易方式 ${i + 1}`)}
              disabled={disabled}
              value={o.channel}
              onChange={e =>
                update(i, {
                  channel: e.target.value as DeliveryOption['channel'],
                  fee: e.target.value === 'meetup' ? 0 : o.fee,
                })
              }
            >
              {tr(deliveryChannels
                .filter(
                  c =>
                    c.id === o.channel || !value.some(v => v.channel === c.id),
                )
                .map(c => (
                  <option key={c.id} value={c.id}>
                    {tr(c.label)}
                  </option>
                )))}
            </select>
          </label>
          {tr(o.channel !== 'meetup' && (
            <label>
              {tr(channelLabel(o.channel))}{tr("運費（0 為免運）")}<input
                disabled={disabled}
                inputMode="numeric"
                value={Number.isNaN(o.fee) ? '' : o.fee}
                onChange={e =>
                  update(i, {
                    fee: e.target.value.trim() ? Number(e.target.value) : NaN,
                  })
                }
              />
            </label>
          ))}
          <label>{tr("說明（選填）")}<textarea
              disabled={disabled}
              value={o.note}
              onChange={e => update(i, { note: e.target.value })}
            />
          </label>
          <button
            className="button secondary"
            disabled={disabled}
            onClick={() => onChange(value.filter((_, j) => i !== j))}
          >{tr("移除這個方式")}</button>
        </div>
      )))}
      <button
        className="button secondary"
        disabled={disabled || value.length >= deliveryChannels.length}
        onClick={() => {
          const c = deliveryChannels.find(
            c => !value.some(o => o.channel === c.id),
          );
          if (c) onChange([...value, { channel: c.id, fee: 0, note: '' }]);
        }}
      >{tr("新增交易方式")}</button>
    </>
  );
}
