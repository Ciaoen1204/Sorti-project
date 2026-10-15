export function shipmentDate(raw: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw))
    throw new Error('請填寫有效寄件日期（YYYY-MM-DD）。');
  const date = new Date(`${raw}T00:00:00+08:00`);
  if (!Number.isFinite(date.getTime()) || taipeiDay(date) !== raw)
    throw new Error('請填寫有效寄件日期。');
  if (date.getTime() > now.getTime())
    throw new Error('寄件日期不能晚於今天，請填寫已實際寄出的日期。');
  return date.toISOString();
}
export const taipeiDay = (date = new Date()) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
