import {tr} from "../src/i18n/language";
import React, { useEffect, useRef, useState } from 'react';
import type { DetectionBox } from '../src/types/ai';

const clamp = (value: number, low = 0, high = 1) =>
  Math.min(high, Math.max(low, value));
export default function DetectionEditor({
  file,
  boxes,
  onChange,
  disabled,
}: {
  file: File;
  boxes: DetectionBox[];
  onChange: (boxes: DetectionBox[]) => void;
  disabled: boolean;
}) {
  const [url, setUrl] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<DetectionBox | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    mode: 'draw' | 'move' | 'resize';
    index: number;
    start: { x: number; y: number };
    original?: DetectionBox;
  } | null>(null);
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    setSelected(null);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  const point = (event: React.PointerEvent) => {
    const rect = stage.current!.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    };
  };
  const update = (index: number, patch: Partial<DetectionBox>) =>
    onChange(boxes.map((box, i) => (i === index ? { ...box, ...patch } : box)));
  const begin = (
    event: React.PointerEvent,
    mode: 'move' | 'resize',
    index: number,
  ) => {
    if (disabled || drawing) return;
    event.stopPropagation();
    event.preventDefault();
    setSelected(index);
    stage.current!.setPointerCapture(event.pointerId);
    gesture.current = {
      mode,
      index,
      start: point(event),
      original: { ...boxes[index] },
    };
  };
  const active = selected === null ? null : boxes[selected];
  return (
    <section className="detection-editor">
      <h3>{tr("照片框選與物品修正")}</h3>
      <p className="muted">{tr("點選框可修改名稱、分類或刪除；拖曳框移動，拖曳右下角調整大小。漏掉的物品可手動框選。")}</p>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={drawing}
        onClick={() => {
          setDrawing(!drawing);
          gesture.current = null;
          setDraft(null);
        }}
      >
        {tr(drawing ? '完成手動框選' : '手動框選新增物品')}
      </button>
      <div
        ref={stage}
        className={`detection-stage ${drawing ? 'drawing' : ''}`}
        data-testid="detection-stage"
        onPointerDown={event => {
          if (!drawing || disabled) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          gesture.current = {
            mode: 'draw',
            index: boxes.length,
            start: point(event),
          };
        }}
        onPointerMove={event => {
          const current = gesture.current;
          if (!current || disabled) return;
          const position = point(event);
          if (current.mode === 'draw') {
            setDraft({
              name: '未命名物品',
              category: '未分類',
              x: Math.min(current.start.x, position.x),
              y: Math.min(current.start.y, position.y),
              width: Math.abs(position.x - current.start.x),
              height: Math.abs(position.y - current.start.y),
            });
          } else if (current.original) {
            const box = current.original;
            update(
              current.index,
              current.mode === 'move'
                ? {
                    x: clamp(
                      box.x + position.x - current.start.x,
                      0,
                      1 - box.width,
                    ),
                    y: clamp(
                      box.y + position.y - current.start.y,
                      0,
                      1 - box.height,
                    ),
                  }
                : {
                    width: clamp(position.x - box.x, 0.01, 1 - box.x),
                    height: clamp(position.y - box.y, 0.01, 1 - box.y),
                  },
            );
          }
        }}
        onPointerUp={event => {
          const current = gesture.current;
          if (current?.mode === 'draw') {
            // Commit final pointer coordinates, independent of React's render timing.
            const position = point(event);
            const completed = {
              name: '未命名物品', category: '未分類',
              x: Math.min(current.start.x, position.x),
              y: Math.min(current.start.y, position.y),
              width: Math.abs(position.x - current.start.x),
              height: Math.abs(position.y - current.start.y),
            };
            if (completed.width >= 0.01 && completed.height >= 0.01) {
              onChange([...boxes, completed]);
              setSelected(boxes.length);
              setDrawing(false);
            }
          } else if (current?.original) {
            const position = point(event);
            const box = current.original;
            update(current.index, current.mode === 'move' ? {
              x: clamp(box.x + position.x - current.start.x, 0, 1 - box.width),
              y: clamp(box.y + position.y - current.start.y, 0, 1 - box.height),
            } : {
              width: clamp(position.x - box.x, 0.01, 1 - box.x),
              height: clamp(position.y - box.y, 0.01, 1 - box.y),
            });
          }
          gesture.current = null;
          setDraft(null);
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          gesture.current = null;
          setDraft(null);
        }}
      >
        <img src={url} alt={tr("可框選的辨識照片")} draggable={false} />
        {tr(boxes.map((box, index) => (
          <button
            type="button"
            key={index}
            disabled={disabled}
            className={`detection-box ${selected === index ? 'selected' : ''}`}
            aria-label={tr(`辨識框 ${index + 1}：${box.name}`)}
            aria-pressed={selected === index}
            style={{
              left: `${box.x * 100}%`,
              top: `${box.y * 100}%`,
              width: `${box.width * 100}%`,
              height: `${box.height * 100}%`,
            }}
            onClick={() => {
              if (!drawing) setSelected(index);
            }}
            onPointerDown={event => begin(event, 'move', index)}
          >
            <span className="detection-label">
              {tr(index + 1)}. {tr(box.name)}
            </span>
            {tr(selected === index && (
              <span
                className="detection-resize"
                onPointerDown={event => begin(event, 'resize', index)}
                aria-hidden="true"
              />
            ))}
          </button>
        )))}
        {tr(draft && (
          <div
            className="detection-box draft"
            style={{
              left: `${draft.x * 100}%`,
              top: `${draft.y * 100}%`,
              width: `${draft.width * 100}%`,
              height: `${draft.height * 100}%`,
            }}
          />
        ))}
      </div>
      {tr(active && selected !== null && (
        <fieldset disabled={disabled} className="detection-fields">
          <legend>{tr("修改物品")}{tr(selected + 1)}</legend>
          <label>{tr("物品名稱")}<input
              value={active.name}
              maxLength={60}
              onChange={event => update(selected, { name: event.target.value })}
            />
          </label>
          <label>{tr("物品分類")}<input
              value={active.category}
              maxLength={30}
              onChange={event =>
                update(selected, { category: event.target.value })
              }
            />
          </label>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              onChange(boxes.filter((_, index) => index !== selected));
              setSelected(null);
            }}
          >{tr("刪除此辨識框")}</button>
        </fieldset>
      ))}
    </section>
  );
}
