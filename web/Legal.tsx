import {
  usePolicyReview,
  setPolicyReviewed,
  resetPolicyReview,
} from '../src/services/legalReview';
import React, { useState, useEffect, type ReactNode } from 'react';
import policies from '../src/data/legalPolicies.json';
import * as data from './data.generated';
import { supabase } from './supabase';
export function legalNavigate(path: string) {
  history.pushState({ legal: true }, '', path);
  window.dispatchEvent(new Event('sorti:legal-navigation'));
}
export function LegalLinks() {
  return (
    <nav className="legal-links">
      <a
        href="/legal/terms"
        onClick={e => {
          e.preventDefault();
          legalNavigate('/legal/terms');
        }}
      >
        服務條款
      </a>
      <a
        href="/legal/privacy"
        onClick={e => {
          e.preventDefault();
          legalNavigate('/legal/privacy');
        }}
      >
        隱私權政策
      </a>
      <a
        href="/legal/contact"
        onClick={e => {
          e.preventDefault();
          legalNavigate('/legal/contact');
        }}
      >
        聯絡我們
      </a>
    </nav>
  );
}
export function LegalChecks({
  adult,
  agreed,
  setAdult,
  setAgreed,
}: {
  adult: boolean;
  agreed: boolean;
  setAdult: (v: boolean) => void;
  setAgreed: (v: boolean) => void;
}) {
  const review = usePolicyReview();
  useEffect(() => {
    resetPolicyReview();
  }, []);
  useEffect(() => {
    if (!review.terms || !review.privacy) setAgreed(false);
  }, [review.terms, review.privacy, setAgreed]);
  return (
    <section className="legal-checks" aria-label="使用確認">
      <label>
        <input
          type="checkbox"
          checked={adult}
          onChange={e => setAdult(e.target.checked)}
        />
        <span>我確認已年滿 18 歲。</span>
      </label>
      <div className="legal-agreement">
        <input
          aria-label="我同意服務條款，並已閱讀隱私權政策。"
          type="checkbox"
          checked={agreed}
          disabled={!review.terms || !review.privacy}
          onChange={e => {
            if (review.terms && review.privacy) setAgreed(e.target.checked);
          }}
        />
        <span>
          我同意{' '}
          <a
            href="/legal/terms"
            onClick={e => {
              e.preventDefault();
              legalNavigate('/legal/terms');
            }}
          >
            服務條款
          </a>
          ，並已閱讀{' '}
          <a
            href="/legal/privacy"
            onClick={e => {
              e.preventDefault();
              legalNavigate('/legal/privacy');
            }}
          >
            隱私權政策
          </a>
          。
        </span>
      </div>
      {(!review.terms || !review.privacy) && (
        <p className="muted legal-reading-required">
          請先開啟兩份文件，勾選後按「確認並返回」，再勾選同意。
        </p>
      )}
    </section>
  );
}

