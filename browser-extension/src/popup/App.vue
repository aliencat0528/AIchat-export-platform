<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { Platform } from '@aichat-export/shared';

interface ConversationInfo {
  id: string;
  title: string;
  selected: boolean;
}

const currentPlatform = ref<Platform | null>(null);
const conversations = ref<ConversationInfo[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);

const platformNames: Record<Platform, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
};

onMounted(async () => {
  try {
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

    // 向 content script 請求對話列表
    if (tab.id) {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getConversations' });
      if (response?.conversations) {
        conversations.value = response.conversations.map((c: { id: string; title: string }) => ({
          ...c,
          selected: false,
        }));
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

const exportSelected = async () => {
  const selected = conversations.value.filter(c => c.selected);
  if (selected.length === 0) {
    alert('請先選擇要匯出的對話');
    return;
  }

  // TODO: 實作匯出功能
  console.log('匯出對話:', selected);
};
</script>

<template>
  <div class="popup">
    <header>
      <h1>AI Chat Export</h1>
      <p v-if="currentPlatform" class="platform">
        {{ platformNames[currentPlatform] }}
      </p>
    </header>

    <main>
      <div v-if="isLoading" class="loading">
        載入中...
      </div>

      <div v-else-if="error" class="error">
        {{ error }}
      </div>

      <template v-else>
        <div class="actions">
          <label>
            <input type="checkbox" @change="e => toggleAll((e.target as HTMLInputElement).checked)">
            全選
          </label>
          <button @click="exportSelected" :disabled="!conversations.some(c => c.selected)">
            匯出選取的對話
          </button>
        </div>

        <ul class="conversation-list">
          <li v-for="conv in conversations" :key="conv.id">
            <label>
              <input type="checkbox" v-model="conv.selected">
              {{ conv.title }}
            </label>
          </li>
        </ul>

        <p v-if="conversations.length === 0" class="empty">
          找不到對話，請確認頁面已完全載入
        </p>
      </template>
    </main>
  </div>
</template>

<style>
.popup {
  width: 350px;
  min-height: 200px;
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

header {
  border-bottom: 1px solid #eee;
  padding-bottom: 12px;
  margin-bottom: 12px;
}

h1 {
  margin: 0;
  font-size: 18px;
}

.platform {
  margin: 4px 0 0;
  color: #666;
  font-size: 12px;
}

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

button {
  padding: 6px 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.conversation-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 300px;
  overflow-y: auto;
}

.conversation-list li {
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.conversation-list label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.loading, .error, .empty {
  text-align: center;
  padding: 20px;
  color: #666;
}

.error {
  color: #dc3545;
}
</style>
