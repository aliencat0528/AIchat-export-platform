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
      const response = await fetch(
        `https://chatgpt.com/backend-api/conversations?offset=${offset}&limit=${limit}&order=updated`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        // 嘗試備用域名
        const altResponse = await fetch(
          `https://chat.openai.com/backend-api/conversations?offset=${offset}&limit=${limit}&order=updated`,
          {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!altResponse.ok) {
          throw new Error(`API 請求失敗: ${response.status}`);
        }

        const data: ConversationListResponse = await altResponse.json();
        allConversations.push(...data.items);
        hasMore = data.items.length === limit;
        offset += limit;
        continue;
      }

      const data: ConversationListResponse = await response.json();
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
 */
function getConversationsFromDOM(): ConversationInfo[] {
  const conversations: ConversationInfo[] = [];

  // 嘗試多種可能的選擇器
  const selectors = [
    'nav a[href^="/c/"]',
    'nav a[href*="/chat/"]',
    '[data-testid="conversation-turn"]',
    'a[href^="/c/"]',
  ];

  for (const selector of selectors) {
    const items = document.querySelectorAll(selector);
    if (items.length > 0) {
      items.forEach((item) => {
        const href = item.getAttribute('href');
        const title = item.textContent?.trim() || '無標題';

        if (href) {
          const idMatch = href.match(/\/c\/([a-f0-9-]+)/);
          if (idMatch) {
            conversations.push({
              id: idMatch[1],
              title,
              create_time: new Date().toISOString(),
              update_time: new Date().toISOString(),
            });
          }
        }
      });
      break;
    }
  }

  return conversations;
}

/**
 * 獲取單一對話的完整內容
 */
async function getConversationContent(conversationId: string): Promise<unknown> {
  // 只使用當前頁面的域名，避免 CORS 錯誤
  const currentHost = window.location.origin;

  try {
    const response = await fetch(
      `${currentHost}/backend-api/conversation/${conversationId}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.ok) {
      return await response.json();
    }

    // 如果 API 失敗（404 等），返回需要導航的標記
    console.warn(`API 返回 ${response.status}，需要導航`);
    return {
      id: conversationId,
      needsNavigation: true,
      status: response.status,
    };
  } catch (e) {
    console.warn(`獲取對話 ${conversationId} 失敗:`, e);
    return {
      id: conversationId,
      needsNavigation: true,
      error: String(e),
    };
  }
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

/**
 * 獲取當前頁面的對話內容（從 DOM）
 */
async function getCurrentConversation(): Promise<{
  id: string;
  title: string;
  messages: MessageInfo[];
}> {
  const messages = extractMessagesFromDOM();

  // 從 URL 獲取對話 ID
  const idMatch = window.location.pathname.match(/\/c\/([a-f0-9-]+)/);
  const id = idMatch ? idMatch[1] : `chatgpt-${Date.now()}`;

  // 嘗試獲取標題
  const titleElement = document.querySelector('h1, [data-testid="conversation-title"]');
  const title = titleElement?.textContent?.trim() || '無標題對話';

  return {
    id,
    title,
    messages,
  };
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('AI Chat Export: ChatGPT content script loaded');
