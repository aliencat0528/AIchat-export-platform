# AI Chat Export Platform - 系統架構文件

> 本文件詳細說明系統架構、技術實作、資料流程與設計模式。
>
> **最後更新**：2026-01-23 | **版本**：0.1.0

## 目錄

- [技術棧總覽](#技術棧總覽)
- [專案結構](#專案結構)
- [模組說明](#模組說明)
- [系統架構圖](#系統架構圖)
- [資料流程](#資料流程)
- [資料模型](#資料模型)
- [外部依賴](#外部依賴)

---

## 技術棧總覽

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AI Chat Export Platform 技術架構                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  前端技術                                                            │
│  ├── Vue 3 (Composition API)                                        │
│  │   ├── Vue Router (SPA 路由)                                       │
│  │   └── <script setup> 語法                                         │
│  │                                                                   │
│  ├── TypeScript                                                     │
│  │   ├── 嚴格型別檢查                                                 │
│  │   └── 共用型別定義 (@aichat-export/shared)                         │
│  │                                                                   │
│  └── Vite                                                           │
│      ├── 開發伺服器 (HMR)                                             │
│      └── 生產建置 (Rollup)                                           │
│                                                                      │
│  資料儲存                                                            │
│  └── IndexedDB                                                      │
│      ├── idb 套件封裝                                                 │
│      ├── 對話資料持久化                                               │
│      └── 索引查詢 (平台、時間)                                         │
│                                                                      │
│  瀏覽器擴充功能                                                       │
│  └── Chrome Manifest V3                                             │
│      ├── Background Service Worker                                  │
│      ├── Popup UI                                                   │
│      └── Content Script (頁面注入)                                   │
│                                                                      │
│  專案管理                                                            │
│  └── npm workspaces                                                 │
│      ├── 單一 node_modules                                           │
│      └── 跨模組依賴管理                                               │
│                                                                      │
│  程式碼品質                                                          │
│  ├── ESLint (TypeScript + Vue)                                      │
│  └── TypeScript 編譯檢查                                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 專案結構

```
AIchat-export-platform/
├── package.json                # 根專案設定 (workspaces)
├── tsconfig.base.json          # TypeScript 基礎設定
├── .gitignore
├── README.md                   # 專案說明
├── CLAUDE.md                   # Claude Code 開發規範
│
├── docs/                       # 文件目錄
│   └── ARCHITECTURE.md         # 本文件
│
├── shared/                     # 共用型別定義
│   ├── package.json
│   ├── tsconfig.json
│   └── types/
│       └── index.ts            # Platform, UnifiedMessage, UnifiedConversation...
│
├── export-parser/              # 匯出檔案解析器
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # 模組入口
│       ├── parsers/
│       │   ├── chatgpt.ts      # ChatGPT 解析器
│       │   ├── gemini.ts       # Gemini 解析器
│       │   └── claude.ts       # Claude 解析器
│       └── utils/
│           └── detector.ts     # 平台偵測器
│
├── browser-extension/          # Chrome 擴充功能
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── popup.html
│   └── src/
│       ├── popup/
│       │   └── main.ts         # Popup UI 入口
│       └── background/
│           └── index.ts        # Service Worker
│
└── web-app/                    # Vue 3 本地管理介面
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.ts             # Vue 入口
        ├── App.vue             # 根組件
        ├── db/
        │   └── index.ts        # IndexedDB 操作
        └── views/
            ├── HomeView.vue        # 對話列表
            ├── ImportView.vue      # 匯入資料
            ├── ConversationView.vue # 對話詳情
            ├── ExportView.vue      # 匯出/備份
            └── SettingsView.vue    # 設定
```

---

## 模組說明

### 核心模組

| 模組 | 路徑 | 職責 |
|-----|------|------|
| **shared** | `shared/` | 跨模組共用的 TypeScript 型別定義 |
| **export-parser** | `export-parser/` | 解析各平台 AI 聊天匯出檔案 |
| **browser-extension** | `browser-extension/` | Chrome 擴充功能，從網頁擷取對話 |
| **web-app** | `web-app/` | Vue 3 本地管理介面 |

### 詳細模組清單

| 模組 | 檔案 | 類別/函式 | 職責 |
|-----|------|----------|------|
| **Types** | `shared/types/index.ts` | `Platform`, `UnifiedMessage`, `UnifiedConversation` | 統一資料格式定義 |
| **ChatGPT Parser** | `export-parser/src/parsers/chatgpt.ts` | `ChatGPTParser` | 解析 ChatGPT 匯出 JSON |
| **Gemini Parser** | `export-parser/src/parsers/gemini.ts` | `GeminiParser` | 解析 Gemini Takeout 匯出 |
| **Claude Parser** | `export-parser/src/parsers/claude.ts` | `ClaudeParser` | 解析 Claude 匯出 JSON |
| **Detector** | `export-parser/src/utils/detector.ts` | `detectPlatform`, `parseExportFile` | 自動偵測平台並解析 |
| **Database** | `web-app/src/db/index.ts` | `getDB`, `saveConversation`, `exportAllData` | IndexedDB CRUD 操作 |
| **Popup** | `browser-extension/src/popup/main.ts` | - | 擴充功能彈出視窗 UI |
| **Background** | `browser-extension/src/background/index.ts` | - | Service Worker 背景處理 |

---

## 系統架構圖

### 整體架構

```
┌─────────────────────────────────────────────────────────────────────┐
│                           使用者介面層                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐         ┌─────────────────────┐            │
│  │     Web App         │         │  Browser Extension  │            │
│  │   (Vue 3 SPA)       │         │   (Chrome MV3)      │            │
│  └──────────┬──────────┘         └──────────┬──────────┘            │
│             │                               │                        │
└─────────────┼───────────────────────────────┼────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           資料處理層                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐         ┌─────────────────────┐            │
│  │   Export Parser     │         │   Content Script    │            │
│  │  (檔案解析器)        │         │   (DOM 擷取)        │            │
│  └──────────┬──────────┘         └──────────┬──────────┘            │
│             │                               │                        │
│             └───────────────┬───────────────┘                        │
│                             ▼                                        │
│                  ┌─────────────────────┐                            │
│                  │   Shared Types      │                            │
│                  │   (統一資料格式)     │                            │
│                  └──────────┬──────────┘                            │
│                             │                                        │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           資料儲存層                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐         ┌─────────────────────┐            │
│  │     IndexedDB       │         │   JSON Backup       │            │
│  │  (本地持久化)        │         │   (匯出檔案)        │            │
│  └─────────────────────┘         └─────────────────────┘            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 資料匯入流程

```
┌────────────────────┐
│   資料來源          │
└─────────┬──────────┘
          │
          ├──► 方式一：官方匯出檔案
          │    │
          │    ▼
          │    ┌────────────────────┐
          │    │  detectPlatform()  │
          │    │  自動偵測平台       │
          │    └─────────┬──────────┘
          │              │
          │              ├──► ChatGPT → ChatGPTParser.parse()
          │              ├──► Gemini  → GeminiParser.parse()
          │              └──► Claude  → ClaudeParser.parse()
          │                           │
          │                           ▼
          │                  ┌────────────────────┐
          │                  │  UnifiedConversation│
          │                  │  (統一格式)         │
          │                  └─────────┬──────────┘
          │                            │
          │                            ▼
          │                  ┌────────────────────┐
          │                  │  saveConversation() │
          │                  │  存入 IndexedDB     │
          │                  └────────────────────┘
          │
          └──► 方式二：瀏覽器擴充功能
               │
               ▼
               ┌────────────────────┐
               │  Content Script    │
               │  從網頁 DOM 擷取    │
               └─────────┬──────────┘
                         │
                         ▼
               ┌────────────────────┐
               │  Background Worker │
               │  轉換為統一格式     │
               └─────────┬──────────┘
                         │
                         ▼
               ┌────────────────────┐
               │  送至 Web App      │
               │  存入 IndexedDB    │
               └────────────────────┘
```

---

## 資料流程

### Web App 頁面流程

```
┌────────────────┐
│   App.vue      │
│   (根組件)      │
└───────┬────────┘
        │
        ├──► HomeView.vue ──────► 顯示對話列表
        │                         │
        │                         ▼
        │                    getConversationsByPlatform()
        │                         │
        │                         ▼
        │                    ConversationView.vue
        │                    (對話詳情)
        │
        ├──► ImportView.vue ──► 上傳 JSON 檔案
        │                       │
        │                       ▼
        │                  parseExportFile()
        │                       │
        │                       ▼
        │                  saveConversations()
        │
        ├──► ExportView.vue ──► 選擇對話匯出
        │                       │
        │                       ▼
        │                  exportAllData()
        │                       │
        │                       ▼
        │                  下載 JSON / Markdown
        │
        └──► SettingsView.vue ──► 應用設定
```

---

## 資料模型

### 核心型別

```typescript
// 來源平台
type Platform = 'chatgpt' | 'gemini' | 'claude';

// 訊息角色
type MessageRole = 'user' | 'assistant' | 'system';

// 統一訊息格式
interface UnifiedMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;        // ISO 8601
  originalId?: string;
  attachments?: Attachment[];
}

// 統一對話格式
interface UnifiedConversation {
  id: string;               // UUID
  title: string;
  platform: Platform;
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601
  messages: UnifiedMessage[];
  importedAt: string;       // ISO 8601
  originalId?: string;
  model?: string;
  tags?: string[];
  rawData?: unknown;
}
```

### IndexedDB Schema

```typescript
interface ChatExportDB extends DBSchema {
  conversations: {
    key: string;                    // conversation.id
    value: UnifiedConversation;
    indexes: {
      'by-platform': Platform;      // 按平台查詢
      'by-createdAt': string;       // 按建立時間排序
      'by-updatedAt': string;       // 按更新時間排序
    };
  };
  settings: {
    key: string;
    value: unknown;
  };
}
```

---

## 外部依賴

### 生產依賴

| 套件 | 版本 | 用途 |
|-----|------|------|
| `vue` | ^3.x | 前端框架 |
| `vue-router` | ^4.x | SPA 路由 |
| `idb` | ^8.x | IndexedDB 封裝 |

### 開發依賴

| 套件 | 版本 | 用途 |
|-----|------|------|
| `typescript` | ^5.4 | 型別檢查 |
| `vite` | ^5.x | 開發/建置工具 |
| `eslint` | ^8.x | 程式碼檢查 |
| `@typescript-eslint/*` | ^7.x | TypeScript ESLint 規則 |
| `eslint-plugin-vue` | ^9.x | Vue ESLint 規則 |

### 平台 API 參考

| 平台 | 端點 | 說明 |
|-----|------|------|
| **ChatGPT** | `GET /backend-api/conversations` | 對話列表 |
| **ChatGPT** | `GET /backend-api/conversation/{id}` | 單一對話 |
| **Claude** | `GET /api/organizations/{org_id}/chat_conversations` | 對話列表 |
| **Claude** | `GET /api/organizations/{org_id}/chat_conversations/{id}` | 單一對話 |
| **Gemini** | - | 無公開 API，使用 DOM 解析 |

---

## 延伸閱讀

- [README.md](../README.md) - 專案總覽、快速開始
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/)
