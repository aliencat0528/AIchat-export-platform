<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

type Platform = 'chatgpt' | 'gemini' | 'claude';

interface ConversationInfo {
  id: string;
  title: string;
  selected: boolean;
  create_time?: string;
  update_time?: string;
}

const currentPlatform = ref<Platform | null>(null);
const conversations = ref<ConversationInfo[]>([]);
const isLoading = ref(true);
const isExporting = ref(false);
const exportProgress = ref(0);
const error = ref<string | null>(null);
const statusMessage = ref<string>('');

const platformNames: Record<Platform, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
};

const platformColors: Record<Platform, string> = {
  chatgpt: '#74aa9c',
  gemini: '#4285f4',
  claude: '#d97706',
};

const selectedCount = computed(() =>
  conversations.value.filter(c => c.selected).length
);

onMounted(async () => {
  try {
    statusMessage.value = '正在偵測平台...';

    // 取得當前頁面資訊
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url) {
      error.value = '無法取得當前頁面資訊';
      isLoading.value = false;
      return;
    }

    // 判斷平台
    if (tab.url.includes('chat.openai.com') || tab.url.includes('chatgpt.com')) {
      currentPlatform.value = 'chatgpt';
    } else if (tab.url.includes('gemini.google.com')) {
      currentPlatform.value = 'gemini';
    } else if (tab.url.includes('claude.ai')) {
      currentPlatform.value = 'claude';
    } else {
      error.value = '請在 ChatGPT、Gemini 或 Claude 頁面使用此擴充功能';
      isLoading.value = false;
      return;
    }

    statusMessage.value = `正在從 ${platformNames[currentPlatform.value]} 獲取對話列表...`;

    // 向 content script 請求對話列表
    if (tab.id) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getConversations' });

        if (response?.error) {
          throw new Error(response.error);
        }

        if (response?.conversations) {
          conversations.value = response.conversations.map((c: {
            id: string;
            title: string;
            create_time?: string;
            update_time?: string;
          }) => ({
            ...c,
            selected: false,
          }));
          statusMessage.value = `找到 ${conversations.value.length} 個對話`;
        } else {
          statusMessage.value = '找不到對話，請確認頁面已完全載入';
        }
      } catch (e) {
        // Content script 可能還沒載入，提示重新整理
        error.value = '無法連接到頁面，請重新整理後再試';
        console.error('Content script error:', e);
      }
    }
  } catch (e) {
    error.value = `發生錯誤: ${e}`;
  } finally {
    isLoading.value = false;
  }
});

const toggleAll = (checked: boolean) => {
  conversations.value.forEach(c => c.selected = checked);
};

/**
 * 等待頁面載入完成
 */
const waitForPageLoad = (tabId: number): Promise<void> => {
  return new Promise((resolve) => {
    const checkReady = () => {
      chrome.tabs.get(tabId, (tab) => {
        if (tab.status === 'complete') {
          // 額外等待一下讓 content script 載入
          setTimeout(resolve, 1000);
        } else {
          setTimeout(checkReady, 200);
        }
      });
    };
    checkReady();
  });
};

/**
 * Gemini 專用：透過導航獲取多個對話內容
 */
const exportGeminiConversations = async (
  tabId: number,
  selected: ConversationInfo[],
  originalUrl: string
): Promise<unknown[]> => {
  const results: unknown[] = [];
  const total = selected.length;

  for (let i = 0; i < selected.length; i++) {
    const conv = selected[i];
    statusMessage.value = `正在匯出 (${i + 1}/${total}): ${conv.title.slice(0, 20)}...`;
    exportProgress.value = Math.round(((i + 1) / total) * 100);

    try {
      // 導航到對話頁面
      const conversationUrl = `https://gemini.google.com/app/${conv.id}`;
      await chrome.tabs.update(tabId, { url: conversationUrl });

      // 等待頁面載入
      await waitForPageLoad(tabId);

      // 獲取對話內容
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'getCurrentConversation',
      });

      if (response?.content) {
        results.push(response.content);
      } else {
        results.push({ id: conv.id, title: conv.title, error: '無法獲取內容' });
      }
    } catch (e) {
      console.error(`獲取對話 ${conv.id} 失敗:`, e);
      results.push({ id: conv.id, title: conv.title, error: String(e) });
    }

    // 防止請求過快
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 導航回原始頁面
  statusMessage.value = '正在返回原始頁面...';
  await chrome.tabs.update(tabId, { url: originalUrl });
  await waitForPageLoad(tabId);

  return results;
};

/**
 * ChatGPT 專用：透過導航獲取對話內容（當 API 失敗時）
 */
