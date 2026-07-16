/**
 * 自動偵測匯出檔案的來源平台
 */

import { v4 as uuidv4 } from 'uuid';
import type { Platform, ParseResult, UnifiedConversation, UnifiedMessage } from '@aichat-export/shared';
import { ChatGPTParser } from '../parsers/chatgpt';
import { GeminiParser } from '../parsers/gemini';
import { ClaudeParser } from '../parsers/claude';

const parsers = [
  new ChatGPTParser(),
  new GeminiParser(),
  new ClaudeParser(),
];

/**
 * 檢查是否為瀏覽器擴充功能匯出格式
 */
interface ExtensionExportData {
  platform: Platform;
  exportedAt: string;
  conversations?: unknown[];
  conversation?: unknown;
}

function isExtensionExport(data: unknown): data is ExtensionExportData {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  return (
    typeof obj.platform === 'string' &&
    ['chatgpt', 'gemini', 'claude'].includes(obj.platform) &&
    typeof obj.exportedAt === 'string' &&
    (Array.isArray(obj.conversations) || obj.conversation !== undefined)
  );
}

/**
 * 解析擴充功能匯出格式
 */
async function parseExtensionExport(data: ExtensionExportData): Promise<ParseResult> {
  try {
    const conversations: UnifiedConversation[] = [];
    const warnings: string[] = [];
    const now = new Date().toISOString();

    // 處理批次匯出（多個對話）
    const rawConversations = data.conversations || (data.conversation ? [data.conversation] : []);

    // 檢查是否所有對話都需要導航（舊版本匯出的問題）
    const needsNavigationCount = rawConversations.filter(
      (c) => (c as { needsNavigation?: boolean }).needsNavigation,
    ).length;

    if (needsNavigationCount === rawConversations.length && rawConversations.length > 0) {
      return {
        success: false,
        conversations: [],
        error: '此檔案是使用舊版擴充功能匯出的，請重新載入擴充功能後再次匯出對話。新版本會自動導航獲取對話內容。',
      };
    }

    // 檢查是否為 ChatGPT 原始 API 格式（有 mapping 欄位）
    const hasMappingFormat = rawConversations.some(
      (c) => (c as { mapping?: unknown }).mapping !== undefined,
    );

    if (hasMappingFormat && data.platform === 'chatgpt') {
      // 使用 ChatGPTParser 解析
      const chatgptParser = new ChatGPTParser();
      return chatgptParser.parse(rawConversations);
    }

    for (const conv of rawConversations as Array<{
      id?: string;
      title?: string;
      messages?: Array<{
        role?: string;
        content?: string;
      }>;
      needsNavigation?: boolean;
      error?: boolean;
    }>) {
      // 跳過需要導航或錯誤的對話
      if (conv.needsNavigation || conv.error) {
        warnings.push(`跳過對話 ${conv.id || '未知'}：需要先導航到該頁面`);
        continue;
      }

      // 提取訊息
      const messages: UnifiedMessage[] = [];
      if (Array.isArray(conv.messages)) {
        for (const msg of conv.messages) {
          if (msg.content) {
            messages.push({
              id: uuidv4(),
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content,
              createdAt: now,
            });
          }
        }
      }

      if (messages.length > 0) {
        conversations.push({
          id: uuidv4(),
          title: conv.title || '無標題對話',
          platform: data.platform,
          createdAt: now,
          updatedAt: now,
          messages,
          importedAt: now,
          originalId: conv.id,
          rawData: conv,
        });
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
      error: `解析擴充功能匯出檔案失敗: ${error}`,
    };
  }
}

/**
 * 偵測資料來源平台
 */
export function detectPlatform(data: unknown): Platform | null {
  // 先檢查是否為擴充功能匯出格式
  if (isExtensionExport(data)) {
    return data.platform;
  }

  for (const parser of parsers) {
    if (parser.canParse(data)) {
      return parser.platform;
    }
  }
  return null;
}

/**
 * 自動偵測並解析匯出檔案
 */
export async function parseExportFile(data: unknown): Promise<ParseResult> {
  // 先檢查是否為擴充功能匯出格式
  if (isExtensionExport(data)) {
    return parseExtensionExport(data);
  }

  for (const parser of parsers) {
    if (parser.canParse(data)) {
      return parser.parse(data);
    }
  }

  return {
    success: false,
    conversations: [],
    error: '無法識別的匯出格式，請確認檔案來源是否為 ChatGPT、Gemini 或 Claude',
  };
}
