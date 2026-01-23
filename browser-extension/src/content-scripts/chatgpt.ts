/**
 * ChatGPT Content Script
 * 注入到 chat.openai.com / chatgpt.com 頁面
 *
 * 使用 ChatGPT 內部 API 獲取對話資料：
 * - 對話列表: /backend-api/conversations
 * - 單一對話: /backend-api/conversation/{id}
 */

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

  if (message.action === 'getMultipleConversations') {
    getMultipleConversations(message.conversationIds)
      .then(conversations => sendResponse({ conversations }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  // 新增：獲取當前對話
  if (message.action === 'getCurrentConversation') {
    getCurrentConversation()
      .then(content => sendResponse({ content }))
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
  const allConversations: ConversationInfo[] = [];
  let offset = 0;
  const limit = 50;
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await apiRequest(
        `/backend-api/conversations?offset=${offset}&limit=${limit}&order=updated`
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

    return allConversations.map(conv => ({
      id: conv.id,
      title: conv.title || '無標題',
      create_time: conv.create_time,
      update_time: conv.update_time,
    }));
  } catch (error) {
    console.error('獲取對話列表失敗:', error);
    // Fallback: 嘗試從 DOM 獲取
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
 */
async function getConversationContent(conversationId: string): Promise<unknown> {
  try {
    const response = await apiRequest(`/backend-api/conversation/${conversationId}`);
    return await response.json();
  } catch (e) {
    console.error(`獲取對話 ${conversationId} 失敗:`, e);
    throw new Error('無法獲取對話內容');
  }
}

/**
 * 獲取當前頁面的對話
 * 優先從 URL 中提取對話 ID，然後調用 API 獲取完整內容
 * 如果 API 失敗，則從 DOM 解析當前對話
 */
async function getCurrentConversation(): Promise<unknown> {
  // 方法 1: 從 URL 提取對話 ID 並調用 API
  const conversationId = getCurrentConversationIdFromUrl();

  if (conversationId) {
    try {
      const content = await getConversationContent(conversationId);
      return content;
    } catch (e) {
      console.warn('從 API 獲取當前對話失敗，嘗試從 DOM 解析:', e);
    }
  }

  // 方法 2: 從 DOM 解析當前對話
  return parseCurrentConversationFromDOM();
}

/**
 * 從 DOM 解析當前對話內容
 */
function parseCurrentConversationFromDOM(): unknown {
  const messages: Array<{
    role: string;
    content: string;
    timestamp?: string;
  }> = [];

  // 2024-2025 ChatGPT 對話訊息選擇器
  const messageSelectors = [
    '[data-message-author-role]',
    '[class*="agent-turn"]',
    '[class*="user-turn"]',
    'div[data-testid*="conversation-turn"]',
    '[class*="ConversationItem"]',
    '.text-base',
  ];

  for (const selector of messageSelectors) {
    try {
      const messageElements = document.querySelectorAll(selector);
      if (messageElements.length > 0) {
        messageElements.forEach((el) => {
          // 判斷角色
          let role = 'unknown';
          const authorRole = el.getAttribute('data-message-author-role');
          if (authorRole) {
            role = authorRole;
          } else if (el.className.includes('user') || el.closest('[data-message-author-role="user"]')) {
            role = 'user';
          } else if (el.className.includes('assistant') || el.closest('[data-message-author-role="assistant"]')) {
            role = 'assistant';
          }

          // 獲取內容
          const contentEl = el.querySelector('.markdown, [class*="prose"], [class*="message-content"]') || el;
          const content = contentEl.textContent?.trim() || '';

          if (content && role !== 'unknown') {
            messages.push({ role, content });
          }
        });

        if (messages.length > 0) {
          break;
        }
      }
    } catch (e) {
      console.warn(`訊息選擇器 "${selector}" 解析失敗:`, e);
    }
  }

  // 嘗試獲取對話標題
  let title = '當前對話';
  const titleSelectors = [
    'h1',
    '[class*="title"]',
    'header h1',
    '[data-testid="conversation-title"]',
  ];

  for (const selector of titleSelectors) {
    const titleEl = document.querySelector(selector);
    if (titleEl?.textContent?.trim()) {
      title = titleEl.textContent.trim();
      break;
    }
  }

  return {
    title,
    conversation_id: getCurrentConversationIdFromUrl() || 'dom-parsed',
    create_time: new Date().toISOString(),
    mapping: null, // DOM 解析無法獲得完整 mapping
    messages, // 簡化的訊息列表
    source: 'dom',
  };
}

/**
 * 批次獲取多個對話內容
 */
async function getMultipleConversations(
  conversationIds: string[]
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
const version = '1.6.0';
const currentUrl = window.location.href;
const conversationId = getCurrentConversationIdFromUrl();

console.log(`[Content Script] Loaded (v${version})`);
console.log(`AI Chat Export: ChatGPT content script loaded`);
console.log(`當前頁面: ${currentUrl}`);
if (conversationId) {
  console.log(`檢測到對話 ID: ${conversationId}`);
}
