/**
 * ChatGPT Content Script
 * 注入到 chat.openai.com / chatgpt.com 頁面
 *
 * 使用 ChatGPT 內部 API 獲取對話資料：
 * - 對話列表: /backend-api/conversations
 * - 單一對話: /backend-api/conversation/{id}
 */

// 將此檔案視為模組，避免 TypeScript 報告重複函數錯誤
export {};

interface ConversationInfo {
  id: string;
  title: string;
  create_time: string;
  update_time: string;
}

interface ConversationListResponse {
  items: ConversationInfo[];
  total: number;
  limit: number;
  offset: number;
}

interface MessageInfo {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * 從當前 URL 提取對話 ID
 * URL 格式: https://chatgpt.com/c/{id} 或 https://chat.openai.com/c/{id}
 */
function getCurrentConversationIdFromUrl(): string | null {
  const url = window.location.href;
  const match = url.match(/\/c\/([a-f0-9-]+)/i);
  return match ? match[1] : null;
}

/**
 * 快取的 accessToken
 */
let cachedAccessToken: string | null = null;
let tokenFetchedAt: number = 0;
const TOKEN_CACHE_DURATION = 30 * 60 * 1000; // 30 分鐘

/**
 * 從 /api/auth/session 端點獲取 accessToken
 *
 * 機制說明：
 * 1. ChatGPT 使用 NextAuth.js 進行身份驗證
 * 2. 當用戶登入後，session 資訊存在 cookie 中（__Secure-next-auth.session-token）
 * 3. /api/auth/session 端點會讀取這個 cookie 並返回包含 accessToken 的 JSON
 * 4. accessToken 用於調用 /backend-api/* 的內部 API
 */
async function fetchAccessToken(): Promise<string | null> {
  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/auth/session`, {
      method: 'GET',
      credentials: 'include', // 重要：帶上 cookie
    });

    if (!response.ok) {
      console.warn('獲取 session 失敗:', response.status);
      return null;
    }

    const data = await response.json();

    if (data?.accessToken) {
      console.log('成功獲取 accessToken');
      return data.accessToken;
    }

    console.warn('Session 回應中沒有 accessToken:', data);
    return null;
  } catch (e) {
    console.error('fetchAccessToken 失敗:', e);
    return null;
  }
}

/**
 * 獲取 accessToken（帶快取）
 */
async function getAccessToken(): Promise<string | null> {
  const now = Date.now();

  // 如果快取有效，直接返回
  if (cachedAccessToken && (now - tokenFetchedAt) < TOKEN_CACHE_DURATION) {
    return cachedAccessToken;
  }

  // 重新獲取 token
  cachedAccessToken = await fetchAccessToken();
  tokenFetchedAt = now;

  return cachedAccessToken;
}

// 監聽來自 popup 的訊息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'getConversations') {
    getConversations()
      .then(conversations => sendResponse({ conversations }))
      .catch(error => sendResponse({ error: error.message }));
    return true; // 表示會異步回應
  }

  if (message.action === 'getConversationContent') {
    getConversationContent(message.conversationId)
      .then(content => sendResponse({ content }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (message.action === 'getCurrentConversation') {
    getCurrentConversation()
      .then(content => sendResponse({ content }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (message.action === 'getMultipleConversations') {
    getMultipleConversations(message.conversationIds)
      .then(conversations => sendResponse({ conversations }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

/**
 * 構建 API 請求的 headers
 */
async function buildHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const token = await getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    console.warn('未能獲取 accessToken，API 請求可能會失敗');
  }

  return headers;
}

/**
 * 獲取當前頁面的基礎 URL
 */
function getBaseUrl(): string {
  const hostname = window.location.hostname;
  if (hostname.includes('chatgpt.com')) {
    return 'https://chatgpt.com';
  }
  return 'https://chat.openai.com';
}

/**
 * 發送 API 請求並處理錯誤
 *
 * 機制說明：
 * 1. 先獲取 accessToken（從 /api/auth/session）
 * 2. 使用 Bearer token 調用 /backend-api/* 端點
 * 3. 如果主域名失敗，不再嘗試備用域名（會造成 CORS 錯誤）
 */
async function apiRequest(endpoint: string): Promise<Response> {
  const baseUrl = getBaseUrl();
  const headers = await buildHeaders();

  console.log(`API 請求: ${baseUrl}${endpoint}`);

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'GET',
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    // 記錄詳細錯誤資訊
    console.error(`API 請求失敗: ${response.status} ${response.statusText}`);
    console.error(`端點: ${endpoint}`);

    // 不再嘗試備用域名，因為跨域請求會被 CORS 阻擋
    throw new Error(`API 請求失敗: ${response.status} - ${response.statusText}`);
  }

  return response;
}

/**
 * 從 ChatGPT API 獲取對話列表
 */
async function getConversations(): Promise<ConversationInfo[]> {
  // 優先使用 DOM 方法（更可靠）
  const domConversations = getConversationsFromDOM();
  if (domConversations.length > 0) {
    console.log('從 DOM 獲取對話列表:', domConversations.length);
    return domConversations;
  }

  // Fallback: 嘗試 API
  const allConversations: ConversationInfo[] = [];
  let offset = 0;
  const limit = 50;
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await apiRequest(
        `/backend-api/conversations?offset=${offset}&limit=${limit}&order=updated`,
      );

      const data: ConversationListResponse = await response.json();

      if (!data.items || !Array.isArray(data.items)) {
        console.warn('API 回應格式異常:', data);
        break;
      }

      allConversations.push(...data.items);
      hasMore = data.items.length === limit;
      offset += limit;

      // 防止請求過快
      if (hasMore) {
        await sleep(100);
      }
    }

    // 如果 API 返回空結果，嘗試 DOM
    if (allConversations.length === 0) {
      console.log('API 返回空結果，嘗試 DOM');
      return getConversationsFromDOM();
    }

    return allConversations.map(conv => ({
      id: conv.id,
      title: conv.title || '無標題',
      create_time: conv.create_time,
      update_time: conv.update_time,
    }));
  } catch (error) {
    console.error('獲取對話列表失敗:', error);
    return getConversationsFromDOM();
  }
}

/**
 * 從 DOM 獲取對話列表（Fallback）
 * 更新選擇器以匹配 ChatGPT 最新版本 UI
 */
function getConversationsFromDOM(): ConversationInfo[] {
  const conversations: ConversationInfo[] = [];
  const seenIds = new Set<string>();

  // 2024-2025 ChatGPT UI 選擇器（按優先級排序）
  const selectors = [
    // 新版本 UI（2024+）
    'nav[aria-label="Chat history"] a[href^="/c/"]',
    'nav ol a[href^="/c/"]',
    'nav li a[href^="/c/"]',
    '[data-testid="history-item"] a[href^="/c/"]',
    // 側邊欄對話連結
    'aside a[href^="/c/"]',
    'div[class*="conversations"] a[href^="/c/"]',
    // 通用選擇器
    'a[href^="/c/"]',
    // 舊版本備援
    'nav a[href*="/chat/"]',
  ];

  for (const selector of selectors) {
    try {
      const items = document.querySelectorAll(selector);
      if (items.length > 0) {
        items.forEach((item) => {
          const href = item.getAttribute('href');
          if (!href) return;

          const idMatch = href.match(/\/c\/([a-f0-9-]+)/i);
          if (!idMatch || seenIds.has(idMatch[1])) return;

          const id = idMatch[1];
          seenIds.add(id);

          // 嘗試多種方式取得標題
          let title = '';

          // 方法 1: 直接取 textContent
          title = item.textContent?.trim() || '';

          // 方法 2: 嘗試找內部的標題元素
          if (!title || title.length > 100) {
            const titleEl = item.querySelector('[class*="title"], [class*="text"], span, div');
            title = titleEl?.textContent?.trim() || title;
          }

          // 方法 3: 使用 title 屬性
          if (!title) {
            title = item.getAttribute('title') || '';
          }

          // 清理標題（移除多餘空白、換行等）
          title = title.replace(/\s+/g, ' ').trim() || '無標題';

          // 限制標題長度
          if (title.length > 100) {
            title = title.substring(0, 100) + '...';
          }

          conversations.push({
            id,
            title,
            create_time: new Date().toISOString(),
            update_time: new Date().toISOString(),
          });
        });

        if (conversations.length > 0) {
          break;
        }
      }
    } catch (e) {
      console.warn(`選擇器 "${selector}" 解析失敗:`, e);
    }
  }

  console.log(`從 DOM 獲取到 ${conversations.length} 個對話`);
  return conversations;
}

/**
 * 獲取單一對話的完整內容
 * 使用 accessToken 機制，失敗時返回 needsNavigation 標記
 */
async function getConversationContent(conversationId: string): Promise<unknown> {
  try {
    const response = await apiRequest(`/backend-api/conversation/${conversationId}`);
    return await response.json();
  } catch (e) {
    // API 失敗時，返回需要導航的標記（讓 popup 使用導航模式）
    console.warn(`API 獲取對話 ${conversationId} 失敗，標記需要導航:`, e);
    return {
      id: conversationId,
      needsNavigation: true,
      error: String(e),
    };
  }
}

/**
 * 獲取當前頁面的對話
 * 優先從 URL 中提取對話 ID，然後調用 API 獲取完整內容
 * 如果 API 失敗，則從 DOM 解析當前對話
 */
async function getCurrentConversation(): Promise<{
  id: string;
  title: string;
  messages: MessageInfo[];
}> {
  const conversationId = getCurrentConversationIdFromUrl();

  // 嘗試從 API 獲取
  if (conversationId) {
    try {
      const response = await apiRequest(`/backend-api/conversation/${conversationId}`);
      const data = await response.json();

      // 如果 API 成功且有 mapping，解析它
      if (data && data.mapping) {
        const messages = parseMessagesFromMapping(data.mapping);
        return {
          id: conversationId,
          title: data.title || '無標題對話',
          messages,
        };
      }
    } catch (e) {
      console.warn('從 API 獲取當前對話失敗，嘗試從 DOM 解析:', e);
    }
  }

  // Fallback: 從 DOM 提取
  const messages = extractMessagesFromDOM();
  const id = conversationId || `chatgpt-${Date.now()}`;

  const titleElement = document.querySelector('h1, [data-testid="conversation-title"]');
  const title = titleElement?.textContent?.trim() || '無標題對話';

  return {
    id,
    title,
    messages,
  };
}

/**
 * 從 ChatGPT API 的 mapping 格式解析訊息
 */
function parseMessagesFromMapping(mapping: Record<string, unknown>): MessageInfo[] {
  const messages: MessageInfo[] = [];
  const nodes: Array<{ id: string; parent: string | null; message: unknown }> = [];

  // 收集所有節點
  for (const [id, node] of Object.entries(mapping)) {
    const n = node as { parent?: string; message?: unknown };
    nodes.push({
      id,
      parent: n.parent || null,
      message: n.message,
    });
  }

  // 找到根節點並按順序遍歷
  const visited = new Set<string>();
  const traverse = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const msg = node.message as {
      author?: { role?: string };
      content?: { parts?: string[] };
    } | null;

    if (msg && msg.author && msg.content?.parts) {
      const role = msg.author.role;
      if (role === 'user' || role === 'assistant') {
        const content = msg.content.parts.join('\n');
        if (content.trim()) {
          messages.push({
            role: role as 'user' | 'assistant',
            content,
          });
        }
      }
    }

    // 找子節點
    const children = nodes.filter(n => n.parent === nodeId);
    for (const child of children) {
      traverse(child.id);
    }
  };

  // 從根節點開始
  const roots = nodes.filter(n => !n.parent);
  for (const root of roots) {
    traverse(root.id);
  }

  return messages;
}

/**
 * 從 DOM 提取訊息
 */
function extractMessagesFromDOM(): MessageInfo[] {
  const messages: MessageInfo[] = [];

  // ChatGPT 的訊息選擇器
  const messageContainers = document.querySelectorAll('[data-message-author-role]');

  messageContainers.forEach(container => {
    const role = container.getAttribute('data-message-author-role');
    const contentEl = container.querySelector('.markdown, .whitespace-pre-wrap');

    if (contentEl) {
      const content = extractTextContent(contentEl);
      if (content && content.length > 0) {
        messages.push({
          role: role === 'user' ? 'user' : 'assistant',
          content,
        });
      }
    }
  });

  // Fallback: 嘗試其他選擇器
  if (messages.length === 0) {
    const turns = document.querySelectorAll('[data-testid^="conversation-turn"]');
    turns.forEach((turn, index) => {
      const content = extractTextContent(turn);
      if (content && content.length > 10) {
        messages.push({
          role: index % 2 === 0 ? 'user' : 'assistant',
          content,
        });
      }
    });
  }

  return messages;
}

/**
 * 提取元素的文字內容，保留格式
 */
function extractTextContent(element: Element): string {
  // 複製元素以避免修改原始 DOM
  const clone = element.cloneNode(true) as Element;

  // 處理程式碼區塊
  const codeBlocks = clone.querySelectorAll('pre');
  codeBlocks.forEach(pre => {
    const code = pre.querySelector('code');
    const lang = code?.className.match(/language-(\w+)/)?.[1] || '';
    const codeText = code?.textContent || pre.textContent || '';
    pre.textContent = '\n```' + lang + '\n' + codeText + '\n```\n';
  });

  // 處理行內程式碼
  const inlineCodes = clone.querySelectorAll('code:not(pre code)');
  inlineCodes.forEach(code => {
    code.textContent = '`' + code.textContent + '`';
  });

  // 處理列表
  const listItems = clone.querySelectorAll('li');
  listItems.forEach(li => {
    li.textContent = '• ' + li.textContent?.trim() + '\n';
  });

  // 獲取最終文字
  let text = clone.textContent?.trim() || '';

  // 清理多餘的空白行
  text = text.replace(/\n{3,}/g, '\n\n');

  return text;
}

/**
 * 批次獲取多個對話內容
 */
async function getMultipleConversations(
  conversationIds: string[],
): Promise<unknown[]> {
  const results: unknown[] = [];

  for (const id of conversationIds) {
    try {
      const content = await getConversationContent(id);
      results.push(content);
      // 防止請求過快
      await sleep(200);
    } catch (e) {
      console.error(`獲取對話 ${id} 失敗:`, e);
      results.push({ error: true, id });
    }
  }

  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 初始化：記錄載入資訊
const version = '1.7.0';
const currentUrl = window.location.href;
const conversationId = getCurrentConversationIdFromUrl();

console.log(`[Content Script] Loaded (v${version})`);
console.log('AI Chat Export: ChatGPT content script loaded');
console.log(`當前頁面: ${currentUrl}`);
if (conversationId) {
  console.log(`檢測到對話 ID: ${conversationId}`);
}
