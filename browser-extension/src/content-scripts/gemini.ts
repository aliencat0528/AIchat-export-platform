/**
 * Gemini Content Script
 * 注入到 gemini.google.com 頁面
 *
 * Gemini 沒有公開的內部 API，主要使用 DOM 解析
 * 注意：DOM 結構可能隨 Google 更新而變動
 */

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

// 監聽來自 popup 的訊息
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
 * 從側邊欄獲取對話列表
 */
async function getConversations(): Promise<ConversationInfo[]> {
  const conversations: ConversationInfo[] = [];

  // Gemini 側邊欄對話列表的可能選擇器
  const selectors = [
    // 對話項目連結
    'a[href*="/app/"]',
    'a[data-conversation-id]',
    '[role="listitem"] a',
    // 側邊欄對話
    'mat-nav-list a',
    '.conversation-item',
    // 通用連結
    'nav a[href*="conversation"]',
  ];

  for (const selector of selectors) {
    const items = document.querySelectorAll(selector);
    if (items.length > 0) {
      items.forEach((item, index) => {
        const href = item.getAttribute('href') || '';
        const conversationId = item.getAttribute('data-conversation-id');
        const title = item.textContent?.trim() || `對話 ${index + 1}`;

        // 從 URL 提取對話 ID
        const idMatch = href.match(/\/app\/([a-zA-Z0-9_-]+)/);
        const id = conversationId || (idMatch ? idMatch[1] : `gemini-${index}`);

        if (id && !conversations.find(c => c.id === id)) {
          conversations.push({
            id,
            title: title.slice(0, 100), // 限制標題長度
            create_time: new Date().toISOString(),
            update_time: new Date().toISOString(),
          });
        }
      });

      if (conversations.length > 0) break;
    }
  }

  // 如果找不到對話列表，嘗試獲取當前對話
  if (conversations.length === 0) {
    const currentUrl = window.location.href;
    const idMatch = currentUrl.match(/\/app\/([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      conversations.push({
        id: idMatch[1],
        title: '當前對話',
        create_time: new Date().toISOString(),
        update_time: new Date().toISOString(),
      });
    }
  }

  return conversations;
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
  const currentUrl = window.location.href;
  const idMatch = currentUrl.match(/\/app\/([a-zA-Z0-9_-]+)/);
  const id = idMatch ? idMatch[1] : `gemini-${Date.now()}`;

  // 嘗試獲取標題
  const titleElement = document.querySelector('h1, [data-conversation-title]');
  const title = titleElement?.textContent?.trim() || '無標題對話';

  return {
    id,
    title,
    messages,
  };
}

/**
 * 獲取特定對話內容（需要導航到該對話頁面）
 */
async function getConversationContent(conversationId: string): Promise<unknown> {
  // Gemini 沒有直接的 API 可以獲取特定對話
  // 如果當前頁面就是該對話，直接解析 DOM
  const currentUrl = window.location.href;
  if (currentUrl.includes(conversationId)) {
    return getCurrentConversation();
  }

  // 否則返回需要導航的提示
  return {
    id: conversationId,
    needsNavigation: true,
    message: '請先導航到該對話頁面',
  };
}

/**
 * 從 DOM 提取訊息
 */
function extractMessagesFromDOM(): MessageInfo[] {
  const messages: MessageInfo[] = [];

  // Gemini 訊息區域的可能選擇器
  const messageSelectors = [
    // 對話輪次容器
    '[data-message-id]',
    '.conversation-turn',
    'message-content',
    // 使用者訊息
    '.user-message',
    '[data-author="user"]',
    // 模型回應
    '.model-response',
    '[data-author="model"]',
    // 通用對話區塊
    '.chat-message',
    '[role="article"]',
  ];

  // 嘗試找到訊息容器
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

  // Fallback: 嘗試按結構解析
  if (messages.length === 0) {
    const allTextBlocks = document.querySelectorAll(
      'div[class*="message"], div[class*="response"], div[class*="query"]'
    );

    allTextBlocks.forEach((block, index) => {
      const content = extractTextContent(block);
      if (content && content.length > 10) {
        // 交替判斷角色（簡單啟發式）
        const role = index % 2 === 0 ? 'user' : 'assistant';
        messages.push({ role, content });
      }
    });
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
    classList.includes('user') ||
    dataAttrs.includes('user') ||
    dataAttrs.includes('human')
  ) {
    return 'user';
  }

  return 'assistant';
}

/**
 * 提取元素的文字內容
 */
function extractTextContent(element: Element): string {
  // 嘗試獲取 markdown 或純文字內容
  const codeBlocks = element.querySelectorAll('pre, code');
  const textContent: string[] = [];

  // 處理程式碼區塊
  codeBlocks.forEach(block => {
    textContent.push('```\n' + block.textContent + '\n```');
  });

  // 獲取主要文字
  const mainText = element.textContent?.trim() || '';

  // 如果沒有程式碼區塊，直接返回文字
  if (codeBlocks.length === 0) {
    return mainText;
  }

  // 合併內容
  return textContent.join('\n\n') || mainText;
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('AI Chat Export: Gemini content script loaded');
