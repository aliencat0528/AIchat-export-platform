<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getConversation, deleteConversation } from '@/db';
import type { UnifiedConversation, Platform } from '@aichat-export/shared';
import { marked } from 'marked';

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true,
});

// 渲染 Markdown
const renderMarkdown = (content: string): string => {
  try {
    return marked.parse(content) as string;
  } catch {
    return content;
  }
};

const route = useRoute();
const router = useRouter();
const conversation = ref<UnifiedConversation | null>(null);
const isLoading = ref(true);

const platformLabels: Record<Platform, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
};

onMounted(async () => {
  const id = route.params.id as string;
  conversation.value = await getConversation(id) || null;
  isLoading.value = false;
});

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-TW');
};

const handleDelete = async () => {
  if (!conversation.value) return;

  if (confirm(`確定要刪除「${conversation.value.title}」嗎？此操作無法復原。`)) {
    await deleteConversation(conversation.value.id);
    router.push('/');
  }
};

const handleExport = () => {
  if (!conversation.value) return;

  const data = JSON.stringify(conversation.value, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${conversation.value.title.slice(0, 50)}.json`;
  a.click();

  URL.revokeObjectURL(url);
};
</script>

<template>
  <div class="conversation-view">
    <div v-if="isLoading" class="loading">
      載入中...
    </div>

    <div v-else-if="!conversation" class="not-found">
      <p>找不到此對話</p>
      <router-link to="/">返回列表</router-link>
    </div>

    <template v-else>
      <!-- 標題列 -->
      <header class="page-header">
        <div class="header-content">
          <router-link to="/" class="back-link">← 返回</router-link>
          <h2>{{ conversation.title }}</h2>
          <div class="meta">
            <span :class="['platform-badge', conversation.platform]">
              {{ platformLabels[conversation.platform] }}
            </span>
            <span class="date">{{ formatDate(conversation.updatedAt) }}</span>
            <span class="message-count">{{ conversation.messages.length }} 則訊息</span>
          </div>
        </div>
        <div class="header-actions">
          <button @click="handleExport" class="btn-export">匯出</button>
          <button @click="handleDelete" class="btn-delete">刪除</button>
        </div>
      </header>

      <!-- 訊息列表 -->
      <div class="messages">
        <div
          v-for="msg in conversation.messages"
          :key="msg.id"
          :class="['message', msg.role]"
        >
          <div class="message-header">
            <span class="role">{{ msg.role === 'user' ? '你' : 'AI' }}</span>
            <span class="time">{{ formatDate(msg.createdAt) }}</span>
          </div>
          <div class="message-content markdown-body" v-html="renderMarkdown(msg.content)"></div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.conversation-view {
  max-width: 900px;
}

.loading,
.not-found {
  text-align: center;
  padding: 60px;
  color: #666;
}

.not-found a {
  color: #007bff;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;
}

.back-link {
  color: #666;
  text-decoration: none;
  font-size: 14px;
  display: block;
  margin-bottom: 8px;
}

.back-link:hover {
  color: #007bff;
}

.page-header h2 {
  font-size: 20px;
  margin-bottom: 8px;
}

.meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #666;
}

.platform-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: white;
}

.platform-badge.chatgpt { background: #74aa9c; }
.platform-badge.gemini { background: #4285f4; }
.platform-badge.claude { background: #d97706; }

.header-actions {
  display: flex;
  gap: 8px;
}

.btn-export,
.btn-delete {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.btn-export {
  background: #007bff;
  color: white;
}

.btn-delete {
  background: #dc3545;
  color: white;
}

.messages {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message {
  padding: 16px;
  border-radius: 8px;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.message.user {
  background: #e3f2fd;
}

.message.assistant {
  background: white;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
}

.role {
  font-weight: 500;
}

.message.user .role {
  color: #1976d2;
}

.message.assistant .role {
  color: #666;
}

.time {
  color: #999;
}

.message-content {
  line-height: 1.6;
}

/* Markdown 樣式 */
.markdown-body {
  font-size: 14px;
}

.markdown-body p {
  margin: 0 0 12px 0;
}

.markdown-body p:last-child {
  margin-bottom: 0;
}

.markdown-body pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 12px 0;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 13px;
}

.markdown-body code {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 13px;
}

.markdown-body pre code {
  background: none;
  padding: 0;
}

.markdown-body ul,
.markdown-body ol {
  margin: 8px 0;
  padding-left: 24px;
}

.markdown-body li {
  margin: 4px 0;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3 {
  margin: 16px 0 8px 0;
  font-weight: 600;
}

.markdown-body h1 { font-size: 1.4em; }
.markdown-body h2 { font-size: 1.2em; }
.markdown-body h3 { font-size: 1.1em; }

.markdown-body blockquote {
  border-left: 3px solid #ddd;
  margin: 12px 0;
  padding-left: 16px;
  color: #666;
}

.markdown-body table {
  border-collapse: collapse;
  margin: 12px 0;
  width: 100%;
}

.markdown-body th,
.markdown-body td {
  border: 1px solid #ddd;
  padding: 8px 12px;
  text-align: left;
}

.markdown-body th {
  background: #f8f9fa;
  font-weight: 500;
}

.markdown-body a {
  color: #007bff;
  text-decoration: none;
}

.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body img {
  max-width: 100%;
  height: auto;
}

.markdown-body hr {
  border: none;
  border-top: 1px solid #eee;
  margin: 16px 0;
}
</style>
