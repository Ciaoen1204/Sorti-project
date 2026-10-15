import { taipeiDate } from './api';
export function assertTodayCheckIn(key: string): void {
  if (
    key.split('-').map(Number).join('-') !==
    taipeiDate().split('-').map(Number).join('-')
  ) {
    throw Error('只能完成今天的任務，不能提前打卡或補打卡。');
  }
}
