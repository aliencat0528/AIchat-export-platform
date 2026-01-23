<script setup lang="ts">
import { ref } from 'vue';
import { deleteAllConversations } from '@/db';

const isClearing = ref(false);

const handleClearAll = async () => {
  if (!confirm('確定要刪除所有對話嗎？此操作無法復原。\n\n建議先匯出備份。')) {
    return;
  }

  if (!confirm('再次確認：這將刪除所有已匯入的對話資料。')) {
    return;
  }

  isClearing.value = true;

  try {
    await deleteAllConversations();
    alert('已清除所有對話');
  } catch (error) {
    alert(`清除失敗: ${error}`);
  } finally {
    isClearing.value = false;
  }
};
</script>

<template>
  <div class="settings">
    <header class="page-header">
      <h2>設定</h2>
    </header>

    <!-- 關於 -->
    <div class="section">
      <h3>關於</h3>
      <p class="description">
        AI Chat Export Platform v0.1.0
      </p>
      <p class="description">
        一個用於匯出、管理和備份 AI 聊天記錄的本地工具。
        <br>
        支援 ChatGPT、Gemini、Claude。
      </p>
    </div>

    <!-- 資料管理 -->
    <div class="section danger">
      <h3>資料管理</h3>
      <p class="description">
        所有資料都儲存在瀏覽器的 IndexedDB 中。
        <br>
        清除瀏覽器資料可能會導致資料遺失，建議定期備份。
      </p>

      <div class="danger-zone">
        <h4>危險區域</h4>
        <button
          @click="handleClearAll"
          :disabled="isClearing"
          class="btn-danger"
        >
          {{ isClearing ? '清除中...' : '清除所有對話' }}
        </button>
      </div>
    </div>

    <!-- 儲存空間 -->
    <div class="section">
      <h3>儲存資訊</h3>
      <p class="description">
        資料儲存於瀏覽器本地 IndexedDB。
        <br>
        容量限制取決於瀏覽器和可用磁碟空間（通常為數百 MB 至數 GB）。
      </p>
    </div>
  </div>
</template>

<style scoped>
.settings {
  max-width: 600px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h2 {
  font-size: 24px;
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
  margin-bottom: 12px;
}

.description {
  color: #666;
  font-size: 14px;
  line-height: 1.6;
}

.danger-zone {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.danger-zone h4 {
  color: #dc3545;
  font-size: 14px;
  margin-bottom: 12px;
}

.btn-danger {
  padding: 10px 20px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.btn-danger:disabled {
  background: #999;
  cursor: not-allowed;
}
</style>
