# SORTI iPhone PWA 測試版

「捐贈與回收」可從物品管理或二手市集進入，支援物品種類、狀況、縣市與管道篩選，並附官方來源、諮詢電話及查核日期。物品卡片可帶入類別；資訊內容共用 `src/data/disposalGuide.ts`，更新時需重新打包。全台查詢窗口不表示全台到府服務，接收與清運需洽提供單位；目前在地資訊含臺北、新北及高雄，其餘縣市透過全台官方窗口查詢。不使用定位、不送出預約，也不新增資料表。

二手市集已分成買家專區與賣家中心，支援商品編輯／上下架、雙方訂單進度與對話列表。既有專案須依 [資料庫更新說明](../supabase/README.md) 執行 `marketplace-workflow.sql` 才能使用新的訂單操作。

照片上傳出現 `Bucket not found` 時，先依照 [照片儲存空間設定](../supabase/README.md) 在 Supabase SQL Editor 執行 `supabase/storage-setup.sql`。

PWA 使用現有 Supabase 帳號與雲端資料，AI 請求由同源 `/api` 入口驗證登入後轉送本機 FastAPI。Gemini 金鑰只留在後端。

## 使用 iPhone

1. 用 Safari 開啟目前的臨時 HTTPS 連結。
2. 登入現有 SORTI 帳號，或建立新帳號並完成信箱驗證。
3. Safari → 分享 → 加入主畫面。如果顯示「作為網頁 App 開啟」，保持開啟。
4. 從主畫面的 SORTI 圖示開啟。Safari 與主畫面 App 的登入狀態可能分開，需要各登入一次。

電腦、FastAPI、PWA 服務與隧道都需要保持開啟。臨時連結在隧道停止後失效，重新啟動通常會取得新網址。

## 支援的測試流程

- 登入／註冊、儲存個人資料與登出。
- 與原生版同步的 7 道情境題、28 個選項、7 張原圖、4 種人格與完整說明。
- 每日三選一任務、Safari 拍照／選相簿、預覽、重拍、Gemini 回饋、雲端打卡紀錄。
- 照片物品辨識、收納建議、儲存與讀取分析紀錄、物品清單。
- 收納對話、二手商品刊登、購物車、貨到／面交訂單、商品對話。
- 深色模式、主畫面圖示與離線載入介面；AI、登入與雲端資料仍需連線。

PWA 為網頁操作版，照片使用 iOS 原生選擇器；Android 版可拖曳辨識框的原生編輯介面尚未移植。WebKit 自動化測試不等同實體 iPhone 相機／系統安裝測試。

## 本機啟動

根目錄 `.env` 使用既有 `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`。後端沿用 `src/backend/.env`，不要將 Gemini 金鑰放在前端設定。

```powershell
npm run pwa:build
# 另一個終端機：
python -m uvicorn main:app --app-dir src/backend --host 127.0.0.1 --port 8000
# 另一個終端機：
npm run pwa:serve
# 另一個終端機（cloudflared 從官方來源安裝）：
.\.pwa-tools\cloudflared.exe tunnel --no-autoupdate --protocol http2 --url http://127.0.0.1:4173
```

不要另外將未驗證登入的 FastAPI 8000 埠公開。PWA 伺服器只提供建置目錄與限定 AI 端點，不提供 `.env`、原始碼或後端文件頁。

## 驗證

```powershell
npm run pwa:check
npx playwright install chromium webkit
npm run pwa:test
```

`pwa:build` 自動從原生測驗與 Supabase 服務匯出網頁資料；不要手動編輯 `*.generated.*`。瀏覽器測試以模擬帳號與 API 回覆驗證 UI，不建立真實帳號或訂單。快取只有建置資產，登入 API、AI 回覆與使用者雲端照片不進離線快取。

## 捐贈與回收地區資料

支援 22 縣市與 368 鄉鎮市區；區域名單由國土測繪中心官方 API 匯入，可執行 `node scripts/update-guide-regions.mjs` 更新。
22 縣市捐贈諮詢電話依衛福部官方窗口名錄整理；區級資料目前有臺北 13 個社福中心、12 個清潔隊及桃園 30 個實物銀行服務據點。桃園資料可執行 `node scripts/update-guide-points.mjs` 更新。來源連結與查核日期顯示於每張卡片。
選擇鄉鎮市區後，僅顯示該區據點及縣市／全台窗口；使用者可另展開同縣市其他區。附近搜尋透過 Google Maps，沒有取得定位或計算距離，也不把地圖搜尋結果標示為已查核據點。尚無區級資料時會提示並提供縣市諮詢、地圖查詢入口。
