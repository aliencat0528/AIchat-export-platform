/**
 * Gemini Content Script
 * 注入到 gemini.google.com 頁面
 *
 * Gemini 沒有公開的內部 API，主要使用 DOM 解析
 * 注意：DOM 結構可能隨 Google 更新而變動
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

  // Gemini 側邊欄對話列表選擇器
  const items = document.querySelectorAll('a[href*="/app/"]');

  items.forEach((item, index) => {
    const href = item.getAttribute('href') || '';

    // 過濾掉非對話連結（如登出連結、accounts.google.com 等）
    if (!href.includes('gemini.google.com/app/') && !href.startsWith('/app/')) {
      return;
    }

    // 從 URL 提取對話 ID
    const idMatch = href.match(/\/app\/([a-zA-Z0-9_-]+)/);
    if (!idMatch) return;

    const id = idMatch[1];
    const title = item.textContent?.trim() || `對話 ${index + 1}`;

    // 避免重複
    if (!conversations.find(c => c.id === id)) {
      conversations.push({
        id,
        title: title.slice(0, 100),
        create_time: new Date().toISOString(),
        update_time: new Date().toISOString(),
      });
    }
  });

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

  // 嘗試從側邊欄獲取標題（當前選中的對話）
  let title = '無標題對話';

  // 方法 1：從側邊欄找到當前活動的對話項目
  const sidebarLinks = document.querySelectorAll('a[href*="/app/"]');
  for (const link of sidebarLinks) {
    const href = link.getAttribute('href') || '';
    if (href.includes(id)) {
      const linkTitle = link.textContent?.trim();
      if (linkTitle && linkTitle.length > 0 && linkTitle.length < 200) {
        title = linkTitle;
        break;
      }
    }
  }

  // 方法 2：如果側邊欄找不到，使用第一條用戶訊息作為標題
  if (title === '無標題對話' && messages.length > 0) {
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (firstUserMsg) {
      title = firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '');
    }
  }

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

  // 使用 Gemini 的自定義元素選擇器（優先使用 user-query 和 model-response）
  // 注意：不要同時使用 .query-content 和 user-query，因為它們可能是巢狀關係
  let userQueries = document.querySelectorAll('user-query');
  let modelResponses = document.querySelectorAll('model-response');

  // 如果沒找到自定義元素，嘗試 class 選擇器
  if (userQueries.length === 0) {
    userQueries = document.querySelectorAll('.query-content');
  }
  if (modelResponses.length === 0) {
    modelResponses = document.querySelectorAll('.response-content');
  }

  // 收集所有訊息並按 DOM 順序排列
  interface MessageNode {
    element: Element;
    role: 'user' | 'assistant';
  }

  const allMessages: MessageNode[] = [];
  const addedElements = new Set<Element>(); // 避免重複

  userQueries.forEach(el => {
    if (!addedElements.has(el)) {
      allMessages.push({ element: el, role: 'user' });
      addedElements.add(el);
    }
  });

  modelResponses.forEach(el => {
    if (!addedElements.has(el)) {
      allMessages.push({ element: el, role: 'assistant' });
      addedElements.add(el);
    }
  });

  // 按 DOM 順序排序
  allMessages.sort((a, b) => {
    const position = a.element.compareDocumentPosition(b.element);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  // 提取內容，並去除重複
  const seenContents = new Set<string>();
  for (const msg of allMessages) {
    const content = extractTextContent(msg.element);
    if (content && content.length > 0 && !seenContents.has(content)) {
      messages.push({
        role: msg.role,
        content,
      });
      seenContents.add(content);
    }
  }

  // Fallback: 如果上述方法失敗，嘗試其他選擇器
  if (messages.length === 0) {
    const fallbackSelectors = [
      '[data-message-id]',
      '.conversation-turn',
      '[role="article"]',
    ];

    for (const selector of fallbackSelectors) {
      const items = document.querySelectorAll(selector);
      if (items.length > 0) {
        items.forEach(item => {
          const role = determineRole(item);
          const content = extractTextContent(item);

          if (content && content.length > 10) {
            messages.push({ role, content });
          }
        });

        if (messages.length > 0) break;
      }
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
    classList.includes('user') ||
    dataAttrs.includes('user') ||
    dataAttrs.includes('human')
  ) {
    return 'user';
  }

  return 'assistant';
}

/**
 * 提取元素的文字內容，保留格式
 */
function extractTextContent(element: Element): string {
  // 複製元素以避免修改原始 DOM
  const clone = element.cloneNode(true) as Element;

  // 移除思考過程區塊（Gemini 的 "thinking" 區域）
  // 注意：不要使用 [class*="thought"]，因為會誤刪 has-thoughts 容器
  // 只移除實際的思考內容區塊
  const thinkingBlocks = clone.querySelectorAll('.thinking-content, .thought-content, .loading-thoughts, [data-thinking], [data-thought]');
  thinkingBlocks.forEach(block => block.remove());

  // 移除「顯示思路」按鈕文字
  const toggleButtons = clone.querySelectorAll('button, [role="button"]');
  toggleButtons.forEach(btn => {
    const text = btn.textContent?.trim() || '';
    if (text === '顯示思路' || text === '隱藏思路' || text === 'Show thinking' || text === 'Hide thinking') {
      btn.remove();
    }
  });

  // 處理程式碼區塊
  const codeBlocks = clone.querySelectorAll('pre');
  codeBlocks.forEach(pre => {
    const code = pre.querySelector('code');
    const lang = code?.className.match(/language-(\w+)/)?.[1] || '';
    const codeText = (code?.textContent || pre.textContent || '').trim();
    // 替換整個 pre 的內容
    const marker = document.createTextNode('\n```' + lang + '\n' + codeText + '\n```\n');
    pre.replaceWith(marker);
  });

  // 處理行內程式碼（排除已處理的 pre 內的 code）
  const inlineCodes = clone.querySelectorAll('code');
  inlineCodes.forEach(code => {
    const text = code.textContent || '';
    code.textContent = '`' + text + '`';
  });

  // 處理列表項目
  const listItems = clone.querySelectorAll('li');
  listItems.forEach(li => {
    const text = li.textContent?.trim() || '';
    li.textContent = '\n• ' + text;
  });

  // 處理段落，確保換行
  const paragraphs = clone.querySelectorAll('p');
  paragraphs.forEach(p => {
    const text = p.textContent?.trim() || '';
    p.textContent = '\n' + text + '\n';
  });

  // 獲取最終文字
  let text = clone.textContent?.trim() || '';

  // 清理多餘的空白行
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/^\n+/, '').replace(/\n+$/, '');

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
