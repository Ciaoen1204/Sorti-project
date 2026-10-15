# SORTI 資料庫設定

## 買家與賣家分區更新

已執行先前完整 SQL 的專案，只需在 SQL Editor 執行 [marketplace-workflow.sql](marketplace-workflow.sql)。新專案的 `setup-all.sql` 已包含相同更新，兩份皆可重複執行。

同一個帳號可以使用買家專區或賣家中心，不需另註冊。切換畫面不會增加權限；資料庫依商品所有者、訂單買賣雙方與對話參與者判斷存取。

| 流程 | 買家 | 賣家 |
| --- | --- | --- |
| 商品 | 瀏覽其他人的上架商品、購物車與結帳 | 刊登、編輯、下架、重新上架，查看已售出商品 |
| 訂單 | 我的購買、配送資訊、待出貨時取消、出貨後確認收貨 | 銷售訂單、收件資料、待出貨時出貨或取消 |
| 訊息 | 聯絡賣家與既有對話列表 | 買家詢問列表與回覆 |

訂單流程為 `pending → shipped → completed`；僅 pending 可取消，取消後重新上架商品。`transition_market_order` 驗證操作身分與現況，不能透過切換 UI 冒用另一方。已售出商品禁止直接改價或重新上架。尚未串接物流 API，確認出貨是賣家實際寄出後手動更新狀態。

## 完整系統建置

1. 開啟根目錄 `.env` 所指定專案的 **SQL Editor → New query**。
2. 貼上 [setup-all.sql](setup-all.sql) 的**全部內容**並按 **Run**。這份檔案已包含照片空間，無須另外執行 storage-setup.sql。
3. 最後結果應有 12 張表，`rowsecurity` 都為 `true`。
4. 執行 [verify-all.sql](verify-all.sql) 檢查資料表、照片空間、結帳函式、外鍵與唯一條件。
5. 回到最新版 PWA 測試測驗、打卡、分析、聊天、刊登、購物車與貨到付款。

登入、密碼與登入憑證由 Supabase Auth 的 `auth.users` 管理，不另外儲存明文密碼。目前 App 的姓名與使用者名稱使用 Auth metadata；保留既有 `profiles`，不新增可能干擾註冊的 Auth trigger，也不覆寫其資料。

| 資料表 | 用途與權限 |
| --- | --- |
| profiles | 既有個人資料，僅本人存取 |
| user_personas | 原始測驗人格與分數，僅本人存取 |
| check_ins | 打卡照片紀錄，僅本人存取、僅台北當日可新增或更新 |
| ai_analyses | 分析結果與建議，僅本人存取 |
| items | 物品及分析關聯，僅本人存取 |
| listings | 商品，登入者可瀏覽上架商品；僅賣家可修改 |
| cart_items | 購物車，僅本人存取 |
| orders | 訂單與收件資訊，僅買賣雙方可讀取 |
| order_items | 訂單商品快照，僅買賣雙方可讀取 |
| conversations | 商品對話，僅買賣雙方存取 |
| messages | 對話訊息，僅參與者存取；不可冒充發送者 |
| ai_chat_messages | AI 對話紀錄，僅本人存取 |

`create_orders_from_cart` 在同一個交易建立各賣家的訂單及明細，依資料庫商品價格計算金額、設定貨到付款待付款狀態、標示商品售出並移除已結帳購物車項目。單賣家小計大於 500 元免運，否則運費 60 元，與目前 App 規則一致。一般使用者不能直接修改訂單金額或付款狀態。點數付款目前沒有扣點系統，因此不接受假裝已付款的訂單。

原始情境問題、圖片及人格說明仍來自 App 既有檔案；每日 Gemini 題目選項與回饋目前仍快取於裝置。這份建置不會將這些內容自動搬到雲端。

SQL 可以重複執行，保留既有紀錄。它重建自身 `sorti_` 前綴的政策、對這 12 張表重新設定應用程式角色權限，並新增限制政策約束既有寬鬆政策。不處理其他業務表。若既有同名表結構不同，交易會失敗並回滾；請保留錯誤訊息，勿先刪表。

專案目前只有 publishable key，無法由程式建立遠端資料表。因此需由專案管理者在 SQL Editor 執行。執行後可在專案目錄執行 `node scripts/check-database.mjs`，此唯讀檢查不讀取紀錄；私人表回應 `42501 permission denied` 是預期的匿名存取限制，不代表表不存在。正式登入後的操作仍需要實機驗證。

## 開發驗證

`scripts/test-database.mjs` 在記憶體 PostgreSQL 建立模擬的 Supabase Auth/Storage，驗證完整 SQL、重複執行、跨帳號權限、台北日期、對話身份、照片政策、訂單金額與交易回滾。它不連線正式資料庫。使用方式：

```powershell
npm install --prefix .pwa-tools/db-test --no-package-lock @electric-sql/pglite
node scripts/test-database.mjs
```

本機測試不取代正式 Supabase 的 SQL Editor 驗證與登入後實際操作。

資料列存取規則參考 [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)。

## 照片空間個別設定

當上傳照片出現 `Bucket not found`，請在與根目錄 `.env` 的 `SUPABASE_URL` 相同的 Supabase 專案設定 Storage。

1. 登入 Supabase Dashboard，選擇專案，開啟 **SQL Editor → New query**。
2. 貼上本資料夾的 `storage-setup.sql` 完整內容，按 **Run**。
3. 結果應有三列：`analysis-photos` 和 `check-in-photos` 的 `public` 為 `false`，`product-photos` 為 `true`。
4. 回到 App 重試照片上傳。PWA 若仍顯示舊訊息，關閉所有 SORTI 視窗後重新開啟。

SQL 可以重複執行，不會刪除照片。它設定上述三個空間的公開狀態，新增登入使用者只能管理自己 ID 資料夾的權限，保留其他既有政策。商品照片可公開瀏覽；每日打卡與分析照片使用限時簽名網址。若先前存在過度寬鬆的政策，需另行檢查；新增政策不會收緊既有政策。

公開的 publishable key 無法代替管理權限建立空間。不要將 service-role key 放進手機、PWA 或貼到聊天中。

官方參考：[Supabase Storage 權限設定](https://supabase.com/docs/guides/storage/security/access-control)。
