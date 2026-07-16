/**
 * ChatGPT 匯出檔案解析器
 * 解析 OpenAI 官方匯出的 conversations.json
 *
 * ChatGPT 使用樹狀結構（mapping）儲存對話：
 * - 每個節點有 parent 和 children 欄位
 * - current_node 指向當前對話分支的最後一個節點
 * - 透過從 current_node 往上遍歷可以得到主要對話路徑
 *
 * 參考: https://community.openai.com/t/questions-about-the-json-structures-in-the-exported-conversations-json/954762
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Parser,
  Platform,
  ParseResult,
  UnifiedConversation,
  UnifiedMessage,
} from '@aichat-export/shared';

// ChatGPT 匯出格式的型別定義
interface ChatGPTExport {
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, ChatGPTNode>;
  conversation_id?: string;
  current_node?: string;
  // 可能存在的其他欄位
  model_slug?: string;
  moderation_results?: unknown[];
}

interface ChatGPTNode {
  id: string;
  message?: ChatGPTMessage;
  parent?: string | null;
  children: string[];
}

interface ChatGPTMessage {
  id: string;
  author: {
    role: 'user' | 'assistant' | 'system' | 'tool';
    name?: string;
    metadata?: Record<string, unknown>;
  };
  content: ChatGPTContent;
  create_time?: number | null;
  update_time?: number | null;
  status?: string;
  metadata?: {
    model_slug?: string;
    [key: string]: unknown;
  };
}

interface ChatGPTContent {
  content_type: string;
  parts?: (string | ChatGPTContentPart)[];
  text?: string;
  language?: string;
}

interface ChatGPTContentPart {
  content_type?: string;
  text?: string;
  [key: string]: unknown;
}

export class ChatGPTParser implements Parser {
  platform: Platform = 'chatgpt';

  canParse(data: unknown): boolean {
    // 檢查是否為 ChatGPT 匯出格式
    if (Array.isArray(data)) {
      const first = data[0];
      return (
        first &&
        typeof first === 'object' &&
        'mapping' in first &&
        'title' in first
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
          error: '無效的 ChatGPT 匯出格式：預期為陣列',
        };
      }

      const conversations: UnifiedConversation[] = [];
      const warnings: string[] = [];

      for (const item of data as ChatGPTExport[]) {
        try {
          const conversation = this.parseConversation(item);
          if (conversation) {
            conversations.push(conversation);
          }
        } catch (e) {
          warnings.push(`解析對話 "${item.title}" 時發生錯誤: ${e}`);
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
        error: `解析 ChatGPT 匯出檔案失敗: ${error}`,
      };
    }
  }

  private parseConversation(data: ChatGPTExport): UnifiedConversation | null {
    const messages = this.extractMessages(data.mapping, data.current_node);

    if (messages.length === 0) {
      return null;
    }

    // 安全處理時間戳（可能為 null 或 0）
    const createdAt = data.create_time
      ? new Date(data.create_time * 1000).toISOString()
      : new Date().toISOString();
    const updatedAt = data.update_time
      ? new Date(data.update_time * 1000).toISOString()
      : createdAt;

    return {
      id: uuidv4(),
      title: data.title || '無標題對話',
      platform: 'chatgpt',
      createdAt,
      updatedAt,
      messages,
      importedAt: new Date().toISOString(),
      originalId: data.conversation_id,
      model: data.model_slug,
      rawData: data,
    };
  }

  /**
   * 從 mapping 中提取訊息
   * 優先使用 current_node 往上遍歷找到主要對話路徑
   * 若無 current_node 則從根節點向下遍歷
   */
  private extractMessages(
    mapping: Record<string, ChatGPTNode>,
    currentNode?: string,
  ): UnifiedMessage[] {
    // 方法 1：從 current_node 往上遍歷（得到主要對話路徑）
    if (currentNode && mapping[currentNode]) {
      return this.extractMessagesFromCurrentNode(mapping, currentNode);
    }

    // 方法 2：從根節點向下遍歷（fallback）
    return this.extractMessagesFromRoot(mapping);
  }

  /**
   * 從 current_node 往上遍歷，得到線性對話路徑
   */
  private extractMessagesFromCurrentNode(
    mapping: Record<string, ChatGPTNode>,
    currentNode: string,
  ): UnifiedMessage[] {
    const messages: UnifiedMessage[] = [];
    const path: string[] = [];

    // 從 current_node 往上遍歷到根節點
    let nodeId: string | null | undefined = currentNode;
    while (nodeId && mapping[nodeId]) {
      path.unshift(nodeId);
      nodeId = mapping[nodeId].parent;
    }

    // 依序提取訊息
    for (const id of path) {
      const node = mapping[id];
      const msg = this.nodeToMessage(node);
      if (msg) {
        messages.push(msg);
      }
    }

    return messages;
  }

  /**
   * 從根節點向下 DFS 遍歷
   */
  private extractMessagesFromRoot(mapping: Record<string, ChatGPTNode>): UnifiedMessage[] {
    const messages: UnifiedMessage[] = [];
    const visited = new Set<string>();

    // 找到根節點（沒有 parent 或 parent 為 null 的節點）
    const rootNodes = Object.values(mapping).filter(
      (node) => !node.parent || !mapping[node.parent],
    );

    // DFS 遍歷訊息樹
    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = mapping[nodeId];
      if (!node) return;

      const msg = this.nodeToMessage(node);
      if (msg) {
        messages.push(msg);
      }

      // 遍歷子節點（選擇第一個子節點以保持線性）
      if (node.children.length > 0) {
        traverse(node.children[0]);
      }
    };

    for (const root of rootNodes) {
      traverse(root.id);
    }

    return messages;
  }

  /**
   * 將節點轉換為 UnifiedMessage
   */
  private nodeToMessage(node: ChatGPTNode): UnifiedMessage | null {
    if (!node.message) return null;

    const { message } = node;
    const role = message.author.role;

    // 跳過 system 訊息和 tool 的中間狀態
    if (role === 'system') return null;

    const content = this.extractContent(message.content);
    if (!content) return null;

    return {
      id: uuidv4(),
      role: role === 'tool' ? 'assistant' : role,
      content,
      createdAt: message.create_time
        ? new Date(message.create_time * 1000).toISOString()
        : new Date().toISOString(),
      originalId: message.id,
    };
  }

  /**
   * 從 ChatGPT content 結構中提取文字內容
   */
  private extractContent(content: ChatGPTContent): string {
    if (content.parts && content.parts.length > 0) {
      return content.parts
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          }
          if (part && typeof part === 'object' && part.text) {
            return part.text;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');
    }
    if (content.text) {
      return content.text;
    }
    return '';
  }
}
