import { LocalizedText as Text } from "../components/LocalizedUI";
import { useScreenStyles } from '../design/useScreenStyles';
import React, { useEffect, useState } from 'react';
import { StyleSheet, ActivityIndicator, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../context/ThemeContext';
import { AI_ANALYSIS_ROOM_IMAGE } from './aiAnalysisData';
import { detectItemsFromPhoto } from '../services/aiApi';

const AIAnalysisProcessingScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const styles = useScreenStyles(baseStyles, theme);
  const photoUri = route?.params?.photoUri;
  const previewUri = photoUri ?? AI_ANALYSIS_ROOM_IMAGE;
  const [statusText, setStatusText] = useState(
    '正在偵測物品、分類空間與找出可優先整理的重點。',
  );

  useEffect(() => {
    let active = true;

    const runDetection = async () => {
      try {
        setStatusText('先分析可見空間、動線與收納櫃，再辨識物品。');
        const response = await detectItemsFromPhoto(photoUri);
        if (!active) return;

        navigation.replace('AIAnalysisResult', {
          photoUri,
          detectedItems: response.detected_items,
          detectionBoxes: response.detection_boxes,
          totalDetections: response.total_detections,
          modelName: response.model_name,
          detectionNotice: response.notice,
          aiStatus: response.ai_status,
          spaceAnalysis: response.space_analysis,
          spaceNotice: response.space_notice,
        });
      } catch (error) {
        if (!active) return;
        navigation.replace('AIAnalysisResult', {
          photoUri,
          detectedItems: [],
          detectionBoxes: [],
          totalDetections: 0,
          modelName: 'best.pt',
          detectionNotice:
            error instanceof Error ? error.message : '辨識失敗，請重新拍攝。',
        });
      }
    };

    runDetection();

    return () => {
      active = false;
    };
  }, [navigation, photoUri]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.centerBlock}>
        <Image source={{ uri: previewUri }} style={styles.preview} />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.title}>正在分析空間</Text>
        <Text style={styles.subtitle}>{statusText}</Text>
      </View>
    </SafeAreaView>
  );
};

const baseStyles = StyleSheet.create({
  container: { flex: 1 },
  preview: { width: 200, height: 150, borderRadius: 12, marginBottom: 32 },
  background: {
    flex: 1,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.85,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.52)',
  },
  centerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 28,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    marginBottom: 12,
    marginTop: 24,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1f1f1f',
    textAlign: 'center',
    fontWeight: '600',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 22,
  },
  progressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  progressActive: { backgroundColor: 'rgba(255,209,102,0.85)' },
  progressText: { color: '#555', fontSize: 12, fontWeight: '700' },
  progressTextActive: { color: '#333', fontSize: 12, fontWeight: '800' },
  actionArea: {
    padding: 20,
    backgroundColor: '#fff',
  },
  disabledButton: {
    height: 58,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.36,
  },
  disabledText: {
    color: '#111',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default AIAnalysisProcessingScreen;
