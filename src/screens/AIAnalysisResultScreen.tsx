import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from "../components/LocalizedUI";
import { useScreenStyles } from '../design/useScreenStyles';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, ImageBackground, Modal, PanResponder, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import { useTheme } from '../context/ThemeContext';
import SpaceAnalysisCard from '../components/SpaceAnalysisCard';
import { AI_ANALYSIS_ROOM_IMAGE } from './aiAnalysisData';
import { cropItemsFromPhoto } from '../services/aiApi';
import { saveRemoteAnalysis } from '../services/supabaseData';
import type { ChatItem, DetectionBox } from '../types/ai';

type EditableDetectionBox = DetectionBox & { id: string };

type NormalizedPoint = { x: number; y: number };

type NormalizedRect = { x: number; y: number; width: number; height: number };

type DraftCorner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const createBoxId = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const toBoxRect = (box: DetectionBox): NormalizedRect => ({
  x: box.x,
  y: box.y,
  width: box.width,
  height: box.height,
});

const toDisplayRect = (
  box: NormalizedRect,
  frame: { width: number; height: number },
) => ({
  left: box.x * frame.width,
  top: box.y * frame.height,
  width: box.width * frame.width,
  height: box.height * frame.height,
});

const containsPointInRect = (point: NormalizedPoint, rect: NormalizedRect) => {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
};

const buildRectFromPoints = (
  start: NormalizedPoint,
  end: NormalizedPoint,
): NormalizedRect => {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  return {
    x: left,
    y: top,
    width,
    height,
  };
};

const getBoxesAtPoint = (
  boxes: EditableDetectionBox[],
  point: NormalizedPoint,
) => boxes.filter(box => containsPointInRect(point, toBoxRect(box))).reverse();

const normalizeRect = (rect: NormalizedRect): NormalizedRect => {
  const width = Math.max(0.04, Math.min(1, rect.width));
  const height = Math.max(0.04, Math.min(1, rect.height));
  const x = Math.max(0, Math.min(1 - width, rect.x));
  const y = Math.max(0, Math.min(1 - height, rect.y));

  return { x, y, width, height };
};

const getRectCornerPoint = (
  rect: NormalizedRect,
  corner: DraftCorner,
): NormalizedPoint => {
  switch (corner) {
    case 'topLeft':
      return { x: rect.x, y: rect.y };
    case 'topRight':
      return { x: rect.x + rect.width, y: rect.y };
    case 'bottomLeft':
      return { x: rect.x, y: rect.y + rect.height };
    case 'bottomRight':
    default:
      return { x: rect.x + rect.width, y: rect.y + rect.height };
  }
};

const getOppositeCorner = (corner: DraftCorner): DraftCorner => {
  switch (corner) {
    case 'topLeft':
      return 'bottomRight';
    case 'topRight':
      return 'bottomLeft';
    case 'bottomLeft':
      return 'topRight';
    case 'bottomRight':
    default:
      return 'topLeft';
  }
};

const buildSummaryItems = (boxes: EditableDetectionBox[]): ChatItem[] => {
  const categoryMap = new Map<string, ChatItem>();

  boxes.forEach(box => {
    const name = box.name?.trim() || '未命名物品';
    const category = box.category?.trim() || '未分類';
    const current = categoryMap.get(`${category}-${name}`) ?? {
      name,
      category,
      count: 0,
    };
    current.count += 1;
    categoryMap.set(`${category}-${name}`, current);
  });

  return Array.from(categoryMap.values()).sort(
    (left, right) =>
      right.count - left.count ||
      left.category.localeCompare(right.category, 'zh-Hant') ||
      left.name.localeCompare(right.name, 'zh-Hant'),
  );
};

const AIAnalysisResultScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const styles = useScreenStyles(baseStyles, theme);
  const photoUri = route?.params?.photoUri;
  const [importing, setImporting] = useState(false);
  const [preferenceNotes, setPreferenceNotes] = useState('');
  const previewUri = photoUri ?? AI_ANALYSIS_ROOM_IMAGE;
  const [editableBoxes, setEditableBoxes] = useState<EditableDetectionBox[]>(
    () =>
      (Array.isArray(route?.params?.detectionBoxes)
        ? route.params.detectionBoxes
        : []
      ).map((box: DetectionBox) => ({
        ...box,
        id: createBoxId(),
      })),
  );
  const totalDetections = editableBoxes.length;
  const [cropPreviews, setCropPreviews] = useState<
    { name: string; category: string; photoUri: string }[]
  >([]);
  const [cropping, setCropping] = useState(false);
  const cropVersion = useRef(0);
  useEffect(() => {
    cropVersion.current += 1;
    setCropPreviews([]);
  }, [editableBoxes, photoUri]);
  async function previewCrops() {
    if (!photoUri || cropping) return;
    setCropping(true);
    try {
      const version = cropVersion.current;
      const { items } = await cropItemsFromPhoto(photoUri, editableBoxes);
      if (version === cropVersion.current) setCropPreviews(items);
    } catch (error) {
      Alert.alert(
        '裁切失敗',
        error instanceof Error ? error.message : '請稍後重試。',
      );
    } finally {
      setCropping(false);
    }
  }
  const [expandedTitle, setExpandedTitle] = useState('');
  const [previewFrameWidth, setPreviewFrameWidth] = useState(0);
  const [previewImageSize, setPreviewImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [draftModalVisible, setDraftModalVisible] = useState(false);
  const [draftBoxId, setDraftBoxId] = useState<string | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [draftRect, setDraftRect] = useState<NormalizedRect | null>(null);

  // Animated Values 用於平滑手勢
  const panAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const resizeAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [activeCorner, setActiveCorner] = useState<DraftCorner | null>(null);

  const draftRectRef = useRef<NormalizedRect | null>(null);
  const gestureStartRectRef = useRef<NormalizedRect | null>(null);

  const displayItems = useMemo(
    () => buildSummaryItems(editableBoxes),
    [editableBoxes],
  );

  const displayCategories = useMemo(() => {
    const categoryMap = new Map<string, EditableDetectionBox[]>();

    editableBoxes.forEach(box => {
      const category = box.category?.trim() || '未分類';
      const current = categoryMap.get(category) ?? [];
      current.push(box);
      categoryMap.set(category, current);
    });

    return Array.from(categoryMap.entries())
      .map(([title, boxes]) => ({ title, boxes }))
      .sort(
        (left, right) =>
          right.boxes.length - left.boxes.length ||
          left.title.localeCompare(right.title, 'zh-Hant'),
      );
  }, [editableBoxes]);

  useEffect(() => {
    if (!expandedTitle && displayCategories.length > 0) {
      setExpandedTitle(displayCategories[0].title);
    }
  }, [displayCategories, expandedTitle]);

  useEffect(() => {
    let active = true;

    if (!previewUri) {
      setPreviewImageSize(null);
      return;
    }

    Image.getSize(
      previewUri,
      (width, height) => {
        if (!active) return;
        setPreviewImageSize({ width, height });
      },
      () => {
        if (!active) return;
        setPreviewImageSize(null);
      },
    );

    return () => {
      active = false;
    };
  }, [previewUri]);

  const selectedBox = useMemo(
    () => editableBoxes.find(box => box.id === selectedBoxId) ?? null,
    [editableBoxes, selectedBoxId],
  );

  useEffect(() => {
    if (!selectedBox) {
      return;
    }

    setEditName(selectedBox.name);
    setEditCategory(selectedBox.category);
  }, [selectedBox]);

  const openEditModal = (box: EditableDetectionBox) => {
    setSelectedBoxId(box.id);
    setEditName(box.name);
    setEditCategory(box.category);
    setEditModalVisible(true);
  };

  const selectBoxFromList = (box: EditableDetectionBox) => {
    setSelectedBoxId(box.id);
    setEditName(box.name);
    setEditCategory(box.category);
  };

  const getItemActionButtonTextStyle = (color: string) => [
    styles.itemActionButtonText,
    { color },
  ];

  const previewImageFrame = useMemo(() => {
    const frameHeight = 420;
    if (
      !previewFrameWidth ||
      !previewImageSize ||
      previewImageSize.width <= 0 ||
      previewImageSize.height <= 0
    ) {
      return { left: 0, top: 0, width: previewFrameWidth, height: frameHeight };
    }

    const containerRatio = previewFrameWidth / frameHeight;
    const imageRatio = previewImageSize.width / previewImageSize.height;

    if (imageRatio > containerRatio) {
      const width = previewFrameWidth;
      const height = previewFrameWidth / imageRatio;
      return {
        left: 0,
        top: (frameHeight - height) / 2,
        width,
        height,
      };
    }

    const height = frameHeight;
    const width = frameHeight * imageRatio;
    return {
      left: (previewFrameWidth - width) / 2,
      top: 0,
      width,
      height,
    };
  }, [previewFrameWidth, previewImageSize]);

  const handlePreviewLayout = (event: LayoutChangeEvent) => {
    setPreviewFrameWidth(event.nativeEvent.layout.width);
  };

  useEffect(() => {
    draftRectRef.current = draftRect;
  }, [draftRect]);

  const normalizePoint = (x: number, y: number): NormalizedPoint => {
    if (!previewImageFrame.width || !previewImageFrame.height) {
      return { x: 0, y: 0 };
    }

    return {
      x: clamp01(x / previewImageFrame.width),
      y: clamp01(y / previewImageFrame.height),
    };
  };

  const startAddDraft = () => {
    const defaultWidth = 0.32;
    const defaultHeight = 0.22;
    const defaultRect = normalizeRect({
      x: 0.5 - defaultWidth / 2,
      y: 0.5 - defaultHeight / 2,
      width: defaultWidth,
      height: defaultHeight,
    });

    panAnim.setValue({ x: 0, y: 0 });
    resizeAnim.setValue({ x: 0, y: 0 });
    setActiveCorner(null);
    setIsAddMode(true);
    setSelectedBoxId(null);
    setDraftRect(defaultRect);
    setEditName('');
    setEditCategory('');
    setEditModalVisible(false);
    setDraftModalVisible(false);
  };

  const confirmDraftBox = () => {
    if (!draftRect) {
      Alert.alert('尚未建立框框', '請先在圖片上調整出一個框框。');
      return;
    }

    const newBox: EditableDetectionBox = {
      id: createBoxId(),
      name: '',
      category: '',
      x: draftRect.x,
      y: draftRect.y,
      width: draftRect.width,
      height: draftRect.height,
    };

    setEditableBoxes(currentBoxes => [...currentBoxes, newBox]);
    setSelectedBoxId(newBox.id);
    setEditName('');
    setEditCategory('');
    setIsAddMode(false);
    setDraftRect(null);
    panAnim.setValue({ x: 0, y: 0 });
    resizeAnim.setValue({ x: 0, y: 0 });
    setActiveCorner(null);
    setDraftBoxId(newBox.id);
    setDraftModalVisible(true);
    setEditModalVisible(false);
  };

  const cancelDraftBox = () => {
    setIsAddMode(false);
    setDraftRect(null);
    panAnim.setValue({ x: 0, y: 0 });
    resizeAnim.setValue({ x: 0, y: 0 });
    setActiveCorner(null);
  };

  // 1. 整體移動手勢 (PanResponder)
  const draftMoveResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          gestureStartRectRef.current = draftRectRef.current;
        },
        onPanResponderMove: Animated.event(
          [null, { dx: panAnim.x, dy: panAnim.y }],
          {
            useNativeDriver: false,
          },
        ),
        onPanResponderRelease: (_event, gestureState) => {
          if (
            gestureStartRectRef.current &&
            previewImageFrame.width &&
            previewImageFrame.height
          ) {
            const dxNorm = gestureState.dx / previewImageFrame.width;
            const dyNorm = gestureState.dy / previewImageFrame.height;

            const updatedRect = normalizeRect({
              ...gestureStartRectRef.current,
              x: gestureStartRectRef.current.x + dxNorm,
              y: gestureStartRectRef.current.y + dyNorm,
            });

            setDraftRect(updatedRect);
          }
          panAnim.setValue({ x: 0, y: 0 });
        },
        onPanResponderTerminate: () => {
          panAnim.setValue({ x: 0, y: 0 });
        },
      }),
    [panAnim, previewImageFrame],
  );

  // 2. 左上與右下控制點手勢 (PanResponder + Animated)
  const createHandleResponder = (corner: DraftCorner) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        gestureStartRectRef.current = draftRectRef.current;
        setActiveCorner(corner);
      },
      onPanResponderMove: Animated.event(
        [null, { dx: resizeAnim.x, dy: resizeAnim.y }],
        {
          useNativeDriver: false,
        },
      ),
      onPanResponderRelease: (_event, gestureState) => {
        const startRect = gestureStartRectRef.current;
        if (startRect && previewImageFrame.width && previewImageFrame.height) {
          const oppositeCorner = getOppositeCorner(corner);
          const anchor = getRectCornerPoint(startRect, oppositeCorner);
          const movedCorner = getRectCornerPoint(startRect, corner);

          const currentPoint = {
            x: movedCorner.x + gestureState.dx / previewImageFrame.width,
            y: movedCorner.y + gestureState.dy / previewImageFrame.height,
          };

          const newRect = normalizeRect(
            buildRectFromPoints(anchor, currentPoint),
          );
          setDraftRect(newRect);
        }
        resizeAnim.setValue({ x: 0, y: 0 });
        setActiveCorner(null);
      },
      onPanResponderTerminate: () => {
        resizeAnim.setValue({ x: 0, y: 0 });
        setActiveCorner(null);
      },
    });

  const renderDraftHandle = (corner: DraftCorner) => {
    if (!draftRect) return null;

    const positionStyle = (() => {
      switch (corner) {
        case 'topLeft':
          return { left: -14, top: -14 };
        case 'topRight':
          return { right: -14, top: -14 };
        case 'bottomLeft':
          return { left: -14, bottom: -14 };
        case 'bottomRight':
        default:
          return { right: -14, bottom: -14 };
      }
    })();

    const handleResponder = createHandleResponder(corner);

    return (
      <View
        key={corner}
        {...handleResponder.panHandlers}
        style={[styles.draftHandle, positionStyle]}
      />
    );
  };

  // 動態計算 DraftBox 樣式（包含動態移動 Translate 與動態縮放 Width/Height/Translate）
  const animatedDraftBoxStyle = useMemo(() => {
    if (!draftRect) return {};

    const baseWidth = draftRect.width * previewImageFrame.width;
    const baseHeight = draftRect.height * previewImageFrame.height;
    const baseLeft = draftRect.x * previewImageFrame.width;
    const baseTop = draftRect.y * previewImageFrame.height;

    if (activeCorner === 'topLeft') {
      // 左上角調整：寬高變動，並且 x, y 隨手勢平移
      return {
        left: baseLeft,
        top: baseTop,
        width: Animated.subtract(baseWidth, resizeAnim.x),
        height: Animated.subtract(baseHeight, resizeAnim.y),
        transform: [{ translateX: resizeAnim.x }, { translateY: resizeAnim.y }],
      };
    }

    if (activeCorner === 'bottomRight') {
      // 右下角調整：僅寬高變動，位置固定
      return {
        left: baseLeft,
        top: baseTop,
        width: Animated.add(baseWidth, resizeAnim.x),
        height: Animated.add(baseHeight, resizeAnim.y),
      };
    }

    // 平時或整體平移模式
    return {
      left: baseLeft,
      top: baseTop,
      width: baseWidth,
      height: baseHeight,
      transform: panAnim.getTranslateTransform(),
    };
  }, [draftRect, previewImageFrame, activeCorner, resizeAnim, panAnim]);

  const selectBoxAtPoint = (point: NormalizedPoint) => {
    const hitBoxes = getBoxesAtPoint(editableBoxes, point);

    if (hitBoxes.length === 0) {
      setSelectedBoxId(null);
      return false;
    }

    openEditModal(hitBoxes[0]);
    return true;
  };

  const previewPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: event => {
      if (isAddMode) {
        return false;
      }

      const { locationX, locationY } = event.nativeEvent;
      const point = normalizePoint(locationX, locationY);
      const hitExistingBox = editableBoxes.some(box =>
        containsPointInRect(point, toBoxRect(box)),
      );
      return hitExistingBox;
    },
    onMoveShouldSetPanResponder: () => false,
    onPanResponderGrant: event => {
      if (isAddMode) {
        return;
      }

      const { locationX, locationY } = event.nativeEvent;
      const point = normalizePoint(locationX, locationY);
      selectBoxAtPoint(point);
    },
    onPanResponderMove: () => undefined,
    onPanResponderRelease: () => undefined,
    onPanResponderTerminate: () => undefined,
  });

  const closeEditModal = () => {
    setEditModalVisible(false);
    setDraftModalVisible(false);

    if (draftBoxId) {
      setEditableBoxes(currentBoxes =>
        currentBoxes.filter(box => box.id !== draftBoxId),
      );
    }

    setDraftBoxId(null);
    setEditName('');
    setEditCategory('');
  };

  const saveEditModal = () => {
    const trimmedName = editName.trim();
    const trimmedCategory = editCategory.trim();

    if (!trimmedName || !trimmedCategory) {
      Alert.alert('資料不完整', '請先輸入物品名稱與分類。');
      return;
    }

    if (!selectedBoxId) {
      Alert.alert('尚未選取框框', '請先選擇一個物品。');
      return;
    }

    setEditableBoxes(currentBoxes =>
      currentBoxes.map(box =>
        box.id === selectedBoxId
          ? {
              ...box,
              name: trimmedName,
              category: trimmedCategory,
            }
          : box,
      ),
    );

    setEditModalVisible(false);
    setDraftModalVisible(false);
    setDraftBoxId(null);
  };

  const isDetailsModalVisible = editModalVisible || draftModalVisible;

  const deleteBox = (box: EditableDetectionBox) => {
    Alert.alert('確定刪除嗎？', `要刪除「${box.name || '未命名物品'}」嗎？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: () => {
          setEditableBoxes(currentBoxes =>
            currentBoxes.filter(candidate => candidate.id !== box.id),
          );

          if (selectedBoxId === box.id) {
            setSelectedBoxId(null);
          }

          if (draftBoxId === box.id) {
            setDraftBoxId(null);
            setDraftModalVisible(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevron-back" size={28} color={theme.textMain} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textMain }]}>
          分析結果
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SpaceAnalysisCard
          space={route?.params?.spaceAnalysis}
          notice={route?.params?.spaceNotice}
        />
        <View
          style={[
            styles.objectReview,
            { backgroundColor: theme.cardBg, borderColor: theme.border },
          ]}
        >
          <View
            style={[
              styles.previewCard,
              styles.previewInPanel,
              { backgroundColor: theme.cardBg, borderColor: theme.border },
            ]}
          >
            <View
              style={styles.preview}
              onLayout={handlePreviewLayout}
              {...previewPanResponder.panHandlers}
            >
              <ImageBackground
                source={{ uri: previewUri }}
                style={styles.previewImageBackground}
                imageStyle={styles.previewImage}
                resizeMode="contain"
              />
              <View
                pointerEvents="box-none"
                style={[
                  styles.previewImageLayer,
                  {
                    left: previewImageFrame.left,
                    top: previewImageFrame.top,
                    width: previewImageFrame.width,
                    height: previewImageFrame.height,
                  },
                ]}
              >
                {editableBoxes.map(box => {
                  const rect = toDisplayRect(toBoxRect(box), previewImageFrame);
                  const isSelected = selectedBoxId === box.id;

                  return (
                    <View
                      key={box.id}
                      style={[
                        styles.detectionBox,
                        isSelected && styles.detectionBoxSelected,
                        {
                          left: rect.left,
                          top: rect.top,
                          width: rect.width,
                          height: rect.height,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.boxLabel,
                          isSelected && styles.boxLabelSelected,
                        ]}
                      >
                        <Text style={styles.boxLabelText}>
                          {box.name || '未命名物品'}
                        </Text>
                      </View>
                    </View>
                  );
                })}

                {draftRect ? (
                  <Animated.View
                    pointerEvents="auto"
                    style={[
                      styles.detectionBox,
                      styles.draftBox,
                      animatedDraftBoxStyle,
                    ]}
                  >
                    <View
                      {...draftMoveResponder.panHandlers}
                      style={styles.draftMoveSurface}
                    />
                    <View style={[styles.boxLabel, styles.draftLabel]}>
                      <Text style={styles.boxLabelText}>新增框框</Text>
                    </View>
                    {renderDraftHandle('topLeft')}
                    {renderDraftHandle('bottomRight')}
                  </Animated.View>
                ) : null}
              </View>
              <View pointerEvents="none" style={styles.previewMask} />
              <View style={styles.resultBadge}>
                <Icon name="checkmark-done-outline" size={16} color="#fff" />
                <Text style={styles.resultBadgeText}>
                  {editableBoxes.length > 0
                    ? `已辨識 ${totalDetections} 個物件`
                    : `目前沒有辨識到明確物品`}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.sectionHeader, { borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.textMain }]}>
              物品統整
            </Text>
            <TouchableOpacity
              style={[
                styles.sectionAddButton,
                { backgroundColor: theme.primary },
              ]}
              onPress={startAddDraft}
            >
              <Text style={styles.sectionAddButtonText}>新增物品</Text>
            </TouchableOpacity>
          </View>

          {isAddMode && draftRect ? (
            <View
              style={[
                styles.draftActionBar,
                { borderColor: theme.border, backgroundColor: theme.cardBg },
              ]}
            >
              <Text style={[styles.draftActionText, { color: theme.textSub }]}>
                先調整圖片上的框框，再按確定填寫詳細資訊。
              </Text>
              <View style={styles.draftActionButtons}>
                <TouchableOpacity
                  style={[
                    styles.draftCancelButton,
                    { borderColor: theme.border },
                  ]}
                  onPress={cancelDraftBox}
                >
                  <Text
                    style={[
                      styles.draftCancelButtonText,
                      { color: theme.textMain },
                    ]}
                  >
                    取消
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.draftConfirmButton,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={confirmDraftBox}
                >
                  <Text style={styles.draftConfirmButtonText}>確定</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {displayCategories.length > 0 ? (
            <View
              style={[
                styles.categoryPanel,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ]}
            >
              {displayCategories.map(category => {
                const isOpen = category.title === expandedTitle;
                return (
                  <View key={category.title} style={styles.categoryBlock}>
                    <TouchableOpacity
                      style={[
                        styles.categoryHeader,
                        isOpen && styles.categoryHeaderOpen,
                      ]}
                      onPress={() =>
                        setExpandedTitle(isOpen ? '' : category.title)
                      }
                    >
                      <View style={styles.categoryHeaderLeft}>
                        <Text style={[styles.arrow, { color: theme.textMain }]}>
                          {isOpen ? '⌄' : '>'}
                        </Text>
                        <Text
                          style={[
                            styles.categoryName,
                            { color: theme.textMain },
                          ]}
                        >
                          {category.title}({category.boxes.length}件)
                        </Text>
                      </View>
                      <Text
                        style={[styles.deleteText, { color: theme.textMain }]}
                      >
                        {isOpen ? '展開中' : '查看'}
                      </Text>
                    </TouchableOpacity>

                    {isOpen ? (
                      <View style={styles.categoryBody}>
                        {category.boxes.map(box => {
                          const isSelected = selectedBoxId === box.id;
                          return (
                            <View
                              key={box.id}
                              style={[
                                styles.itemRow,
                                isSelected && styles.itemRowSelected,
                                {
                                  borderColor: isSelected
                                    ? theme.primary
                                    : theme.border,
                                },
                              ]}
                            >
                              <TouchableOpacity
                                style={styles.itemSelectArea}
                                onPress={() => selectBoxFromList(box)}
                                activeOpacity={0.85}
                              >
                                <View
                                  style={[
                                    styles.itemDot,
                                    {
                                      backgroundColor: isSelected
                                        ? theme.primary
                                        : theme.border,
                                    },
                                  ]}
                                />
                                <View style={styles.itemTextBlock}>
                                  <Text
                                    style={[
                                      styles.itemText,
                                      { color: theme.textMain },
                                    ]}
                                  >
                                    {box.name || '未命名物品'}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.itemMeta,
                                      { color: theme.textSub },
                                    ]}
                                  >
                                    {box.category || '未分類'}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                              <View style={styles.itemActionButtons}>
                                <TouchableOpacity
                                  style={[
                                    styles.itemActionButton,
                                    { borderColor: theme.border },
                                  ]}
                                  onPress={() => openEditModal(box)}
                                >
                                  <Text
                                    style={getItemActionButtonTextStyle(
                                      theme.textMain,
                                    )}
                                  >
                                    修改
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[
                                    styles.itemActionButton,
                                    { borderColor: theme.border },
                                  ]}
                                  onPress={() => deleteBox(box)}
                                >
                                  <Text style={styles.itemDeleteText}>
                                    刪除
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <View
              style={[
                styles.emptyStateCard,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.emptyStateTitle, { color: theme.textMain }]}>
                目前沒有偵測到明確物件
              </Text>
              <Text style={[styles.emptyStateText, { color: theme.textSub }]}>
                這張照片沒有辨識到明確物品。請靠近物品、保持光線充足，或換個角度重新拍攝。
              </Text>
            </View>
          )}

          {!!route?.params?.detectionNotice && (
            <Text style={{ color: theme.textSub, padding: 12 }}>
              {route.params.detectionNotice}
            </Text>
          )}
        </View>
        <View style={styles.footerHint}>
          <Text style={{ color: theme.textMain }}>收納需求與限制（選填）</Text>
          <TextInput
            value={preferenceNotes}
            onChangeText={setPreferenceNotes}
            maxLength={500}
            multiline
            placeholder="例如：租屋不能鑽牆、常用物品要好拿、優先用現有櫃子"
            placeholderTextColor={theme.textSub}
            style={{
              color: theme.textMain,
              borderColor: theme.border,
              borderWidth: 1,
              padding: 12,
            }}
          />
        </View>
        {!!editableBoxes.length && (
          <View style={styles.footerHint}>
            <TouchableOpacity
              style={[styles.ctaButton, { backgroundColor: theme.primary }]}
              disabled={cropping}
              onPress={previewCrops}
            >
              <Text style={styles.ctaText}>
                {cropping ? '裁切中…' : '更新單件裁切預覽'}
              </Text>
            </TouchableOpacity>
            {cropPreviews.map((item, index) => (
              <View key={index}>
                <Image
                  source={{ uri: item.photoUri }}
                  style={styles.cropThumbnail}
                  resizeMode="contain"
                />
                <Text style={{ color: theme.textMain }} localize={false}>
                  {item.name} · {item.category}
                </Text>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.ctaButton, { backgroundColor: theme.primary }]}
              onPress={() =>
                navigation.navigate('AIChat', { detectedItems: displayItems })
              }
            >
              <Text style={styles.ctaText}>針對這些物品詢問 AI</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.footerHint}>
          <Text style={[styles.footerHintText, { color: theme.textSub }]}>
            {displayCategories.length > 0
              ? '請確認物品名稱與框選範圍，可手動新增物品；確認後按「產生建議」。'
              : '這次分析沒有產生物品清單，所以畫面上不會顯示分類項目。'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.ctaButton, { backgroundColor: theme.primary }]}
          accessibilityRole="button"
          accessibilityLabel="產生建議"
          disabled={importing}
          onPress={() =>
            navigation.navigate('AIAnalysisAdvice', {
              photoUri,
              detectedItems: displayItems,
              detectionBoxes: editableBoxes,
              spaceAnalysis: route?.params?.spaceAnalysis,
              preferenceNotes,
            })
          }
        >
          <Text style={styles.ctaText}>產生建議</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={isDetailsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.cardBg, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.textMain }]}>
              {draftModalVisible ? '填寫物品詳細資訊' : '修改物品資訊'}
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSub }]}>
              {draftModalVisible
                ? '先填入名稱與分類，再儲存。'
                : '修改後會立即更新圖片上的框框與統整清單。'}
            </Text>

            <View style={styles.modalForm}>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="物品名稱"
                placeholderTextColor={theme.textSub}
                style={[
                  styles.modalInput,
                  { borderColor: theme.border, color: theme.textMain },
                ]}
              />
              <TextInput
                value={editCategory}
                onChangeText={setEditCategory}
                placeholder="分類"
                placeholderTextColor={theme.textSub}
                style={[
                  styles.modalInput,
                  { borderColor: theme.border, color: theme.textMain },
                ]}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalSecondaryButton,
                  { borderColor: theme.border },
                ]}
                onPress={closeEditModal}
              >
                <Text
                  style={[
                    styles.modalSecondaryButtonText,
                    { color: theme.textMain },
                  ]}
                >
                  取消
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalPrimaryButton,
                  { backgroundColor: theme.primary },
                ]}
                onPress={saveEditModal}
              >
                <Text style={styles.modalPrimaryButtonText}>儲存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View
        style={[
          styles.bottomBar,
          { backgroundColor: theme.background, borderTopColor: theme.border },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          disabled={importing || !editableBoxes.length}
          style={[styles.ctaButton, { backgroundColor: theme.primary }]}
          onPress={async () => {
            if (!photoUri || importing) return;
            setImporting(true);
            try {
              const { items } = await cropItemsFromPhoto(
                photoUri,
                editableBoxes,
              );
              await saveRemoteAnalysis({
                photoUri,
                detectedItems: displayItems,
                itemPhotos: items,
                adviceText: '',
                summary: `辨識 ${editableBoxes.length} 個物件`,
              });
              navigation.replace('ItemManagement');
            } catch (error) {
              Alert.alert(
                '匯入失敗',
                error instanceof Error ? error.message : '請稍後重試。',
              );
            } finally {
              setImporting(false);
            }
          }}
        >
          <Text style={styles.ctaText}>
            {importing ? '匯入中' : '匯入物品管理'}
          </Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
};

const baseStyles = StyleSheet.create({
  cropThumbnail: { width: 160, height: 140, marginTop: 12 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { paddingVertical: 4, paddingRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSpacer: { width: 28 },
  scrollContent: { paddingBottom: 24 },
  objectReview: { margin: 16, padding: 16, borderWidth: 1, borderRadius: 16 },
  previewInPanel: {
    marginHorizontal: 0,
    borderWidth: 0,
    borderRadius: 12,
    elevation: 0,
    shadowOpacity: 0,
  },
  previewCard: {
    marginHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  preview: {
    height: 420,
    position: 'relative',
  },
  previewImageBackground: {
    flex: 1,
  },
  previewImage: { borderRadius: 24 },
  previewImageLayer: {
    position: 'absolute',
  },
  detectionBoxSelected: {
    borderColor: '#ffffff',
    backgroundColor: 'rgba(255, 176, 32, 0.16)',
  },
  detectionBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#ffb020',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 176, 32, 0.08)',
  },
  draftBox: {
    borderStyle: 'dashed',
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  boxLabel: {
    position: 'absolute',
    left: 0,
    top: -24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  boxLabelSelected: {
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  draftLabel: {
    backgroundColor: 'rgba(30, 64, 175, 0.92)',
  },
  boxLabelText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  previewMask: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  resultBadge: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  resultBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 },
  sectionHeader: {
    marginTop: 14,
    marginHorizontal: 16,
    borderBottomWidth: 1,
    paddingHorizontal: 4,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  sectionAddButton: {
    minWidth: 90,
    minHeight: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  sectionAddButtonText: { color: '#111', fontSize: 12, fontWeight: '800' },
  draftActionBar: {
    marginHorizontal: 16,
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  draftActionText: { fontSize: 12, lineHeight: 17 },
  draftActionButtons: { flexDirection: 'row', gap: 10 },
  draftCancelButton: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftCancelButtonText: { fontSize: 13, fontWeight: '800' },
  draftConfirmButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftConfirmButtonText: { color: '#111', fontSize: 13, fontWeight: '800' },
  categoryPanel: {
    marginHorizontal: 16,
    marginTop: 0,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  categoryBlock: { borderBottomWidth: 1, borderBottomColor: '#ddd' },
  categoryHeader: {
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 220, 120, 0.16)',
  },
  categoryHeaderOpen: { backgroundColor: 'rgba(255, 236, 180, 0.56)' },
  categoryHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  arrow: { fontSize: 22, marginRight: 6 },
  categoryName: { fontSize: 14, fontWeight: '700' },
  deleteText: { fontSize: 13, fontWeight: '700' },
  categoryBody: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: '#fff',
  },
  itemRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemRowSelected: {
    borderWidth: 1.5,
  },
  itemSelectArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemTextBlock: { flex: 1 },
  itemDot: { width: 8, height: 8, borderRadius: 4 },
  itemText: { fontSize: 14, fontWeight: '700' },
  itemMeta: { fontSize: 11, marginTop: 2 },
  itemActionButtons: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  itemActionButton: {
    minWidth: 48,
    minHeight: 28,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  itemActionButtonText: { fontSize: 11, fontWeight: '800' },
  itemDeleteText: { color: '#d92d20', fontSize: 11, fontWeight: '800' },
  emptyStateCard: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  emptyStateTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  emptyStateText: { fontSize: 13, lineHeight: 19 },
  footerHint: { paddingHorizontal: 20, paddingTop: 14 },
  footerHintText: { fontSize: 13, lineHeight: 19 },
  bottomBar: {
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    paddingTop: 12,
    paddingBottom: 16,
  },
  bottomLeft: { flex: 1, paddingRight: 10 },
  bottomLabel: { fontSize: 11, fontWeight: '700' },
  bottomValue: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  ctaButton: {
    flex: 1,
    minWidth: 80,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ctaText: { fontSize: 15, fontWeight: '800', color: '#111' },
  draftHandle: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#3b82f6',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  draftMoveSurface: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalSubtitle: { fontSize: 12, lineHeight: 17 },
  modalForm: { gap: 10 },
  modalInput: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryButtonText: { fontSize: 14, fontWeight: '800' },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryButtonText: { color: '#111', fontSize: 14, fontWeight: '800' },
});

export default AIAnalysisResultScreen;
