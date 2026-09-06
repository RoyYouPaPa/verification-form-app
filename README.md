# 驗收單 PDF 產生器

純前端網頁應用（Vite + React + TypeScript）：選公司別、填欄位、上傳多張照片 → 一鍵下載 PDF。
版面依原始 Excel 驗收單重畫（A4 直式、每頁 4×4 格線、15 張照片 + 印章）。可部署到 GitHub Pages。

## 功能

- 進站密碼保護（前端 gate，僅擋一般人，非強資安）。
- 公司別下拉選單，依公司動態顯示欄位、表頭、印章（資料驅動）。
- 多張照片上傳：縮圖預覽、刪除、上下調整順序（順序 = PDF 排列順序）。
- 一鍵產生並下載 PDF，內嵌中文字型（Noto Sans TC，subset）。
- 儲存抽象層，預設不儲存；改 env 即可切換 Supabase / REST（皆為 stub）。

## 環境需求

- Node 18 以上（建議 20）。
- 本機若用 nvm：`nvm use 20`。**請勿使用 Node 14，Vite 會壞。**

## 安裝與開發

```bash
npm install
npm run dev      # 啟動開發伺服器
npm run build    # 型別檢查 + 打包，輸出 dist/
npm run preview  # 預覽打包結果
npm run smoke    # Node 煙霧測試：20 張照片 → 應為 2 頁
```

首次進站需輸入密碼，預設 `verify2026`（見下方設定）。

## 環境變數設定

複製 `.env.example` 成 `.env`（或 `.env.local`）後修改。所有變數在 build 時注入前端，**不要放真正機密**。

| 變數 | 說明 | 預設 |
| --- | --- | --- |
| `VITE_APP_PASSWORD` | 進站密碼 | `verify2026` |
| `VITE_BASE` | 部署 base path | `/` |
| `VITE_STORAGE_MODE` | 儲存後端：`none` / `supabase` / `rest` | `none` |
| `VITE_SUPABASE_URL` | Supabase 專案 URL（mode=supabase 時） | 空 |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | 空 |
| `VITE_STORAGE_API_URL` | 通用 REST API endpoint（mode=rest 時） | 空 |

### 設定密碼

改 `.env` 的 `VITE_APP_PASSWORD`，重新 build 即生效。解鎖狀態存於 `sessionStorage`，重整免再輸入。

### 切換儲存後端

預設 `VITE_STORAGE_MODE=none`：產完 PDF 就完成，**不發任何網路請求**。

要開始儲存：

1. 把 `VITE_STORAGE_MODE` 改成 `supabase` 或 `rest`。
2. 填好對應變數。
3. 到 `src/storage/index.ts` 完成該 adapter 的 `// TODO`（目前為 stub）。

`getStorage()` 工廠會依 `VITE_STORAGE_MODE` 回傳對應 adapter，PDF 產生成功後呼叫 `storage.save(record, pdf)`。

## 部署到 GitHub Pages

已附 `.github/workflows/deploy.yml`：push 到 `main` 會自動 build 並部署。

1. 到 repo 的 **Settings → Pages**，將 **Source** 設為 **GitHub Actions**。
2. push 到 `main` 即觸發部署。
3. workflow 會自動把 `VITE_BASE` 設成 `/<repo-name>/`（專案頁必需）。
   - 若使用**自訂網域**或 **user/organization 頁**（`<user>.github.io`），請把 base 改回 `/`。
4. 可選：在 repo 設定
   - **Secret** `VITE_APP_PASSWORD` 覆蓋密碼；
   - **Variable** `VITE_STORAGE_MODE` 覆蓋儲存模式。

### base path 說明

- 本機開發：`/`。
- GitHub Pages 專案頁 `https://<user>.github.io/<repo>/`：base 必須是 `/<repo>/`，否則資源 404。
- `vite.config.ts` 從 `VITE_BASE` 讀取，預設 `/`。

