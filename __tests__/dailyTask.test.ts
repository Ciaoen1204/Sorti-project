import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDailyTask, saveDailyTask } from '../src/services/dailyTask';
import { postAiJson } from '../src/services/aiApi';
import {
  assertTodayCheckIn,
  checkInDateKey,
} from '../src/services/checkInDate';

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { user: { id: 'user-1' } } },
      })),
    },
  },
}));
jest.mock('../src/services/aiApi', () => ({ postAiJson: jest.fn() }));

beforeEach(async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 9, 23, 59));
  jest.clearAllMocks();
  await AsyncStorage.clear();
});
afterEach(() => jest.useRealTimers());

test('rejects past and future dates before requesting a task', async () => {
  await expect(getDailyTask('2026-10-10')).rejects.toThrow();
  await expect(getDailyTask('2026-10-8')).rejects.toThrow();
  expect(postAiJson).not.toHaveBeenCalled();
});

test('keeps the same task when reopening today', async () => {
  (postAiJson as jest.Mock).mockResolvedValue({
    date: '2026-10-09',
    tasks: ['整理桌面後拍照。', '整理抽屜後拍照。', '整理鞋櫃後拍照。'],
  });
  const task = await getDailyTask(checkInDateKey());
  expect(await getDailyTask(checkInDateKey())).toEqual(task);
  expect(postAiJson).toHaveBeenCalledTimes(1);
});

test('rejects a capture date after midnight', () => {
  const key = checkInDateKey();
  assertTodayCheckIn(key);
  jest.setSystemTime(new Date(2026, 9, 10, 0, 1));
  expect(() => assertTodayCheckIn(key)).toThrow();
});

test('does not cache a task that arrives after midnight', async () => {
  (postAiJson as jest.Mock).mockImplementation(async () => {
    jest.setSystemTime(new Date(2026, 9, 10, 0, 1));
    return {
      date: '2026-10-09',
      tasks: ['整理桌面後拍照。', '整理抽屜後拍照。', '整理鞋櫃後拍照。'],
    };
  });
  await expect(getDailyTask('2026-10-9')).rejects.toThrow();
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
});

test('rejects mismatched dates from the backend', async () => {
  (postAiJson as jest.Mock).mockResolvedValue({
    date: '2026-10-10',
    tasks: ['整理桌面後拍照。', '整理抽屜後拍照。', '整理鞋櫃後拍照。'],
  });
  await expect(getDailyTask('2026-10-9')).rejects.toThrow();
});

test('keeps the selected choice and feedback when reopening', async () => {
  (postAiJson as jest.Mock).mockResolvedValue({
    date: '2026-10-09',
    tasks: ['整理桌面。', '整理抽屜。', '整理鞋櫃。'],
  });
  const original = await getDailyTask(checkInDateKey());
  const selected = {
    ...original,
    task: original.tasks[1],
    feedback: '抽屜很整齊！',
  };
  await saveDailyTask(selected);
  expect(await getDailyTask(checkInDateKey())).toEqual(selected);
});

test('rejects duplicate or fewer than three tasks', async () => {
  for (const tasks of [
    ['整理桌面。'],
    ['整理桌面。', '整理桌面。', '整理鞋櫃。'],
  ]) {
    (postAiJson as jest.Mock).mockResolvedValue({ date: '2026-10-09', tasks });
    await expect(getDailyTask(checkInDateKey())).rejects.toThrow();
  }
});
