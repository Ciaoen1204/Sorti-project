import {tr} from "../src/i18n/language";
import React, { useEffect, useRef } from 'react';
import { storagePersona } from '../src/data/storagePersonas';
export function PersonaDetails({
  open,
  identity,
  close,
  quiz,
}: {
  open: boolean;
  identity: string;
  close: () => void;
  quiz: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const persona = storagePersona(identity);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    else if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="persona-dialog"
      aria-label={tr("整理偏好特質")}
      onCancel={close}
      onClose={() => {
        close();
        document
          .getElementById('persona-badge')
          ?.focus({ preventScroll: true });
      }}
      onClick={event => {
        if (event.target === ref.current) close();
      }}
    >
      <h2>{tr(persona?.name || '尚未設定整理偏好')}</h2>
      {tr(persona ? (
        <>
          <p className="persona-axes">
            {tr(persona.vLabel)}
            <br />
            {tr(persona.dLabel)}
          </p>
          <h3>{tr("你的整理特質")}</h3>
          <p>{tr(persona.feature)}</p>
          <p className="muted">{tr(persona.desc)}</p>
        </>
      ) : (
        <p>{tr("完成收納測驗，就能查看你的整理人格與特質。")}</p>
      ))}
      <button
        className="button"
        onClick={() => {
          close();
          quiz();
        }}
      >
        {tr(persona ? '重新測驗整理偏好' : '開始收納測驗')}
      </button>
      <button className="button secondary" onClick={close}>{tr("關閉")}</button>
    </dialog>
  );
}