const exportChatGPTConversations = async (
  tabId: number,
  selected: ConversationInfo[],
  originalUrl: string
): Promise<unknown[]> => {
  const results: unknown[] = [];
  const total = selected.length;

  for (let i = 0; i < selected.length; i++) {
    const conv = selected[i];
    statusMessage.value = `正在匯出 (${i + 1}/${total}): ${conv.title.slice(0, 20)}...`;
    exportProgress.value = Math.round(((i + 1) / total) * 100);

    try {
      // 導航到對話頁面
      const conversationUrl = `https://chatgpt.com/c/${conv.id}`;
      await chrome.tabs.update(tabId, { url: conversationUrl });

      // 等待頁面載入
      await waitForPageLoad(tabId);

      // 獲取對話內容
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'getCurrentConversation',
      });

      if (response?.content) {
        results.push(response.content);
      } else {
        results.push({ id: conv.id, title: conv.title, error: '無法獲取內容' });
      }
    } catch (e) {
      console.error(`獲取對話 ${conv.id} 失敗:`, e);
      results.push({ id: conv.id, title: conv.title, error: String(e) });
    }

    // 防止請求過快
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 導航回原始頁面
  statusMessage.value = '正在返回原始頁面...';
  await chrome.tabs.update(tabId, { url: originalUrl });
  await waitForPageLoad(tabId);

  return results;
};

const exportSelected = async () => {
  const selected = conversations.value.filter(c => c.selected);
  if (selected.length === 0) {
    alert('請先選擇要匯出的對話');
    return;
  }

  isExporting.value = true;
  exportProgress.value = 0;
  statusMessage.value = '正在匯出對話...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id || !tab.url) throw new Error('無法取得頁面');

    let exportedConversations: unknown[];

    // Gemini 需要特殊處理：透過導航獲取每個對話
    if (currentPlatform.value === 'gemini') {
      exportedConversations = await exportGeminiConversations(tab.id, selected, tab.url);
    } else if (currentPlatform.value === 'chatgpt') {
      // ChatGPT：先嘗試 API，如果有任何失敗則改用導航
      const conversationIds = selected.map(c => c.id);
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'getMultipleConversations',
        conversationIds,
      });

      if (response?.error) {
        throw new Error(response.error);
      }

      const apiResults = response.conversations || [];

      // 檢查是否有需要導航的對話
      const needsNavigation = apiResults.some(
        (r: { needsNavigation?: boolean }) => r?.needsNavigation
      );

      if (needsNavigation) {
        console.log('API 部分失敗，改用導航模式');
        exportedConversations = await exportChatGPTConversations(tab.id, selected, tab.url);
      } else {
        exportedConversations = apiResults;
      }
    } else {
      // Claude 使用 API
      const conversationIds = selected.map(c => c.id);
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'getMultipleConversations',
        conversationIds,
      });

      if (response?.error) {
        throw new Error(response.error);
      }
      exportedConversations = response.conversations || [];
    }

    const exportData = {
      platform: currentPlatform.value,
      exportedAt: new Date().toISOString(),
      conversations: exportedConversations,
    };

    // 下載 JSON 檔案
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);

    const filename = `${currentPlatform.value}-export-${Date.now()}.json`;

    await chrome.downloads.download({
      url,
      filename,
      saveAs: true,
    });

    statusMessage.value = `成功匯出 ${selected.length} 個對話`;

    // 清除選擇
    conversations.value.forEach(c => c.selected = false);

  } catch (e) {
    error.value = `匯出失敗: ${e}`;
  } finally {
    isExporting.value = false;
    exportProgress.value = 0;
  }
};

const exportCurrent = async () => {
  isExporting.value = true;
  statusMessage.value = '正在匯出當前對話...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) throw new Error('無法取得頁面');

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'getCurrentConversation',
    });

    if (response?.error) {
      throw new Error(response.error);
    }

    const exportData = {
      platform: currentPlatform.value,
      exportedAt: new Date().toISOString(),
      conversation: response.content,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);

    const title = response.content?.title || 'conversation';
    const filename = `${currentPlatform.value}-${title.slice(0, 30)}-${Date.now()}.json`;

    await chrome.downloads.download({
      url,
      filename: filename.replace(/[<>:"/\\|?*]/g, '_'),
      saveAs: true,
    });

    statusMessage.value = '匯出成功';

  } catch (e) {
    error.value = `匯出失敗: ${e}`;
  } finally {
    isExporting.value = false;
  }
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('zh-TW', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
};

const refreshList = async () => {
  isLoading.value = true;
  error.value = null;
  conversations.value = [];

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab.id && currentPlatform.value) {
    try {
      statusMessage.value = '重新載入中...';
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getConversations' });
      if (response?.conversations) {
        conversations.value = response.conversations.map((c: { id: string; title: string }) => ({
          ...c,
          selected: false,
        }));
        statusMessage.value = `找到 ${conversations.value.length} 個對話`;
      }
    } catch (e) {
      error.value = '重新載入失敗，請重新整理頁面';
    }
  }

  isLoading.value = false;
};
</script>

