# 驗收單 PDF 產生器 — 開發規格書 (SPEC)

## 目標
一個純前端（可部署到 GitHub Pages）的網頁應用：使用者選公司別、填 6–7 個欄位、一次上傳多張照片 → 一鍵下載 PDF。版面必須「照原始 Excel 驗收單的樣式重畫」。不需要輸出 Excel，只要 PDF。

## 技術棧（已定案，請照此實作）
- **Vite + React + TypeScript**
- **PDF**：`pdf-lib` + `@pdf-lib/fontkit`，內嵌中文字型（Noto Sans TC，需 subset 以縮小檔案）
- **Node 版本**：專案需 Node 18+。此機器用 nvm，請在每個 npm/npx 指令前 `export NVM_DIR="$HOME/.nvm"; source "$NVM_DIR/nvm.sh"; nvm use 20`（v20.11.1）。**不要用系統預設 node（v14 會壞）**。
- 部署：GitHub Pages（GitHub Actions workflow）。

## 頁面/功能

### 1. 前端密碼保護（進站 gate）
- 進站先要求輸入密碼，比對 `import.meta.env.VITE_APP_PASSWORD`（預設值可放 `verify2026`，但從 env 讀）。
- 正確後把解鎖狀態存 `sessionStorage`，重整不用再輸入。
- 這只是「不公開/擋一般人」用途，不是強資安，程式碼註解要講清楚。

### 2. 輸入表單
- **公司別下拉選單**：`鵬曜工程有限公司` / `澄遠工程有限公司`。選了之後，動態顯示該公司的欄位、表頭、印章。
- 各公司欄位見下方 `companies` 設定。
- **日期**欄位（兩間共用，預設今天）：用於 PDF 檔名，並顯示在表頭右上角（頁數旁）。
- **多張照片上傳**：`<input type=file multiple accept=image/*>`，顯示縮圖清單，可刪除單張、可調整順序（拖曳或上下按鈕即可）。照片順序 = PDF 內排列順序。
- 「產生 PDF」按鈕：一鍵產生並下載。

### 3. PDF 版面（**最重要，要照原稿**）
- A4 直式（595 x 842 pt）。
- **表頭（每頁都要重複）**，由上到下：
  - 左上：公司名稱（大字，粗體）。
  - 右上：聯絡資訊多行（僅鵬曜有，見設定）；再下面放「日期」「頁數: n」。
  - 中間：標題「驗收單」（大字、置中）。
  - 欄位區：**兩欄式排列**，盡量貼近原稿（見下方各公司欄位順序）。label 用「客戶:」這種冒號樣式。
- **照片格線**：每頁 **4 欄 × 4 列 = 16 格**。
  - **15 格放照片**，由左到右、由上到下填。
  - **右下角第 16 格（第4列第4欄）固定放公司印章**（每頁都放）。
  - 每格是直式（約 3:4，對應原稿照片 386x515）。照片用 `contain` 方式置中不變形，多的留白。
  - 一頁最多 15 張，**第 16 張起換新頁、重複整個表頭、頁數 +1**、繼續填。
- **檔名**：`{公司別}_{客戶}_驗收單_{YYYYMMDD}.pdf`（把不合法字元換成底線）。

### 4. 儲存抽象層（預留資料庫，預設不儲存）
- 定義介面：
  ```ts
  export interface FormRecord {
    company: string; date: string; fields: Record<string,string>;
    photoCount: number; pageCount: number; createdAt: string;
  }
  export interface StorageAdapter {
    save(record: FormRecord, pdf: Blob): Promise<void>;
  }
  ```
- 實作：
  - `NoneAdapter`：no-op（只 console.log，預設）。
  - `SupabaseAdapter`：**stub**，讀 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`，內容先寫 `// TODO: 之後接上`，未啟用時不可影響流程。
  - `RestAdapter`：**stub**，讀 `VITE_STORAGE_API_URL`，同上。
