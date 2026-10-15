# 二手市集改版交付（2026-10-11）

## 介面與導航

| 原本 | 新版 |
| --- | --- |
| 買家專區／賣家中心切換，再選功能 | 直接瀏覽商品；統一我的交易、訊息中心 |
| 橫向小圖卡、只篩選已載入資料 | 雙欄正方形圖片、名稱兩行、NT$ 價格；後端搜尋／分類／價格／排序／20 件分頁 |
| 刊登藏於賣家中心 | 首頁「＋刊登商品」；選來源→資訊→預覽確認→成功操作 |
| 買家與賣家對話分開 | 同一訊息列表、真實最近訊息與對象識別碼，沿用聊天室 |
| 大型捐贈回收 CTA 搶占瀏覽首頁 | 保留物品管理／首頁／我的交易次要入口 |
| 商品詳情分享按鈕無事件、假「剛剛上架」 | 系統分享商品資訊、真實日期；照片失敗提示、固定交易操作區 |

主導覽維持首頁／物品／二手市集／設定。市集 → 商品詳情／購物車／刊登商品／我的交易／訊息中心；我的交易 → 我的購買／我的刊登／銷售訂單。舊 Native role/tab 路由參數仍相容，它只指定要看的交易紀錄，不能切換驗證身分或權限。

## 修改檔案

- `App.tsx`：相容舊交易路由，role 改為選填以支援統一訊息入口。
- `src/screens/MarketScreen.tsx`：FlatList 雙欄、搜尋分類排序價格、分頁、首頁刊登與交易入口。
- `src/screens/MarketplaceWorkspaceScreen.tsx`：整合我的交易與訊息，真實計數與分頁，保留出貨／收貨／取消／上下架操作。
- `src/screens/AddProductScreen.tsx`：三步刊登、個人物品來源、原生相機與相簿、共用驗證與防重複提交。
- `src/screens/ProductDetailScreen.tsx`：照片與貨幣格式、分享、真實日期／分類／賣家帳號、交易操作防連點。
- `src/screens/DonationRecyclingScreen.tsx`：出售入口直接開啟刊登流程。
- `src/components/MarketImage.tsx`：正方形圖片與載入失敗提示。
- `src/context/CartContext.tsx`：使用最新狀態避免相同商品重複出現在清單。
- `src/services/supabaseData.ts`：既有查詢加入分頁／搜尋／排序／價格篩選；精確計數、單件讀取及統一對話與最新訊息。
- `src/services/marketplace.ts`：沿用原分類，兩平台共用價格驗證／NT$ 格式／分享文字。
- `src/services/useMarketPage.ts`：兩平台共用防止舊回應覆蓋、debounce 與分頁狀態。
- `web/main.tsx`、`web/style.css`、`web/AppChrome.tsx`：PWA 對應完整操作及圖示、主題樣式。
- `__tests__/marketplace.test.ts`、`web/tests/pwa.spec.ts`：查詢／業務規則及兩種手機瀏覽器流程回歸。
- `.eslintignore`：排除打包產物與自動產生檔，避免 lint 第三方壓縮 bundle。
- `docs/platform-parity.md`、本文件：同步紀錄與交付。
- `web/data.generated.ts`：由 pwa:prepare 匯出，未手動編輯。

## API／資料庫

沒有新增 FastAPI 端點、資料表、第三方套件或導航框架。既有 service 保留原陣列回傳格式，增加選填查詢參數及頁數；商品日期由既有 created_at 讀取。商品狀態、訂單狀態、付款方式、價格與運費規則不變。

經使用者同意已部署專案原有 `supabase/marketplace-workflow.sql`，遠端 migration 名稱 `install_existing_marketplace_workflow`。補上原先缺少的 `transition_market_order` 與 `sorti_can_view_listing`，以及原檔定義的商品、購物車存取保護。未刪除資料或放寬一般用戶訂單寫入權限。驗證相關表 RLS 開啟、匿名無函式執行權、未登入呼叫遭拒；訊息與商品關聯在真實 Android 帳號可讀。

## 實作範圍與限制

完成瀏覽／搜尋／篩選排序／分頁／刊登預覽／編輯上下架／交易整合／統一訊息／購物車與結帳，以及捐贈回收入口整合。正式資料均來自 Supabase；自動化測試的商品／訂單為攔截 API 的測試資料，未寫入正式資料庫。

現有模型僅一張商品照片；沒有商品狀況欄位、已讀／未讀數、評價、收藏、公開賣家名稱或草稿。未增加假控制項；使用狀況填在商品描述，賣家顯示帳號前八碼，分享為真實商品文字資訊，沒有假裝提供可永久開啟的商品連結。聊天沿用 10 秒輪詢而非宣稱 Realtime。物流仍由賣家實際寄出後手動確認，不是物流 API。

Supabase 安全檢查無 ERROR；有既有交易 SECURITY DEFINER RPC 對 authenticated 開放的提示，這是原有原子交易設計，函式內保留登入／角色／狀態檢查並撤銷 anon 執行權。另有既有帳號外洩密碼保護未啟用提示，未擅自調整驗證設定。參考：[函式檢查說明](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)、[密碼保護設定](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)。

## 驗證結果

- Native 與 PWA TypeScript 型別檢查通過。
- Jest：14 suites／54 項通過，包含 6 項市集查詢與驗證測試。
- ESLint：0 errors，53 warnings（既有 inline style、no-void 等風格提示）。
- 完整 PWA：65 項通過、1 項略過（既有 WebKit 離線 service worker 測試）；另外透過真正的設定開關驗證深色市集與明暗切換後交易操作，Chromium／WebKit 2 項通過。
- PWA production build 成功；仍有單一 bundle 超過 500 KB 的建置提醒，沒有因此更動其他模組載入架構。
- Android arm64 Release APK 打包成功並 USB 安裝；實際開啟並讀取商品、最近聊天訊息。最終版再安裝 adb 回報 Success。APK：`release-builds/Sorti-marketplace-arm64.apk`。
- 兩瀏覽器以 API 攔截測試同帳號購買／刊登／銷售／聊天、既有物品帶入、免費商品刊登與防重複提交、購物車→結帳→購買紀錄、搜尋分頁／價格排序／錯誤復原、原測驗／照片辨識及其他既有功能。
- 沒有在正式環境建立、取消或出貨真實訂單，也沒有代替使用者發送真實訊息。

## 截圖與 Android 手動確認

PWA 截圖使用測試商品圖片，不代表正式市集資料：[淺色市集](../pwa-runtime/market-buyer-webkit-iphone.png)、[深色市集](../pwa-runtime/market-dark-webkit-iphone.png)、[我的刊登](../pwa-runtime/market-seller-webkit-iphone.png)。Android 實機畫面：[市集](../pwa-runtime/android-market-home.png)、[訊息中心](../pwa-runtime/android-inbox.png)。

建議用兩個測試帳號確認：相機與相簿權限／從物品選擇刊登／公開照片內容、編輯與上下架、加入購物車後結帳、賣家確認寄出後買家確認收貨、取消待出貨訂單與重新上架、雙方聊天、返回與四個主導覽、深色模式及系統放大字體。自動化已驗證流程，但真實物流與跨帳號完整交易仍需以測試商品確認。

操作習慣參考 [二手吐司官方網站](https://toas2t.com/)，未複製其品牌、素材或程式碼。

公開 HTTPS PWA 已核對 HTTP 200，提供最終 bundle `index-D6-2WF3N.js`。APK SHA-256：`C5F5029C86EDC831F9699FDB42D05B47A0A7B4019FC16BC957EC602945124D78`。
