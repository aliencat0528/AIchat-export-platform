/**
 * AI Chat Export Parser
 * 解析各平台 AI 聊天匯出檔案
 */

export { ChatGPTParser } from './parsers/chatgpt';
export { GeminiParser } from './parsers/gemini';
export { ClaudeParser } from './parsers/claude';
export { detectPlatform, parseExportFile } from './utils/detector';

// Re-export types
export type {
  Platform,
  UnifiedConversation,
  UnifiedMessage,
  ParseResult,
  Parser,
} from '@aichat-export/shared';
