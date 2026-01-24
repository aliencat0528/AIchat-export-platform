/**
 * Claude Content Script
 * 注入到 claude.ai 頁面
 *
 * Claude 有內部 API 可以使用：
 * - 對話列表: /api/organizations/{org_id}/chat_conversations
 * - 單一對話: /api/organizations/{org_id}/chat_conversations/{id}
 */

// 將此檔案視為模組，避免 TypeScript 報告重複函數錯誤
export {};

interface ConversationInfo {
  id: string;
  title: string;
  create_time: string;
  update_time: string;
}

interface MessageInfo {
  role: 'user' | 'assistant';
  content: string;
}

// 監聯來自 popup 的訊息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'getConversations') {
    getConversations()
      .then(conversations => sendResponse({ conversations }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
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
 * 獲取組織 ID（從 URL 或 API）
 */
async function getOrganizationId(): Promise<string | null> {
  // 嘗試從 URL 獲取
  const urlMatch = window.location.pathname.match(/\/organization\/([a-f0-9-]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }

  // 嘗試從 API 獲取
  try {
    const response = await fetch('https://claude.ai/api/organizations', {
      method: 'GET',
      credentials: 'include',
    });

    if (response.ok) {
      const orgs = await response.json();
      if (orgs && orgs.length > 0) {
        return orgs[0].uuid;
      }
    }
  } catch (e) {
    console.warn('獲取組織 ID 失敗:', e);
  }

  return null;
}

/**
 * 從 Claude API 獲取對話列表
 */
async function getConversations(): Promise<ConversationInfo[]> {
  const orgId = await getOrganizationId();

  if (!orgId) {
    console.warn('無法獲取組織 ID，嘗試從 DOM 獲取');
    return getConversationsFromDOM();
  }

  try {
    const response = await fetch(
      `https://claude.ai/api/organizations/${orgId}/chat_conversations`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`API 請求失敗: ${response.status}`);
    }

    const data = await response.json();

    return data.map((conv: {
      uuid: string;
      name: string;
      created_at: string;
      updated_at: string;
    }) => ({
      id: conv.uuid,
      title: conv.name || '無標題',
      create_time: conv.created_at,
      update_time: conv.updated_at,
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

  // Claude 側邊欄對話列表的可能選擇器
  const selectors = [
    'a[href^="/chat/"]',
    'a[href*="/chat/"]',
    '[data-testid="conversation-item"]',
    '.conversation-list-item',
    'nav a[href*="chat"]',
  ];

  for (const selector of selectors) {
    const items = document.querySelectorAll(selector);
    if (items.length > 0) {
      items.forEach((item, index) => {
        const href = item.getAttribute('href');
        const title = item.textContent?.trim() || `對話 ${index + 1}`;

        if (href) {
          const idMatch = href.match(/\/chat\/([a-f0-9-]+)/);
          if (idMatch) {
            conversations.push({
              id: idMatch[1],
              title: title.slice(0, 100),
              create_time: new Date().toISOString(),
              update_time: new Date().toISOString(),
            });
          }
        }
      });

      if (conversations.length > 0) break;
    }
  }

  return conversations;
}

/**
 * 獲取單一對話的完整內容
 */
async function getConversationContent(conversationId: string): Promise<unknown> {
  const orgId = await getOrganizationId();

  if (!orgId) {
    // 如果當前頁面是該對話，從 DOM 獲取
    if (window.location.pathname.includes(conversationId)) {
      return getCurrentConversation();
    }
    throw new Error('無法獲取組織 ID');
  }

  try {
    const response = await fetch(
      `https://claude.ai/api/organizations/${orgId}/chat_conversations/${conversationId}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`API 請求失敗: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('獲取對話內容失敗:', error);

    // Fallback: 從 DOM 獲取當前對話
    if (window.location.pathname.includes(conversationId)) {
      return getCurrentConversation();
    }

    throw error;
  }
}

/**
 * 獲取當前頁面的對話內容
 */
async function getCurrentConversation(): Promise<{
  id: string;
  title: string;
  messages: MessageInfo[];
}> {
  const messages = extractMessagesFromDOM();

  // 從 URL 獲取對話 ID
  const idMatch = window.location.pathname.match(/\/chat\/([a-f0-9-]+)/);
  const id = idMatch ? idMatch[1] : `claude-${Date.now()}`;

  // 嘗試獲取標題
  const titleElement = document.querySelector(
    'h1, [data-testid="conversation-title"], .conversation-title'
  );
  const title = titleElement?.textContent?.trim() || '無標題對話';

  return {
    id,
    title,
    messages,
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
      await sleep(300);
    } catch (e) {
      console.error(`獲取對話 ${id} 失敗:`, e);
      results.push({ error: true, id });
    }
  }

  return results;
}

/**
 * 從 DOM 提取訊息
 */
function extractMessagesFromDOM(): MessageInfo[] {
  const messages: MessageInfo[] = [];

  // Claude 訊息區域的可能選擇器
  const messageSelectors = [
    // 人類訊息
    '[data-testid="human-message"]',
    '.human-message',
    // AI 訊息
    '[data-testid="ai-message"]',
    '.ai-message',
    // 通用對話區塊
    '[data-message-author-role]',
    '.message-content',
  ];

  // 嘗試使用 data-message-author-role 屬性
  const roleMessages = document.querySelectorAll('[data-message-author-role]');
  if (roleMessages.length > 0) {
    roleMessages.forEach(msg => {
      const role = msg.getAttribute('data-message-author-role');
      const content = extractTextContent(msg);

      if (content) {
        messages.push({
          role: role === 'user' || role === 'human' ? 'user' : 'assistant',
          content,
        });
      }
    });
    return messages;
  }

  // 嘗試其他選擇器
  for (const selector of messageSelectors) {
    const items = document.querySelectorAll(selector);
    if (items.length > 0) {
      items.forEach(item => {
        const role = determineRole(item);
        const content = extractTextContent(item);

        if (content) {
          messages.push({ role, content });
        }
      });

      if (messages.length > 0) break;
    }
  }

  return messages;
}

/**
 * 判斷訊息角色
 */
function determineRole(element: Element): 'user' | 'assistant' {
  const classList = element.className.toLowerCase();
  const dataAttrs = element.outerHTML.toLowerCase();

  if (
    classList.includes('human') ||
    classList.includes('user') ||
    dataAttrs.includes('human') ||
    dataAttrs.includes('user')
  ) {
    return 'user';
  }

  return 'assistant';
}

/**
 * 提取元素的文字內容
 */
function extractTextContent(element: Element): string {
  // 處理程式碼區塊
  const codeBlocks = element.querySelectorAll('pre, code');
  const textContent: string[] = [];

  codeBlocks.forEach(block => {
    const lang = block.getAttribute('data-language') || '';
    textContent.push('```' + lang + '\n' + block.textContent + '\n```');
  });

  // 如果沒有程式碼區塊，直接返回文字
  if (codeBlocks.length === 0) {
    return element.textContent?.trim() || '';
  }

  return textContent.join('\n\n') || element.textContent?.trim() || '';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('AI Chat Export: Claude content script loaded');
