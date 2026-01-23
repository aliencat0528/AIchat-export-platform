<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { parseExportFile } from '@aichat-export/parser';
import { saveConversations, importBackupData } from '@/db';
import type { Platform } from '@aichat-export/shared';

const router = useRouter();
const isDragging = ref(false);
const isProcessing = ref(false);
const importResult = ref<{
  success: boolean;
  message: string;
  imported?: number;
  warnings?: string[];
} | null>(null);

const platformLabels: Record<Platform, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = true;
};

const handleDragLeave = () => {
  isDragging.value = false;
};

const handleDrop = async (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = false;

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    await processFile(files[0]);
  }
};

const handleFileSelect = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    await processFile(input.files[0]);
  }
};

const processFile = async (file: File) => {
  isProcessing.value = true;
  importResult.value = null;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // 檢查是否為備份檔案
    if (data.version && data.conversations && data.metadata) {
      // 這是一個備份檔案
      const result = await importBackupData(text);
      importResult.value = {
        success: true,
        message: `成功從備份檔匯入 ${result.imported} 個對話`,
        imported: result.imported,
        warnings: result.errors.length > 0 ? result.errors : undefined,
      };
    } else {
      // 嘗試解析為平台匯出檔案
      const result = await parseExportFile(data);

      if (result.success) {
        await saveConversations(result.conversations);
        importResult.value = {
          success: true,
          message: `成功匯入 ${result.conversations.length} 個對話`,
          imported: result.conversations.length,
          warnings: result.warnings,
        };
      } else {
        importResult.value = {
          success: false,
          message: result.error || '解析失敗',
        };
      }
    }
  } catch (error) {
    importResult.value = {
      success: false,
      message: `處理檔案失敗: ${error}`,
    };
  } finally {
    isProcessing.value = false;
  }
};
</script>

<template>
  <div class="import">
    <header class="page-header">
      <h2>匯入資料</h2>
      <p class="subtitle">支援 ChatGPT、Gemini、Claude 的官方匯出檔案，以及本平台的備份檔</p>
    </header>

    <!-- 匯入說明 -->
    <div class="instructions">
      <h3>如何取得匯出檔案？</h3>
      <div class="instruction-cards">
        <div class="card">
          <h4>{{ platformLabels.chatgpt }}</h4>
          <ol>
            <li>前往 chat.openai.com</li>
            <li>Settings → Data Controls</li>
            <li>Export data</li>
            <li>下載 ZIP 後解壓縮，找到 <code>conversations.json</code></li>
          </ol>
        </div>
        <div class="card">
          <h4>{{ platformLabels.gemini }}</h4>
          <ol>
            <li>前往 takeout.google.com</li>
            <li>選擇「Gemini Apps」</li>
            <li>匯出並下載</li>
            <li>解壓縮後找到對話 JSON 檔案</li>
          </ol>
        </div>
        <div class="card">
          <h4>{{ platformLabels.claude }}</h4>
          <ol>
            <li>前往 claude.ai</li>
            <li>Settings → Export Data</li>
            <li>下載並解壓縮</li>
            <li>找到 <code>conversations.json</code></li>
          </ol>
        </div>
      </div>
    </div>

    <!-- 拖放上傳區域 -->
    <div
      class="drop-zone"
      :class="{ dragging: isDragging, processing: isProcessing }"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <div v-if="isProcessing" class="processing-state">
        <div class="spinner"></div>
        <p>處理中...</p>
      </div>
      <div v-else class="upload-state">
        <div class="icon">📁</div>
        <p>拖放 JSON 檔案到此處</p>
        <p class="or">或</p>
        <label class="btn-select">
          選擇檔案
          <input type="file" accept=".json" @change="handleFileSelect" hidden />
        </label>
      </div>
    </div>

    <!-- 匯入結果 -->
    <div v-if="importResult" class="result" :class="{ success: importResult.success, error: !importResult.success }">
      <p class="message">{{ importResult.message }}</p>
      <ul v-if="importResult.warnings && importResult.warnings.length > 0" class="warnings">
        <li v-for="(warning, i) in importResult.warnings" :key="i">{{ warning }}</li>
      </ul>
      <button v-if="importResult.success" @click="router.push('/')" class="btn-view">
        查看對話列表
      </button>
    </div>
  </div>
</template>

<style scoped>
.import {
  max-width: 900px;
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

.instructions {
  margin-bottom: 30px;
}

.instructions h3 {
  font-size: 16px;
  margin-bottom: 16px;
}

.instruction-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.card {
  background: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.card h4 {
  margin-bottom: 12px;
  font-size: 14px;
}

.card ol {
  padding-left: 20px;
  font-size: 13px;
  color: #666;
}

.card li {
  margin-bottom: 6px;
}

.card code {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 12px;
  padding: 60px 20px;
  text-align: center;
  transition: all 0.3s;
  background: white;
}

.drop-zone.dragging {
  border-color: #007bff;
  background: #f0f7ff;
}

.drop-zone.processing {
  background: #f8f9fa;
}

.upload-state .icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.upload-state p {
  color: #666;
  margin-bottom: 8px;
}

.or {
  font-size: 14px;
  color: #999;
}

.btn-select {
  display: inline-block;
  margin-top: 8px;
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border-radius: 6px;
  cursor: pointer;
}

.processing-state {
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #eee;
  border-top-color: #007bff;
  border-radius: 50%;
  margin: 0 auto 16px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.result {
  margin-top: 24px;
  padding: 16px;
  border-radius: 8px;
}

.result.success {
  background: #d4edda;
  border: 1px solid #c3e6cb;
}

.result.error {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
}

.result .message {
  font-weight: 500;
}

.warnings {
  margin-top: 12px;
  padding-left: 20px;
  font-size: 13px;
  color: #856404;
}

.btn-view {
  margin-top: 12px;
  padding: 8px 16px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
</style>