<template>
  <div class="popup">
    <!-- Header -->
    <header>
      <div class="title-row">
        <h1>AI Chat Export</h1>
        <button class="btn-icon" @click="refreshList" :disabled="isLoading" title="重新載入">
          <span :class="{ rotating: isLoading }">↻</span>
        </button>
      </div>
      <div v-if="currentPlatform" class="platform-badge" :style="{ background: platformColors[currentPlatform] }">
        {{ platformNames[currentPlatform] }}
      </div>
    </header>

    <main>
      <!-- Loading -->
      <div v-if="isLoading" class="loading">
        <div class="spinner"></div>
        <p>{{ statusMessage }}</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="error">
        <p>{{ error }}</p>
        <button @click="refreshList" class="btn-retry">重試</button>
      </div>

      <!-- Content -->
      <template v-else>
        <!-- Quick Export -->
        <div class="quick-actions">
          <button @click="exportCurrent" :disabled="isExporting" class="btn-quick">
            匯出當前對話
          </button>
        </div>

        <!-- Conversation List -->
        <div class="section">
          <div class="section-header">
            <span>對話列表</span>
            <span class="count">{{ conversations.length }} 個</span>
          </div>

          <div v-if="conversations.length > 0" class="list-controls">
            <label class="select-all">
              <input
                type="checkbox"
                :checked="selectedCount === conversations.length && conversations.length > 0"
                :indeterminate="selectedCount > 0 && selectedCount < conversations.length"
                @change="e => toggleAll((e.target as HTMLInputElement).checked)"
              >
              全選
            </label>
            <span v-if="selectedCount > 0" class="selected-count">
              已選 {{ selectedCount }}
            </span>
          </div>

          <ul class="conversation-list">
            <li v-for="conv in conversations" :key="conv.id" class="conversation-item">
              <label>
                <input type="checkbox" v-model="conv.selected">
                <span class="conv-title">{{ conv.title }}</span>
                <span class="conv-date">{{ formatDate(conv.update_time) }}</span>
              </label>
            </li>
          </ul>

          <p v-if="conversations.length === 0" class="empty">
            找不到對話
          </p>
        </div>

        <!-- Export Button -->
        <div class="export-section" v-if="conversations.length > 0">
          <button
            @click="exportSelected"
            :disabled="selectedCount === 0 || isExporting"
            class="btn-export"
          >
            <span v-if="isExporting">匯出中...</span>
            <span v-else>匯出選取的對話 ({{ selectedCount }})</span>
          </button>
        </div>

        <!-- Status -->
        <div v-if="statusMessage && !isLoading" class="status">
          {{ statusMessage }}
        </div>
      </template>
    </main>

    <!-- Footer -->
    <footer>
      <a href="https://github.com/aliencat0528/AIchat-export-platform" target="_blank">
        GitHub
      </a>
    </footer>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.popup {
  width: 380px;
  min-height: 300px;
  max-height: 500px;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
}

header {
  padding: 16px;
  border-bottom: 1px solid #eee;
  background: #fafafa;
}

.title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h1 {
  font-size: 16px;
  font-weight: 600;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.btn-icon:hover {
  background: #eee;
}

.btn-icon:disabled {
  opacity: 0.5;
}

.rotating {
  display: inline-block;
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.platform-badge {
  display: inline-block;
  margin-top: 8px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  color: white;
  font-weight: 500;
}

main {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #666;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #eee;
  border-top-color: #007bff;
  border-radius: 50%;
  animation: rotate 1s linear infinite;
  margin-bottom: 12px;
}

.error {
  text-align: center;
  padding: 30px 20px;
  color: #dc3545;
}

.btn-retry {
  margin-top: 12px;
  padding: 8px 16px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.quick-actions {
  margin-bottom: 12px;
}

.btn-quick {
  width: 100%;
  padding: 10px;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-quick:hover {
  background: #e8e8e8;
}

.btn-quick:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.section {
  background: white;
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  padding: 10px 12px;
  background: #f8f9fa;
  font-weight: 500;
  font-size: 13px;
}

.count {
  color: #666;
  font-weight: normal;
}

.list-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  font-size: 13px;
}

.select-all {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.selected-count {
  color: #007bff;
  font-size: 12px;
}

.conversation-list {
  list-style: none;
  max-height: 200px;
  overflow-y: auto;
}

.conversation-item {
  border-bottom: 1px solid #f0f0f0;
}

.conversation-item:last-child {
  border-bottom: none;
}

.conversation-item label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
}

.conversation-item label:hover {
  background: #f8f9fa;
}

.conv-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.conv-date {
  color: #999;
  font-size: 11px;
  flex-shrink: 0;
}

.empty {
  text-align: center;
  padding: 20px;
  color: #999;
  font-size: 13px;
}

.export-section {
  margin-top: 12px;
}

.btn-export {
  width: 100%;
  padding: 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-export:hover {
  background: #0056b3;
}

.btn-export:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.status {
  margin-top: 12px;
  text-align: center;
  font-size: 12px;
  color: #666;
}

footer {
  padding: 10px 16px;
  border-top: 1px solid #eee;
  text-align: center;
  font-size: 12px;
}

footer a {
  color: #666;
  text-decoration: none;
}

footer a:hover {
  color: #007bff;
}
</style>
