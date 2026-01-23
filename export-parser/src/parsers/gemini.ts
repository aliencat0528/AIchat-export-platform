/**
 * Gemini (Google Takeout) 匯出檔案解析器
 *
 * Google Takeout 匯出的 Gemini 對話格式：
 * - 位於 /gemini/conversations/ 資料夾
 * - 每個對話是一個獨立的 JSON 檔案
 *
 * 參考: https://github.com/GeoAnima/Gemini-Conversation-Downloader
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Parser,
  Platform,
  ParseResult,
  UnifiedConversation,
  UnifiedMessage,
} from '@aichat-export/shared';

// Gemini Takeout 格式的型別定義
interface GeminiConversation {
  id?: string;
  createdTime?: string;
  lastModifiedTime?: string;
  messages?: GeminiMessage[];
  isArchived?: boolean;
  // 舊格式相容
  title?: string;
  createTime?: string;
  updateTime?: string;
}

interface GeminiMessage {
  role?: 'user' | 'model' | 'USER' | 'MODEL';
  text?: string;
  content?: string | GeminiContent[];
  createTime?: string;
  timestamp?: string;
}

interface GeminiContent {
  text?: string;
  type?: string;
}

export class GeminiParser implements Parser {
  platform: Platform = 'gemini';

  canParse(data: unknown): boolean {
    // Gemini Takeout 的格式可能有多種
    // 1. 單一對話物件
    if (this.isGeminiConversation(data)) {
      return true;
    }
    // 2. 對話陣列
    if (Array.isArray(data) && data.length > 0 && this.isGeminiConversation(data[0])) {
      return true;
    }
    return false;
  }

  private isGeminiConversation(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;

    // 檢查是否有 Gemini 特有的欄位結構
    // 注意：這個判斷邏輯可能需要根據實際 Takeout 格式調整
    return (
      ('messages' in obj || 'text' in obj) &&
      !('mapping' in obj) // 排除 ChatGPT 格式
    );
  }

  async parse(data: unknown): Promise<ParseResult> {
    try {
      const conversations: UnifiedConversation[] = [];
      const warnings: string[] = [];

      const items = Array.isArray(data) ? data : [data];

      for (const item of items as GeminiConversation[]) {
        try {
          const conversation = this.parseConversation(item);
          if (conversation) {
            conversations.push(conversation);
          }
        } catch (e) {
          warnings.push(`解析 Gemini 對話時發生錯誤: ${e}`);
        }
      }

      return {
        success: true,
        conversations,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        conversations: [],
        error: `解析 Gemini 匯出檔案失敗: ${error}`,
      };
    }
  }

  private parseConversation(data: GeminiConversation): UnifiedConversation | null {
    const messages = this.extractMessages(data);

    if (messages.length === 0) {
      return null;
    }

    const now = new Date().toISOString();
    // 支援新舊格式的時間欄位
    const createdAt = data.createdTime || data.createTime || now;
    const updatedAt = data.lastModifiedTime || data.updateTime || now;

    return {
      id: uuidv4(),
      title: data.title || this.generateTitle(messages),
      platform: 'gemini',
      createdAt,
      updatedAt,
      messages,
      importedAt: now,
      originalId: data.id,
      rawData: data,
    };
  }

  private extractMessages(data: GeminiConversation): UnifiedMessage[] {
    const messages: UnifiedMessage[] = [];

    if (!data.messages) {
      return messages;
    }

    for (const msg of data.messages) {
      const content = this.extractMessageContent(msg);
      if (!content) continue;

      // 支援大小寫不同的 role 值
      const role = msg.role?.toLowerCase();
      const isAssistant = role === 'model';

      messages.push({
        id: uuidv4(),
        role: isAssistant ? 'assistant' : 'user',
        content,
        createdAt: msg.createTime || msg.timestamp || new Date().toISOString(),
      });
    }

    return messages;
  }

  private extractMessageContent(msg: GeminiMessage): string {
    // 優先使用 text 欄位
    if (msg.text) {
      return msg.text;
    }

    // 處理 content 可能是字串或陣列的情況
    if (typeof msg.content === 'string') {
      return msg.content;
    }

    if (Array.isArray(msg.content)) {
      return msg.content
        .filter((c) => c.text)
        .map((c) => c.text)
        .join('\n');
    }

    return '';
  }

  private generateTitle(messages: UnifiedMessage[]): string {
    // 使用第一則使用者訊息作為標題
    const firstUserMsg = messages.find((m) => m.role === 'user');
    if (firstUserMsg) {
      const title = firstUserMsg.content.slice(0, 50);
      return title.length < firstUserMsg.content.length ? `${title}...` : title;
    }
    return '無標題對話';
  }
}
