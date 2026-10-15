import {tr} from "../src/i18n/language";
import React from 'react';
import type { KnowledgeSource } from '../src/types/ai';
export function KnowledgeSources({ sources }: { sources: KnowledgeSource[] }) {
  if (!sources.length) return null;
  return (
    <details className="card knowledge-sources">
      <summary>{tr("參考整理技巧 · 查看來源")}</summary>
      <p className="muted">{tr("參考《怦然心動的人生整理魔法》作者官方公開的 KonMari 技巧摘要，搭配你的測驗偏好與空間條件。")}</p>
      <ul>
        {tr(sources.map(source => (
          <li key={source.title}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {tr(source.title)}
            </a>
            <small> · {tr(source.source_label)}</small>
          </li>
        )))}
      </ul>
    </details>
  );
}
