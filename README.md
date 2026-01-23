# AI Chat Export Platform

統一匯出與管理 AI 聊天記錄（ChatGPT、Gemini、Claude）

## 功能特色

- **多平台支援**：ChatGPT、Gemini、Claude
- **匯出檔案解析**：支援各平台官方匯出格式
- **瀏覽器擴充功能**：直接從網頁抓取對話
- **本地管理介面**：統一檢視、搜尋、匯出
- **選擇性匯出**：可選擇特定對話匯出
- **完整備份**：IndexedDB 本地儲存 + JSON 備份檔

## 專案結構

```
AIchat-export-platform/
├── shared/                 # 共用型別定義
├── export-parser/          # 匯出檔案解析器
├── browser-extension/      # Chrome 擴充功能
└── web-app/               # Vue 3 本地管理介面
```

## 快速開始

### 安裝依賴

```bash
npm install
```

### 啟動 Web App（開發模式）

```bash
npm run dev:web
```

開啟 http://localhost:5173

### 建置 Chrome 擴充功能

```bash
npm run build:extension
```

建置完成後，在 Chrome 載入 `browser-extension/dist/` 資料夾：

1. 開啟 `chrome://extensions/`
2. 開啟「開發人員模式」
3. 點選「載入未封裝項目」
4. 選擇 `browser-extension/dist/` 資料夾

## 使用方式

### 方式一：匯入官方匯出檔案

1. 從各平台匯出對話：
   - **ChatGPT**: Settings → Data Controls → Export data
   - **Gemini**: takeout.google.com → 選擇 Gemini Apps
   - **Claude**: Settings → Export Data

2. 在 Web App「匯入資料」頁面上傳 JSON 檔案

### 方式二：使用瀏覽器擴充功能

1. 安裝擴充功能
2. 前往 ChatGPT / Gemini / Claude 網頁
3. 點擊擴充功能圖示
4. 選擇要匯出的對話
5. 匯出到 Web App

## 技術架構

| 模組 | 技術 |
|------|------|
| 前端框架 | Vue 3 + TypeScript |
| 建置工具 | Vite |
| 資料儲存 | IndexedDB (idb) |
| 擴充功能 | Chrome Manifest V3 |
| 套件管理 | npm workspaces |

## 開發指令

```bash
# 建置所有模組
npm run build:all

# 建置單一模組
npm run build:parser
npm run build:extension
npm run build:web

# 開發模式
npm run dev:web
npm run dev:extension
```

## 平台 API 說明

### ChatGPT
- 對話列表: `GET /backend-api/conversations`
- 單一對話: `GET /backend-api/conversation/{id}`

### Claude
- 對話列表: `GET /api/organizations/{org_id}/chat_conversations`
- 單一對話: `GET /api/organizations/{org_id}/chat_conversations/{id}`

### Gemini
- 無公開 API，使用 DOM 解析

## License

MIT
