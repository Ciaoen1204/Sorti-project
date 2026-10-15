# 拾序政策整合 v1.1

## 內容來源及共用方式

唯一正文來源是使用者提供的《拾序_服務條款_v1.1.pdf》（4 頁、37 條）及《拾序_隱私權政策_v1.1.pdf》（5 頁、38 條）。共用檔為 `src/data/legalPolicies.json`，保存來源 SHA-256、完整段落及 PDF 超連結。只移除頁碼、重複頁尾及排版換行；跨行 Supabase DPA 網址依原 PDF 的超連結還原。未翻譯、摘要或改寫正文，未發現無法辨識字元。

文件原文的更新日期為 2026 年 10 月 14 日；生效說明「生效日：本版本於本服務正式發布之日。」及末節原有文字逐字保留，沒有另行推定生效日期。政策正文不經介面翻譯器。

核對：`python scripts/verify-legal-source.py`；可傳入另一個 PDF 來源資料夾。以原始雜湊、移除純空白後的完整正文、PDF 註解內網址比對。9 頁均已渲染檢視；6 個公開網址 HTTP 200。來源檔不是公開下載資產。

## 使用流程

- Android：歡迎頁、註冊頁、確認頁、設定提供政策入口；讀取登入失敗畫面亦可閱讀政策。
- PWA：`/legal/terms`、`/legal/privacy`、`/legal/contact`，直接開啟不需登入。`scripts/serve-pwa.mjs` 只為這三個明確路徑提供 SPA fallback。
- PWA 政策覆蓋層保持底下註冊元件掛載，Native 使用 stack push，返回不清空已填欄位。
- Email 註冊兩項確認預設 false；未勾選不建立帳號。取得 session 後以本人 JWT 保存紀錄；根導覽等待保存流程，保存失敗進入限制確認頁，不進服務。
- Google 可先完成 OAuth 身分建立；根導覽先檢查伺服器紀錄，未確認者只能閱讀政策、聯絡或登出。既有帳號、重新登入及新裝置使用同一檢查。
- 不把 Auth user_metadata、手機快取或 localStorage 視為確認依據。未確認的 Native stack 沒有 Home／Quiz／交易／聊天等服務 route；PWA 不掛載服務畫面。AI gateway 與 FastAPI 每次請求也查伺服器確認紀錄，失敗關閉存取。
- 設定僅有服務條款、隱私權政策、聯絡我們；未新增刪除頁面或刪除功能。聯絡頁只有 mailto 與複製，郵件由使用者自行編輯及送出，不呼叫寄信或刪除 API。
- 年滿 18 歲是自我聲明，不是身分或出生日期查核。

## Migration 與部署狀態

**遠端 migration 尚未套用，沒有修改 Supabase Auth 設定，也沒有部署 Edge Function 或重新啟動公開後端。** 已產生 PWA 靜態 build；既有執行中的伺服器仍需部署新版。Migration 未套用時，新客戶端會停在確認閘門，不能假稱服務已開通。

1. 管理員審閱並在測試資料庫套用整份 `supabase/legal-consent-v1.1.sql`，在既有 marketplace migrations 後執行。不可只執行建表部分。
2. 新表 `legal_acceptances` 只允許本人讀取，authenticated 無直接 insert/update/delete 權限。僅本人可呼叫 RPC，以伺服器驗證 v1.1、兩項聲明；時間由伺服器產生。重複確認不覆寫原時間。舊版本歷史列保留；未向前端開放管理員金鑰。
3. Restrictive RLS 與既有 owner/participant 規則共同作用；確認紀錄本身不受服務閘門限制。Marketplace SECURITY DEFINER RPC 另加入口檢查，否則它們可繞過表格 RLS。日後重建這些 RPC 後必須重套政策 migration；新版本政策須同步調整伺服器驗證與客戶端版本，不能靠前端常數單獨升級。
4. 在真實 Supabase 測試帳號上驗證 RLS／RPC／Storage／Realtime／token refresh；本次只有本機 PostgreSQL 引擎測試，沒有宣稱遠端已驗證。
5. 重新部署 `scripts/serve-pwa.mjs` 與 FastAPI `src/backend/main.py`；FastAPI 需要 `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`（可從專案 `.env` 讀取），用 caller JWT 查紀錄。請勿傳 service-role key 到前端。後端缺設定／逾時／紀錄不存在皆拒絕。
6. 重新部署 `supabase/functions/market-push/index.ts`；未接受當前版本的既有通知工作不發送推播。不能只更新前端就宣稱後端限制已部署。
7. 發布 PWA 靜態 build，發布／安裝新版 APK 並以 Android 實機驗證郵件程式、剪貼簿、返回、Google OAuth 及新裝置重新登入。iPhone WebKit 測試不是實機測試。
8. 目前仍為受邀測試，沒有調整或放寬既有公開註冊設定。現有前端只有 signUp/OAuth，沒有找到邀請碼或伺服器 allowlist 的強制檢查；團隊須在公開測試連結使用前確認現有邀請控管與 Auth 設定。不得將文案「受邀測試」當作已實作邀請驗證。

