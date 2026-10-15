export function normalizeStorageLocation(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 100) : '';
}

export function itemPlacementLabel(location: unknown): '待整理' | '已定位' {
  return normalizeStorageLocation(location) ? '已定位' : '待整理';
}

export function itemImportLabel(createdAt: unknown, source: unknown): string {
  if (typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) return '';
  const date = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(createdAt));
  return `${date} · ${source === 'ai' ? '照片辨識匯入' : '手動新增'}`;
}
