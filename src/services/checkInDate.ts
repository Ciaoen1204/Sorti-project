/** Local calendar dates, matching the dates displayed on the phone. */
export function checkInDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function isTodayCheckIn(key: string): boolean {
  return key === checkInDateKey();
}

export function assertTodayCheckIn(key: string): void {
  if (!isTodayCheckIn(key)) {
    throw new Error('只能完成今天的任務，不能提前打卡或補打卡。');
  }
}

export function toIsoCheckInDate(key: string): string {
  const [year, month, day] = key.split('-');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