本機 SQL 測試：`npm install --prefix pwa-runtime/sqltest --no-package-lock --ignore-scripts @electric-sql/pglite`，再 `node scripts/test-legal-migration.mjs`。隔離安裝，不改正式相依套件。涵蓋版本、兩項聲明、伺服器時間、重複確認不覆寫、本人讀取、他人不可讀、無直接寫入／修改／刪除、未確認 RPC 拒絕、匿名拒絕。

## 政策與既有實作的具體落差（尚未由本次核取框解決）

1. **Gemini 示範資料限制未強制落實。** `src/backend/main.py:chat` 將自由輸入、history、items、persona、space_analysis、storage_preferences 交給 `rag_service.answer_question`；`vision_detection.py`、`space_analysis.py`、`daily_tasks.py` 會傳照片／任務回饋給 Gemini。沒有檢測或阻擋含姓名、電話、地址、可識別人物、私人住家、文件等資料的強制措施。條款第 4 節與隱私第 4 節僅允許符合限制的示範資料，**接受政策不代表這項差異已修正**。正式測試前須限制示範資料或另行完成符合政策的技術與流程；不能向測試者宣稱一般私人照片可任意送 AI。
2. **保存期限尚無完整自動清理實作。** 已檢查目前 SQL／backend，未找到全面執行「交易完結／結束後最長一年」及「交付後 90 日清除收件資料（含聊天、備註副本）」的排程與全副本清理。需團隊以人工流程／排程落實，並建立 30 日聯絡受理等追蹤；本次未新增自動刪除功能。
3. **人工刪除與第三方留存需實際執行。** 聯絡頁只提供申請方式，不會清除 Supabase、Storage、通知 Token 或供應商副本，也不會在複製／開啟郵件後顯示申請已送出。政策既有刪除說明及保存期限完整保留。
4. **供應商地區與營運事實需要團隊確認。** 文件提及 Supabase Mumbai、團隊本機 FastAPI、無獨立備份；本次未變更基礎設施、計費方案或備份設定，也未以新增頁面宣稱這些營運事實已稽核。

## 驗證

詳見本次測試執行結果：Native 與 PWA TypeScript、Jest、FastAPI unit tests、PGlite SQL 與手機 Chromium/WebKit Playwright。Playwright 使用模擬 Auth／RPC，不代表真實 Google 登入或遠端資料庫部署驗證。未測 Android 實機、真實郵件程式、跨實際裝置或正式遠端部署。


## 主要修改檔案

- 共用正文：`src/data/legalPolicies.json`；核對工具：`scripts/verify-legal-source.py`。
- Native：`App.tsx`、`src/services/useAccountSession.ts`、`src/components/LegalChecks.tsx`、`src/screens/LegalPolicyScreen.tsx`、`LegalConsentScreen.tsx`、`ContactScreen.tsx`、`RegisterScreen.tsx`、`WelcomeScreen.tsx`、`SettingsScreen.tsx`。
- PWA：`web/Legal.tsx`、`web/main.tsx`、`web/style.css`、`scripts/serve-pwa.mjs`；`web/data.generated.ts` 僅由 `pwa:prepare` 產生。
- 雲端與 AI 閘門：`src/services/supabaseData.ts`、`src/services/aiApi.ts`、`src/backend/legal_access.py`、`src/backend/main.py`、`supabase/legal-consent-v1.1.sql`、`supabase/functions/market-push/index.ts`。
- 移除舊摘要入口：`src/data/appSupport.ts`；新版政策正文只取自 PDF。
- 原生剪貼簿相依套件：`package.json`、`package-lock.json`；測試 mock：`jest.setup.js`。
- 測試：`__tests__/legalConsent.test.tsx`、`__tests__/accountSession.test.tsx`、`web/tests/legal.spec.ts`、`scripts/test-legal-migration.mjs`、`src/backend/test_legal_access.py`；既有 Auth／API fixtures 配合新增伺服器閘門調整。


