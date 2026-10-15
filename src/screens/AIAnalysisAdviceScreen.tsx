import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from "../components/LocalizedUI";
import { useScreenStyles } from '../design/useScreenStyles';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdviceText from '../components/AdviceText';
import { parseAdvice } from '../services/adviceSections';
import { declutterOverview } from '../services/declutterOverview';

import { useTheme } from '../context/ThemeContext';
import { AI_ANALYSIS_ROOM_IMAGE } from './aiAnalysisData';
import SpaceAnalysisCard from '../components/SpaceAnalysisCard';
import { loadStorageProfile } from '../services/supabaseData';
import { askAiQuestion, cropItemsFromPhoto } from '../services/aiApi';
import { saveAiAnalysisHistoryRecord } from '../services/photoTempStore';
import type { ChatItem } from '../types/ai';

const AIAnalysisAdviceScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const styles = useScreenStyles(baseStyles, theme);
  const photoUri = route?.params?.photoUri;
  const detectedItems: ChatItem[] = useMemo(
    () =>
      Array.isArray(route?.params?.detectedItems)
        ? route.params.detectedItems
        : [],
    [route?.params?.detectedItems],
  );
  const previewUri = photoUri ?? AI_ANALYSIS_ROOM_IMAGE;
  const [rawAdviceText, setRawAdviceText] = useState('');
  const [adviceNotice, setAdviceNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(true);
  const [adviceError, setAdviceError] = useState('');
  const [isSavingHistory, setIsSavingHistory] = useState(false);

  useEffect(() => {
    let active = true;

    const generateAdvice = async () => {
      try {
        setIsLoadingAdvice(true);
        setAdviceError('');

        // 前端只傳遞任務類型與辨識資料；完整輸出規則由後端 prompts.py 管理。
        const profile = await loadStorageProfile();
        const response = await askAiQuestion({
          question: '請根據照片辨識結果產生收納分析建議。',
          detectedItems,
          mode: 'photo_analysis',
          userPersona: profile?.persona_name || undefined,
          spaceAnalysis: route?.params?.spaceAnalysis,
          storagePreferences: {
            visual_preference: profile?.visual_preference,
            detail_preference: profile?.detail_preference,
            notes: route?.params?.preferenceNotes || '',
          },
        });

        if (!active) return;
        setRawAdviceText(response.reply);
        setAdviceNotice(response.notice || '');
      } catch (error) {
        if (!active) return;
        setAdviceError(
          error instanceof Error ? error.message : '無法取得建議，請稍後再試',
        );
        setRawAdviceText('');
      } finally {
        if (!active) return;
        setIsLoadingAdvice(false);
      }
    };

    generateAdvice();

    return () => {
      active = false;
    };
  }, [
    detectedItems,
    route?.params?.spaceAnalysis,
    route?.params?.preferenceNotes,
    retry,
  ]);

  const { mainAdvice, purchaseItems } = useMemo(
    () => parseAdvice(rawAdviceText),
    [rawAdviceText],
  );

  const saveButtonOpacity =
    isLoadingAdvice || !rawAdviceText || isSavingHistory ? 0.6 : 1;

  const handleSaveAdvice = async () => {
    if (isLoadingAdvice || isSavingHistory || adviceError || !rawAdviceText) return;

    try {
      setIsSavingHistory(true);
      const boxes = route?.params?.detectionBoxes;
      const itemPhotos =
        photoUri && boxes?.length
          ? (await cropItemsFromPhoto(photoUri, boxes)).items
          : undefined;
      await saveAiAnalysisHistoryRecord({
        itemPhotos,
        photoUri: previewUri,
        detectedItems,
        adviceText: rawAdviceText,
      });
      Alert.alert(
        detectedItems.length ? '已匯入物品管理' : '已儲存建議',
        detectedItems.length
          ? '辨識物品照片已裁切並儲存，收納建議也已加入歷史紀錄。'
          : '照片與收納建議已加入歷史紀錄。',
        [
          {
            text: detectedItems.length ? '查看物品' : '查看整理紀錄',
            onPress: () => navigation.navigate(detectedItems.length ? 'ItemManagement' : 'AIAnalysisHistory'),
          },
          { text: '繼續查看建議' },
        ],
      );
    } catch (error) {
      Alert.alert(
        '儲存失敗',
        error instanceof Error
          ? error.message
          : '無法儲存歷史紀錄，請稍後再試。',
      );
    } finally {
      setIsSavingHistory(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.textMain }]}>收納建議</Text>

        <View style={styles.segmentRow}>
          <View
            style={[styles.segmentActive, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.segmentActiveText}>整理前</Text>
          </View>
        </View>

        <TouchableOpacity
          disabled={isLoadingAdvice}
          onPress={() => setRetry(value => value + 1)}
        >
          <Text style={{ color: theme.primary }}>
            依目前空間與物品重新產生建議
          </Text>
        </TouchableOpacity>
        <SpaceAnalysisCard space={route?.params?.spaceAnalysis} />
        <Text style={{ color: theme.textSub }}>{adviceNotice}</Text>
        <View style={[styles.previewWrap, { borderColor: theme.border }]}>
          <ImageBackground
            source={{ uri: previewUri }}
            style={styles.preview}
            imageStyle={styles.previewImage}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMain }]}>
            斷捨離
          </Text>
          <Text style={[styles.bodyText, { color: theme.textMain }]}>
            {declutterOverview(detectedItems)}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMain }]}>
            如何收納?
          </Text>
          {isLoadingAdvice ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textSub }]}>
                AI 正在根據辨識結果生成建議...
              </Text>
            </View>
          ) : adviceError ? (
            <Text style={styles.errorText}>{adviceError}</Text>
          ) : (
            <AdviceText text={mainAdvice} />
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMain }]}>
            建議採購
          </Text>
          {purchaseItems.length > 0 ? (
            <View style={styles.purchaseList}>
              {purchaseItems.map(item => (
                <View
                  key={item}
                  style={[
                    styles.purchaseItem,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.cardBg,
                    },
                  ]}
                >
                  <Text
                    style={[styles.purchaseItemText, { color: theme.textMain }]}
                  >
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.bodyText, { color: theme.textMain }]}>
              目前沒有需要補充的收納用品。
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.importButton,
            { backgroundColor: theme.primary, opacity: saveButtonOpacity },
          ]}
          onPress={handleSaveAdvice}
          disabled={isLoadingAdvice || !rawAdviceText || isSavingHistory}
        >
          <Text style={styles.buttonText}>
            {isSavingHistory ? '匯入中' : '裁切物品並匯入物品管理'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { borderTopColor: theme.border, backgroundColor: theme.background },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.bottomActionButton,
            { backgroundColor: theme.primary },
          ]}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.buttonText}>回主畫面</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.bottomActionButton,
            { backgroundColor: theme.primary },
          ]}
          onPress={() => navigation.navigate('CalendarCheckIn')}
        >
          <Text style={styles.buttonText}>拍照打卡</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const baseStyles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingBottom: 24 },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  segmentActive: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 3,
  },
  segmentActiveText: { color: '#111', fontSize: 16, fontWeight: '800' },
  previewWrap: {
    borderWidth: 1.5,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  preview: { height: 230 },
  previewImage: { borderRadius: 30 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 22, fontWeight: '800', marginBottom: 10 },
  bodyText: { fontSize: 15, lineHeight: 22 },
  purchaseList: { gap: 10 },
  purchaseItem: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  purchaseItemText: { fontSize: 15, fontWeight: '700' },
  loadingBlock: { paddingVertical: 10, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 14, lineHeight: 21, color: '#b42318' },
  bottomBar: {
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 12,
  },
  importButton: {
    minHeight: 50,
    padding: 14,
    marginTop: 20,
    borderRadius: 14,
    alignItems: 'center',
  },
  bottomActionButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '800', color: '#111' },
});

export default AIAnalysisAdviceScreen;
