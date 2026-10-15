import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { postAiJson } from './aiApi';
import { assertTodayCheckIn, toIsoCheckInDate } from './checkInDate';

export type DailyTask = {
  date: string;
  tasks: string[];
  task: string;
  feedback?: string;
  completedTask?: string;
  completedFeedback?: string;
};

async function storageKey(date: string): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw new Error('請先登入後再取得每日任務。');
  }
  return `sorti_daily_task_v2:${data.session.user.id}:${date}`;
}

function validTasks(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    new Set(value).size === 3 &&
    value.every(
      item => typeof item === 'string' && item.trim() && item.length <= 100,
    )
  );
}

export async function loadSavedDailyTask(
  date: string,
): Promise<DailyTask | null> {
  const raw = await AsyncStorage.getItem(await storageKey(date));
  if (!raw) {
    return null;
  }
  try {
    const value = JSON.parse(raw);
    return value.date === date &&
      validTasks(value.tasks) &&
      value.tasks.includes(value.task)
      ? value
      : null;
  } catch {
    return null;
  }
}

export async function saveDailyTask(task: DailyTask): Promise<void> {
  assertTodayCheckIn(task.date);
  if (!validTasks(task.tasks) || !task.tasks.includes(task.task)) {
    throw new Error('請選擇今天提供的任務。');
  }
  await AsyncStorage.setItem(await storageKey(task.date), JSON.stringify(task));
}

export async function getDailyTask(
  date: string,
  signal?: AbortSignal,
): Promise<DailyTask> {
  assertTodayCheckIn(date);
  const cached = await loadSavedDailyTask(date);
  assertTodayCheckIn(date);
  if (cached) {
    return cached;
  }
  const result = await postAiJson<
    { date: string; tasks: string[] },
    { date: string }
  >('/daily-task', { date: toIsoCheckInDate(date) }, { signal });
  assertTodayCheckIn(date);
  if (result.date !== toIsoCheckInDate(date) || !validTasks(result.tasks)) {
    throw new Error('每日任務格式不正確，請重新取得。');
  }
  const tasks = result.tasks.map(value => value.trim());
  const task = { date, tasks, task: tasks[0] };
  await saveDailyTask(task);
  return task;
}
