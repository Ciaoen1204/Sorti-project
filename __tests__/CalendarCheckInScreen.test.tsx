import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Alert, TouchableOpacity } from 'react-native';
import CalendarCheckInScreen from '../src/screens/CalendarCheckInScreen';
import { saveCheckInRecord } from '../src/services/photoTempStore';
import { saveDailyTask } from '../src/services/dailyTask';
import { getTaskPhotoFeedback } from '../src/services/aiApi';
import * as VisionCamera from 'react-native-vision-camera';

jest.mock('react-native-vision-camera', () => ({
  __esModule: true,
  Camera: () => null,
  CommonResolutions: { HD_4_3: { width: 1280, height: 960 } },
  useCameraDevice: () => ({ id: 'back' }),
  useCameraPermission: () => ({
    hasPermission: true,
    requestPermission: jest.fn(async () => true),
  }),
  usePhotoOutput: jest.fn(),
}));

jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ theme: {}, isDarkMode: false }),
}));
jest.mock('../src/services/photoTempStore', () => ({
  loadCheckInRecords: jest.fn(async () => ({ '2026-10-8': 'file://old.jpg' })),
  saveCheckInRecord: jest.fn(),
}));
jest.mock('../src/services/dailyTask', () => ({
  getDailyTask: jest.fn(async () => ({
    date: '2026-10-9',
    task: '整理桌面後拍照打卡。',
    tasks: [
      '整理桌面後拍照打卡。',
      '整理抽屜後拍照打卡。',
      '整理鞋櫃後拍照打卡。',
    ],
  })),
  loadSavedDailyTask: jest.fn(async () => null),
  saveDailyTask: jest.fn(async () => {}),
}));
jest.mock('../src/services/aiApi', () => ({ getTaskPhotoFeedback: jest.fn() }));

let screen: Renderer.ReactTestRenderer;
beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'setImmediate'] });
  jest.setSystemTime(new Date(2026, 9, 9, 12));
  jest.clearAllMocks();
  (getTaskPhotoFeedback as jest.Mock)
    .mockReset()
    .mockResolvedValue({ feedback: '照片中桌面很整齊！' });
  (saveCheckInRecord as jest.Mock).mockResolvedValue({
    '2026-10-9': 'file://new.jpg',
  });
  jest.spyOn(VisionCamera, 'usePhotoOutput').mockReturnValue({
    capturePhotoToFile: jest.fn(async () => ({ filePath: '/new.jpg' })),
  } as any);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await act(async () => {
    screen = Renderer.create(
      <CalendarCheckInScreen navigation={{ goBack: jest.fn() }} />,
    );
  });
});

function button(label: string) {
  return screen.root
    .findAllByType(TouchableOpacity)
    .find(node => node.props.accessibilityLabel === label)!;
}

test('shows three choices and saves the selected task', async () => {
  expect(
    screen.root
      .findAllByType(TouchableOpacity)
      .filter(node => node.props.accessibilityRole === 'radio'),
  ).toHaveLength(3);
  await act(async () => button('選擇任務2').props.onPress());
  expect(saveDailyTask).toHaveBeenLastCalledWith(
    expect.objectContaining({ task: '整理抽屜後拍照打卡。' }),
  );
  expect(button('選擇任務2').props.accessibilityState.selected).toBe(true);
});

test('previews a photo before submission and allows retaking', async () => {
  await act(async () => dayButton('2026-10-9').props.onPress());
  await act(async () => button('拍照完成今日任務').props.onPress());
  expect(getTaskPhotoFeedback).not.toHaveBeenCalled();
  expect(saveCheckInRecord).not.toHaveBeenCalled();
  expect(button('重新拍攝')).toBeDefined();
  await act(async () => button('重新拍攝').props.onPress());
  expect(button('拍照完成今日任務')).toBeDefined();
});

test('submits the selected task with the photo and stores feedback', async () => {
  await act(async () => button('選擇任務2').props.onPress());
  await act(async () => dayButton('2026-10-9').props.onPress());
  await act(async () => button('拍照完成今日任務').props.onPress());
  await act(async () => button('確認照片並完成任務').props.onPress());
  expect(getTaskPhotoFeedback).toHaveBeenCalledWith(
    '2026-10-09',
    '整理抽屜後拍照打卡。',
    'file:///new.jpg',
    expect.anything(),
  );
  expect(saveDailyTask).toHaveBeenLastCalledWith(
    expect.objectContaining({ feedback: '照片中桌面很整齊！' }),
  );
  expect(Alert.alert).toHaveBeenCalledWith(
    '今日任務完成',
    '照片中桌面很整齊！',
  );
});

test('keeps the photo available for retry if Gemini fails', async () => {
  (getTaskPhotoFeedback as jest.Mock).mockRejectedValue(new Error('服務忙碌'));
  await act(async () => dayButton('2026-10-9').props.onPress());
  await act(async () => button('拍照完成今日任務').props.onPress());
  await act(async () => button('確認照片並完成任務').props.onPress());
  expect(saveCheckInRecord).not.toHaveBeenCalled();
  expect(button('重新拍攝')).toBeDefined();
  expect(button('確認照片並完成任務')).toBeDefined();
});

test('can switch tasks after completing today and keeps the old feedback', async () => {
  await act(async () => dayButton('2026-10-9').props.onPress());
  await act(async () => button('拍照完成今日任務').props.onPress());
  await act(async () => button('確認照片並完成任務').props.onPress());
  expect(button('選擇任務2').props.disabled).toBe(false);
  await act(async () => button('選擇任務2').props.onPress());
  expect(button('選擇任務2').props.accessibilityState.selected).toBe(true);
  expect(saveDailyTask).toHaveBeenLastCalledWith(
    expect.objectContaining({
      task: '整理抽屜後拍照打卡。',
      completedTask: '整理桌面後拍照打卡。',
      completedFeedback: '照片中桌面很整齊！',
      feedback: undefined,
    }),
  );
  await act(async () => button('選擇任務1').props.onPress());
  expect(saveDailyTask).toHaveBeenLastCalledWith(
    expect.objectContaining({ feedback: '照片中桌面很整齊！' }),
  );
});
afterEach(async () => {
  await act(async () => screen.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function dayButton(prefix: string) {
  return screen.root
    .findAllByType(TouchableOpacity)
    .find(node => node.props.accessibilityLabel?.startsWith(prefix))!;
}

test('future dates do not open the camera', async () => {
  await act(async () => dayButton('2026-10-10').props.onPress());
  expect(Alert.alert).toHaveBeenCalledWith('日期尚未到', expect.any(String));
  expect(
    screen.root.findAllByProps({ accessibilityLabel: '拍照完成今日任務' }),
  ).toHaveLength(0);
});

test('past records open a preview, not the camera', async () => {
  await act(async () => dayButton('2026-10-8').props.onPress());
  expect(
    screen.root.findAllByProps({ accessibilityLabel: '拍照完成今日任務' }),
  ).toHaveLength(0);
  expect(
    screen.root.findAll(node => node.props.source?.uri === 'file://old.jpg')
      .length,
  ).toBeGreaterThan(0);
});

test('a camera opened today cannot save after midnight', async () => {
  await act(async () => dayButton('2026-10-9').props.onPress());
  const shutter = screen.root
    .findAllByType(TouchableOpacity)
    .find(node => node.props.accessibilityLabel === '拍照完成今日任務')!;
  jest.setSystemTime(new Date(2026, 9, 10, 0, 1));
  await act(async () => shutter.props.onPress());
  expect(saveCheckInRecord).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith(
    '打卡失敗',
    expect.stringContaining('只能完成今天'),
  );
});
