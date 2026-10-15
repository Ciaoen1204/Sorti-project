export type AIRole = 'system' | 'user' | 'assistant';

export type AIRequestMode = 'chat' | 'photo_analysis';

export interface AIMessage {
  id: string;
  role: AIRole;
  content: string;
  createdAt?: number;
}

export interface ChatItem {
  name: string;
  category: string;
  count: number;
  confidence?: number;
  raw_label?: string;
}

export interface ChatRequest {
  language?: 'zh-TW' | 'en';
  history?: {role: 'user' | 'assistant';content: string}[];
  space_analysis?: SpaceAnalysis;
  storage_preferences?: StoragePreferences;
  message: string;
  items: ChatItem[];
  user_persona?: string;
  user_profile?: Record<string, unknown>;

  /**
   * chat：一般 AI 收納聊天
   * photo_analysis：照片辨識後的收納分析
   */
  mode?: AIRequestMode;
}

export interface KnowledgeSource {
  title: string;
  url: string;
  source_label: string;
}

export interface ChatResponse {
  retrieved_sources?: KnowledgeSource[];
  notice?: string;
  reply: string;
  retrieved_titles: string[];
}

export interface AskQuestionRequest {
  spaceAnalysis?: SpaceAnalysis;
  storagePreferences?: StoragePreferences;
  question: string;
  detectedItems: ChatItem[];
  userPersona?: string;
  topK?: number;

  /**
   * 照片分析頁面請傳入 photo_analysis。
   */
  mode?: AIRequestMode;
}

export interface AskQuestionResponse {
  retrievedSources?: KnowledgeSource[];
  notice?: string;
  reply: string;
  retrievedTitles: string[];
}

export interface DetectItemsResponse {
  space_analysis?: SpaceAnalysis | null;
  space_status?: 'completed' | 'unavailable';
  space_notice?: string;
  ai_status?: 'completed' | 'unavailable';
  notice?: string;
  detected_items: ChatItem[];
  detection_boxes: DetectionBox[];
  total_detections: number;
  model_name: string;
}

export interface DetectionBox {
  source?: 'model' | 'gemini' | 'combined';
  name: string;
  category: string;
  confidence?: number;
  raw_label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ApiErrorResponse {
  detail?: string;
  message?: string;
}

export interface SpaceAnalysis {
  room_type: string;
  summary: string;
  regions: {
    id: string;
    name: string;
    kind: string;
    polygon: { x: number; y: number }[];
    observation: string;
  }[];
  storage_units: { name: string; region_id: string; observation: string }[];
  circulation: string[];
  limitations: string[];
  overlay_uri?: string | null;
}
export interface StoragePreferences {
  visual_preference?: 'rich' | 'minimal' | null;
  detail_preference?: 'simple' | 'detailed' | null;
  notes?: string;
}
