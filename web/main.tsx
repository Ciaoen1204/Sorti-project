import FirstPermissions from './FirstPermissions';
import {LegalRouter,LegalLinks,LegalChecks,LegalGate} from './Legal';
import {tr,useLanguage,initializeLanguage,getLanguage} from "../src/i18n/language";
import {chatPresentation, chatHistory} from '../src/services/chatPresentation';
import DraggableAssistant from './DraggableAssistant';
import assistantBear from '../src/assets/images/sorti-logo.png';
import googleMark from '../src/assets/images/google-g.png';
import Notifications, { openNotifications } from './Notifications';
import { disableWebPush } from './push';
import { DeliveryOptions } from './DeliveryOptions';
import {
  availableChannels,
  channelLabel,
  deliverySummary,
  type DeliveryOption,
} from '../src/services/deliveryChannels';
import { transactionStatus } from '../src/services/marketplaceOrder';
import { WebMarketOrder, WebMarketCheckout } from './MarketTransaction';
import {
  itemConditions,
  validateDelivery,
  marketRequestId,
  deliveryLabel,
} from '../src/services/marketplaceOrder';
import type { KnowledgeSource } from '../src/types/ai';
import { PersonaDetails } from './PersonaDetails';
import React, {
  useCallback,
  useRef,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import DetectionEditor from './DetectionEditor';
import {
  advicePresentation,
  parseAdvice,
} from '../src/services/adviceSections';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { api, errorText, taipeiDate } from './api';
import * as data from './data.generated';
import {
  currency,
  listingCategories,
  marketSorts,
  priceRange,
  validateListing,
  productShareText,
} from '../src/services/marketplace';
import { useMarketPage } from '../src/services/useMarketPage';
import quiz from './quiz.generated.json';
import {
  AppBrand as Brand,
  AppIcon,
  AppMenu,
  AppNavigation,
} from './AppChrome';
import { appearance } from '../src/design/platformAppearance';
import { displayPersona } from '../src/design/personaLabel';
import {
  itemImportLabel,
  itemPlacementLabel,
} from '../src/services/inventoryDetails';
import { captureGuidance } from '../src/data/captureGuidance';
import { declutterOverview } from '../src/services/declutterOverview';
import './style.css';
import {
  appAbout,
  reminderDescription,
} from '../src/data/appSupport';
import {
  disposalAdvice,
  filterDisposalResources,
  guideCheckedAt,
  guideConditions,
  guideRegions,
  guideDistricts,
  guideMapUrl,
  guideLocation,
  addressMapUrl,
  inferGuideCategory,
  itemCategories,
} from '../src/data/disposalGuide';
import type {
  GuideCategory,
  GuideCondition,
  GuideKind,
} from '../src/data/disposalGuide';

const scenes = import.meta.glob('../src/assets/images/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
type Item = { name: string; category: string; count: number };
type Route =
  | 'home'
  | 'quiz'
  | 'daily'
  | 'analysis'
  | 'history'
  | 'chat'
  | 'items'
  | 'donation'
  | 'market'
  | 'seller-store'
  | 'product'
  | 'add-product'
  | 'edit-product'
  | 'cart'
  | 'checkout'
  | 'market-thread'
  | 'market-order'
  | 'settings'
  | 'profile';
type Result = {
  space_analysis?: import('../src/types/ai').SpaceAnalysis | null;
  space_notice?: string;
  ai_status?: 'completed' | 'unavailable';
  notice?: string;
  detected_items: Item[];
  total_detections: number;
  detection_boxes?: import('../src/types/ai').DetectionBox[];
};
let currentUserId = '';
function storageKey(key: string) {
  return `sorti_pwa:${currentUserId}:${key}`;
}
function read<T>(key: string, fallback: T): T {
  try {
    return (
      JSON.parse(localStorage.getItem(storageKey(key)) || 'null') ?? fallback
    );
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  localStorage.setItem(storageKey(key), JSON.stringify(value));
}
function to(route: Route) {
  location.hash = route;
  window.scrollTo(0, 0);
}
function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      className={secondary ? 'button secondary' : 'button'}
      disabled={disabled}
      onClick={onClick}
    >
      {tr(children)}
    </button>
  );
}
function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <p className="error" role="alert">
      {tr(error)}
    </p>
  ) : null;
}
function useLoad<T>(loader: () => Promise<T>, initial: T) {
  const [load] = useState(() => loader);
  const [value, setValue] = useState(initial),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true),
    [version, refresh] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError('');
    load()
      .then(v => {
        if (active) setValue(v);
      })
      .catch(e => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [load, version]);
  const retry = useCallback(() => refresh(v => v + 1), []);
  return { value, setValue, error, busy, retry };
}
function LoadState({
  busy,
  error,
  retry,
}: {
  busy: boolean;
  error: string;
  retry: () => void;
}) {
  return (
    <>
      {tr(busy && <p role="status">{tr("正在載入…")}</p>)}
      <ErrorMessage error={error} />
      {tr(error && (
        <Button secondary onClick={retry}>{tr("重新載入")}</Button>
      ))}
    </>
  );
}
function Auth({ onLogin }: { onLogin: () => void }) {
  const [adult,setAdult]=useState(false),[agreed,setAgreed]=useState(false);
  const [welcome, setWelcome] = useState(true);
  const [googleBusy, setGoogleBusy] = useState(false);
  useEffect(() => {
    const restore = () => setGoogleBusy(false);
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [showPassword, setShowPassword] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    const form = new FormData(event.currentTarget),
      email = String(form.get('email')).trim().toLowerCase(),
      password = String(form.get('password'));
    try {
      if(register&&(!adult||!agreed)) throw Error('請完成兩項使用確認。');
      if (register && password !== form.get('confirm'))
        throw Error('密碼與確認密碼不一致。');
      const response = register
        ? await data.registerWithLegalConfirmation(email,password,{display_name:String(form.get('name')).trim(),username:String(form.get('username')).trim()},adult,agreed)
        : await supabase.auth.signInWithPassword({ email, password });
      if (response.error) throw response.error;
      if (response.data.session) onLogin();
      else setMessage('帳號已建立，請使用電子信箱與密碼登入。');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function googleLogin() {
    if (busy || googleBusy) return;
    setGoogleBusy(true);
    setError('');
    try {
      const url = await data.createGoogleLoginUrl(
        location.origin + '/?auth_callback=google',
      );
      location.assign(url);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setGoogleBusy(false);
    }
  }
  if (welcome)
    return (
      <main className="auth welcome">
        <div className="welcome-hero">
          <Brand />
          <h1>{tr("讓生活，回到喜歡的樣子")}</h1>
          <p className="muted">{tr("從整理一件物品，開始你的拾序生活")}</p>
        </div>
        <div className="welcome-actions">
          <Button
            onClick={() => {
              setRegister(false);
              setWelcome(false);
            }}
          >{tr("登入")}</Button>
          <Button
            secondary
            onClick={() => {
              setRegister(true);
              setWelcome(false);
            }}
          >{tr("註冊")}</Button>
        </div>
      </main>
    );
  return (
    <main className="auth">
      <div className="auth-header">
        <button
          type="button"
          className="auth-back"
          aria-label={tr("返回歡迎頁")}
          onClick={() => setWelcome(true)}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <Brand />
      </div>
      <h1>{tr(register ? '建立帳號' : '登入 拾序')}</h1>
      <p className="muted">{tr(register?'開始管理物品，為生活留出更多空間。':'登入後查看你的物品、任務與整理紀錄。')}</p>
      <form className="auth-form auth-clean" onSubmit={submit}>
        {register && (
          <>
            <label>{tr("姓名")}<div className="auth-input">
                
                <input
                  name="name"
                  autoComplete="name"
                  placeholder={tr("請輸入姓名")}
                  required
                />
              </div>
            </label>
            <label>{tr("使用者名稱")}<div className="auth-input">
                
                <input
                  name="username"
                  autoComplete="username"
                  placeholder={tr("請輸入使用者名稱")}
                  required
                />
              </div>
            </label>
          </>
        )}
        <label>{tr("電子信箱")}<div className="auth-input">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <path d="m3 6 9 7 9-7" />
            </svg>
            <input
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              placeholder="name@example.com"
              required
            />
          </div>
        </label>
        <label>{tr("密碼")}<div className="auth-input">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <rect x="4" y="10" width="16" height="11" rx="3" />
              <path d="M8 10V6a4 4 0 0 1 8 0v4" />
            </svg>
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={register ? 'new-password' : 'current-password'}
              placeholder={tr("請輸入密碼")}
              minLength={register ? 8 : undefined}
              required
            />
            <button
              type="button"
              className="auth-eye"
              aria-label={tr(showPassword ? '隱藏密碼' : '顯示密碼')}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(v => !v)}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
                {tr(showPassword && <path d="m3 3 18 18" />)}
              </svg>
            </button>
          </div>
        </label>
        {tr(register && (
          <>
            <p className="auth-password-note">{tr("✓ 密碼至少 8 個字元")}</p>
            <label>{tr("確認密碼")}<div className="auth-input">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
                <input
                  name="confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={tr("請再次輸入密碼")}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="auth-eye"
                  aria-label={tr(showPassword ? '隱藏確認密碼' : '顯示確認密碼')}
                  onClick={() => setShowPassword(v => !v)}
                >
                  {tr(' ')}
                  {tr(showPassword ? '隱藏' : '顯示')}{tr(' ')}
                </button>
              </div>
            </label>
          </>
        ))}
        <ErrorMessage error={error} />
        {tr(message && <p role="status">{tr(message)}</p>)}
        <Button type="submit" disabled={busy || (register&&(!adult||!agreed))}>
          {tr(busy ? '處理中…' : register ? '建立帳號' : '登入')}
        </Button>
        <div className="auth-divider">
          <span>{tr(register ? '或透過以下方式註冊' : '或透過以下方式登入')}</span>
        </div>
        <Button secondary disabled={busy || googleBusy} onClick={googleLogin}>
          <img src={googleMark} width={22} height={22} alt="" className="google-mark" />
          {tr(register ? '使用 Google 帳號註冊' : '使用 Google 帳號登入')}
        </Button>
        {register && <LegalChecks {...{adult,setAdult,agreed,setAgreed}}/>}
        <div className="auth-account-prompt">
          {tr(!register && <span>{tr("還沒註冊帳號嗎？")}</span>)}
          <button
            type="button"
            className="auth-account-link"
            onClick={() => {
              setRegister(!register);
              setError('');
              setMessage('');
            }}
          >
            {tr(register ? '已經有帳號了？前往登入' : '請先完成帳號註冊')}
          </button>
        </div>
      </form>
    </main>
  );
}
function Quiz() {
  const [intro, setIntro] = useState(true),
    [index, setIndex] = useState(0),
    [answers, setAnswers] = useState<number[]>([]),
    [result, setResult] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (intro)
    return (
      <>
        <h1>{tr("收納魔法學院")}</h1>
        <section className="card">
          <p>{tr("✦ 你收到一封來自神祕魔法學院的入學通知。")}</p>
          <p>{tr("✦ 在這裡，空間與秩序是一門至高無上的魔咒。通過七道神祕的空間試煉後，你將正式覺醒，解鎖屬於你的專屬收納魔法身分！")}</p>
          <p>{tr("✦ 準備好拿好你的魔杖，接受這場空間秩序的洗禮了嗎？")}</p>
          <Button onClick={() => setIntro(false)}>{tr("開啟入學試煉")}</Button>
        </section>
      </>
    );
  if (result) {
    const visual = answers.filter(
      (a, i) => quiz.questions[i].options[a].scores.visual === '豐富',
    ).length;
    const detail = answers.filter(
      (a, i) => quiz.questions[i].options[a].scores.detail === '詳盡',
    ).length;
    const key = `${visual > 3 ? '豐富' : '簡潔'}_${
      detail > 3 ? '詳盡' : '簡易'
    }` as keyof typeof quiz.academyResults;
    const identity = quiz.academyResults[key];
    async function save() {
      setBusy(true);
      setError('');
      try {
        await data.savePersona({
          personaName: identity.name,
          visualPreference: visual > 3 ? 'rich' : 'minimal',
          detailPreference: detail > 3 ? 'detailed' : 'simple',
          visualScore: Math.round((Math.max(visual, 7 - visual) / 7) * 100),
          detailScore: Math.round((Math.max(detail, 7 - detail) / 7) * 100),
        });
        write('persona', identity.name);
        to('home');
      } catch (e) {
        setError(errorText(e));
      } finally {
        setBusy(false);
      }
    }
    return (
      <>
        <h1>{tr("魔法身分覺醒")}</h1>
        <section className="card">
          <h2>{tr(identity.name)}</h2>
          <p>{tr(identity.vLabel)}</p>
          <p>{tr(identity.dLabel)}</p>
          <h3>{tr("核心特徵")}</h3>
          <p>{tr(identity.feature)}</p>
          <h3>{tr("試煉鑑定結果")}</h3>
          <p>{tr(identity.desc)}</p>
          <ErrorMessage error={error} />
          <Button disabled={busy} onClick={save}>
            {tr(busy ? '儲存中…' : '進入魔法空間')}
          </Button>
        </section>
      </>
    );
  }
  const question = quiz.questions[index];
  return (
    <>
      <div className="row">
        <h1>{tr("試煉")}{tr(index + 1)}</h1>
        <span className="muted">{tr(index + 1)} / 7</span>
      </div>
      <progress value={index + 1} max={7} />
      <section className="card scene-card">
        <img
          className="scene"
          src={scenes[`../src/assets/images/${question.image}`]}
          alt={tr(`第 ${index + 1} 題情境圖`)}
        />
        <div className="inset">
          <h2>{tr(question.question)}</h2>
          {tr(question.options.map((option, i) => (
            <button
              key={option.text}
              className="choice"
              onClick={() => {
                const next = [...answers];
                next[index] = i;
                setAnswers(next);
                if (index === 6) setResult(true);
                else setIndex(index + 1);
              }}
            >
              {tr(option.text)}
            </button>
          )))}
        </div>
      </section>
      {tr(index > 0 && (
        <Button secondary onClick={() => setIndex(index - 1)}>{tr("上一關")}</Button>
      ))}
    </>
  );
}
async function normalizePhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw Error('請選擇照片檔案。');
  if (file.size > 25 * 1024 * 1024)
    throw Error('照片過大，請選擇小於 25 MB 的照片。');
  const uri = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = uri;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw Error('無法讀取照片，請重新拍攝。');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        v => (v ? resolve(v) : reject(Error('照片處理失敗。'))),
        'image/jpeg',
        0.85,
      ),
    );
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  } catch {
    throw Error('無法讀取這張照片，請重新拍攝或選擇 JPEG／PNG 照片。');
  } finally {
    URL.revokeObjectURL(uri);
  }
}
function PhotoPicker({
  file,
  onChange,
  disabled,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled: boolean;
}) {
  const [preview, setPreview] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      onChange(await normalizePhoto(selected));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="photo-picker">
      {tr(preview && (
        <img className="preview" src={preview} alt={tr("待提交的照片預覽")} />
      ))}
      <div className="row wrap">
        <label className={`button ${disabled || busy ? 'disabled' : ''}`}>
          {tr(file ? '重新拍攝' : '拍攝照片')}
          <input
            aria-label={tr("拍攝照片")}
            type="file"
            accept="image/*"
            capture="environment"
            disabled={disabled || busy}
            onChange={choose}
          />
        </label>
        <label
          className={`button secondary ${disabled || busy ? 'disabled' : ''}`}
        >{tr("從相簿選擇")}<input
            aria-label={tr("從相簿選擇")}
            type="file"
            accept="image/*"
            disabled={disabled || busy}
            onChange={choose}
          />
        </label>
      </div>
      {tr(busy && <p role="status">{tr("正在處理照片…")}</p>)}
      <ErrorMessage error={error} />
    </div>
  );
}
type Task = {
  date: string;
  tasks: string[];
  task: string;
  feedback?: string;
  completedTask?: string;
};
function CheckInCalendar({
  date,
  records,
}: {
  date: string;
  records: Record<string, string>;
}) {
  const [month, setMonth] = useState(date.slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  const [year, number] = month.split('-').map(Number);
  const first = new Date(year, number - 1, 1).getDay();
  const days = new Date(year, number, 0).getDate();
  function shift(offset: number) {
    const next = new Date(year, number - 1 + offset, 1);
    setMonth(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`,
    );
    setSelected(null);
  }
  const savedTask = selected
    ? read<Task | null>('task:' + selected, null)
    : null;
  return (
    <section className="card" aria-label={tr("打卡日曆")}>
      <div className="row">
        <Button secondary onClick={() => shift(-1)}>{tr("上個月")}</Button>
        <h3>{tr(month)}</h3>
        <Button secondary onClick={() => shift(1)}>{tr("下個月")}</Button>
      </div>
      <div className="check-in-calendar">
        {tr(['日', '一', '二', '三', '四', '五', '六'].map(day => (
          <span key={day}>{tr(day)}</span>
        )))}
        {tr(Array.from({ length: first }, (_, i) => (
          <span key={`empty-${i}`} />
        )))}
        {tr(Array.from({ length: days }, (_, i) => {
          const key = `${month}-${String(i + 1).padStart(2, '0')}`;
          return (
            <button
              key={key}
              aria-label={tr(`${key}${records[key] ? ' 已打卡' : ''}`)}
              aria-current={key === date ? 'date' : undefined}
              disabled={!records[key]}
              onClick={() => setSelected(key)}
            >
              <span className="calendar-day-number">{tr(i + 1)}</span>
              {tr(records[key] && <span className="calendar-day-mark">✓</span>)}
            </button>
          );
        }))}
      </div>
      <p className="muted">{tr("只有今天可以完成任務；點選已打卡日期查看照片與回饋。")}</p>
      {tr(selected && records[selected] && (
        <div className="feedback">
          <h3>{tr(selected)}{tr("打卡紀錄")}</h3>
          <img
            className="preview"
            src={records[selected]}
            alt={tr(`${selected} 打卡照片`)}
          />
          {tr(savedTask?.completedTask && <p>{tr(savedTask.completedTask)}</p>)}
          {tr(savedTask?.feedback && <p>{tr(savedTask.feedback)}</p>)}
          <Button secondary onClick={() => setSelected(null)}>{tr("關閉紀錄")}</Button>
        </div>
      ))}
    </section>
  );
}
function Daily({ date }: { date: string }) {
  const [saved] = useState(() => read<Task | null>('task:' + date, null));
  const [task, setTask] = useState<Task | null>(saved),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [file, setFile] = useState<File | null>(null);
  const records = useLoad(
    data.loadRemoteCheckIns,
    {} as Record<string, string>,
  );
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api<{ date: string; tasks: string[] }>(
        '/daily-task',
        { date },
      );
      if (
        response.date !== date ||
        response.tasks.length !== 3 ||
        new Set(response.tasks).size !== 3
      )
        throw Error('任務格式錯誤，請重試。');
      const next = { ...response, task: response.tasks[0] };
      if (date !== taipeiDate())
        throw Error('日期已變更，請重新選擇今天的任務。');
      setTask(next);
      write('task:' + date, next);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [date]);
  useEffect(() => {
    if (!saved) load();
  }, [load, saved]);
  async function complete() {
    if (!task || !file || busy) return;
    setBusy(true);
    setError('');
    let uri = '';
    try {
      if (date !== taipeiDate()) throw Error('只能完成今天的任務。');
      const form = new FormData();
      form.append('date', date);
      form.append('task', task.task);
      form.append('image', file);
      const response = await api<{ feedback: string }>(
        '/daily-task/feedback',
        form,
      );
      if (date !== taipeiDate())
        throw Error('日期已變更，請重新取得今天的任務。');
      uri = URL.createObjectURL(file);
      await data.saveRemoteCheckIn(date, uri);
      const next = {
        ...task,
        completedTask: task.task,
        feedback: response.feedback,
      };
      write('task:' + date, next);
      setTask(next);
      setFile(null);
      records.retry();
    } catch (e) {
      setError(errorText(e));
    } finally {
      if (uri) URL.revokeObjectURL(uri);
      setBusy(false);
    }
  }
  const completed = task?.completedTask === task?.task && !!task?.feedback;
  return (
    <>
      <h1>{tr("每日任務")}</h1>
      <p className="muted">{tr(date)}{tr("· 只能完成今天的任務")}</p>
      <section className="card">
        <h2>{tr("選擇今日任務")}</h2>
        {tr(loading && <p role="status">{tr("正在產生任務…")}</p>)}
        {task?.tasks.map(choice => (
          <label
            className={`choice ${task.task === choice ? 'selected' : ''}`}
            key={choice}
          >
            <input
              type="radio"
              name="task"
              checked={task.task === choice}
              disabled={busy}
              onChange={() => {
                const next = { ...task, task: choice };
                setTask(next);
                write('task:' + date, next);
              }}
            />
            {tr(choice)}
          </label>
        ))}
        <ErrorMessage error={error} />
        {tr(!task && !loading && <Button onClick={load}>{tr("重新取得任務")}</Button>)}
        {tr(task && (
          <>
            <PhotoPicker file={file} onChange={setFile} disabled={busy} />
            <Button disabled={!file || busy} onClick={complete}>
              {tr(busy ? '正在取得回饋並儲存…' : '提交成果並取得回饋')}
            </Button>
            {tr(completed && (
              <div className="feedback">
                <h3>{tr("任務完成回饋")}</h3>
                <p>{tr(task.feedback)}</p>
              </div>
            ))}
          </>
        ))}
      </section>
      <h2>{tr("打卡紀錄")}</h2>
      <LoadState {...records} />
      <CheckInCalendar date={date} records={records.value} />
      <div className="gallery">
        {tr(Object.entries(records.value)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([day, image]) => (
            <figure key={day}>
              <a href={image} target="_blank" rel="noreferrer">
                <img src={image} alt={tr(`${day} 打卡照片`)} />
              </a>
              <figcaption>{tr(day)}</figcaption>
            </figure>
          )))}
      </div>
      {tr(!records.busy &&
        !records.error &&
        !Object.keys(records.value).length && (
          <p className="muted">{tr("完成第一個任務後，照片會顯示在這裡。")}</p>
        ))}
    </>
  );
}
function SpaceUnderstanding({
  space,
  notice,
}: {
  space?: import('../src/types/ai').SpaceAnalysis | null;
  notice?: string;
}) {
  if (!space && !notice) return null;
  return (
    <section className="card">
      <h2>{tr("空間分布")}</h2>
      {tr(notice && <p role="status">{tr(notice)}</p>)}
      {tr(space && (
        <>
          <h3>{tr(space.room_type)}</h3>
          <p>{tr(space.summary)}</p>
          <ol>
            {tr(space.regions.map(region => (
              <li key={region.id}>
                {tr(region.name)}：{tr(region.observation)}
              </li>
            )))}
          </ol>
          <h3>{tr("現有收納空間")}</h3>
          <ul>
            {tr(space.storage_units.map((unit, i) => (
              <li key={i}>
                {tr(unit.name)}：{tr(unit.observation)}
              </li>
            )))}
          </ul>
          <h3>{tr("動線與待確認資訊")}</h3>
          <ul>
            {tr(space.circulation.map((line, i) => (
              <li key={`flow-${i}`}>{tr(line)}</li>
            )))}
            {tr(space.limitations.map((line, i) => (
              <li key={`limit-${i}`}>{tr("待確認：")}{tr(line)}</li>
            )))}
          </ul>
        </>
      ))}
    </section>
  );
}
function Analysis() {
  const [showGuidance, setShowGuidance] = useState(
    () => !read('capture-intro-dismissed', false),
  );
  const [dontRemind, setDontRemind] = useState(false);
  const [preferenceNotes, setPreferenceNotes] = useState('');
  const [adviceNotice, setAdviceNotice] = useState('');
  const [generatingAdvice, setGeneratingAdvice] = useState(false);
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [result, setResult] = useState<Result | null>(null),
    [advice, setAdvice] = useState(''),
    [saved, setSaved] = useState(false);
  const [crops, setCrops] = useState<
    { name: string; category: string; photoUri: string }[]
  >([]);
  function updateBoxes(boxes: NonNullable<Result['detection_boxes']>) {
    const groups = new Map<string, Item>();
    for (const box of boxes) {
      const key = JSON.stringify([box.name, box.category]);
      const existing = groups.get(key);
      if (existing) existing.count += 1;
      else
        groups.set(key, { name: box.name, category: box.category, count: 1 });
    }
    setResult(previous =>
      previous
        ? {
            ...previous,
            detection_boxes: boxes,
            detected_items: [...groups.values()],
            total_detections: boxes.length,
          }
        : null,
    );
    setCrops([]);
    setAdvice('');
    setAdviceNotice('');
    setSaved(false);
    setError('');
  }
  async function refreshCrops() {
    if (!file || !result?.detection_boxes?.length) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('boxes', JSON.stringify(result.detection_boxes));
      const cropped = await api<{
        items: { name: string; category: string; photoUri: string }[];
      }>('/crop-items', form);
      if (cropped.items.length !== result.detection_boxes.length)
        throw Error('裁切圖片數量不完整，請重試。');
      setCrops(cropped.items);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }
  async function generateAdvice(detection: Result, display = true) {
    if (
      detection.detection_boxes?.some(
        box => !box.name.trim() || !box.category.trim(),
      )
    )
      throw Error('請先填寫每個物品的名稱與分類。');
    const profile = await data.loadStorageProfile();
    const response = await api<{
      reply: string;
      retrieved_titles?: string[];
      retrieved_sources?: KnowledgeSource[];
      notice?: string;
    }>('/chat', {
      space_analysis: detection.space_analysis
        ? { ...detection.space_analysis, overlay_uri: undefined }
        : undefined,
      storage_preferences: {
        visual_preference: profile?.visual_preference,
        detail_preference: profile?.detail_preference,
        notes: preferenceNotes,
      },
      message:
        '請依照片空間格局、現有收納櫃與動線，結合偏好和知識庫提供具體收納建議。',
      mode: 'photo_analysis',
      items: detection.detected_items,
      user_persona: profile?.persona_name || undefined,
    });
    if (display) {
      setAdvice(response.reply);
      setAdviceNotice(response.notice || '');
    }
    return response.reply;
  }
  async function refreshAdvice() {
    if (!result || busy) return;
    setBusy(true);
    setError('');
    setAdvice('');
    setAdviceNotice('');
    setGeneratingAdvice(true);
    try {
      if (
        result.detection_boxes?.some(
          box => !box.name.trim() || !box.category.trim(),
        )
      )
        throw Error('請先填寫每個物品的名稱與分類。');
      await generateAdvice(result);
    } catch (error) {
      setError(errorText(error));
    } finally {
      setGeneratingAdvice(false);
      setBusy(false);
    }
  }
  async function analyze() {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    setAdvice('');
    setSaved(false);
    setCrops([]);
    setAdviceNotice('');
    try {
      const form = new FormData();
      form.append('image', file);
      const detection = await api<Result>('/detect', form);
      setResult(detection);
      if (detection.detected_items.length) {
        if (!detection.detection_boxes?.length)
          throw Error('沒有取得物品位置，無法裁切。請重新分析照片。');
        const cropForm = new FormData();
        cropForm.append('image', file);
        cropForm.append('boxes', JSON.stringify(detection.detection_boxes));
        const cropped = await api<{
          items: { name: string; category: string; photoUri: string }[];
        }>('/crop-items', cropForm);
        if (cropped.items.length !== detection.detection_boxes.length)
          throw Error('裁切圖片數量不完整，請重新分析。');
        setCrops(cropped.items);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!file || !result) return;
    setBusy(true);
    setError('');
    const uri = URL.createObjectURL(file);
    try {
      if (
        result.detection_boxes?.some(
          box => !box.name.trim() || !box.category.trim(),
        )
      )
        throw Error('請先填寫每個物品的名稱與分類。');
      if (result.detected_items.length && !result.detection_boxes?.length)
        throw Error('沒有取得物品位置，無法裁切。請重新分析照片。');
      let itemPhotos = crops;
      if (result.detected_items.length && !itemPhotos.length) {
        const form = new FormData();
        form.append('image', file);
        form.append('boxes', JSON.stringify(result.detection_boxes));
        itemPhotos = (
          await api<{
            items: { name: string; category: string; photoUri: string }[];
          }>('/crop-items', form)
        ).items;
        setCrops(itemPhotos);
      }
      if (itemPhotos.length !== (result.detection_boxes?.length || 0))
        throw Error('裁切圖片數量不完整，請重新分析。');
      await data.saveRemoteAnalysis({
        itemPhotos,
        photoUri: uri,
        detectedItems: result.detected_items,
        adviceText: advice,
        summary: `辨識 ${result.total_detections} 個物件`,
      });
      setSaved(true);
      to(result.detected_items.length ? 'items' : 'history');
    } catch (e) {
      setError(errorText(e));
    } finally {
      URL.revokeObjectURL(uri);
      setBusy(false);
    }
  }
  return (
    <>
      <h1>{tr("空間分析")}</h1>
      {tr(showGuidance && (
        <section className="card" aria-label={tr("拍攝前注意事項")}>
          <h2>{tr("拍攝前注意事項")}</h2>
          <ul>
            {tr(captureGuidance.map(tip => (
              <li key={tip}>{tr(tip)}</li>
            )))}
          </ul>
          <label className="choice">
            <input
              type="checkbox"
              checked={dontRemind}
              onChange={e => setDontRemind(e.target.checked)}
            />{tr("以後不再提醒")}</label>
          <Button
            secondary
            onClick={() => {
              if (dontRemind) write('capture-intro-dismissed', true);
              setShowGuidance(false);
            }}
          >{tr("了解，開始選擇照片")}</Button>
        </section>
      ))}
      <section className="card">
        <p>{tr("先確認空間分區與辨識物品，也可以手動框選新增。完成確認後，按「產生建議」取得收納建議。")}</p>
        <label>{tr("收納需求與限制（選填）")}<textarea
            maxLength={500}
            value={preferenceNotes}
            disabled={busy}
            onChange={e => {
              setPreferenceNotes(e.target.value);
              setAdvice('');
              setAdviceNotice('');
              setSaved(false);
            }}
            placeholder={tr("例如：租屋不能鑽牆、常用物品要好拿、優先用現有櫃子")}
          />
        </label>
      </section>
      <section className="card">
        <p>{tr("拍攝光線充足的空間照片，取得物品分類與收納建議。")}</p>
        <PhotoPicker
          file={file}
          onChange={v => {
            if (v) setShowGuidance(false);
            setFile(v);
            setResult(null);
            setAdvice('');
            setSaved(false);
            setCrops([]);
            setAdviceNotice('');
          }}
          disabled={busy}
        />
        <Button disabled={!file || busy} onClick={analyze}>
          {tr(busy ? '處理中…' : '開始分析')}
        </Button>
        <ErrorMessage error={error} />
      </section>
      {result && (
        <section className="analysis-results">
          <SpaceUnderstanding
            space={result.space_analysis}
            notice={result.space_notice}
          />
          <section
            className="card object-review"
            aria-label={tr("照片框選與物品修正")}
          >
            {tr(result.ai_status === 'completed' && (
              <p className="muted">{tr("模型與 Gemini 輔助辨識完成，匯入前請確認物品。")}</p>
            ))}
            {tr(result.notice && <p role="status">{tr(result.notice)}</p>)}
            {tr(file && (
              <DetectionEditor
                file={file}
                boxes={result.detection_boxes ?? []}
                onChange={updateBoxes}
                disabled={busy}
              />
            ))}
            {tr(!!result.detection_boxes?.length && !crops.length && (
              <Button secondary disabled={busy} onClick={refreshCrops}>{tr("更新單件裁切預覽")}</Button>
            ))}
            {result.detected_items.length ? (
              <ul>
                {result.detected_items.map((item, i) => (
                  <li key={i}>
                    {item.name} · {tr(item.category)} · {tr(item.count)}{tr("件")}</li>
                ))}
              </ul>
            ) : (
              <p>{tr("沒有辨識到明確物品，可以靠近一點或換角度重拍。")}</p>
            )}
            {!!crops.length && (
              <>
                <h3>{tr("單件物品裁切預覽 ·")}{tr(crops.length)}{tr("件")}</h3>
                <div className="grid">
                  {crops.map((item, index) => (
                    <figure key={index} className="crop-preview">
                      <img
                        className="item-thumbnail"
                        src={item.photoUri}
                        alt={tr(`${item.name}裁切預覽 ${index + 1}`)}
                      />
                      <figcaption>{item.name}</figcaption>
                    </figure>
                  ))}
                </div>
                <p className="muted">{tr("按下匯入後，這些單件圖片會儲存到物品管理。")}</p>
              </>
            )}
          </section>
          <Button disabled={busy} onClick={refreshAdvice}>
            {tr(generatingAdvice
              ? '產生建議中…'
              : advice
              ? '重新產生建議'
              : '產生建議')}
          </Button>
          {tr(advice && (
            <>
              <h2>{tr("收納建議")}</h2>
              <section className="card" aria-label={tr("斷捨離")}>
                <h3>{tr("斷捨離")}</h3>
                <p>{tr(declutterOverview(result.detected_items, advice))}</p>
              </section>
              <AdviceContent text={advice} />
              {tr(adviceNotice && <p role="status">{tr(adviceNotice)}</p>)}
            </>
          ))}
          {tr(result.detected_items.length > 0 && (
            <Button disabled={busy || saved} onClick={save}>
              {tr(saved ? '已匯入物品管理' : '裁切物品並匯入物品管理')}
            </Button>
          ))}
          {tr(advice && result.detected_items.length === 0 && (
            <Button disabled={busy || saved} onClick={save}>
              {tr(saved ? '已儲存建議' : '儲存建議')}
            </Button>
          ))}
          <Button
            secondary
            disabled={busy}
            onClick={() => continueChat(result.detected_items)}
          >{tr("針對這些物品詢問 AI")}</Button>
          {tr(saved && (
            <Button secondary onClick={() => to('items')}>{tr("查看物品管理")}</Button>
          ))}
        </section>
      )}
    </>
  );
}
function continueChat(items: Item[]) {
  write('chat-context', items);
  to('chat');
}
function AdviceContent({ text, chat = false }: { text: string; chat?: boolean }) {
  const parsed = parseAdvice(text);
  return (
    <>
      <div className="advice-content">
        {parsed.mainAdvice ? (
          advicePresentation(parsed.mainAdvice).map((section, index) => (
            <section key={index} className="advice-section">
              {tr(section.title && <h3>{tr(section.title)}</h3>)}
              {section.blocks.map((block, blockIndex) =>
                block.kind === 'step' ? (
                  <article key={blockIndex} className="advice-step">
                    <div className="advice-step-header">
                      <span
                        className="advice-step-number"
                        aria-label={tr(`步驟 ${block.number}`)}
                      >
                        {tr(block.number)}
                      </span>
                      <h4>{block.title}</h4>
                    </div>
                    {tr(block.description && (
                      <p className="advice-step-description">
                        {tr(block.description)}
                      </p>
                    ))}
                  </article>
                ) : (
                  <p key={blockIndex} className="advice-note">
                    {block.text}
                  </p>
                ),
              )}
            </section>
          ))
        ) : (
          <p>{tr("這筆紀錄沒有儲存收納建議。")}</p>
        )}
      </div>
      {tr(!chat&&<section className="card advice-purchases" aria-label={tr("建議採購")}>
        <h3>{tr("建議採購")}</h3>
        {tr(parsed.purchaseItems.length ? (
          <ul>
            {tr(parsed.purchaseItems.map(item => (
              <li key={item}>{tr(item)}</li>
            )))}
          </ul>
        ) : (
          <p className="muted">{tr("目前沒有需要補充的收納用品。")}</p>
        ))}
      </section>)}
    </>
  );
}
function History() {
  const result = useLoad(
    data.loadRemoteAnalyses,
    [] as Awaited<ReturnType<typeof data.loadRemoteAnalyses>>,
  );
  return (
    <>
      <h1>{tr("整理紀錄")}</h1>
      <LoadState {...result} />
      {result.value.map(record => (
        <details className="card" key={record.id}>
          <summary>
            {tr(new Date(record.createdAt).toLocaleDateString('zh-TW'))} ·{tr(' ')}
            {tr(record.summary || '空間分析')}
          </summary>
          {tr(record.photoUri && (
            <img className="preview" src={record.photoUri} alt={tr("分析照片")} />
          ))}
          <h3>{tr("辨識到的物品")}</h3>
          {record.detectedItems.length ? (
            <ul>
              {record.detectedItems.map((item, i) => (
                <li key={i}>
                  {item.name} · {tr(item.category)} · {tr(item.count)}{tr("件")}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">{tr("這筆紀錄沒有物品明細。")}</p>
          )}
          <h3>{tr("收納建議")}</h3>
          <AdviceContent text={record.adviceText} />
          <Button secondary onClick={() => continueChat(record.detectedItems)}>{tr("針對這些物品詢問 AI")}</Button>
        </details>
      ))}
      {tr(!result.busy && !result.error && !result.value.length && (
        <p className="muted">{tr("還沒有紀錄。完成空間分析後可儲存在這裡。")}</p>
      ))}
    </>
  );
}
function ChatAdvice({text,interactive,onChoose,onCustomInput}:{text:string;interactive:boolean;onChoose:(question:string)=>void;onCustomInput:()=>void}) {
 const [expanded,setExpanded]=useState(false);const {body,questions,clarification}=chatPresentation(text);const hasSteps=advicePresentation(body).some(s=>s.blocks.some(b=>b.kind==='step'));const long=!hasSteps&&body.length>280;
 return <div className="chat-advice">
 {tr(long&&!expanded?<p>{tr(body.slice(0,160))}…</p>:<AdviceContent text={body} chat/>)}
 {tr(long&&<button className="chat-expand" onClick={()=>setExpanded(!expanded)}>{tr(expanded?'收合內容':'展開完整建議')}</button>)}
 {tr(interactive&&hasSteps&&<div className="chat-invitation"><p>{tr("哪一步有問題，或不適合你的情況？都可以問我。")}</p><button onPointerDown={e=>e.preventDefault()} onClick={onCustomInput}>{tr("提出問題")}</button></div>)}
 {tr(interactive&&clarification&&questions.length>0&&<div className="chat-questions"><small>{tr(clarification?'選擇符合你的情況，或自行輸入':'需要時再繼續')}</small>{tr(questions.map(q=><button key={q} onPointerDown={e=>e.preventDefault()} onClick={()=>onChoose(q)}>{tr(q)} →</button>))}<button onPointerDown={e=>e.preventDefault()} onClick={onCustomInput}>{tr("其他／自行輸入")}</button></div>)}
 </div>;
}
function Chat() {
  const historyRef=useRef<HTMLDivElement>(null);
  const inputRef=useRef<HTMLTextAreaElement>(null);
  const [followupContext,setFollowupContext]=useState('');
  useEffect(() => {
    const viewport=window.visualViewport;
    const sync=()=>{
      document.documentElement.style.setProperty('--chat-viewport-height',`${viewport?.height ?? window.innerHeight}px`);
      document.documentElement.style.setProperty('--chat-viewport-top',`${viewport?.offsetTop ?? 0}px`);
    };
    sync();
    viewport?.addEventListener('resize',sync);
    viewport?.addEventListener('scroll',sync);
    window.addEventListener('resize',sync);
    return ()=>{
      viewport?.removeEventListener('resize',sync);
      viewport?.removeEventListener('scroll',sync);
      window.removeEventListener('resize',sync);
      document.documentElement.style.removeProperty('--chat-viewport-height');
      document.documentElement.style.removeProperty('--chat-viewport-top');
    };
  },[]);

  const [context, setContext] = useState<Item[]>(() =>
    read('chat-context', []),
  );
  const result = useLoad(
    data.loadAiChatMessages,
    [] as Awaited<ReturnType<typeof data.loadAiChatMessages>>,
  );
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(()=>{historyRef.current?.scrollTo({top:historyRef.current.scrollHeight,behavior:'smooth'});},[result.value,busy]);
  async function send(event?: FormEvent, question?: string, replyContext?: string) {
    event?.preventDefault();
    const text = (question ?? message).trim();
    if (!text || busy) return;
    const contextForReply=replyContext || followupContext;
    setFollowupContext('');
    setBusy(true);
    setError('');
    try {
      await data.saveAiChatMessage('user', text, context);
      result.setValue(v => [
        ...v,
        { id: String(Date.now()), sender: 'user', text, createdAt: Date.now() },
      ]);
      setMessage('');
      const response = await api<{ reply: string }>('/chat', {
        message: text,
        language: getLanguage(),
        history: chatHistory(result.value,contextForReply),
        items: context,
        user_persona: read('persona', ''),
      });
      await data.saveAiChatMessage('assistant', response.reply, context);
      result.retry();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ai-messenger" aria-label={tr("收納助理聊天")}>
      <div className="ai-chat-status" role="status">{tr(busy?'正在回覆…':'步驟一次看清楚，有問題隨時問')}</div>
      {!!context.length && (
        <section className="card">
          <h2>{tr("這次詢問的物品")}</h2>
          <ul>
            {context.map((item, i) => (
              <li key={i}>
                {item.name} · {tr(item.category)} · {tr(item.count)}{tr("件")}</li>
            ))}
          </ul>
          <Button
            secondary
            onClick={() => {
              write('chat-context', []);
              setContext([]);
            }}
          >{tr("清除物品背景")}</Button>
        </section>
      )}
      <p className="ai-chat-persona">{tr("收納偏好：")}{tr(read('persona', '尚未設定'))}</p>
      <LoadState {...result} />
      <div className="messages ai-chat-history" ref={historyRef} role="log" aria-label={tr("對話紀錄")} aria-live="polite">
        {tr(!result.value.length&&!result.busy&&<p className="ai-chat-empty">{tr("想整理哪個角落？告訴我，我們一起開始。")}</p>)}
        {result.value.map((message,index) => (
          <div
            key={message.id}
            className={
              'bubble ' + (message.sender === 'user' ? 'user' : 'assistant')
            }
          >
            {message.sender==='user'?message.text:<ChatAdvice text={message.text} interactive={!busy&&index===result.value.length-1} onChoose={q=>{void send(undefined,q,message.text);}} onCustomInput={()=>{setFollowupContext(message.text);inputRef.current?.focus();}}/>}
            <small className="message-time">
              {tr(new Date(message.createdAt).toLocaleTimeString(getLanguage()==='en'?'en-US':'zh-TW', {
                hour: '2-digit',
                minute: '2-digit',
              }))}
            </small>
          </div>
        ))}
      </div>
      <ErrorMessage error={error} />
      <form className="ai-chat-composer" onSubmit={send}>
        <label>
          <span className="sr-only">{tr("你的問題")}</span>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={tr("哪一步有問題？直接問我")}
            ref={inputRef}
            rows={1}
            required
          />
        </label>
        <button className="ai-chat-send" onPointerDown={e => e.preventDefault()} type="submit" aria-label={tr("送出訊息")} disabled={busy || !message.trim()}><AppIcon name="arrow"/></button>
      </form>
    </section>
  );
}
function Items() {
  const result = useLoad(
    data.loadRemoteItems,
    [] as Awaited<ReturnType<typeof data.loadRemoteItems>>,
  );
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  const [status, setStatus] = useState('all');
  const [placement, setPlacement] = useState('全部');
  const [locationTarget, setLocationTarget] = useState<
    Awaited<ReturnType<typeof data.loadRemoteItems>>[number] | null
  >(null);
  const [location, setLocation] = useState('');
  const [adding, setAdding] = useState(false);
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [mutationError, setMutationError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<
    (typeof result.value)[number] | null
  >(null);
  const categories = [
    ...new Set([
      '文具',
      '3C',
      '書籍',
      '生活用品',
      '美妝',
      ...result.value.map(item => item.category),
    ]),
  ];
  const visible = result.value.filter(
    item =>
      (item.name + item.category + (item.storageLocation || ''))
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (category === '全部' || item.category === category) &&
      (status === 'all' || item.disposition === status) &&
      (placement === '全部' ||
        itemPlacementLabel(item.storageLocation) === placement),
  );
  async function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!locationTarget || mutationBusy) return;
    setMutationBusy(true);
    setMutationError('');
    try {
      const value = await data.setItemStorageLocation(
        locationTarget.id,
        location,
      );
      result.setValue(items =>
        items.map(item =>
          item.id === locationTarget.id
            ? { ...item, storageLocation: value }
            : item,
        ),
      );
      setLocationTarget(null);
    } catch (error) {
      setMutationError(errorText(error));
    } finally {
      setMutationBusy(false);
    }
  }
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutationBusy) return;
    const form = new FormData(event.currentTarget);
    setMutationBusy(true);
    setMutationError('');
    const uri = newPhoto ? URL.createObjectURL(newPhoto) : '';
    try {
      await data.createRemoteItem({
        name: String(form.get('name')),
        category: String(form.get('category')),
        quantity: Number(form.get('quantity')),
        photoUri: uri || undefined,
      });
      setAdding(false);
      setNewPhoto(null);
      setCategory('全部');
      setStatus('all');
      setPlacement('全部');
      setQuery('');
      result.retry();
    } catch (error) {
      setMutationError(errorText(error));
    } finally {
      if (uri) URL.revokeObjectURL(uri);
      setMutationBusy(false);
    }
  }
  async function remove() {
    if (!deleteTarget || mutationBusy) return;
    setMutationBusy(true);
    setMutationError('');
    try {
      await data.deleteRemoteItem(deleteTarget.id);
      result.setValue(items =>
        items.filter(item => item.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
    } catch (error) {
      setMutationError(errorText(error));
    } finally {
      setMutationBusy(false);
    }
  }
  async function changeStatus(
    item: (typeof result.value)[number],
    value: data.ItemDisposition,
  ) {
    setMutationBusy(true);
    setMutationError('');
    try {
      await data.setItemDisposition(item.id, value);
      result.setValue(items =>
        items.map(row =>
          row.id === item.id ? { ...row, disposition: value } : row,
        ),
      );
    } catch (error) {
      setMutationError(errorText(error));
    } finally {
      setMutationBusy(false);
    }
  }
  const [conditions, setConditions] = useState<Record<string, GuideCondition>>(
    {},
  );
  return (
    <>
      <div className="row">
        <h1>{tr("物品管理")}</h1>
        <Button
          disabled={mutationBusy}
          onClick={() => {
            setAdding(!adding);
            setMutationError('');
          }}
        >{tr("＋ 新增物品")}</Button>
      </div>
      <ErrorMessage error={mutationError} />
      <Button secondary onClick={() => to('analysis')}>{tr("拍照辨識並匯入物品")}</Button>
      {tr(locationTarget && (
        <section className="card" aria-label={tr("設定存放位置")}>
          <h2>{tr("設定存放位置：")}{tr(locationTarget.name)}</h2>
          <p className="muted">{tr("填入位置後標記為已定位；清空則回到待整理。")}</p>
          <form onSubmit={saveLocation}>
            <label>{tr("存放位置")}<input
                value={location}
                onChange={e => setLocation(e.target.value)}
                maxLength={100}
                disabled={mutationBusy}
                placeholder={tr("例如：主臥衣櫃上層")}
                autoFocus
              />
            </label>
            <div className="row">
              <Button type="submit" disabled={mutationBusy}>
                {tr(mutationBusy ? '儲存中…' : '儲存位置')}
              </Button>
              <Button
                secondary
                disabled={mutationBusy}
                onClick={() => setLocationTarget(null)}
              >{tr("取消設定位置")}</Button>
            </div>
          </form>
        </section>
      ))}
      {tr(adding && (
        <section className="card">
          <h2>{tr("新增物品")}</h2>
          <form className="item-create-form" onSubmit={add}>
            <label>{tr("物品名稱")}<input name="name" required maxLength={60} autoFocus />
            </label>
            <label>{tr("分類")}<input
                name="category"
                list="item-categories"
                defaultValue="生活用品"
                required
                maxLength={30}
              />
            </label>
            <datalist id="item-categories">
              {tr(categories.map(value => (
                <option key={value} value={value} />
              )))}
            </datalist>
            <label>{tr("數量")}<input
                name="quantity"
                type="number"
                min={1}
                max={9999}
                step={1}
                defaultValue={1}
                required
              />
            </label>
            <p className="muted">{tr("物品照片（選填）")}</p>
            <PhotoPicker
              file={newPhoto}
              onChange={setNewPhoto}
              disabled={mutationBusy}
            />
            <div className="item-create-actions">
              <Button type="submit" disabled={mutationBusy}>
                {tr(mutationBusy ? '儲存中…' : '儲存物品')}
              </Button>
              <Button
                secondary
                disabled={mutationBusy}
                onClick={() => {
                  setAdding(false);
                  setNewPhoto(null);
                }}
              >{tr("取消新增")}</Button>
            </div>
          </form>
        </section>
      ))}
      {tr(deleteTarget && (
        <dialog className="card inventory-delete-dialog" role="alertdialog" aria-label={tr("確認刪除物品")}
          ref={node => { if (node && !node.open) node.showModal(); }}
          onCancel={event => { event.preventDefault(); if (!mutationBusy) setDeleteTarget(null); }}>

          <h2>{tr("刪除「")}{tr(deleteTarget.name)}」？</h2>
          <p>{tr("將從物品管理移除，分析紀錄與已刊登商品會保留。")}</p>
          {mutationError && <p role="alert">{tr(mutationError)}</p>}
          <div className="row">
            <Button disabled={mutationBusy} onClick={remove}>
              {tr(mutationBusy ? '刪除中…' : '確認刪除')}
            </Button>
            <Button
              secondary
              disabled={mutationBusy}
              onClick={() => setDeleteTarget(null)}
            >{tr("取消刪除")}</Button>
          </div>
        </dialog>
      ))}
      <Button
        secondary
        onClick={() => {
          write('guide-category', '');
          to('donation');
        }}
      >{tr("捐贈與回收")}</Button>
      <label>{tr("搜尋物品")}<input
          value={query}
          onChange={e => setQuery(e.target.value)}
          type="search"
        />
      </label>
      <div className="inventory-tabs" aria-label={tr("物品分類")}>
        {tr(['全部', ...categories].map(value => (
          <button
            key={value}
            type="button"
            aria-pressed={category === value}
            onClick={() => setCategory(value)}
          >
            {tr(value)}
          </button>
        )))}
      </div>
      <label>{tr("篩選物品狀態")}<select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">{tr("全部狀態")}</option>
          {tr(Object.entries(data.itemDispositionLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {tr(label)}
            </option>
          )))}
        </select>
      </label>
      <div className="inventory-tabs" aria-label={tr("整理進度")}>
        {tr(['全部', '待整理', '已定位'].map(value => (
          <button
            key={value}
            type="button"
            aria-label={tr(`整理進度：${value}`)}
            aria-pressed={placement === value}
            onClick={() => setPlacement(value)}
          >
            {tr(value)}
          </button>
        )))}
      </div>
      <LoadState {...result} />
      {visible.map(item => (
        <article className="card inventory-card" key={item.id}>
          <div className="inventory-summary">
            {item.imageUri ? (
              <img
                className="item-thumbnail"
                src={item.imageUri}
                alt={tr(`${item.name}物品照片`)}
              />
            ) : (
              <div className="inventory-placeholder" aria-label={tr("尚未加入照片")}>{tr("物品")}</div>
            )}
            <div className="inventory-info">
              <h2>{item.name}</h2>
              <p>{tr("分類：")}{tr(item.category)} · {tr(item.quantity)}{tr("件")}</p>
            </div>
            <span className={`inventory-badge ${item.disposition}`}>
              {tr(data.itemDispositionLabels[item.disposition])}
            </span>
          </div>
          <p className="muted">
            {tr(itemPlacementLabel(item.storageLocation))}{tr("· 存放位置：")}{tr(item.storageLocation || '尚未指定')}
          </p>
          {tr(itemImportLabel(item.created_at, item.source) && (
            <p className="muted">
              {tr(itemImportLabel(item.created_at, item.source))}
            </p>
          ))}
          <Button
            secondary
            disabled={mutationBusy}
            onClick={() => {
              setLocationTarget(item);
              setLocation(item.storageLocation || '');
            }}
          >{tr("設定存放位置")}</Button>
          <div className="row">
            <label>{tr("管理狀態：")}{item.name}
              <select
                disabled={mutationBusy}
                value={item.disposition}
                onChange={e =>
                  changeStatus(item, e.target.value as data.ItemDisposition)
                }
              >
                {tr(Object.entries(data.itemDispositionLabels).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {tr(label)}
                    </option>
                  ),
                ))}
              </select>
            </label>
            <Button
              secondary
              disabled={mutationBusy}
              onClick={() => {
                setMutationError('');
                setDeleteTarget(item);
              }}
            >{tr("刪除物品")}</Button>
          </div>
          {tr(item.disposition === 'sell' && (
            <p className="muted">{tr("待售是管理標記，出售前請另外刊登商品。")}</p>
          ))}
          <label>{tr("物品狀況：")}{item.name}
            <select
              value={conditions[item.id] || 'unsure'}
              onChange={e =>
                setConditions({
                  ...conditions,
                  [item.id]: e.target.value as GuideCondition,
                })
              }
            >
              {tr(guideConditions.map(([value, label]) => (
                <option key={value} value={value}>
                  {tr(label)}
                </option>
              )))}
            </select>
          </label>
          <div className="market-actions">
            {conditions[item.id] === 'usable' && (
              <>
                <Button
                  secondary
                  onClick={() => {
                    write('listing-item-name', item.name);
                    write('listing-item-photo', item.imageUri || '');
                    write('listing-item-category', item.category || '其他');
                    to('add-product');
                  }}
                >{tr("出售")}</Button>
                <Button
                  secondary
                  onClick={() => {
                    write('guide-category', item.category + ' ' + item.name);
                    write('guide-condition', 'usable');
                    write('guide-kind', 'donation');
                    to('donation');
                  }}
                >{tr("捐贈")}</Button>
              </>
            )}
            <Button
              secondary
              onClick={() => {
                write('guide-category', item.category + ' ' + item.name);
                write('guide-condition', conditions[item.id] || 'unsure');
                write(
                  'guide-kind',
                  conditions[item.id] && conditions[item.id] !== 'unsure'
                    ? 'recycle'
                    : 'all',
                );
                to('donation');
              }}
            >
              {tr(conditions[item.id] && conditions[item.id] !== 'unsure'
                ? '回收／清運'
                : '查詢這件物品的處理管道')}
            </Button>
          </div>
        </article>
      ))}
      {tr(!result.busy &&
        !result.error &&
        !!result.value.length &&
        !visible.length && (
          <p className="muted">{tr("沒有符合搜尋或篩選條件的物品。")}</p>
        ))}
      {tr(!result.busy && !result.error && !result.value.length && (
        <section className="card">
          <p>{tr("尚未加入物品，可手動新增，或拍照分析後匯入。")}</p>
          <Button onClick={() => to('analysis')}>{tr("拍照分析")}</Button>
        </section>
      ))}
    </>
  );
}
function MarketImage({
  uri,
  title = '商品照片',
}: {
  uri: string;
  title?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return (
    <div className="market-photo">
      {tr(uri && !failed ? (
        <img
          src={uri}
          alt={tr(title)}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="market-photo-placeholder">
          <AppIcon name="camera" />
          <span>{tr("照片暫無法顯示")}</span>
        </div>
      ))}
    </div>
  );
}
function BuyerBrowse({
  select,
}: {
  select: (product: data.ProductRecord) => void;
}) {
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('全部');
  const [sort, setSort] = useState<data.ProductQuery['sort']>('newest');
  const [open, setOpen] = useState(false),
    [min, setMin] = useState(''),
    [max, setMax] = useState(''),
    [error, setError] = useState('');
  const [range, setRange] = useState<{ minPrice?: number; maxPrice?: number }>(
    {},
  );
  const result = useMarketPage(data.loadProducts, {
    query,
    category,
    sort,
    ...range,
  });
  return (
    <>
      <div className="market-search">
        <AppIcon name="search" />
        <input
          aria-label={tr("搜尋商品")}
          type="search"
          placeholder={tr("搜尋二手商品、品牌或關鍵字")}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {tr(!!query && (
          <button aria-label={tr("清除搜尋")} onClick={() => setQuery('')}>
            <AppIcon name="close" />
          </button>
        ))}
      </div>
      <div className="market-tabs" aria-label={tr("商品分類")}>
        {tr(['全部', ...listingCategories].map(c => (
          <button
            key={c}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {tr(c)}
          </button>
        )))}
      </div>
      <div className="market-browse-tools">
        <small>
          {marketSorts.find(([v]) => v === sort)?.[1]}
          {tr(range.minPrice !== undefined || range.maxPrice !== undefined
            ? ` · ${range.minPrice ?? 0}～${range.maxPrice ?? '不限'} 元`
            : '')}
        </small>
        <Button secondary onClick={() => setOpen(!open)}>{tr("篩選與排序")}</Button>
      </div>
      {tr(open && (
        <section className="card market-filters">
          <label>{tr("排序")}<select
              aria-label={tr("排序")}
              value={sort}
              onChange={e =>
                setSort(e.target.value as data.ProductQuery['sort'])
              }
            >
              {tr(marketSorts.map(([v, label]) => (
                <option value={v} key={v}>
                  {tr(label)}
                </option>
              )))}
            </select>
          </label>
          <div className="market-price-fields">
            <label>{tr("最低價格")}<input
                inputMode="decimal"
                value={min}
                onChange={e => setMin(e.target.value)}
                placeholder={tr("不限")}
              />
            </label>
            <label>{tr("最高價格")}<input
                inputMode="decimal"
                value={max}
                onChange={e => setMax(e.target.value)}
                placeholder={tr("不限")}
              />
            </label>
          </div>
          <ErrorMessage error={error} />
          <div className="market-actions">
            <Button
              onClick={() => {
                try {
                  setRange(priceRange(min, max));
                  setError('');
                } catch (e) {
                  setError(errorText(e));
                }
              }}
            >{tr("套用價格")}</Button>
            <Button
              secondary
              onClick={() => {
                setMin('');
                setMax('');
                setRange({});
                setCategory('全部');
                setSort('newest');
                setError('');
              }}
            >{tr("清除篩選")}</Button>
          </div>
        </section>
      ))}
      <div className="market-grid">
        {result.value.map(product => (
          <button
            key={product.id}
            className="market-product-card"
            onClick={() => select(product)}
          >
            <MarketImage uri={product.img} title={tr(product.title)} />
            <div className="market-product-info">
              <h3>{product.title}</h3>
              <strong>{tr(currency(product.price))}</strong>
              <small>
                {tr(product.condition || '狀況未填')} ·{tr(' ')}
                {tr(product.allowMeetup ? '面交 ' : '')}
                {tr(product.allowShipping ? '寄送' : '')}
              </small>
              <small>
                {tr([product.category, product.location]
                  .filter(Boolean)
                  .join(' · '))}
              </small>
            </div>
          </button>
        ))}
      </div>
      {tr(result.busy && (
        <p role="status" className="market-empty">{tr("正在搜尋商品…")}</p>
      ))}
      <ErrorMessage error={result.error} />
      {tr(result.error && (
        <Button secondary onClick={result.retry}>{tr("重新載入")}</Button>
      ))}
      {tr(!result.busy && !result.error && !result.value.length && (
        <section className="market-empty">
          <AppIcon name="search" />
          <h2>
            {tr(query || category !== '全部' || Object.keys(range).length
              ? '沒有符合條件的商品'
              : '目前沒有上架商品')}
          </h2>
          <p className="muted">
            {tr(query
              ? '試試其他關鍵字，或清除搜尋與篩選。'
              : '可以調整篩選條件，或刊登你的二手好物。')}
          </p>
        </section>
      ))}
      {tr(result.hasMore && !result.error && (
        <Button secondary disabled={result.busy} onClick={result.more}>{tr("載入更多商品")}</Button>
      ))}
    </>
  );
}
function DonationRecycling() {
  const [category, setCategory] = useState<GuideCategory>(() =>
    inferGuideCategory(read('guide-category', '')),
  );
  const [condition, setCondition] = useState<GuideCondition>(() => {
    const value = read<GuideCondition>('guide-condition', 'unsure');
    write('guide-condition', 'unsure');
    return value;
  });
  const [region, setRegion] = useState('全台');
  const [district, setDistrict] = useState('');
  const [includeOtherDistricts, setIncludeOtherDistricts] = useState(false);
  const [kind, setKind] = useState<GuideKind>(() => {
    const value = read<GuideKind>('guide-kind', 'all');
    write('guide-kind', 'all');
    return value;
  });
  const effectiveKind: GuideKind = condition === 'broken' ? 'recycle' : kind;
  const resources = filterDisposalResources(
    category,
    region,
    effectiveKind,
    district,
    includeOtherDistricts,
  );
  return (
    <>
      <h1>{tr("捐贈與回收")}</h1>
      <p className="muted">{tr("讓用不到的物品，找到下一個去處。")}</p>
      <section className="card guide-filters">
        <label>{tr("物品類別")}<select
            value={category}
            onChange={e => setCategory(e.target.value as GuideCategory)}
          >
            {tr(itemCategories.map(([value, label]) => (
              <option key={value} value={value}>
                {tr(label)}
              </option>
            )))}
          </select>
        </label>
        <label>{tr("物品狀況")}<select
            value={condition}
            onChange={e => {
              const value = e.target.value as GuideCondition;
              setCondition(value);
              setKind(value === 'broken' ? 'recycle' : 'all');
            }}
          >
            {tr(guideConditions.map(([value, label]) => (
              <option key={value} value={value}>
                {tr(label)}
              </option>
            )))}
          </select>
        </label>
        <label>{tr("所在地區")}<select
            value={region}
            onChange={e => {
              setRegion(e.target.value);
              setDistrict('');
              setIncludeOtherDistricts(false);
            }}
          >
            {tr(guideRegions.map(value => (
              <option key={value}>{tr(value)}</option>
            )))}
          </select>
        </label>
        <label>{tr("鄉鎮市區")}<select
            value={district}
            disabled={region === '全台'}
            onChange={e => setDistrict(e.target.value)}
          >
            <option value="">{tr("全部鄉鎮市區")}</option>
            {tr(guideDistricts(region).map(value => (
              <option key={value}>{tr(value)}</option>
            )))}
          </select>
        </label>
        {tr(district && (
          <label>
            <input
              type="checkbox"
              checked={includeOtherDistricts}
              onChange={e => setIncludeOtherDistricts(e.target.checked)}
            />{tr("也顯示同縣市其他區據點")}</label>
        ))}
        <a
          className="button secondary"
          href={guideMapUrl(region, district, category, effectiveKind)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {tr(condition === 'broken'
            ? '在地圖查附近回收／清運單位'
            : '在地圖查附近捐贈／回收單位')}
        </a>
        <small className="muted">{tr("地圖會搜尋所選地區周邊；結果由地圖提供，請另向單位確認接收條件。")}</small>
      </section>
      <section className="card">
        <h2>{tr("處理建議")}</h2>
        <p>{tr(disposalAdvice(category, condition))}</p>
        {tr(condition === 'usable' && (
          <Button
            secondary
            onClick={() => {
              to('add-product');
            }}
          >{tr("刊登二手商品")}</Button>
        ))}
      </section>
      <div className="market-tabs" aria-label={tr("管道類型")}>
        {tr((
          [
            ['all', '全部管道'],
            ['donation', '捐贈'],
            ['recycle', '回收／清運'],
          ] as const
        )
          .filter(([value]) => condition !== 'broken' || value === 'recycle')
          .map(([value, label]) => (
            <button
              key={value}
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
            >
              {tr(label)}
            </button>
          )))}
      </div>
      <p className="muted" role="status">{tr("共")}{tr(resources.length)}{tr("個資訊管道 · 區級據點、縣市與全台窗口分別標示")}</p>
      <p className="muted">標示「諮詢／轉介」的窗口，需先電話確認收件品項、新舊限制及交付方式，請勿直接寄送。</p>
      {tr(resources.map(resource => (
        <article className="card guide-resource" key={resource.id}>
          <span className="guide-tag">
            {tr(resource.kind === 'donation' ? '捐贈' : '回收／清運')} ·{tr(' ')}
            {tr(guideLocation(resource))}{resource.serviceType&&<> · {tr(resource.serviceType)}</>}
          </span>
          <h2>{tr(resource.title)}</h2>
          {tr(resource.address && <p>{tr(resource.address)}</p>)}
          {tr(resource.phone && (
            <p>{tr("電話：")}{tr(resource.phoneLabel || resource.phone)}</p>
          ))}
          <p>{tr(resource.description)}</p>
          {!resource.serviceType&&<p className="muted">{tr(resource.preparation)}</p>}
          <small>{tr("來源：")}{tr(resource.provider)}{tr("· 查核：")}{tr(resource.checkedAt||guideCheckedAt)}
          </small>
          <div className="market-actions">
            {tr(resource.address && (
              <a
                className="button secondary"
                href={addressMapUrl(resource.address)}
                target="_blank"
                rel="noopener noreferrer"
              >{tr("查看位置")}</a>
            ))}
            <a
              className="button secondary"
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
            >{tr("查看官方資訊")}<span className="sr-only">：{tr(resource.title)}{tr("（另開視窗）")}</span>
            </a>
            {tr(resource.phone && (
              <a className="button secondary" href={`tel:${resource.phone}`}>{tr("撥打諮詢電話")}</a>
            ))}
          </div>
        </article>
      )))}
      {tr(district &&
        !resources.some(resource => resource.district === district) && (
          <p className="muted">{tr("目前尚未整理到這個區符合條件的已查核據點。可聯絡下列縣市窗口，或用地圖查詢附近單位。")}</p>
        ))}
      {tr(!resources.length && (
        <p className="muted">{tr("目前沒有符合條件的管道，請切換至全部物品或全部管道。")}</p>
      ))}
      <p className="muted">{tr("資訊依政府與機構官網整理；接收條件、服務地區與時間可能調整，出發或寄送前請向提供單位確認。此頁提供資訊查詢，預約與捐贈由提供單位辦理。")}</p>
    </>
  );
}
function Market({
  select,
  edit,
}: {
  select: (product: data.ProductRecord) => void;
  edit?: (product: data.ProductRecord) => void;
}) {
  const [section, setSection] = useState(() => {
    const target = read<string>('market-destination', 'browse');
    write('market-destination', 'browse');
    return target === 'products' || target === 'purchases'
      ? 'transactions'
      : target;
  });
  const [transaction, setTransaction] = useState(() =>
    read('market-transaction', 'purchases'),
  );
  return (
    <>
      <div className="market-header">
        <h1>{tr("二手市集")}</h1>
        <div className="market-header-actions">
          <button
            aria-label={tr("訊息中心")}
            aria-pressed={section === 'inbox'}
            onClick={() => setSection('inbox')}
          >
            <AppIcon name="chat" />
          </button>
          <button aria-label={tr("購物車")} onClick={() => to('cart')}>
            <AppIcon name="cart" />
          </button>
          <button
            aria-pressed={section === 'transactions'}
            onClick={() => setSection('transactions')}
          >{tr("我的交易")}</button>
        </div>
      </div>
      {tr(section === 'browse' ? (
        <>
          <div className="market-publish-dock">
            <Button onClick={() => to('add-product')}>{tr("＋刊登商品")}</Button>
          </div>
          <BuyerBrowse select={select} />
        </>
      ) : (
        <>
          <Button secondary onClick={() => setSection('browse')}>{tr("返回商品瀏覽")}</Button>
          {tr(section === 'transactions' && (
            <>
              <h2 className="market-section-title">{tr("我的交易")}</h2>
              <div className="market-tabs" aria-label={tr("我的交易")}>
                {tr([
                  ['purchases', '我的購買'],
                  ['products', '我的刊登'],
                  ['sales', '銷售訂單'],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    aria-pressed={transaction === v}
                    onClick={() => {
                      setTransaction(v);
                      write('market-transaction', v);
                    }}
                  >
                    {tr(label)}
                  </button>
                )))}
              </div>
              {tr(transaction === 'products' ? (
                <SellerProducts edit={edit} />
              ) : (
                <MarketOrders
                  key={transaction}
                  role={transaction === 'purchases' ? 'buyer' : 'seller'}
                />
              ))}
              <Button secondary onClick={() => to('donation')}>{tr("捐贈與回收資訊")}</Button>
            </>
          ))}
          {tr(section === 'inbox' && <MarketInbox />)}
        </>
      ))}
    </>
  );
}
function SellerProducts({
  edit,
}: {
  edit?: (product: data.ProductRecord) => void;
}) {
  const [filter, setFilter] = useState('active'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const result = useMarketPage(data.loadMyProducts, { status: filter });
  const counts = useLoad(
    data.loadMyProductCounts,
    null as Record<string, number> | null,
  );
  const labels: Record<string, string> = {
    active: '上架中',
    reserved: '保留中',
    archived: '已下架',
    sold: '已售出',
  };
  async function toggle(product: data.ProductRecord) {
    if (
      !window.confirm(
        product.status === 'active'
          ? '確定下架這件商品？下架後買家無法購買。'
          : '確定重新上架這件商品？',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await data.setProductVisibility(
        product.id,
        product.status === 'active' ? 'archived' : 'active',
      );
      result.retry();
      counts.retry();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="row">
        <h2>{tr("我的刊登")}</h2>
        <Button onClick={() => to('add-product')}>{tr("刊登商品")}</Button>
      </div>
      <div className="market-tabs">
        {tr(Object.entries(labels).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {tr(label)}（{tr(counts.value?.[key] ?? '…')}）
          </button>
        )))}
      </div>
      <LoadState {...result} />
      <LoadState {...counts} />
      <ErrorMessage error={error} />
      {tr(result.hasMore && (
        <Button secondary disabled={result.busy} onClick={result.more}>{tr("載入更多刊登")}</Button>
      ))}
      {tr(result.value
        .filter(p => p.status === filter)
        .map(p => (
          <article className="card" key={p.id}>
            <div className="product">
              <MarketImage uri={p.img} title={tr(p.title)} />
              <div>
                <h3>{tr(p.title)}</h3>
                <p>NT$ {tr(p.price)}</p>
                <small>{tr(labels[p.status])}</small>
              </div>
            </div>
            {tr(['active', 'archived'].includes(p.status) && (
              <div className="market-actions">
                <Button secondary disabled={busy} onClick={() => edit?.(p)}>{tr("編輯商品")}</Button>
                <Button
                  secondary
                  disabled={busy}
                  onClick={() => void toggle(p)}
                >
                  {tr(p.status === 'active' ? '下架' : '重新上架')}
                </Button>
              </div>
            ))}
            {tr(p.status === 'sold' && (
              <p className="muted">{tr("前往「銷售訂單」處理出貨與查看收件資料。")}</p>
            ))}
          </article>
        )))}
      {tr(!result.busy &&
        !result.error &&
        !result.value.some(p => p.status === filter) && (
          <p className="muted">{tr("目前沒有")}{tr(labels[filter])}{tr("的商品。")}</p>
        ))}
    </>
  );
}
function MarketOrders({ role }: { role: data.MarketRole }) {
  const [filter, setFilter] = useState('all'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const loader = useCallback(
    (options: data.ProductQuery) => data.loadMarketOrders(role, options),
    [role],
  );
  const result = useMarketPage(loader, { status: filter });
  const lock = useRef(false);
  async function act(
    order: data.MarketOrder,
    action: 'ship' | 'complete' | 'cancel',
  ) {
    if (lock.current) return;
    const prompt =
      action === 'ship'
        ? '確認商品已實際寄出，再更新為已出貨。'
        : action === 'complete'
        ? '確認已收到商品並檢查無誤，再完成訂單。'
        : '確定取消這筆訂單？商品會重新上架。';
    if (!window.confirm(prompt)) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await data.transitionMarketOrder(order.id, action);
      result.retry();
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <h2>{tr(role === 'buyer' ? '我的購買' : '銷售訂單')}</h2>
      <div className="market-tabs">
        {tr([
          ['all', '全部'],
          ['requested', '待回覆'],
          ['waitMeetup', '待面交'],
          ['waitShip', '待出貨'],
          ['waitReceive', '待收貨'],
          ['rejected', '已拒絕'],
          ['pending', '既有待出貨'],
          ['shipped', '已出貨'],
          ['completed', '已完成'],
          ['cancelled', '已取消'],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {tr(label)}
          </button>
        )))}
      </div>
      <LoadState {...result} />
      {tr(result.hasMore && (
        <Button secondary disabled={result.busy} onClick={result.more}>{tr("載入更多訂單")}</Button>
      ))}
      <ErrorMessage error={error} />
      {tr(result.value
        .filter(
          o =>
            filter === 'all' ||
            o.status === filter ||
            (filter === 'pending' && o.status === 'paid'),
        )
        .map(o => (
          <article className="card" key={o.id}>
            <div className="row">
              <h3>{tr("訂單商品")}</h3>
              <strong>
                {tr(o.workflow_version === 2
                  ? transactionStatus(o)
                  : data.orderStatusLabel[o.status] || o.status)}
              </strong>
            </div>
            <p className="muted">
              {tr(new Date(o.created_at).toLocaleDateString('zh-TW'))} ·{tr(' ')}
              {tr(deliveryLabel(o.delivery_method))}
            </p>
            {tr(o.order_items.map(i => (
              <div className="order-product-row" key={i.listing_id}>
                <MarketImage
                  uri={data.getPublicImageUrl(
                    'product-photos',
                    i.image_path_snapshot || null,
                  )}
                  title={tr(i.title_snapshot)}
                />
                <div>
                  <p>
                    <strong>{tr("品名：")}{tr(i.title_snapshot)}</strong>
                  </p>
                  <p>NT$ {tr(i.price_snapshot)}</p>
                </div>
              </div>
            )))}
            <p>{tr("運費 NT$")}{tr(o.shipping_fee)}{tr("· 合計")}{tr(' ')}
              <strong>NT$ {tr(o.total_amount)}</strong>
            </p>
            <Button
              onClick={() => {
                sessionStorage.setItem('sorti-order-id', o.id);
                to('market-order');
              }}
            >{tr("查看訂單與下一步")}</Button>
            <details>
              <summary>{tr("訂單資訊")}</summary>
              <p className="order-number">{tr("訂單編號：")}{tr(o.id.toUpperCase())}</p>
              <p>
                {tr(o.recipient_name)} · {tr(o.recipient_phone)}
              </p>
              <p>{tr(o.shipping_address)}</p>
            </details>
            <div className="market-actions">
              {tr((o.workflow_version === 2
                ? []
                : data.orderActions(role, o.status)
              ).map(action => (
                <Button
                  key={action}
                  secondary={action === 'cancel'}
                  disabled={busy}
                  onClick={() => void act(o, action)}
                >
                  {tr(data.orderActionLabel[action])}
                </Button>
              )))}
            </div>
          </article>
        )))}
      {tr(!result.busy &&
        !result.error &&
        !result.value.some(
          o =>
            filter === 'all' ||
            o.status === filter ||
            (filter === 'pending' && o.status === 'paid'),
        ) && <p className="muted">{tr("目前沒有這個狀態的訂單。")}</p>)}
    </>
  );
}
function MarketThread({
  id,
  title,
  role,
  since,
}: {
  id: string;
  title: string;
  role: data.MarketRole;
  since?: string;
}) {
  const messageRequest = useRef(marketRequestId());
  const historyRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const result = useLoad(
    () => data.loadMarketplaceMessages(id, since),
    [] as data.MarketplaceMessage[],
  );
  useEffect(() => {
    const history = historyRef.current;
    if (history && followLatest.current)
      history.scrollTop = history.scrollHeight;
  }, [result.value]);
  const [related, setRelated] = useState<data.MarketOrder[]>([]);
  useEffect(() => {
    let active = true;
    const load = () =>
      data
        .loadRelatedMarketOrders(id)
        .then(os => {
          if (active) setRelated(os);
        })
        .catch(() => {});
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id]);
  const [text, setText] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const timer = window.setInterval(result.retry, 10000);
    return () => window.clearInterval(timer);
  }, [result.retry]);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await data.sendMarketplaceMessage(
        id,
        text.trim(),
        messageRequest.current,
      );
      messageRequest.current = marketRequestId();
      followLatest.current = true;
      setText('');
      result.retry();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="messenger" aria-label={tr("商品聊天")}>
      <header className="messenger-header">
        <span className="messenger-avatar" aria-hidden="true">
          {tr(role === 'buyer' ? '賣' : '買')}
        </span>
        <div>
          <h3>{tr(role === 'buyer' ? '賣家對話' : '買家對話')}</h3>
          <p className="muted">{tr(title)}</p>
        </div>
      </header>
      {tr(related.map(o => (
        <Button
          key={o.id}
          secondary
          onClick={() => {
            sessionStorage.setItem('sorti-order-id', o.id);
            to('market-order');
          }}
        >{tr("查看訂單")}{tr(o.id.slice(0, 8))} ·{tr(' ')}
          {tr(o.workflow_version === 2
            ? transactionStatus(o)
            : data.orderStatusLabel[o.status] || o.status)}
        </Button>
      )))}
      <LoadState {...result} />
      <ErrorMessage error={error} />
      <div
        ref={historyRef}
        onScroll={e => {
          const el = e.currentTarget;
          followLatest.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="messenger-history"
        aria-label={tr("聊天紀錄")}
        aria-live="polite"
      >
        {tr(!result.busy && !result.value.length && (
          <p className="messenger-empty">{tr("還沒有訊息，先向對方打個招呼吧。")}</p>
        ))}
        {tr(result.value.map((m, index) => {
          const mine = m.senderId === currentUserId;
          const date = new Date(m.createdAt);
          const previous = result.value[index - 1];
          const newDay =
            !previous ||
            new Date(previous.createdAt).toLocaleDateString('zh-TW') !==
              date.toLocaleDateString('zh-TW');
          return (
            <React.Fragment key={m.id}>
              {tr(newDay && (
                <p className="messenger-date">
                  {tr(date.toLocaleDateString('zh-TW'))}
                </p>
              ))}
              <div className={'messenger-row' + (mine ? ' mine' : '')}>
                {tr(!mine && (
                  <span className="messenger-avatar" aria-hidden="true">
                    {tr(role === 'buyer' ? '賣' : '買')}
                  </span>
                ))}
                <div className="messenger-message">
                  <p className="messenger-bubble">{tr(m.text)}</p>
                  <time dateTime={date.toISOString()}>
                    {tr(date.toLocaleTimeString(getLanguage()==='en'?'en-US':'zh-TW', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }))}
                  </time>
                </div>
              </div>
            </React.Fragment>
          );
        }))}
      </div>
      <form className="messenger-composer" onSubmit={send}>
        <label>
          <span className="sr-only">{tr("訊息")}</span>
          <textarea
            rows={1}
            placeholder={tr("哪一步有問題？直接問我")}
            value={text}
            disabled={busy}
            onChange={e => {
              setText(e.target.value);
              messageRequest.current = marketRequestId();
            }}
            maxLength={10000}
            required
          />
        </label>
        <Button type="submit" disabled={busy || !text.trim()}>
          {tr(busy ? '傳送中' : '送出')}
        </Button>
      </form>
    </section>
  );
}
const loadAllConversations = (options: data.ProductQuery) =>
  data.loadMarketConversations(undefined, options);
function MarketChatPage() {
  let thread: {
    id: string;
    title: string;
    role: data.MarketRole;
    productId?: string;
    orderId?: string;
    since?: string;
  } | null = null;
  try {
    thread = JSON.parse(
      sessionStorage.getItem('sorti-market-thread') || 'null',
    );
  } catch {}
  if (!thread?.id)
    return (
      <>
        <h1>{tr("商品聊聊")}</h1>
        <p>{tr("請先從商品或訊息中心選擇對話。")}</p>
        <Button onClick={() => to('market')}>{tr("返回市集")}</Button>
      </>
    );
  return (
    <>
      <h1>{tr("商品聊聊")}</h1>
      <Button
        secondary
        onClick={() => {
          if (thread.orderId) {
            sessionStorage.setItem('sorti-order-id', thread.orderId);
            to('market-order');
          } else if (thread.productId) {
            sessionStorage.setItem('sorti-product-id', thread.productId);
            to('product');
          } else {
            write('market-destination', 'inbox');
            to('market');
          }
        }}
      >
        {tr(thread.orderId
          ? '返回訂單'
          : thread.productId
          ? '返回商品'
          : '返回訊息列表')}
      </Button>
      <MarketThread
        key={thread.id}
        id={thread.id}
        title={tr(thread.title)}
        role={thread.role}
        since={thread.since}
      />
    </>
  );
}
function MarketInbox() {
  const result = useMarketPage(loadAllConversations);
  const [selected, setSelected] = useState<data.MarketConversation | null>(
    null,
  );
  return (
    <>
      <h2 className="market-section-title">{tr("訊息中心")}</h2>
      <Button secondary onClick={result.retry}>{tr("重新整理訊息")}</Button>
      <LoadState {...result} />
      {tr(selected ? (
        <>
          <Button secondary onClick={() => setSelected(null)}>{tr("返回訊息列表")}</Button>
          <MarketThread
            key={selected.id}
            id={selected.id}
            title={tr(selected.listing?.title || '商品對話')}
            role={selected.viewerRole}
          />
        </>
      ) : (
        result.value.map(c => (
          <button
            className="card inbox-item"
            key={c.id}
            onClick={() => setSelected(c)}
          >
            <strong>{tr(c.listing?.title || '商品對話')}</strong>
            <span>
              {tr(c.viewerRole === 'buyer'
                ? `賣家 · ${c.seller_id.slice(0, 8)}`
                : `買家 · ${c.buyer_id.slice(0, 8)}`)}
            </span>
            <span className="inbox-preview">
              {tr(c.latestMessage || '尚無訊息')}
            </span>
            <small>{tr(new Date(c.last_message_at).toLocaleString('zh-TW'))}</small>
          </button>
        ))
      ))}
      {tr(!result.busy && !result.error && !selected && !result.value.length && (
        <p className="market-empty muted">{tr("還沒有對話。從商品詳情詢問賣家後，對話會出現在這裡。")}</p>
      ))}
      {tr(!selected && result.hasMore && (
        <Button secondary disabled={result.busy} onClick={result.more}>{tr("載入更多對話")}</Button>
      ))}
    </>
  );
}
function SellerStore({ select }: { select: (p: data.ProductRecord) => void }) {
  const sellerId = sessionStorage.getItem('sorti-seller-id') || '';
  const [items, setItems] = useState<data.ProductRecord[]>([]),
    [page, setPage] = useState(0),
    [more, setMore] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [added, setAdded] = useState<string[]>([]),
    [retry, setRetry] = useState(0),
    [adding, setAdding] = useState('');
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError('');
    if (!sellerId) {
      setError('請從商品頁開啟賣家賣場。');
      setBusy(false);
      return;
    }
    data
      .loadProducts({ sellerId, page })
      .then(rows => {
        if (active) {
          setItems(v =>
            page === 0
              ? rows
              : [...v, ...rows.filter(r => !v.some(i => i.id === r.id))],
          );
          setMore(rows.length === 20);
        }
      })
      .catch(e => active && setError(errorText(e)))
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, [sellerId, page, retry]);
  return (
    <>
      <h1>{tr("賣家賣場")}</h1>
      <p>{tr("挑選同一賣家的商品，加入購物車一起結帳。")}</p>
      <Button onClick={() => to('cart')}>{tr("查看購物車")}</Button>
      {tr(error && (
        <p role="alert">
          {tr(error)}
          <Button onClick={() => setRetry(v => v + 1)}>{tr("重新載入")}</Button>
        </p>
      ))}
      <div className="market-grid">
        {tr(items.map(p => (
          <article className="card" key={p.id}>
            <button className="product-open" onClick={() => select(p)}>
              <MarketImage uri={p.img} title={tr(p.title)} />
              <h2>{tr(p.title)}</h2>
              <p>{tr(currency(p.price))}</p>
            </button>
            <Button
              disabled={
                !!adding || added.includes(p.id) || p.sellerId === currentUserId
              }
              onClick={async () => {
                setAdding(p.id);
                setError('');
                try {
                  await data.addCartItem(p.id);
                  setAdded(v => [...v, p.id]);
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setAdding('');
                }
              }}
            >
              {tr(added.includes(p.id)
                ? '已加入購物車'
                : adding === p.id
                ? '正在加入…'
                : '加入購物車')}
            </Button>
          </article>
        )))}
      </div>
      {tr(busy && <p role="status">{tr("正在載入…")}</p>)}
      {tr(!busy && !error && !items.length && <p>{tr("目前沒有上架商品。")}</p>)}
      {tr(more && !busy && !error && (
        <Button onClick={() => setPage(v => v + 1)}>{tr("載入更多")}</Button>
      ))}
    </>
  );
}
function Product({ product }: { product: data.ProductRecord }) {
  const hasDelivery = Boolean(product.allowMeetup || product.allowShipping);
  const ownProduct = product.sellerId === currentUserId;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const lock = useRef(false);
  async function act(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="market-detail">
      <Button
        secondary
        onClick={() => {
          sessionStorage.setItem('sorti-seller-id', product.sellerId);
          to('seller-store');
        }}
      >{tr("逛逛賣家賣場")}</Button>
      <div className="market-detail-header">
        <Button secondary onClick={() => to('market')}>{tr("返回市集")}</Button>
        <Button
          secondary
          onClick={() =>
            void act(async () => {
              const text =
                productShareText(product) +
                '\n' +
                location.origin +
                location.pathname +
                '?listing=' +
                encodeURIComponent(product.id) +
                '#product';
              if (navigator.share)
                await navigator.share({ title: product.title, text });
              else if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                setMessage('商品資訊已複製');
              } else throw new Error('此瀏覽器無法分享，請使用系統分享功能。');
            })
          }
        >{tr("分享商品")}</Button>
      </div>
      <MarketImage uri={product.img} title={tr(product.title)} />
      <section className="card market-detail-info">
        <strong className="market-detail-price">
          {tr(currency(product.price))}
        </strong>
        <h1>{product.title}</h1>
        <p className="muted">
          {tr([product.category, product.location].filter(Boolean).join(' · '))}
        </p>
        {tr(product.createdAt && (
          <small>{tr("上架日期：")}{tr(new Date(product.createdAt).toLocaleDateString('zh-TW'))}
          </small>
        ))}
      </section>
      <section className="card">
        <p>
          {tr(product.condition || '狀況未填')} ·{tr(' ')}
          {tr(product.defects || '瑕疵說明未提供')}
        </p>
        <p>{tr("交易方式：")}{tr(product.allowMeetup ? '面交 ' : '')}
          {tr(product.allowShipping ? '寄送' : '')}
          {tr(!product.allowMeetup && !product.allowShipping ? '賣家尚未設定' : '')}
        </p>
        <p>
          {tr(availableChannels(product).map(o => (
            <span key={o.channel} style={{ display: 'block' }}>
              {tr(channelLabel(o.channel))}
              {tr(o.channel === 'meetup' ? '' : ` · 運費 NT$ ${o.fee}`)}
              {tr(o.note ? ' · ' + o.note : '')}
            </span>
          )))}
        </p>
        <h2>{tr("商品描述")}</h2>
        <p className="prewrap">{tr(product.description || '賣家尚未提供描述。')}</p>
      </section>
      <section className="card">
        <h2>{tr("賣家資訊")}</h2>
        <p>{tr("賣家 · 可透過聊聊詢問商品詳情")}</p>
      </section>
      <ErrorMessage error={error} />
      {tr(message && <p role="status">{tr(message)}</p>)}
      <div className="market-detail-actions">
        {ownProduct ? (
          <Button
            onClick={() => {
              write('market-destination', 'products');
              write('market-transaction', 'products');
              to('market');
            }}
          >
            {tr(hasDelivery ? '管理我的刊登' : '補充交易方式')}
          </Button>
        ) : (
          <>
            {tr(!hasDelivery && (
              <p role="status">{tr("賣家尚未設定交易方式，請先詢問賣家。")}</p>
            ))}
            {tr(product.status !== 'active' && (
              <p className="muted">{tr("這件商品目前無法購買。")}</p>
            ))}
            <div className="market-actions">
              <Button
                secondary
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    const id = await data.getOrCreateConversation(product);
                    sessionStorage.setItem(
                      'sorti-market-thread',
                      JSON.stringify({
                        id,
                        title: product.title,
                        role: 'buyer',
                        productId: product.id,
                      }),
                    );
                    to('market-thread');
                  })
                }
              >{tr("詢問賣家")}</Button>
              <Button
                disabled={busy || !hasDelivery || product.status !== 'active'}
                onClick={() =>
                  void act(async () => {
                    await data.addCartItem(product.id);
                    setMessage('已加入購物車');
                  })
                }
              >{tr("加入購物車")}</Button>
              <Button
                disabled={busy || !hasDelivery || product.status !== 'active'}
                onClick={() =>
                  void act(async () => {
                    sessionStorage.setItem('sorti-direct-buy', product.id);
                    to('checkout');
                  })
                }
              >
                {tr(hasDelivery ? '立即購買' : '尚未開放購買')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function AddProduct({
  product,
  onView,
}: {
  product?: data.ProductRecord;
  onView: (product: data.ProductRecord) => void;
}) {
  const [inventoryDraft] = useState(() => {
    const value = {
      image: read('listing-item-photo', ''),
      category: read('listing-item-category', '其他'),
    };
    write('listing-item-photo', '');
    write('listing-item-category', '');
    return value;
  });
  const [draftTitle] = useState(() => {
    const value = read('listing-item-name', '');
    write('listing-item-name', '');
    return value;
  });
  const [showPreview, setShowPreview] = useState(false);
  const [step, setStep] = useState(product || draftTitle ? 'form' : 'source');
  const [title, setTitle] = useState(product?.title || draftTitle),
    [category, setCategory] = useState(
      product?.category || inventoryDraft.category || '其他',
    );
  const [price, setPrice] = useState(product ? String(product.price) : ''),
    [location, setLocation] = useState(product?.location || ''),
    [description, setDescription] = useState(product?.description || '');
  const [file, setFile] = useState<File | null>(null),
    [imageUri, setImageUri] = useState(
      product?.img || inventoryDraft.image || '',
    );
  const [sourceUri, setSourceUri] = useState(
    product?.img || inventoryDraft.image || '',
  );
  const [items, setItems] = useState<
      Awaited<ReturnType<typeof data.loadRemoteItems>>
    >([]),
    [showItems, setShowItems] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [published, setPublished] = useState<data.ProductRecord | null>(null);
  const [condition, setCondition] = useState(product?.condition || ''),
    [defects, setDefects] = useState(product?.defects || '');
  const requestId = useRef(marketRequestId());
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>(
    product?.deliveryOptions ||
      (product ? [] : [{ channel: 'meetup', fee: 0, note: '' }]),
  );
  const { allowMeetup, allowShipping, meetupNote, shippingNote, shippingFee } =
    deliverySummary(deliveryOptions);
  const updateDeliveryOptions = setDeliveryOptions;
  const delivery = { condition, defects, ...deliverySummary(deliveryOptions) };
  const lock = useRef(false);
  useEffect(() => {
    if (!file) {
      setImageUri(sourceUri);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUri(url);
    return () => URL.revokeObjectURL(url);
  }, [file, sourceUri]);
  async function chooseInventory() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setShowItems(true);
    try {
      setItems(await data.loadRemoteItems());
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function preview(e: FormEvent) {
    e.preventDefault();
    try {
      validateListing({ title, category, price, location, imageUri });
      setStep('delivery');
      setError('');
    } catch (err) {
      setError(errorText(err));
    }
  }
  async function publish() {
    if (lock.current) return;
    try {
      validateListing({ title, category, price, location, imageUri });
      validateDelivery(delivery);
    } catch (e) {
      setError(errorText(e));
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const values = {
        ...delivery,
        requestId: requestId.current,
        title: title.trim(),
        description: description.trim(),
        category,
        price: Number(price),
        location: location.trim(),
        imageUri,
      };
      let saved: data.ProductRecord;
      if (product) {
        await data.updateProduct(product.id, {
          ...values,
          imageUri: imageUri === product.img ? undefined : imageUri,
        });
        saved = await data.loadProduct(product.id);
      } else saved = await data.createProduct(values);
      setPublished(saved);
      setStep('success');
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <h1>{tr(product ? '編輯商品' : '刊登商品')}</h1>
      <Button
        secondary
        disabled={busy}
        onClick={() => {
          if (showPreview) setShowPreview(false);
          else if (step === 'delivery') setStep('form');
          else if (step === 'form' && !product) setStep('source');
          else to('market');
        }}
      >{tr("返回")}</Button>
      {tr(step !== 'success' && (
        <ol className="listing-steps" aria-label={tr("刊登進度")}>
          {tr(['選擇照片', '商品資訊', '交易與刊登'].map((label, i) => (
            <li
              key={label}
              aria-current={
                i === ['source', 'form', 'delivery'].indexOf(step)
                  ? 'step'
                  : undefined
              }
            >
              <span>{tr(i + 1)}</span>
              {tr(label)}
            </li>
          )))}
        </ol>
      ))}
      {step === 'source' && (
        <section className="card">
          <h2>{tr("想出售哪件物品？")}</h2>
          <PhotoPicker file={file} onChange={setFile} disabled={busy} />
          {tr(imageUri && !file && <MarketImage uri={imageUri} />)}
          <Button onClick={() => void chooseInventory()}>{tr("從我的物品中選擇")}</Button>
          <Button
            secondary
            onClick={() => {
              if (file || imageUri) {
                setError('');
                setStep('form');
              } else setError('請先拍攝或選擇商品照片。');
            }}
          >{tr("下一步：商品資訊")}</Button>
          <p className="muted">{tr("物品會帶入名稱、分類與照片，刊登前請確認內容。")}</p>
          {showItems &&
            items.map(item => (
              <button
                className="card product listing-source"
                key={item.id}
                onClick={() => {
                  setTitle(item.name);
                  setCategory(item.category || '其他');
                  setSourceUri(item.imageUri || '');
                  setFile(null);
                  setStep('form');
                }}
              >
                <MarketImage uri={item.imageUri} title={tr(item.name)} />
                <span>
                  <strong>{item.name}</strong>
                  <small>{tr(item.category)}</small>
                </span>
              </button>
            ))}
          {tr(showItems && !busy && !error && !items.length && (
            <p>{tr("目前沒有物品，可以拍照新增商品。")}</p>
          ))}
        </section>
      )}
      {tr(step === 'form' && (
        <form className="card" onSubmit={preview}>
          {tr(!file && imageUri && <MarketImage uri={imageUri} />)}
          <PhotoPicker file={file} onChange={setFile} disabled={busy} />
          <label>{tr("商品名稱")}<input
              name="title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              disabled={busy}
            />
          </label>
          <label>{tr("分類")}<select
              aria-label={tr("分類")}
              name="category"
              value={category}
              onChange={e => setCategory(e.target.value)}
              disabled={busy}
            >
              {tr(Array.from(new Set([...listingCategories, category])).map(c => (
                <option key={c}>{tr(c)}</option>
              )))}
            </select>
          </label>
          <label>{tr("使用狀況")}<select
              aria-label={tr("使用狀況")}
              value={condition}
              onChange={e => setCondition(e.target.value)}
              required
            >
              <option value="">{tr("請選擇")}</option>
              {tr(itemConditions.map(c => (
                <option key={c}>{tr(c)}</option>
              )))}
            </select>
          </label>
          <label>{tr("瑕疵說明")}<textarea
              value={defects}
              onChange={e => setDefects(e.target.value)}
            />
          </label>
          <label>{tr("商品描述")}<textarea
              name="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={tr("請描述使用狀況、瑕疵與尺寸")}
              disabled={busy}
            />
          </label>
          <label>{tr("價格")}<input
              name="price"
              inputMode="decimal"
              value={price}
              onChange={e => setPrice(e.target.value)}
              required
              disabled={busy}
            />
          </label>
          <label>{tr("地點")}<input
              name="location"
              value={location}
              onChange={e => setLocation(e.target.value)}
              required
              disabled={busy}
            />
          </label>
          <p className="muted">{tr("照片刊登後會公開，下一步設定交易方式。")}</p>
          <Button type="submit" disabled={busy}>{tr("下一步：交易方式")}</Button>
        </form>
      ))}
      {tr(step === 'delivery' && !showPreview && (
        <section className="card">
          <h2>{tr("交易方式")}</h2>
          {tr(product && !product.deliveryOptions && (
            <p>{tr("舊商品請重新選擇提供的交易管道與運費後儲存。")}</p>
          ))}
          <DeliveryOptions
            value={deliveryOptions}
            onChange={updateDeliveryOptions}
            disabled={busy}
          />
          <p>{tr("平台不代收付款、不提供物流保障。同賣家同方式合單取最高一件運費。")}</p>
          <Button
            onClick={() => {
              try {
                validateDelivery(delivery);
                setError('');
                setShowPreview(true);
              } catch (e) {
                setError(errorText(e));
              }
            }}
          >{tr("預覽商品")}</Button>
        </section>
      ))}
      {tr(step === 'delivery' && showPreview && (
        <section className="card listing-preview">
          <h2>{tr("確認商品資訊")}</h2>
          <MarketImage uri={imageUri} />
          <strong className="market-detail-price">
            {tr(currency(Number(price)))}
          </strong>
          <h2>{tr(title)}</h2>
          <p>
            {tr(condition)} · {tr(defects || '瑕疵說明未提供')}
          </p>
          <p>
            {tr(allowMeetup ? '面交 ' : '')}
            {tr(allowShipping ? `寄送 · 運費 NT$ ${shippingFee}` : '')}
          </p>
          {tr(deliveryOptions.map(o => (
            <p key={o.channel}>
              {tr(channelLabel(o.channel))}
              {tr(o.channel === 'meetup' ? '' : ` · 運費 NT$ ${o.fee}`)}
            </p>
          )))}
          <p>
            {tr(meetupNote)} {tr(shippingNote)}
          </p>
          <p className="muted">
            {tr(category)} · {tr(location)}
          </p>
          <p className="prewrap">{tr(description || '尚未提供描述')}</p>
          <Button
            secondary
            disabled={busy}
            onClick={() => setShowPreview(false)}
          >{tr("返回修改")}</Button>
          <Button disabled={busy} onClick={() => void publish()}>
            {tr(busy
              ? '正在上傳照片與儲存商品…'
              : product
              ? '儲存修改'
              : '確認上架')}
          </Button>
        </section>
      ))}
      {tr(step === 'success' && published && (
        <section className="card">
          <h2>{tr(product ? '商品修改成功' : '商品刊登成功')}</h2>
          <p>{tr("照片與商品資訊已儲存。")}</p>
          <Button onClick={() => onView(published)}>{tr("查看商品")}</Button>
          <Button secondary onClick={() => to('market')}>{tr("返回市集")}</Button>
          <Button
            secondary
            onClick={() => {
              write('market-destination', 'products');
              write('market-transaction', 'products');
              to('market');
            }}
          >{tr("管理我的刊登")}</Button>
        </section>
      ))}
      {tr(busy && step !== 'preview' && <p role="status">{tr("正在載入…")}</p>)}
      <ErrorMessage error={error} />
    </>
  );
}
function Cart({ checkout = false }: { checkout?: boolean }) {
  const result = useLoad(
      data.loadCart,
      [] as Awaited<ReturnType<typeof data.loadCart>>,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const total = result.value.reduce((sum, item) => sum + item.price, 0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await data.createOrdersFromCart(result.value, 'cod', {
        name: String(form.get('name')).trim(),
        phone: String(form.get('phone')).trim(),
        address: String(form.get('address')).trim(),
      });
      result.retry();
      write('market-destination', 'purchases');
      write('market-transaction', 'purchases');
      to('market');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>{tr(checkout ? '確認訂單' : '購物車')}</h1>
      <LoadState {...result} />
      <ErrorMessage error={error} />
      {result.value.map(item => (
        <div className="card row" key={item.id}>
          <div>
            <h2>{item.title}</h2>
            <p>NT$ {tr(item.price)}</p>
          </div>
          {tr(!checkout && (
            <Button
              secondary
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await data.removeCartItem(item.id);
                  result.retry();
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >{tr("移除")}</Button>
          ))}
        </div>
      ))}
      {tr(result.value.length > 0 ? (
        <section className="card">
          <p>{tr("商品小計 NT$")}{tr(total)}</p>
          <p>{tr("運費於確認購買時依交易方式計算，購物車不保留商品。")}</p>
          <h2>{tr("商品小計 NT$")}{tr(total)}</h2>
          {tr(checkout ? (
            <form onSubmit={submit}>
              <label>{tr("收件人")}<input name="name" required />
              </label>
              <label>{tr("電話")}<input name="phone" type="tel" required />
              </label>
              <label>{tr("地址")}<input name="address" required />
              </label>
              <p>{tr("付款方式：貨到／面交付款")}</p>
              <Button type="submit" disabled={busy}>
                {tr(busy ? '建立中…' : '建立訂單')}
              </Button>
            </form>
          ) : (
            <Button
              onClick={() => {
                sessionStorage.removeItem('sorti-direct-buy');
                to('checkout');
              }}
            >{tr("前往結帳")}</Button>
          ))}
        </section>
      ) : (
        !result.busy && !result.error && <p className="muted">{tr("購物車是空的。")}</p>
      ))}
    </>
  );
}
function Profile({ session }: { session: Session }) {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  useEffect(() => {
    let active = true;
    const path = session.user.user_metadata.avatar_path;
    if (path)
      data
        .getPrivateImageUrl('analysis-photos', path)
        .then(uri => {
          if (active) setAvatar(uri);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [session.user.user_metadata.avatar_path]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      if (avatarFile) {
        const uri = URL.createObjectURL(avatarFile);
        try {
          setAvatar(await data.saveAccountAvatar(uri));
          setAvatarFile(null);
        } finally {
          URL.revokeObjectURL(uri);
        }
      }
      await data.updateAccountProfile({
        displayName: String(form.get('name')).trim(),
        username: String(form.get('username')).trim(),
        email: String(form.get('email')).trim(),
        gender: String(form.get('gender')).trim(),
        password: String(form.get('password') || ''),
      });
      setMessage('個人資料已儲存。若修改電子郵件，請依驗證信完成確認。');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>{tr("個人資料")}</h1>
      <section className="card">
        <h2>{tr("大頭貼")}</h2>
        {tr(avatar && (
          <img className="item-thumbnail" src={avatar} alt={tr("個人大頭貼")} />
        ))}
        <PhotoPicker
          file={avatarFile}
          onChange={setAvatarFile}
          disabled={busy}
        />
      </section>
      <form className="card" onSubmit={save}>
        <label>{tr("姓名")}<input
            name="name"
            defaultValue={session.user.user_metadata.display_name || ''}
            required
          />
        </label>
        <label>{tr("使用者名稱")}<input
            name="username"
            defaultValue={session.user.user_metadata.username || ''}
            required
          />
        </label>
        <label>{tr("電子郵件")}<input
            name="email"
            type="email"
            defaultValue={session.user.email || ''}
            required
          />
        </label>
        <label>{tr("性別")}<input
            name="gender"
            defaultValue={session.user.user_metadata.gender || ''}
            placeholder={tr("可不填")}
          />
        </label>
        <label>{tr("新密碼")}<input
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            placeholder={tr("不修改請留空")}
          />
        </label>
        <ErrorMessage error={error} />
        {tr(message && <p role="status">{tr(message)}</p>)}
        <Button type="submit" disabled={busy}>{tr("儲存資料")}</Button>
      </form>
    </>
  );
}
const pageTitles: Partial<Record<Route, string>> = {
  quiz: '收納測驗',
  daily: '每日任務',
  analysis: '拍照分析',
  history: '整理紀錄',
  chat: '收納助理',
  items: '物品管理',
  donation: '捐贈與回收',
  market: '二手市集',
  'seller-store': '賣家賣場',
  product: '商品詳情',
  'add-product': '刊登商品',
  'edit-product': '編輯商品',
  cart: '購物車',
  checkout: '確認購買',
  'market-thread': '商品聊聊',
  'market-order': '訂單詳情',
  settings: '設定',
  profile: '個人資料',
};
function navigatePage(path: string) {
  if (path === 'donation') {
    write('guide-category', '');
    write('guide-condition', 'unsure');
    write('guide-kind', 'all');
  }
  to(path as Route);
}
function Home({
  persona,
  reminder,
  date,
  session,
}: {
  persona: string;
  reminder: boolean;
  date: string;
  session: Session;
}) {
  const meta=session.user.user_metadata;
  const nickname=meta.display_name||meta.full_name||meta.username||tr('收納新手');
  const [avatar,setAvatar]=useState(meta.avatar_url||meta.picture||'');
  useEffect(()=>{let active=true;setAvatar(meta.avatar_url||meta.picture||'');if(meta.avatar_path)data.getPrivateImageUrl('analysis-photos',meta.avatar_path).then(uri=>{if(active)setAvatar(uri);}).catch(()=>{});return()=>{active=false;};},[meta.avatar_path,meta.avatar_url,meta.picture]);
  const inventory=useLoad(data.loadRemoteItems,[] as Awaited<ReturnType<typeof data.loadRemoteItems>>);
  const pending=inventory.value.filter(i=>!i.storageLocation).length;
  const selling=inventory.value.filter(i=>i.disposition==='sell').length;
  const [showPersona, setShowPersona] = useState(false);
  const records = useLoad(
    data.loadRemoteCheckIns,
    {} as Record<string, string>,
  );
  const completed = !!records.value[date];
  const days = Object.keys(records.value).filter(day => day <= date).length;
  return (
    <>
      <button className="home-profile" aria-label={tr("編輯暱稱與頭貼")} onClick={()=>to('profile')}>{tr(avatar?<img src={avatar} alt={tr("你的頭貼")}/>:<span className="home-avatar-fallback"><AppIcon name="home-outline"/></span>)}<span><strong>{tr("你好，")}{nickname}</strong><small>{tr("今天，讓家裡輕鬆一點")}</small></span><AppIcon name="arrow"/></button>
      {tr(reminder && !completed && (
        <button className="card reminder-card" onClick={() => to('daily')}>
          <h2>{tr("今天的整理提醒")}</h2>
          <p>{tr("每天留一點時間，完成一件整理小任務。")}</p>
        </button>
      ))}
      <PersonaDetails
        open={showPersona}
        identity={persona}
        close={() => setShowPersona(false)}
        quiz={() => to('quiz')}
      />
      <section className="home-welcome">
        <div className="greeting-row">
          
          <button
            id="persona-badge"
            className="persona-badge"
            aria-label={tr("查看收納人格特質")}
            onClick={() => setShowPersona(true)}
          >{tr("收納人格特質：")}{tr(displayPersona(persona || '收納新手'))}
          </button>
        </div>
        <h1>{tr("讓整理，從一個角落開始")}</h1>
        <p>{tr("依照你的收納偏好，找到適合自己的整理方式")}</p>
      </section>
      <section className="home-hero">
        <small>{tr("AI 空間分析")}</small>
        <h2>{tr("拍下想整理的角落")}</h2>
        <p>{tr("辨識照片中的物品，查看整理建議。")}</p>
        <Button onClick={() => to('analysis')}>
          <AppIcon name="camera" />{tr("開始整理")}
        </Button>
      </section>
      {tr(!inventory.busy&&!inventory.error&&<button className="card home-progress" onClick={()=>to('items')}><strong>{tr("你的整理成果")}</strong><p>{tr("管理")}{tr(inventory.value.length)}{tr("件物品 · 累積打卡")}{tr(days)}{tr("天")}</p>{tr((pending>0||selling>0)&&<small>{tr(pending)}{tr("件尚待定位 ·")}{tr(selling)}{tr("件準備出售")}</small>)}</button>)}
      <h2 className="home-section-title">{tr("今天的小步驟")}</h2>
      <div className="grid home-features">
        <button className="card feature" onClick={() => to('daily')}>
          <span className="feature-icon">
            <AppIcon name="leaf" />
          </span>
          <h2>{tr("每日任務")}</h2>
          <p>{tr(completed ? '今日已完成' : '花 5 分鐘，選一個角落開始')}</p>
          <span className="feature-footer">
            {tr(completed ? '查看任務' : '選一個任務')}
            <AppIcon name="arrow" />
          </span>
        </button>
        <button className="card feature" onClick={() => to('history')}>
          <span className="feature-icon accent">
            <AppIcon name="history" />
          </span>
          <h2>{tr("整理紀錄")}</h2>
          <p>{tr("累積打卡")}{tr(days)}{tr("天")}</p>
          <span className="feature-footer">{tr("回顧整理紀錄")}<AppIcon name="arrow" />
          </span>
        </button>
      </div>
      <h2 className="home-section-title">{tr("用不到的物品")}</h2>
      <div className="grid home-features">
        <button className="card feature" onClick={() => to('market')}>
          <AppIcon name="storefront-outline" />
          <h2>{tr("二手市集")}</h2>
          <p>{tr("買賣物品、訂單與交易訊息")}</p>
        </button>
        <button
          className="card feature"
          onClick={() => navigatePage('donation')}
        >
          <AppIcon name="leaf" />
          <h2>{tr("捐贈與回收")}</h2>
          <p>{tr("找捐贈單位、回收與清運服務")}</p>
        </button>
      </div>
      <DraggableAssistant open={()=>to('chat')}><span className="assistant-speech">{tr("收納助理")}</span><img src={assistantBear} width={62} height={62} alt="" draggable={false}/></DraggableAssistant>
    </>
  );
}
function App() {
  const {language,setLanguage}=useLanguage();
  useEffect(()=>{void initializeLanguage({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});},[]);
  useEffect(()=>{document.documentElement.lang=language;},[language]);
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [authError, setAuthError] = useState(''),
    [route, setRoute] = useState<Route>(
      (location.hash.slice(1) || 'home') as Route,
    ),
    [date, setDate] = useState(taipeiDate()),
    [online, setOnline] = useState(navigator.onLine),
    [dark, setDark] = useState(
      localStorage.getItem('sorti_pwa_dark') === 'true',
    ),
    [product, setProduct] = useState<data.ProductRecord | null>(null),
    [persona, setPersona] = useState(''),
    [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        if (active) {
          currentUserId = next?.user.id || '';
          setSession(next);
          setReady(true);
        }
      },
    );
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setAuthError(error.message);
        currentUserId = data.session?.user.id || '';
        setSession(data.session);
        setReady(true);
      })
      .catch(e => {
        if (active) {
          setAuthError(errorText(e));
          setReady(true);
        }
      });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);
  const [legal,setLegal]=useState<{id:string;accepted:boolean}|null>(null),[legalAttempt,setLegalAttempt]=useState(0);
  useEffect(()=>{if(!session){setLegal(null);return;}let active=true;setLegal(null);data.loadLegalAcceptance().then(accepted=>{if(active)setLegal({id:session.user.id,accepted});}).catch(()=>{if(active){setAuthError('無法讀取政策確認紀錄，請重試。');setLegal({id:session.user.id,accepted:false});}});return()=>{active=false;};},[session?.user.id,legalAttempt]);
  const legalReady=!!session&&legal?.id===session.user.id&&legal.accepted;
  const googleCallbackUserId = legalReady ? session?.user.id : undefined;
  useEffect(() => {
    if (
      !ready ||
      !googleCallbackUserId ||
      new URL(location.href).searchParams.get('auth_callback') !== 'google'
    )
      return;
    let active = true;
    data
      .authenticatedStartScreen(googleCallbackUserId)
      .catch(() => 'Home')
      .then(destination => {
        if (!active) return;
        history.replaceState(null, '', location.pathname);
        to(destination === 'Home' ? 'home' : 'quiz');
      });
    return () => {
      active = false;
    };
  }, [ready, googleCallbackUserId]);
  useEffect(() => {
    const hash = () => {
        setRoute((location.hash.slice(1) || 'home') as Route);
        window.scrollTo(0, 0);
      },
      state = () => {
        setOnline(navigator.onLine);
        setDate(taipeiDate());
      };
    window.addEventListener('hashchange', hash);
    window.addEventListener('online', state);
    window.addEventListener('offline', state);
    document.addEventListener('visibilitychange', state);
    const timer = setInterval(state, 30000);
    return () => {
      window.removeEventListener('hashchange', hash);
      window.removeEventListener('online', state);
      window.removeEventListener('offline', state);
      document.removeEventListener('visibilitychange', state);
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const colors = appearance[dark ? 'dark' : 'light'];
    const variables = {
      bg: colors.background,
      card: colors.cardBg,
      text: colors.textMain,
      sub: colors.textSub,
      line: colors.border,
      primary: colors.primary,
      on: colors.onPrimary,
      soft: colors.primarySoft,
      accent: colors.accent,
      'accent-soft': colors.accentSoft,
    };
    Object.entries(variables).forEach(([name, value]) =>
      document.documentElement.style.setProperty('--' + name, value),
    );
    localStorage.setItem('sorti_pwa_dark', String(dark));
  }, [dark, route]);
  useEffect(() => {
    if (!session || !legalReady) {
      setPersona('');
      return;
    }
    let active = true;
    setPersona(read('persona', ''));
    supabase
      .from('user_personas')
      .select('persona_name')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data?.persona_name) {
          write('persona', data.persona_name);
          setPersona(data.persona_name);
        }
      });
    return () => {
      active = false;
    };
  }, [session, route, legalReady]);
  useEffect(() => {
    if (legalReady && route === 'product') {
      const id =
        new URLSearchParams(location.search).get('listing') ||
        sessionStorage.getItem('sorti-product-id');
      if (id)
        data
          .loadProduct(id)
          .then(setProduct)
          .catch(() => setProduct(null));
    }
  }, [route,legalReady]);
  if (!ready)
    return (
      <main className="auth">
        <Brand />
        <p role="status">{tr("正在開啟 拾序…")}</p>
      </main>
    );
  if (!session)
    return (
      <>
        <ErrorMessage error={authError} />
        <Auth
          onLogin={async()=>{try{if(await data.loadLegalAcceptance()){const {data:auth}=await supabase.auth.getSession();if(auth.session){const destination=await data.authenticatedStartScreen(auth.session.user.id);to(destination==='Quiz'?'quiz':'home');}}}catch{setAuthError('尚未完成政策確認或讀取失敗，請重試。');}}}
        />
      </>
    );
  if(!legalReady)return <>{legal?.id===session.user.id?<LegalGate readError={authError} key={session.user.id} onAccepted={()=>setLegalAttempt(v=>v+1)}/>:<main className="auth"><p>正在讀取政策確認紀錄…</p><LegalLinks/></main>}</>;
  const select = (p: data.ProductRecord) => {
    setProduct(p);
    sessionStorage.setItem('sorti-product-id', p.id);
    const url = new URL(location.href);
    url.searchParams.delete('listing');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    to('product');
  };
  let page: ReactNode;
  switch (route) {
    case 'quiz':
      page = <Quiz />;
      break;
    case 'daily':
      page = <Daily key={date} date={date} />;
      break;
    case 'analysis':
      page = <Analysis />;
      break;
    case 'history':
      page = <History />;
      break;
    case 'chat':
      page = <Chat />;
      break;
    case 'items':
      page = <Items />;
      break;
    case 'donation':
      page = <DonationRecycling />;
      break;
    case 'market':
      page = (
        <Market
          select={select}
          edit={p => {
            setProduct(p);
            to('edit-product');
          }}
        />
      );
      break;
    case 'seller-store':
      page = <SellerStore select={select} />;
      break;
    case 'product':
      page = product ? (
        <Product key={product.id} product={product} />
      ) : (
        <Market
          select={select}
          edit={p => {
            setProduct(p);
            to('edit-product');
          }}
        />
      );
      break;
    case 'add-product':
      page = <AddProduct onView={select} />;
      break;
    case 'edit-product':
      page = product ? (
        <AddProduct key={product.id} product={product} onView={select} />
      ) : (
        <Market
          select={select}
          edit={p => {
            setProduct(p);
            to('edit-product');
          }}
        />
      );
      break;
    case 'cart':
      page = <Cart />;
      break;
    case 'checkout':
      page = <WebMarketCheckout />;
      break;
    case 'market-thread':
      page = <MarketChatPage />;
      break;
    case 'market-order':
      page = <WebMarketOrder />;
      break;
    case 'profile':
      page = <Profile session={session} />;
      break;
    case 'settings':
      page = (
        <>
          <h1>{tr("設定")}</h1>
          <h2 className="settings-section-title">{tr("帳號設定")}</h2>
          <section className="card settings-links">
            <Button secondary onClick={() => to('profile')}>{tr("編輯個人資料")}</Button>
            <Button secondary onClick={() => to('profile')}>{tr("變更密碼")}</Button>
            <Button secondary onClick={() => to('quiz')}>{tr("重新進行收納測驗")}</Button>
          </section>
          <Button secondary onClick={openNotifications}>{tr("通知中心與通知設定")}</Button>
          <h2 className="settings-section-title">{tr("通用設定")}</h2>
          <section className="card settings-links">
            <label className="row">{tr("語言")}<select aria-label={tr('語言')} value={language} onChange={event=>{void setLanguage(event.target.value==='en'?'en':'zh-TW').catch(()=>setAuthError(tr('儲存失敗')));}}><option value="zh-TW">繁體中文</option><option value="en">English</option></select></label>
            <label className="row">{tr("深色模式")}<input
                type="checkbox"
                checked={dark}
                onChange={e => setDark(e.target.checked)}
              />
            </label>
          </section>
          <section className="card settings-links">
            <h2>{tr("每日任務提醒")}</h2>
            <label className="row">{tr("首頁提醒")}<input
                type="checkbox"
                checked={!!session.user.user_metadata.daily_reminder}
                onChange={async e => {
                  try {
                    await data.setDailyReminder(e.target.checked);
                  } catch (error) {
                    setAuthError(errorText(error));
                  }
                }}
              />
            </label>
            <p className="muted">{tr(reminderDescription)}</p>
          </section>
          <h2 className="settings-section-title">{tr("關於與支援")}</h2>
          <section className="card settings-links">
            <details>
              <summary>{tr("關於我們")}</summary>
              <p>{tr(appAbout)}</p>
            </details>
            <LegalLinks/>
          </section>
          <section className="card">
            <h2>{tr("加入 Android 主畫面")}</h2>
            <p>{tr('在 Android 使用 Chrome 開啟拾序，點右上角「⋮」，選擇「加到主畫面」或「安裝應用程式」，依畫面指示完成。')}</p>
            <p className="muted">{tr('若在其他 App 內開啟，請先選擇「使用 Chrome 開啟」。選項名稱可能依瀏覽器版本不同。')}</p>
          </section>
          <section className="card">
            <h2>{tr("加入 iPhone 主畫面")}</h2>
            <p>{tr("在 Safari 按分享，選擇「加入主畫面」，即可用 App 方式開啟。")}</p>
            <p className="muted">{tr("AI、登入與雲端同步需要網路連線。")}</p>
          </section>
          <Button
            secondary
            onClick={async () => {
              try {
                await disableWebPush();
              } catch {
                alert('無法取消此裝置推播，請連線後重試登出。');
                return;
              }
              const { error } = await supabase.auth.signOut();
              if (error) setAuthError(error.message);
              else to('home');
            }}
          >{tr("登出帳號")}</Button>
          <ErrorMessage error={authError} />
        </>
      );
      break;
    default:
      page = (
        <Home
          session={session}
          persona={persona}
          reminder={!!session.user.user_metadata.daily_reminder}
          date={date}
        />
      );
  }
  return (
    <div className="app" key={session.user.id}>
      <header className="app-header">
        <button
          className="icon-button"
          aria-label={tr(route === 'home' ? '開啟選單' : '返回上一頁')}
          onClick={() =>
            route === 'home' ? setMenuOpen(true) : history.back()
          }
        >
          <AppIcon name={route === 'home' ? 'menu' : 'back'} />
        </button>
        {tr(route === 'home' ? (
          <div className="home-brand-offset"><Brand compact /></div>
        ) : route === 'chat' ? (
          <div className="ai-chat-heading"><img src={assistantBear} alt=""/><h1>{tr("收納助理")}</h1></div>
        ) : (
          <strong className="page-title">{tr(pageTitles[route] || '拾序')}</strong>
        ))}
        {tr(route === 'home' ? null : <button className="icon-button" aria-label={tr("開啟選單")} onClick={()=>setMenuOpen(true)}><AppIcon name="menu"/></button>)}
      </header>
      <AppMenu
        open={menuOpen}
        close={() => setMenuOpen(false)}
        go={navigatePage}
      />
      {tr(!online && (
        <p className="offline" role="status">{tr("目前離線，連線後可繼續使用 AI 與雲端資料。")}</p>
      ))}
      <main key={route} className={'screen screen-' + route}>
        {tr(page)}
      </main>
      <AppNavigation route={route} go={navigatePage} />
      <Notifications
        accountId={session?.user.id || ''}
        openTarget={async target => {
          if (target.orderId) {
            sessionStorage.setItem('sorti-order-id', target.orderId);
            to('market-order');
          } else if (target.conversationId && target.listingId) {
            const p = await data.loadProduct(target.listingId);
            sessionStorage.setItem(
              'sorti-market-thread',
              JSON.stringify({
                id: target.conversationId,
                title: p.title,
                productId: p.id,
                role: p.sellerId === currentUserId ? 'seller' : 'buyer',
              }),
            );
            to('market-thread');
          }
        }}
      />
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<LegalRouter><App /><FirstPermissions/></LegalRouter>);
if ('serviceWorker' in navigator && window.isSecureContext)
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
