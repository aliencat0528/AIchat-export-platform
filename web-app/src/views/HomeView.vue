<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getAllConversations } from '@/db';
import type { UnifiedConversation, Platform } from '@aichat-export/shared';

const router = useRouter();
const conversations = ref<UnifiedConversation[]>([]);
const isLoading = ref(true);
const searchQuery = ref('');
const selectedPlatform = ref<Platform | 'all'>('all');
const selectedConversations = ref<Set<string>>(new Set());

const platformLabels: Record<Platform, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
};

const filteredConversations = computed(() => {
  let result = conversations.value;

  // 平台篩選
  if (selectedPlatform.value !== 'all') {
    result = result.filter(c => c.platform === selectedPlatform.value);
  }

  // 搜尋篩選
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(c =>
      c.title.toLowerCase().includes(query) ||
      c.messages.some(m => m.content.toLowerCase().includes(query))
    );
  }

  // 按更新時間排序（最新的在前面）
  return result.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
});

const platforms = computed(() => {
  const set = new Set(conversations.value.map(c => c.platform));
  return Array.from(set);
});

onMounted(async () => {
  try {
    conversations.value = await getAllConversations();
  } finally {
    isLoading.value = false;
  }
});

const toggleSelect = (id: string) => {
  if (selectedConversations.value.has(id)) {
    selectedConversations.value.delete(id);
  } else {
    selectedConversations.value.add(id);
  }
};

const toggleSelectAll = () => {
  if (selectedConversations.value.size === filteredConversations.value.length) {
    selectedConversations.value.clear();
  } else {
    filteredConversations.value.forEach(c => selectedConversations.value.add(c.id));
  }
};

const viewConversation = (id: string) => {
  router.push(`/conversation/${id}`);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};
</script>

<template>
  <div class="home">
    <header class="page-header">
      <h2>對話列表</h2>
      <p class="subtitle">共 {{ conversations.length }} 個對話</p>
    </header>

    <!-- 篩選工具列 -->
    <div class="toolbar">
      <div class="search">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜尋對話..."
        />
      </div>

      <div class="filters">
        <select v-model="selectedPlatform">
          <option value="all">所有平台</option>
          <option v-for="p in platforms" :key="p" :value="p">
            {{ platformLabels[p] }}
          </option>
        </select>
      </div>

      <div class="actions" v-if="selectedConversations.size > 0">
        <span class="selected-count">
          已選擇 {{ selectedConversations.size }} 個
        </span>
        <button class="btn-export" @click="$router.push('/export')">
          匯出選取
        </button>
      </div>
    </div>

    <!-- 載入中 -->
    <div v-if="isLoading" class="loading">
      載入中...
    </div>

    <!-- 空狀態 -->
    <div v-else-if="conversations.length === 0" class="empty">
      <p>尚未匯入任何對話</p>
      <router-link to="/import" class="btn-primary">
        開始匯入
      </router-link>
    </div>

    <!-- 對話列表 -->
    <div v-else class="conversation-list">
      <div class="list-header">
        <label class="checkbox-cell">
          <input
            type="checkbox"
            :checked="selectedConversations.size === filteredConversations.length && filteredConversations.length > 0"
            @change="toggleSelectAll"
          />
        </label>
        <span class="title-cell">標題</span>
        <span class="platform-cell">平台</span>
        <span class="date-cell">更新時間</span>
        <span class="messages-cell">訊息數</span>
      </div>

      <div
        v-for="conv in filteredConversations"
        :key="conv.id"
        class="conversation-item"
        @click="viewConversation(conv.id)"
      >
        <label class="checkbox-cell" @click.stop>
          <input
            type="checkbox"
            :checked="selectedConversations.has(conv.id)"
            @change="toggleSelect(conv.id)"
          />
        </label>
        <span class="title-cell">{{ conv.title }}</span>
        <span class="platform-cell">
          <span :class="['platform-badge', conv.platform]">
            {{ platformLabels[conv.platform] }}
          </span>
        </span>
        <span class="date-cell">{{ formatDate(conv.updatedAt) }}</span>
        <span class="messages-cell">{{ conv.messages.length }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  max-width: 1200px;
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

.toolbar {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  width: 250px;
}

.filters select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
}

.actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.selected-count {
  color: #666;
  font-size: 14px;
}

.btn-export {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.conversation-list {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
}

.list-header,
.conversation-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 16px;
}

.list-header {
  background: #f8f9fa;
  font-weight: 500;
  font-size: 14px;
  color: #666;
}

.conversation-item {
  border-top: 1px solid #eee;
  cursor: pointer;
  transition: background 0.2s;
}

.conversation-item:hover {
  background: #f8f9fa;
}

.checkbox-cell {
  width: 24px;
  flex-shrink: 0;
}

.title-cell {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-cell {
  width: 100px;
  flex-shrink: 0;
}

.platform-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.platform-badge.chatgpt {
  background: #74aa9c;
  color: white;
}

.platform-badge.gemini {
  background: #4285f4;
  color: white;
}

.platform-badge.claude {
  background: #d97706;
  color: white;
}

.date-cell {
  width: 120px;
  flex-shrink: 0;
  color: #666;
  font-size: 14px;
}

.messages-cell {
  width: 80px;
  flex-shrink: 0;
  text-align: right;
  color: #666;
  font-size: 14px;
}

.loading,
.empty {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.empty .btn-primary {
  display: inline-block;
  margin-top: 16px;
  padding: 10px 20px;
  background: #007bff;
  color: white;
  text-decoration: none;
  border-radius: 6px;
}
</style>
