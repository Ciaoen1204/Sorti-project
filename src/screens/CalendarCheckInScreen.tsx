import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity, LocalizedAlert as Alert } from "../components/LocalizedUI";
import { useScreenStyles } from '../design/useScreenStyles';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ScrollView, Image, ActivityIndicator, AppState, Modal, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  CommonResolutions,
} from 'react-native-vision-camera';
import { useSortiTheme as useTheme } from '../design/sortiTheme';
import {
  loadCheckInRecords,
  saveCheckInRecord,
} from '../services/photoTempStore';
import type { CheckInRecords } from '../services/photoTempStore';
import {
  checkInDateKey,
  isTodayCheckIn,
  assertTodayCheckIn,
  toIsoCheckInDate,
} from '../services/checkInDate';
import {
  getDailyTask,
  loadSavedDailyTask,
  saveDailyTask,
} from '../services/dailyTask';
import { getTaskPhotoFeedback } from '../services/aiApi';
import type { DailyTask } from '../services/dailyTask';

const CalendarCheckInScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const styles = useScreenStyles(baseStyles, theme);
  const [today, setToday] = useState(() => new Date());
  const dateKey = checkInDateKey(today);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [captureDate, setCaptureDate] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [checkInRecords, setCheckInRecords] = useState<CheckInRecords>({});
  const [task, setTask] = useState<DailyTask | null>(null);
  const [taskError, setTaskError] = useState('');
  const [taskLoading, setTaskLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [preview, setPreview] = useState<{
    date: string;
    uri: string;
    task?: string;
    feedback?: string;
  } | null>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const photoOutput = usePhotoOutput({
    targetResolution: CommonResolutions.HD_4_3,
    quality: 1,
  });
  const device = useCameraDevice('back');

  useEffect(() => {
    const refresh = () => setToday(new Date());
    const timer = setInterval(refresh, 15000);
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh();
      }
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);

  useEffect(() => {
    let active = true;
    loadCheckInRecords()
      .then(records => {
        if (active) {
          setCheckInRecords(records);
        }
      })
      .catch(() => {
        if (active) {
          Alert.alert('讀取失敗', '無法讀取打卡紀錄，請重新開啟此畫面。');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    setTask(null);
    setTaskError('');
    setTaskLoading(true);
    setCaptureDate(null);
    setCapturedPhoto(null);
    getDailyTask(dateKey, controller.signal)
      .then(value => {
        if (active) {
          setTask(value);
        }
      })
      .catch(() => {
        if (active) {
          setTaskError('無法取得今日任務，請確認網路與 AI 服務後重試。');
        }
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) {
          setTaskLoading(false);
        }
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [dateKey, retry]);

  const shiftMonth = (offset: number) => {
    const next = new Date(currentYear, currentMonth + offset, 1);
    setCurrentYear(next.getFullYear());
    setCurrentMonth(next.getMonth());
  };

  const openCamera = async () => {
    if (!task || !isTodayCheckIn(task.date)) {
      setToday(new Date());
      Alert.alert('任務尚未就緒', '請先取得今天的任務。');
      return;
    }
    if (!hasPermission && !(await requestPermission())) {
      Alert.alert('需要權限', '請至手機設定開啟相機權限，才能拍照打卡。');
      return;
    }
    if (!isTodayCheckIn(task.date)) {
      setToday(new Date());
      return;
    }
    setCapturedPhoto(null);
    setCaptureDate(task.date);
  };

  const chooseTask = async (choice: string) => {
    if (!task || savingRef.current || choice === task.task) {
      return;
    }
    try {
      const completedTask =
        task.completedTask ?? (task.feedback ? task.task : undefined);
      const completedFeedback = task.completedFeedback ?? task.feedback;
      const next = {
        ...task,
        task: choice,
        completedTask,
        completedFeedback,
        feedback: choice === completedTask ? completedFeedback : undefined,
      };
      await saveDailyTask(next);
      setTask(next);
    } catch (error) {
      Alert.alert(
        '無法選擇任務',
        error instanceof Error ? error.message : '請稍後再試。',
      );
    }
  };

  const showRecord = async (key: string) => {
    let savedTask: DailyTask | null = null;
    try {
      savedTask = await loadSavedDailyTask(key);
    } catch {
      /* 舊紀錄仍可查看照片。 */
    }
    setPreview({
      date: key,
      uri: checkInRecords[key],
      task: savedTask?.completedTask ?? savedTask?.task,
      feedback: savedTask?.completedFeedback ?? savedTask?.feedback,
    });
  };

  const selectDay = async (day: number) => {
    const key = `${currentYear}-${currentMonth + 1}-${day}`;
    const selected = new Date(currentYear, currentMonth, day);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (selected > start) {
      Alert.alert('日期尚未到', '每日任務只在當天開放，不能提前拍照打卡。');
      return;
    }
    if (checkInRecords[key]) {
      await showRecord(key);
    } else if (isTodayCheckIn(key)) {
      await openCamera();
    } else {
      Alert.alert('當天未打卡', '過去日期只能查看已有紀錄，不能補打卡。');
    }
  };

  const handleTakePic = async () => {
    if (!captureDate || savingRef.current) {
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      assertTodayCheckIn(captureDate);
      const photo = await photoOutput.capturePhotoToFile(
        { flashMode: 'off' },
        {},
      );
      assertTodayCheckIn(captureDate);
      if (!photo?.filePath) {
        throw new Error('沒有取得照片，請重新拍攝。');
      }
      const uri = photo.filePath.startsWith('file://')
        ? photo.filePath
        : `file://${photo.filePath}`;
      setCapturedPhoto(uri);
    } catch (error) {
      if (!isTodayCheckIn(captureDate)) {
        setCaptureDate(null);
        setToday(new Date());
      }
      Alert.alert(
        '打卡失敗',
        error instanceof Error ? error.message : '無法儲存照片，請稍後再試。',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const submitTask = async () => {
    if (!captureDate || !capturedPhoto || !task || savingRef.current) {
      return;
    }
    savingRef.current = true;
    setSaving(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      assertTodayCheckIn(captureDate);
      const result = await getTaskPhotoFeedback(
        toIsoCheckInDate(captureDate),
        task.task,
        capturedPhoto,
        controller.signal,
      );
      assertTodayCheckIn(captureDate);
      if (!result.feedback?.trim()) {
        throw new Error('沒有取得任務回饋，請重試。');
      }
      const nextTask = {
        ...task,
        feedback: result.feedback.trim(),
        completedTask: task.task,
        completedFeedback: result.feedback.trim(),
      };
      const records = await saveCheckInRecord(captureDate, capturedPhoto);
      await saveDailyTask(nextTask);
      setTask(nextTask);
      setCheckInRecords(records);
      setCaptureDate(null);
      setCapturedPhoto(null);
      Alert.alert('今日任務完成', result.feedback);
    } catch (error) {
      if (!isTodayCheckIn(captureDate)) {
        setCaptureDate(null);
        setCapturedPhoto(null);
        setToday(new Date());
      }
      Alert.alert(
        '送出失敗',
        error instanceof Error ? error.message : '照片已保留，請重試。',
      );
    } finally {
      clearTimeout(timeout);
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (captureDate && capturedPhoto) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.taskCard, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.taskTitle, { color: theme.textMain }]}>
              確認任務照片
            </Text>
            <Text style={[styles.taskBody, { color: theme.textMain }]}>
              {task?.task}
            </Text>
            <Image
              source={{ uri: capturedPhoto }}
              style={styles.confirmImage}
              resizeMode="contain"
            />
            <TouchableOpacity
              accessibilityLabel="重新拍攝"
              disabled={saving}
              style={[styles.secondaryButton, { borderColor: theme.border }]}
              onPress={() => setCapturedPhoto(null)}
            >
              <Text style={{ color: theme.textMain }}>重新拍攝</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="確認照片並完成任務"
              disabled={saving}
              style={[
                styles.taskButton,
                { backgroundColor: theme.primary },
                saving && styles.disabled,
              ]}
              onPress={submitTask}
            >
              {saving ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={theme.onPrimary} />
                  <Text style={{ color: theme.onPrimary }}>
                    正在產生照片回饋…
                  </Text>
                </View>
              ) : (
                <Text
                  style={[styles.taskButtonText, { color: theme.onPrimary }]}
                >
                  確認照片並完成任務
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              disabled={saving}
              style={styles.secondaryButton}
              onPress={() => {
                setCaptureDate(null);
                setCapturedPhoto(null);
              }}
            >
              <Text style={{ color: theme.textSub }}>返回任務</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (captureDate) {
    return (
      <View style={styles.cameraContainer}>
        <StatusBar barStyle="light-content" />
        {device ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            outputs={[photoOutput]}
          />
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>相機鏡頭初始化中...</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.closeCameraBtn}
          disabled={saving}
          onPress={() => setCaptureDate(null)}
        >
          <Icon name="chevron-back" size={32} color="#fff" />
        </TouchableOpacity>
        <View style={styles.cameraTask}>
          <Text style={styles.cameraTaskText}>{task?.task}</Text>
        </View>
        <View style={styles.cameraBottomBar}>
          <TouchableOpacity
            accessibilityLabel="拍照完成今日任務"
            style={[styles.shutterBtn, saving && styles.disabled]}
            disabled={saving || !device}
            onPress={handleTakePic}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const completed =
    !!checkInRecords[dateKey] &&
    !!task &&
    (task.completedTask === task.task ||
      (!task.completedTask && !!task.feedback));
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const cells = [
    ...Array(firstDayIndex).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevron-back" size={28} color={theme.textMain} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textMain }]}>
          每日任務
        </Text>
        <View style={styles.placeholderWidth} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.pageIntro}>
          <Text style={[styles.pageSubtitle, { color: theme.textSub }]}>
            選擇一項任務，完成後拍照記錄。
          </Text>
          <View style={styles.steps}>
            {['選擇任務', '拍照', '查看回饋'].map((step, index) => (
              <View key={step} style={styles.step}>
                <View
                  style={[
                    styles.stepNumber,
                    { backgroundColor: theme.primarySoft },
                  ]}
                >
                  <Text
                    style={[styles.stepNumberText, { color: theme.primary }]}
                  >
                    {index + 1}
                  </Text>
                </View>
                <Text style={[styles.stepText, { color: theme.textSub }]}>
                  {step}
                </Text>
                {index < 2 && (
                  <Icon
                    name="chevron-forward"
                    size={12}
                    color={theme.placeholder}
                  />
                )}
              </View>
            ))}
          </View>
        </View>
        <View style={[styles.taskCard, { backgroundColor: theme.cardBg }]}>
          <Text style={[styles.taskTitle, { color: theme.textMain }]}>
            {completed ? '今日已完成 ✓' : '選擇今日任務'}
          </Text>
          <Text style={[styles.taskDate, { color: theme.textSub }]}>
            {today.getMonth() + 1}月 {today.getDate()}日 · 今日三選一
          </Text>
          {taskLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.textMain} />
              <Text style={{ color: theme.textSub }}>正在產生今日任務…</Text>
            </View>
          ) : taskError ? (
            <>
              <Text style={[styles.taskBody, { color: theme.textSub }]}>
                {taskError}
              </Text>
              <TouchableOpacity
                style={[styles.taskButton, { backgroundColor: theme.primary }]}
                onPress={() => setRetry(value => value + 1)}
              >
                <Text
                  style={[styles.taskButtonText, { color: theme.onPrimary }]}
                >
                  重新取得任務
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.taskHint, { color: theme.textSub }]}>
                大約 5 分鐘，完成一項就很棒。
              </Text>
              {task?.tasks.map((choice, index) => (
                <TouchableOpacity
                  key={choice}
                  accessibilityLabel={`選擇任務${index + 1}`}
                  accessibilityRole="radio"
                  accessibilityState={{
                    selected: task.task === choice,
                    disabled: saving,
                  }}
                  disabled={saving}
                  onPress={() => chooseTask(choice)}
                  style={[
                    styles.taskChoice,
                    {
                      borderColor:
                        task.task === choice ? theme.primary : theme.border,
                      backgroundColor:
                        task.task === choice ? theme.primarySoft : theme.cardBg,
                    },
                  ]}
                >
                  <Icon
                    name={
                      task.task === choice
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={22}
                    color={
                      task.task === choice ? theme.primary : theme.placeholder
                    }
                  />
                  <Text style={[styles.choiceText, { color: theme.textMain }]}>
                    {choice}
                  </Text>
                </TouchableOpacity>
              ))}
              {!!task?.feedback && (
                <View
                  style={[
                    styles.feedbackCard,
                    { backgroundColor: theme.background },
                  ]}
                >
                  <Text style={[styles.taskTitle, { color: theme.textMain }]}>
                    任務回饋
                  </Text>
                  <Text style={[styles.taskBody, { color: theme.textMain }]}>
                    {task.feedback}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.taskButton, { backgroundColor: theme.primary }]}
                onPress={() => (completed ? showRecord(dateKey) : openCamera())}
              >
                <Text
                  style={[styles.taskButtonText, { color: theme.onPrimary }]}
                >
                  {completed ? '查看今日照片' : '拍下成果，完成任務'}
                </Text>
              </TouchableOpacity>
              {completed && (
                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    { borderColor: theme.border },
                  ]}
                  onPress={openCamera}
                >
                  <Text style={{ color: theme.textMain }}>
                    重新拍攝今日照片
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
          <Text style={[styles.taskHint, { color: theme.textSub }]}>
            僅限當天打卡，請拍攝整理完成後的成果。
          </Text>
        </View>
        <View style={styles.historyHeading}>
          <Text style={[styles.sectionTitle, { color: theme.textMain }]}>
            我的打卡足跡
          </Text>
          <Icon name="calendar-outline" size={19} color={theme.primary} />
        </View>
        <View style={[styles.monthSelector, { backgroundColor: theme.cardBg }]}>
          <TouchableOpacity
            onPress={() => shiftMonth(-1)}
            style={styles.arrowBtn}
          >
            <Icon name="chevron-back" size={20} color={theme.textSub} />
          </TouchableOpacity>
          <Text style={[styles.monthText, { color: theme.textMain }]}>
            {currentYear}年 {currentMonth + 1}月
          </Text>
          <TouchableOpacity
            onPress={() => shiftMonth(1)}
            style={styles.arrowBtn}
          >
            <Icon name="chevron-forward" size={20} color={theme.textSub} />
          </TouchableOpacity>
        </View>
        <View style={[styles.calendarCard, { backgroundColor: theme.cardBg }]}>
          <View style={styles.weekHeader}>
            {['日', '一', '二', '三', '四', '五', '六'].map(day => (
              <Text
                key={day}
                style={[styles.weekDayText, { color: theme.textSub }]}
              >
                {day}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {cells.map((day, index) => {
              if (!day) {
                return <View key={`empty-${index}`} style={styles.dayCell} />;
              }
              const key = `${currentYear}-${currentMonth + 1}-${day}`;
              const isToday = key === dateKey;
              const future =
                new Date(currentYear, currentMonth, day) >
                new Date(
                  today.getFullYear(),
                  today.getMonth(),
                  today.getDate(),
                );
              const uri = !future && checkInRecords[key];
              return (
                <View key={key} style={styles.dayCell}>
                  <TouchableOpacity
                    accessibilityLabel={`${key}${
                      future ? '，尚未開放' : uri ? '，已打卡' : ''
                    }`}
                    onPress={() => selectDay(day)}
                    style={[
                      uri ? styles.avatarWrapper : styles.normalCell,
                      isToday && { backgroundColor: theme.primary },
                      future && styles.disabled,
                    ]}
                  >
                    {uri ? (
                      <Image source={{ uri }} style={styles.dayImg} />
                    ) : (
                      <Text
                        style={[
                          styles.dayText,
                          { color: isToday ? theme.onPrimary : theme.textMain },
                          isToday && styles.todayText,
                        ]}
                      >
                        {day}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
      <Modal
        visible={!!preview}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview(null)}
      >
        <View style={styles.previewBackdrop}>
          <View style={[styles.previewCard, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.taskTitle, { color: theme.textMain }]}>
              {preview?.date} 打卡紀錄
            </Text>
            <Text style={[styles.taskBody, { color: theme.textSub }]}>
              {preview?.task || '照片打卡紀錄'}
            </Text>
            {preview && (
              <Image
                source={{ uri: preview.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}
            {!!preview?.feedback && (
              <Text style={[styles.taskBody, { color: theme.textMain }]}>
                {preview.feedback}
              </Text>
            )}
            <TouchableOpacity
              style={[styles.taskButton, { backgroundColor: theme.primary }]}
              onPress={() => setPreview(null)}
            >
              <Text style={[styles.taskButtonText, { color: theme.onPrimary }]}>
                關閉
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const baseStyles = StyleSheet.create({
  pageIntro: { width: '100%', marginBottom: 24 },
  introTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: 'flex-start',
    borderRadius: 20,
  },
  introTagText: { fontSize: 11, fontWeight: '600' },
  pageTitle: { fontSize: 27, lineHeight: 38, fontWeight: '700', marginTop: 16 },
  pageSubtitle: { fontSize: 13, lineHeight: 22, marginTop: 8 },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 22,
    flexWrap: 'wrap',
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { fontSize: 11, fontWeight: '700' },
  stepText: { fontSize: 11 },
  historyHeading: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  taskChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: 1.5,
    borderRadius: 18,
    marginVertical: 7,
  },
  choiceText: { flex: 1, fontSize: 14, lineHeight: 24 },
  feedbackCard: { padding: 16, borderRadius: 12, marginVertical: 16 },
  secondaryButton: {
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    marginVertical: 12,
  },
  confirmImage: {
    width: '100%',
    height: 350,
    marginBottom: 12,
    borderRadius: 20,
  },
  taskCard: { width: '100%', padding: 22, borderRadius: 28, marginBottom: 20 },
  taskTitle: { fontSize: 19, fontWeight: '700' },
  taskDate: { fontSize: 12, marginTop: 8 },
  taskBody: { fontSize: 16, lineHeight: 25, marginVertical: 16 },
  taskButton: {
    padding: 16,
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  taskButtonText: { fontSize: 15, fontWeight: '700' },
  taskHint: { fontSize: 12, lineHeight: 18, marginTop: 12 },
  loadingRow: { flexDirection: 'row', gap: 10, marginVertical: 20 },
  disabled: { opacity: 0.35 },
  cameraTask: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  cameraTaskText: { color: '#fff', fontSize: 16, lineHeight: 24 },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  previewCard: { padding: 20, borderRadius: 20 },
  previewImage: { width: '100%', height: 300, marginBottom: 20 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  backBtn: { paddingVertical: 5, paddingRight: 15, zIndex: 10 },
  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  placeholderWidth: { width: 32 },
  scrollContent: {
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 24,
    paddingBottom: 30,
    maxWidth: 620,
    width: '100%',
    alignSelf: 'center',
  },

  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
  },
  arrowBtn: { padding: 6, borderRadius: 10, borderWidth: 1 },
  monthText: { fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },

  calendarCard: {
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 8,
    width: '100%',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  weekHeader: { flexDirection: 'row', width: '100%', marginBottom: 12 },
  weekDayText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 13,
    color: '#a89d9d',
    fontWeight: '600',
  },
  sundayText: { color: '#c99e93' },

  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  dayCell: {
    width: '14.28%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  normalCell: {
    width: 38,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 19,
  },
  dayText: { fontSize: 15, fontWeight: '500',textAlign:'center',minWidth:24,lineHeight:20 },

  avatarWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    backgroundColor: '#f5f5f5',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  dayImg: { width: '100%', height: '100%' },

  todayCell: {},
  todayText: { fontSize: 15, fontWeight: '700' },

  errorContainer: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: { color: '#888', fontSize: 15 },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  closeCameraBtn: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
  },
  cameraBottomBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 150,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20, // 已修正 justifyContent
  },
  albumShortcut: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: '#333',
  },
  shortcutImg: { width: '100%', height: '100%' },
  albumEmpty: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 56,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },
  cameraPlaceholder: { width: 52 },
});

export default CalendarCheckInScreen;
