/**
 * AI Chat Export Platform - 統一型別定義
 */

// ============================================
// 來源平台
// ============================================

export type Platform = 'chatgpt' | 'gemini' | 'claude';

export const PlatformLabels: Record<Platform, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
};

// ============================================
// 訊息角色
// ============================================

export type MessageRole = 'user' | 'assistant' | 'system';

// ============================================
// 統一訊息格式
// ============================================

export interface UnifiedMessage {
  /** 訊息唯一 ID */
  id: string;
  /** 角色：user / assistant / system */
  role: MessageRole;
  /** 訊息內容（純文字或 Markdown） */
  content: string;
  /** 訊息建立時間（ISO 8601） */
  createdAt: string;
  /** 原始平台的訊息 ID（可選） */
  originalId?: string;
  /** 附件（圖片、檔案等，可選） */
  attachments?: Attachment[];
}

// ============================================
// 附件
// ============================================

export interface Attachment {
  /** 附件類型 */
  type: 'image' | 'file' | 'code';
  /** 檔案名稱 */
  name: string;
  /** MIME 類型 */
  mimeType?: string;
  /** Base64 編碼的內容（小檔案）或 URL */
  content?: string;
  /** 檔案大小（bytes） */
  size?: number;
}

// ============================================
// 統一對話格式
// ============================================

export interface UnifiedConversation {
  /** 對話唯一 ID（UUID） */
  id: string;
  /** 對話標題 */
  title: string;
  /** 來源平台 */
  platform: Platform;
  /** 對話建立時間（ISO 8601） */
  createdAt: string;
  /** 對話最後更新時間（ISO 8601） */
  updatedAt: string;
  /** 訊息列表 */
  messages: UnifiedMessage[];
  /** 匯入時間（ISO 8601） */
  importedAt: string;
  /** 原始平台的對話 ID（可選） */
  originalId?: string;
  /** 使用的模型名稱（可選） */
  model?: string;
  /** 自訂標籤（可選） */
  tags?: string[];
  /** 原始資料（保留完整原始結構，可選） */
  rawData?: unknown;
}

// ============================================
// 匯出格式
// ============================================

export type ExportFormat = 'json' | 'markdown' | 'html' | 'pdf';

export interface ExportOptions {
  /** 匯出格式 */
  format: ExportFormat;
  /** 是否包含原始資料 */
  includeRawData?: boolean;
  /** 是否包含附件 */
  includeAttachments?: boolean;
}

// ============================================
// 備份格式（完整資料庫匯出）
// ============================================

export interface BackupData {
  /** 備份版本 */
  version: string;
  /** 備份建立時間 */
  createdAt: string;
  /** 對話列表 */
  conversations: UnifiedConversation[];
  /** 備份 metadata */
  metadata: {
    totalConversations: number;
    platforms: Platform[];
    exportedBy: string;
  };
}

// ============================================
// 解析器介面
// ============================================

export interface ParseResult {
  /** 是否成功 */
  success: boolean;
  /** 解析後的對話列表 */
  conversations: UnifiedConversation[];
  /** 錯誤訊息（如果失敗） */
  error?: string;
  /** 警告訊息列表 */
  warnings?: string[];
}

export interface Parser {
  /** 解析器支援的平台 */
  platform: Platform;
  /** 解析匯出檔案 */
  parse(data: unknown): Promise<ParseResult>;
  /** 檢查是否為該平台的匯出格式 */
  canParse(data: unknown): boolean;
}
