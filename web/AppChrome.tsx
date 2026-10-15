import {tr} from "../src/i18n/language";
import { useEffect, useRef, type ReactNode } from 'react';
import logo from '../src/assets/images/sorti-logo.png';
import { primaryNavigation } from '../src/design/platformAppearance';

const paths: Record<string, ReactNode> = {
  'home-outline': (
    <>
      <path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z" />
    </>
  ),
  'grid-outline': (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  'storefront-outline': (
    <>
      <path d="M4 10v11h16V10M3 4h18l1 6c-2 3-4 3-6 0-2 3-4 3-6 0-2 3-4 3-8 0zM9 21v-7h6v7" />
    </>
  ),
  'settings-outline': (
    <>
      <path d="m9 3-1 3-3 1-2 3 2 2-1 4 3 2 3-1 2 4 3-1 1-3 3-1 2-3-2-2 1-4-3-2-3 1-2-4z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  cart: (
    <>
      <path d="M2 3h3l3 12h11l3-8H6" />
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  back: <path d="m15 5-7 7 7 7" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  camera: (
    <>
      <path d="M3 7h5l2-3h4l2 3h5v14H3z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 3C4 2 1 13 7 18s15-1 13-15ZM5 21 17 7" />
    </>
  ),
  history: (
    <>
      <rect x="3" y="6" width="18" height="15" rx="2" />
      <path d="M6 3h12M7 11h10M7 16h6" />
    </>
  ),
  chat: <path d="M3 4h18v13H9l-6 4zM7 9h10M7 13h6" />,
  person: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
};
export function AppIcon({ name }: { name: string }) {
  return (
    <svg
      className="app-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {tr(paths[name] || paths.history)}
    </svg>
  );
}
export function AppBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <img src={logo} alt={tr("拾序 熊抱收納盒 Logo")} />
      <div>
        <strong>拾序</strong>
        {tr(!compact && <small>{tr("收納管理")}</small>)}
      </div>
    </div>
  );
}
export function AppNavigation({
  route,
  go,
}: {
  route: string;
  go: (route: string) => void;
}) {
  return (
    <nav aria-label={tr("主要導覽")}>
      {tr(primaryNavigation.map(item => (
        <button
          key={item.webRoute}
          aria-current={route === item.webRoute ? 'page' : undefined}
          onClick={() => go(item.webRoute)}
        >
          <AppIcon name={item.icon} />
          <span>{tr(item.label)}</span>
        </button>
      )))}
    </nav>
  );
}
export function AppMenu({
  open,
  close,
  go,
}: {
  open: boolean;
  close: () => void;
  go: (route: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    else if (!open && dialog?.open) dialog.close();
  }, [open]);
  const entries = [
    ['home', '首頁', 'home-outline'],
    ['items', '物品管理', 'grid-outline'],
    ['daily', '每日任務', 'leaf'],
    ['chat', '收納助理', 'chat'],
    ['history', '歷史紀錄', 'history'],
    ['quiz', '收納測驗', 'history'],
    ['market', '二手市集', 'storefront-outline'],
    ['donation', '捐贈與回收', 'leaf'],
    ['profile', '個人中心', 'person'],
    ['settings', '設定', 'settings-outline'],
  ];
  return (
    <dialog
      ref={ref}
      className="app-menu"
      aria-label={tr("功能選單")}
      onCancel={close}
      onClose={close}
      onClick={e => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="menu-heading">
        <AppBrand compact />

      </div>
      <div className="menu-links">
        {tr(entries.map(([path, label, icon]) => (
          <button
            key={path}
            onClick={() => {
              close();
              go(path);
            }}
          >
            <AppIcon name={icon} />
            <span>{tr(label)}</span>
          </button>
        )))}
      </div>
    </dialog>
  );
}
