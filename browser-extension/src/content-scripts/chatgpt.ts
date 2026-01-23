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
});

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
  const baseUrls = ['https://chatgpt.com', 'https://chat.openai.com'];

  for (const baseUrl of baseUrls) {
    try {
      const response = await fetch(
        `${baseUrl}/backend-api/conversation/${conversationId}`,
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
    } catch (e) {
      console.warn(`嘗試 ${baseUrl} 失敗:`, e);
    }
  }

  throw new Error('無法獲取對話內容');
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

console.log('AI Chat Export: ChatGPT content script loaded');
