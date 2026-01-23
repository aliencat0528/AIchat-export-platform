/**
 * 自動偵測匯出檔案的來源平台
 */

import type { Platform, ParseResult } from '@aichat-export/shared';
import { ChatGPTParser } from '../parsers/chatgpt';
import { GeminiParser } from '../parsers/gemini';
import { ClaudeParser } from '../parsers/claude';

const parsers = [
  new ChatGPTParser(),
  new GeminiParser(),
  new ClaudeParser(),
];

/**
 * 偵測資料來源平台
 */
export function detectPlatform(data: unknown): Platform | null {
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