- 工廠 `getStorage()` 依 `VITE_STORAGE_MODE`（`none`|`supabase`|`rest`，預設 `none`）回傳對應 adapter。
- 產生 PDF 成功後呼叫 `storage.save(...)`。預設 `none` 時等於不儲存 → 「產完 PDF 就算完成」。
- `.env.example` 要把所有開關與用法註解清楚，讓使用者「改 env 就能開始存」。

## 各公司設定（companies config）

### 鵬曜工程有限公司 (key: `pengyao`)
- 表頭聯絡資訊（固定顯示）：
  - `電話/傳真: (02)2662-8384`
  - `手機: 0937819234`
  - `E-mail:peng.yau@msa.hinet.net`
- 表單欄位（順序，兩欄排列建議）：
  - 左欄：`客戶`、`聯絡人`、`電話`、`傳真`
  - 右欄：`工程名稱`、`工程地點`、`製表人員`
- 印章：`/seals/pengyao.jpeg`（已放好；統編 24710733）

### 澄遠工程有限公司 (key: `chengyuan`)
- 表頭聯絡資訊：無（表頭只有公司名 + 標題）
- 表單欄位（順序）：
  - 左欄：`客戶名稱`、`電話`、`分機`、`製表人員`
  - 右欄：`聯絡人`、`傳真`、`驗收項目`
- 印章：`/seals/chengyuan.png`（**目前檔案可能尚未放置**；統編 60569875、TEL 02-2664-0068、地址 新北市深坑區埔新街6號2樓）。若檔案不存在，印章格顯示灰色虛線框 + 文字「（印章待補）」，不可讓 PDF 產生失敗。

> 設計成資料驅動：新增公司只要在 config 加一筆（公司名、聯絡行、欄位、印章路徑）即可，不用改版面程式。

## 共用 PDF 產生函式（供測試重用）
- 請把 PDF 產生寫成**與 DOM 無關**的純函式：
  ```ts
  // src/pdf/generatePdf.ts
  export interface GeneratePdfInput {
    companyKey: string;
    fields: Record<string,string>;
    date: string;               // YYYY-MM-DD
    photos: Uint8Array[];       // JPEG/PNG bytes，依序
    fontBytes: Uint8Array;      // Noto Sans TC
    sealBytes: Uint8Array | null;
    company: CompanyConfig;
  }
  export async function generatePdf(input: GeneratePdfInput): Promise<Uint8Array>;
  ```
- React 端負責讀檔成 bytes、抓字型與印章、呼叫此函式、觸發下載。
- 這樣 Node 測試可直接 import `generatePdf` 餵 fixture 產出 PDF。

## 交付項目
1. 完整可跑的 Vite React TS 專案（在本資料夾根目錄）。
2. `npm install` 於 Node 20 可成功；`npm run build` 產出 `dist/` 且 TypeScript 無錯。
3. `npm run dev` 可啟動；表單→上傳→產生 PDF 流程可用。
4. `.github/workflows/deploy.yml`：push 到 main 自動 build 並部署 GitHub Pages。
5. `vite.config.ts`：`base` 可透過 env（`VITE_BASE`）設定，預設 `/`（GitHub Pages 專案頁需設成 `/repo-name/`，README 要說明）。
6. `.env.example` + `README.md`（中文）：如何跑、如何設密碼、如何切換儲存後端、如何部署到 GitHub Pages、GitHub Pages 私有限制與密碼保護說明、如何新增公司/替換印章。
7. `src/pdf/generatePdf.ts` 為環境無關純函式。

## 驗收重點（測試會查）
- 上傳 20 張照片 → 產出 **2 頁** PDF（第1頁15張+印章、第2頁5張+印章），每頁表頭重複、頁數遞增。
- 上傳 15 張 → 1 頁。上傳 16 張 → 2 頁。
- 中文字（公司名、欄位、標題）在 PDF 內正確顯示（非亂碼/空白）。
- 兩間公司都能產、欄位/表頭/印章正確對應。
- 檔名格式正確。
- `VITE_STORAGE_MODE=none` 時不呼叫任何網路；流程正常。

## 注意
- 不要把 node_modules commit。加 `.gitignore`。
- 所有面向使用者的文字用繁體中文。
