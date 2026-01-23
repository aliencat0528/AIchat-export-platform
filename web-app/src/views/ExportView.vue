<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getAllConversations, exportAllData } from '@/db';
import type { UnifiedConversation, Platform, ExportFormat } from '@aichat-export/shared';

const conversations = ref<UnifiedConversation[]>([]);
const selectedIds = ref<Set<string>>(new Set());
const exportFormat = ref<ExportFormat>('json');
const isLoading = ref(true);

const platformLabels: Record<Platform, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
};

onMounted(async () => {
  conversations.value = await getAllConversations();
  isLoading.value = false;
});

const toggleSelect = (id: string) => {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id);
  } else {
    selectedIds.value.add(id);
  }
};

const toggleSelectAll = () => {
  if (selectedIds.value.size === conversations.value.length) {
    selectedIds.value.clear();
  } else {
    conversations.value.forEach(c => selectedIds.value.add(c.id));
  }
};

const exportSelected = () => {
  const selected = conversations.value.filter(c => selectedIds.value.has(c.id));

  if (selected.length === 0) {
    alert('請先選擇要匯出的對話');
    return;
  }

  const data = JSON.stringify(selected, null, 2);
  downloadFile(data, `conversations-${Date.now()}.json`, 'application/json');
};

const exportFullBackup = async () => {
  const data = await exportAllData();
  downloadFile(data, `aichat-backup-${Date.now()}.json`, 'application/json');
};

const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('zh-TW');
};
</script>

<template>
  <div class="export">
    <header class="page-header">
      <h2>匯出 / 備份</h2>
      <p class="subtitle">選擇要匯出的對話，或建立完整備份</p>
    </header>

    <!-- 完整備份 -->
    <div class="section">
      <h3>完整備份</h3>
      <p class="description">
        匯出所有對話及設定，可用於還原或轉移到其他裝置。
      </p>
      <button @click="exportFullBackup" class="btn-primary">
        下載完整備份
      </button>
    </div>

    <!-- 選擇性匯出 -->
    <div class="section">
      <h3>選擇性匯出</h3>
      <p class="description">
        選擇要匯出的對話。
      </p>

      <div v-if="isLoading" class="loading">載入中...</div>

      <template v-else>
        <div class="toolbar">
          <label>
            <input
              type="checkbox"
              :checked="selectedIds.size === conversations.length && conversations.length > 0"
              @change="toggleSelectAll"
            />
            全選
          </label>
          <span class="selected-count" v-if="selectedIds.size > 0">
            已選擇 {{ selectedIds.size }} 個
          </span>
          <button
            @click="exportSelected"
            :disabled="selectedIds.size === 0"
            class="btn-export"
          >
            匯出選取
          </button>
        </div>

        <div class="conversation-list">
          <div
            v-for="conv in conversations"
            :key="conv.id"
            class="conversation-item"
          >
            <label>
              <input
                type="checkbox"
                :checked="selectedIds.has(conv.id)"
                @change="toggleSelect(conv.id)"
              />
              <span class="title">{{ conv.title }}</span>
              <span :class="['platform-badge', conv.platform]">
                {{ platformLabels[conv.platform] }}
              </span>
              <span class="date">{{ formatDate(conv.updatedAt) }}</span>
            </label>
          </div>

          <p v-if="conversations.length === 0" class="empty">
            沒有可匯出的對話
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.export {
  max-width: 800px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h2 {
  font-size: 24px;
  margin-bottom: 4px;
}

.subtitle {
  color: #666;
}

.section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-bottom: 24px;
}

.section h3 {
  font-size: 16px;
  margin-bottom: 8px;
}

.description {
  color: #666;
  font-size: 14px;
  margin-bottom: 16px;
}

.btn-primary {
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;
}

.selected-count {
  color: #666;
  font-size: 14px;
}

.btn-export {
  margin-left: auto;
  padding: 8px 16px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.btn-export:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.conversation-list {
  max-height: 400px;
  overflow-y: auto;
}

.conversation-item {
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.conversation-item label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.conversation-item .title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: white;
}

.platform-badge.chatgpt { background: #74aa9c; }
.platform-badge.gemini { background: #4285f4; }
.platform-badge.claude { background: #d97706; }

.date {
  color: #999;
  font-size: 13px;
}

.loading,
.empty {
  text-align: center;
  padding: 40px;
  color: #666;
}
</style>