### 2026-10-15 實際執行紀錄

- Native `npx tsc --noEmit` 與 PWA `npm run pwa:check` 通過。
- Jest：22 suites、79 tests 通過。FastAPI／RAG／PDF／任務單元測試：29 tests 通過。
- 本機 SQL 測試通過，另驗證重複套用 migration 不會重複注入 RPC guard；沒有連線遠端資料庫。
- 政策專用 Playwright：Chromium 手機及 WebKit iPhone 共 18 tests 通過，包括全段正文、網址、預設未勾、原註冊輸入、Email、OAuth callback、既有帳號、保存／讀取失敗、新瀏覽器 context、設定與聯絡。
- 相關功能回歸共選取 40 項：政策、歡迎頁、保留登入、Google PKCE／取消、交易入口、7 題原始測驗、任務、聊天、照片儲存；38 passed、1 failed、1 skipped 的初次結果中，失敗為 WebKit 返回頁面尚未載入就讀取歡迎頁狀態的測試競態；補上等待後取消 Google 兩個平台重跑均通過。累計選取項目 39 項通過，WebKit service-worker 離線網路模擬 1 項依測試設定跳過，Chromium 離線測試通過。
- 曾啟動完整 126 項 PWA suite，因舊首頁標題／直接登入畫面等過時預期失敗而中止；已更新本次涉及的預期並完成上述選取回歸。**沒有宣稱完整 126 項皆通過**。
- PWA production build 成功。Android arm64 release build 成功：`release-builds/Shixu-policy-v1.1-arm64.apk`，46,203,948 bytes，SHA-256 `5E876DE20BD1A1E61FB022600BD4F6F651FD591E25120EC61572CF856E01D2F8`。
- 六個第三方公開網址在本次檢查均回傳 HTTP 200；不保證供應商日後網址永久可用。
- 未執行 Android／iPhone 實機、真實 Google 憑證登入、實際跨裝置、原生郵件程式／剪貼簿、遠端 migration 或正式服務部署驗證。瀏覽器 Auth／RPC 使用 mocks，SQL 使用隔離本機引擎。


### 政策閱讀卡片調整

依參考圖恢復註冊表單，年齡與行內政策同意卡片移到 Email／Google 註冊按鈕下方，移除重複的技術提示。Native／PWA 每份文件新增快速滑到底部、底部手動閱讀勾選及確認返回；快捷滑動不會勾選。兩份文件確認後可回填表單的政策同意，但不勾選年齡，也不直接建立伺服器確認紀錄。讀取／保存錯誤在卡片內顯示，保留失敗不放行。

本次 Native／PWA 型別檢查通過，79 項 Jest 與 20 項政策瀏覽器測試通過；最後緊湊版面的閱讀返回相關 4 項另重跑通過。PWA 重新打包，Android 重新產生 `release-builds/Shixu-policy-reader-arm64.apk`。政策正文未修改，遠端 migration／後端部署仍未執行；未做 Android 實機驗證。


### 遠端套用與確認解鎖修正（2026-10-15）

使用者明確授權後，整份 `legal-consent-v1.1.sql` 已套用到目前專案 `riqpljtpfcwuejvoyfoh`。遠端確認表 RLS 已啟用、authenticated 只有讀取沒有直接 INSERT、18 個服務 gate、5 個 Marketplace RPC guard。另執行 `verify-legal-consent.sql` 回滾測試，版本／年齡／保存讀回／時間不覆寫／匿名拒絕通過，未替任何真實使用者留下同意紀錄。此狀態取代上文「migration 尚未套用」。

兩份文件的閱讀勾選改為局部草稿，必須按「確認並返回」才解鎖外部同意；外部同意仍須本人另勾選。Native 連結改為獨立可觸控元件，PWA 使用獨立導覽事件。79 項 Jest、22 項手機 Chromium／WebKit 政策測試通過，兩端 TypeScript 及 Android APK／PWA build 成功。新版 APK：`release-builds/Shixu-policy-confirmed-arm64.apk`。目前 4173 PWA 程序已重啟，三個政策直接路由已 HTTP 200 驗證。

安全 advisor 已執行，仍有已登入者可呼叫 SECURITY DEFINER 等警告；政策保存及檢查 RPC 是刻意開放給登入本人、內部固定 auth.uid()、空 search_path，anon 已撤權，不是無警告的安全稽核。未做 Android 實機或以真實登入 JWT 完整端到端確認；遠端函式測試使用回滾交易。AI 後端與推播函式的其他部署及既有政策落差仍依前文列示。
