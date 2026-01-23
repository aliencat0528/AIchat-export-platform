/**
 * Background Service Worker
 * 處理擴充功能的背景任務
 */

// 監聽來自 popup 或 content script 的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'exportConversations') {
    // 處理匯出請求
    handleExport(message.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 表示會異步回應
  }
});

async function handleExport(data: unknown): Promise<void> {
  // TODO: 實作匯出邏輯
  console.log('處理匯出:', data);
}

// 擴充功能安裝時的初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Chat Export 擴充功能已安裝');
});
