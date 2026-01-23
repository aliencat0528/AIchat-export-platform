/**
 * Claude 匯出檔案解析器
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Parser,
  Platform,
  ParseResult,
  UnifiedConversation,
  UnifiedMessage,
} from '@aichat-export/shared';

// Claude 匯出格式的型別定義（基於已知結構）
interface ClaudeExport {
  uuid: string;
  name: string;
  created_at: string;
  updated_at: string;
  chat_messages: ClaudeMessage[];
}

interface ClaudeMessage {
  uuid: string;
  text: string;
  sender: 'human' | 'assistant';
  created_at: string;
  updated_at: string;
  attachments?: ClaudeAttachment[];
}

interface ClaudeAttachment {
  file_name: string;
  file_type: string;
  file_size: number;
  extracted_content?: string;
}

export class ClaudeParser implements Parser {
  platform: Platform = 'claude';

  canParse(data: unknown): boolean {
    // 檢查是否為 Claude 匯出格式
    if (Array.isArray(data)) {
      const first = data[0];
      return (
        first &&
        typeof first === 'object' &&
        'chat_messages' in first &&
        'uuid' in first
      );
    }
    return false;
  }

  async parse(data: unknown): Promise<ParseResult> {
    try {
      if (!Array.isArray(data)) {
        return {
          success: false,
          conversations: [],
          error: '無效的 Claude 匯出格式：預期為陣列',
        };
      }

      const conversations: UnifiedConversation[] = [];
      const warnings: string[] = [];

      for (const item of data as ClaudeExport[]) {
        try {
          const conversation = this.parseConversation(item);
          if (conversation) {
            conversations.push(conversation);
          }
        } catch (e) {
          warnings.push(`解析 Claude 對話 "${item.name}" 時發生錯誤: ${e}`);
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
        error: `解析 Claude 匯出檔案失敗: ${error}`,
      };
    }
  }

  private parseConversation(data: ClaudeExport): UnifiedConversation | null {
    const messages = this.extractMessages(data.chat_messages);

    if (messages.length === 0) {
      return null;
    }

    return {
      id: uuidv4(),
      title: data.name || '無標題對話',
      platform: 'claude',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      messages,
      importedAt: new Date().toISOString(),
      originalId: data.uuid,
      rawData: data,
    };
  }

  private extractMessages(chatMessages: ClaudeMessage[]): UnifiedMessage[] {
    return chatMessages.map((msg) => ({
      id: uuidv4(),
      role: msg.sender === 'human' ? 'user' : 'assistant',
      content: msg.text,
      createdAt: msg.created_at,
      originalId: msg.uuid,
      attachments: msg.attachments?.map((att) => ({
        type: 'file' as const,
        name: att.file_name,
        mimeType: att.file_type,
        size: att.file_size,
        content: att.extracted_content,
      })),
    }));
  }
}
