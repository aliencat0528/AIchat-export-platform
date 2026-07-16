# AIchat Export Platform — 領域知識索引

> **載入方式**：先讀此索引，再依需求載入對應檔案。不需要的不載入。

---

## 領域知識檔案

| 主題 | 檔案 | 何時載入 |
|------|------|---------|
| 各平台匯出格式規格 | `@platform-formats.md` | 新增/修改 parser 時 |
| IndexedDB schema 設計 | `@storage-schema.md` | 修改儲存結構時 |
| Extension 架構與 content script | `@extension-arch.md` | 處理 extension 功能時 |
| 已知問題與解法 | `@solutions.md` | 遇到已知問題時 |

---

## 快速判斷

- 新增/修改 **parser** → 載入 `@platform-formats.md`
- 修改 **IndexedDB / storage** → 載入 `@storage-schema.md`
- 處理 **extension / content script** → 載入 `@extension-arch.md`
- 遇到 **錯誤 / bug** → 先查 `@solutions.md`
- 需要系統架構全貌 → 讀取 `@../docs/ARCHITECTURE.md`
