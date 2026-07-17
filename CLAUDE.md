# AIchat Export Platform 規則

> 繼承根目錄共用規則（Claude Code 已自動載入，勿重複讀取 ../CLAUDE.md）

---

## 專案概述
AI 對話記錄統一匯出與管理工具（ChatGPT / Gemini / Claude）。  
**技術棧**：Vue 3 + TypeScript + Vite + IndexedDB + Chrome Extension  
**架構**：npm workspaces monorepo

---

## Commit Scopes

| Scope | 說明 |
|-------|------|
| `shared` | 共用工具與型別 |
| `parser` | 對話匯出解析器 |
| `extension` | 瀏覽器擴充套件 |
| `web-app` | Web 應用程式 |
| `docs` | 文件 |

---

## 開發指令

```bash
npm run dev:web          # Web App 開發伺服器
npm run dev:extension    # Extension 開發
npm run build:all        # 建置所有套件
npm run lint             # ESLint 檢查
npm run test             # 執行測試
```

**Commit 前必做**：`npm run build:all` + `npm run lint`

---

## 文件觸發詞

| 觸發詞 | 檢查 `docs/ARCHITECTURE.md` 的區塊 |
|--------|-----------------------------------|
| `parser`, `解析器` | 模組清單、解析流程 |
| `view`, `頁面`, `component` | Web App 頁面流程 |
| `type`, `interface`, `型別` | 資料模型 |
| `IndexedDB`, `storage` | 儲存架構 |
| `extension`, `擴充功能` | Extension 架構 |
| `API`, `endpoint` | 平台 API 參考 |

---

## 領域知識索引
需要時：`@.claude/knowledge/index.md`