export function LegalGate({
  onAccepted,
  readError,
}: {
  onAccepted: () => void;
  readError?: string;
}) {
  const [adult, setAdult] = useState(false),
    [agreed, setAgreed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <main className="auth legal-gate">
      <h1>使用拾序前，請先確認</h1>
      <p className="muted">閱讀下方文件並完成確認，即可繼續。</p>
      <LegalChecks {...{ adult, setAdult, agreed, setAgreed }} />
      {(error || readError) && (
        <p className="legal-error" role="alert">
          {error || readError}
        </p>
      )}
      <button
        className="button"
        disabled={!adult || !agreed || busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await data.acceptLegalPolicies(adult, agreed);
            const { data: auth } = await supabase.auth.getSession();
            if (auth.session) {
              const destination = await data.authenticatedStartScreen(
                auth.session.user.id,
              );
              location.hash = destination === 'Quiz' ? 'quiz' : 'home';
            }
            onAccepted();
          } catch (e) {
            setError(e instanceof Error ? e.message : '保存失敗，請重試。');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? '保存中…' : '確認並繼續'}
      </button>
      <button
        className="button secondary"
        onClick={async () => {
          const { error: e } = await supabase.auth.signOut();
          if (e) setError('登出失敗，請重試。');
        }}
      >
        登出帳號
      </button>
    </main>
  );
}
function Contact() {
  const [status, setStatus] = useState('');
  const email = 'amanda.pan1204@gmail.com';
  return (
    <>
      <h1>聯絡我們</h1>
      <p>
        如需服務協助、問題回報，或申請刪除帳號及個人資料，請寄信至
        amanda.pan1204@gmail.com。
      </p>
      <p>
        <a className="button secondary" href={'mailto:' + email}>
          開啟郵件程式
        </a>
      </p>
      <input
        aria-label="聯絡信箱"
        value={email}
        readOnly
        onFocus={e => e.target.select()}
      />
      <button
        className="button secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(email);
            setStatus('已複製 Email 地址。');
          } catch {
            setStatus('無法自動複製，請選取上方信箱自行複製。');
          }
        }}
      >
        複製 Email 地址
      </button>
      <p>
        請自行填寫並確認郵件內容；請勿提供密碼或非必要證件。帳號及資料刪除由團隊人工受理，開啟郵件或複製信箱不代表申請已送出。無法開啟郵件程式時，請複製信箱後自行寄信。處理方式及保存期限請見隱私權政策。
      </p>
      <p role="status">{status}</p>
      <LegalLinks />
    </>
  );
}
export function LegalRouter({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const change = () => setPath(location.pathname);
    window.addEventListener('popstate', change);
    window.addEventListener('sorti:legal-navigation', change);
    return () => {
      window.removeEventListener('popstate', change);
      window.removeEventListener('sorti:legal-navigation', change);
    };
  }, []);
  const legal = ['/legal/terms', '/legal/privacy', '/legal/contact'].includes(
    path,
  );
  const doc = path === '/legal/privacy' ? policies.privacy : policies.terms;
  const kind = path === '/legal/privacy' ? 'privacy' : 'terms';
  const review = usePolicyReview();
  const [readingChecked, setReadingChecked] = useState(false);
  useEffect(() => {
    setReadingChecked(false);
  }, [path]);
  const bottom = React.useRef<HTMLElement>(null);
  function back() {
    if (history.state?.legal) history.back();
    else {
      history.replaceState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }
  useEffect(() => {
    if (legal) window.scrollTo(0, 0);
  }, [path, legal]);
  return (
    <>
      <div hidden={legal}>{children}</div>
      {legal && (
        <main className="legal-page">
          <button
            className="legal-back"
            onClick={() => {
              if (history.state?.legal) history.back();
              else {
                history.replaceState(null, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }
            }}
          >
            ‹ 返回
          </button>
          {path === '/legal/contact' ? (
            <Contact />
          ) : (
            <>
              <h1>{doc.title} v1.1</h1>
              {doc.blocks.map((b, i) =>
                /^[一二三四五六七八九十]+、/.test(b) ? (
                  <h2 key={i}>{b}</h2>
                ) : (
                  <p key={i}>
                    {b.split(/(https?:\/\/[^\s，。；）]+)/g).map((part, j) =>
                      part.startsWith('http') ? (
                        <a
                          key={j}
                          href={part}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {part}
                        </a>
                      ) : (
                        part
                      ),
                    )}
                  </p>
                ),
              )}
              <section
                ref={bottom}
                className="policy-review"
                aria-label="文件閱讀確認"
              >
                <label>
                  <input
                    type="checkbox"
                    checked={readingChecked}
                    onChange={e => setReadingChecked(e.target.checked)}
                  />
                  {kind === 'terms'
                    ? '我已閱讀並同意服務條款'
                    : '我已閱讀隱私權政策'}
                </label>
                <button
                  className="button"
                  disabled={!readingChecked}
                  onClick={() => {
                    if (!readingChecked) return;
                    setPolicyReviewed(kind, true);
                    back();
                  }}
                >
                  確認並返回
                </button>
              </section>
              <button
                className="button legal-jump-fixed"
                onClick={() =>
                  bottom.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  })
                }
              >
                滑到底部 ↓
              </button>
            </>
          )}
        </main>
      )}
    </>
  );
}