### GitHub Pages 的隱私限制

GitHub Pages 的頁面內容**公開可存取**（除非用 GitHub Enterprise 的私有 Pages）。本專案的密碼 gate 只能擋掉「隨手瀏覽的人」，密碼與所有 env 變數都會被打包進前端、可被檢視。**請勿在此放置真正的機密資料。** 若需要真正權限控管，請改用有後端驗證的部署方式。

## 新增公司 / 替換印章

### 新增公司

編輯 `src/config/companies.ts`，在 `companies` 加一筆並在 `companyOrder` 加上 key：

```ts
myco: {
  key: 'myco',
  name: '範例工程有限公司',
  headerStyle: 'boxed',             // 'boxed'（客戶資訊加框）或 'plain'（無框純文字）
  contactLines: ['電話: ...'],      // 沒有就給 []
  leftFields: [{ key: '客戶' }, ...],
  rightFields: [{ key: '聯絡人' }, ...],
  fileNameFieldKey: '工程名稱',       // 檔名中段用哪個欄位（未填則退回「驗收單」）
  sealPath: 'seals/myco.png',        // 放到 public/seals/
},
```

版面與 PDF 皆資料驅動，加設定即可，不需改版面程式。

### 替換 / 新增印章

把印章圖檔（jpeg/png）放到 `public/seals/`，檔名對應該公司 config 的 `sealPath`。

若對應的印章檔不存在，PDF 的印章格會顯示灰色虛線框 +「（印章待補）」，不會出錯；放入檔案後即自動顯示。

## 專案結構

```
src/
  config/companies.ts    公司設定（資料驅動）
  pdf/
    generatePdf.ts        PDF 產生純函式（與 DOM 無關，供測試重用）
    assets.ts             瀏覽器端資源載入（字型 / 印章 / File→bytes）
  storage/index.ts        儲存抽象層 + adapters + 工廠
  components/
    PasswordGate.tsx      進站密碼 gate
    VerificationForm.tsx  主表單
    PhotoUploader.tsx     多照片上傳 + 縮圖 + 排序
  App.tsx / main.tsx / styles.css
public/
  fonts/NotoSansTC-Regular.ttf   中文字型（Noto Sans TC，靜態 glyf TTF）
  seals/                          公司印章
scripts/smoke.mjs                 Node 煙霧測試
```

## 中文字型說明（重要）

PDF 內嵌 **Noto Sans TC**（`public/fonts/NotoSansTC-Regular.ttf`），
並且**內嵌完整字型、不做 subset**（`generatePdf` 的 `subsetFont` 預設 `false`）。

原因：`pdf-lib` + `@pdf-lib/fontkit` 對 Noto CJK 這類「含 composite 字符」的字型做 subset 時，
會漏字 / 毀損（部分中文字在 PDF 內顯示不出來）。實測 CFF OTF 與變體字型 subset 皆有此問題。
因此改用「由變體字型 instance 出來的靜態 glyf TTF + 不 subset」，確保所有中文字正確顯示。

代價：字型完整內嵌會讓每份 PDF 增加約 7MB。若日後 fontkit 修好 subset，
可把 `subsetFont` 改回 `true` 縮小檔案。

若要換字型，請放**靜態（非變體）glyf TrueType** 字型到 `public/fonts/NotoSansTC-Regular.ttf`。

## PDF 版面規則

- A4 直式（595×842 pt），表頭每頁重複（公司名、聯絡資訊、標題「驗收單」、日期、頁數、欄位）。
- 照片格線每頁 4 欄 × 4 列 = 16 格：前 15 格填照片（左→右、上→下），右下第 16 格固定放印章。
- 照片以 `contain` 置中不變形。第 16 張起換新頁、重複表頭、頁數 +1。
- 檔名：`{公司別}_{客戶}_驗收單_{YYYYMMDD}.pdf`（非法字元換底線）。
