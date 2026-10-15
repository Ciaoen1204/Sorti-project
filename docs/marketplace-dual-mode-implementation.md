# 二手市集雙模式交易實作交付

2026-10-11。Android／PWA 程式與打包完成；**雲端 SQL 尚未套用，新交易流程尚不能宣稱已在正式資料庫驗證**。

## 本次行為

- 保留市集雙欄、搜尋分頁、統一我的交易、訊息中心、四個主導覽及物品清單帶入刊登。
- 刊登增加商品狀況、瑕疵、面交／寄送、面交偏好、實際自行寄送方式及固定運費，進預覽前完整驗證。照片維持現有單張。
- 直接購買只帶指定商品，不先加入購物車；購物車結帳可選取商品及每件允許的交付方式。依賣家＋方式分單，同組寄送運費取最高一件；面交不要求收件資料。
- 送出後顯示「已送出購買請求」及「等待賣家確認」，商品不立即售出。賣家接受才原子保留；競爭請求失效。既有 pending／paid／shipped 訂單仍保留原流程，不推測交付方式或平台收款。
- 共用訂單詳情呈現下一步、快照商品、真實金額、交易進度、約定／寄件資料與歷程，依角色產生操作。
- 面交可提出新版本時間地點，由對方確認最新版本；任一方交付後不再改安排。買家收到與賣家交付兩邊都確認才完成。
- 寄送由賣家填真實日期、可選物流商／追蹤碼，再標記已寄件；畫面明示非物流驗證。買家確認實際收到才完成。不生成假物流單號，不提供平台收款保障。
- 未接受請求可由買家取消；已接受但交付未開始須雙方同意取消。任一方已交付確認或已寄件後不能普通取消／重新上架。
- 問題記錄由交易雙方協調，雙方確認解決才關閉，未關閉阻擋完成。沒有平台退款、仲裁或客服受理承諾。
- 商品／訂單／聊天沿用既有 listing＋buyer＋seller 關聯，可區分取消後重新購買的歷史單。訊息新增重試鍵；寫入與對話排序時間透過資料庫觸發器保持原子性。

## 程式位置

- `src/services/marketplaceOrder.ts`：共用交付設定驗證、狀態投影、合法 UI 動作、分組費用與請求識別碼。
- `src/services/supabaseData.ts`：唯一雲端入口，v2 請求、操作、詳情、關聯訂單／對話與訊息重試。
- `src/screens/MarketOrderDetailScreen.tsx`／`web/MarketTransaction.tsx`：兩端訂單、面交、寄送、取消及問題操作。
- `CheckoutScreen.tsx`／WebMarketCheckout：直接購買隔離、購物車選取與請求成功。
- `AddProductScreen.tsx`／PWA AddProduct：來源→資訊→交易設定→預覽→成功。
- MarketScreen、ProductDetailScreen、MarketplaceWorkspaceScreen、ChatScreen 與 PWA 對應畫面：商品狀況、保留狀態及真實訂單入口。
- `scripts/export-pwa-data.cjs`：同時改寫共用型別與執行期 import；`web/data.generated.ts` 一律由 pwa:prepare 匯出。

## 雲端部署檔案及保護

待套用：[`supabase/marketplace-dual-mode.sql`](../supabase/marketplace-dual-mode.sql)，需在 Supabase SQL Editor **執行整份檔案**。本工作階段的 Supabase 連接工具不可用，本機只有 publishable key，不能以它執行資料庫 DDL；沒有把 service role 放入前端，也沒有直接修改正式資料。

SQL 包含新欄位、order_events／order_issues、RLS、RPC、訊息唯一鍵、舊版新建訂單閘門，以及既有取消訂單釋出 allocation 的相容觸發器。保留舊資料；遇舊資料重複有效出售會整份回滾，要求人工檢查，不擅自刪資料決定勝方。

設計細節相較提案的調整：目前面交安排與單次寄件採 orders 的 JSONB 欄位，由只有 RPC 可寫的 orders 權限保護；不額外建 order_meetups／order_shipments 表。版本與參與者檢查在 RPC 執行，歷史動作寫 order_events。精確地點、地址、電話及追蹤碼只供訂單參與者讀取，不寫入公開 listing 或歷程 metadata。

整批冪等內容只保存摘要，不把其他賣家商品與寄送地址複製給同批的面交賣家。accepted／completed 的 allocation 由單件唯一索引防重複出售；本次 P0 採共用 advisory transaction lock 序列化市場變更，適合目前低流量測試。若之後高流量，需要多連線壓測後細化鎖，不能宣稱本機測試等於正式併發壓測。

部署後需要用兩個測試帳號完成面交／寄送、接拒單、取消、越權與同件搶單驗證。未串接正式金流、物流、推播、收藏、評價或未讀數；原 AI、辨識框、裁切、測驗和捐贈回收均保留。

## 驗證與產物

- Native `tsc --noEmit`、PWA `pwa:check` 通過；lint 0 errors，仍有既有／Inline Style 警告。
- Jest：15 suites／60 tests 通過。
- 隔離 PostgreSQL 相容引擎：35 assertions 通過，包含接單競爭結果、防越權、請求重試、收貨、單方交付、問題處理、取消、舊版閘門及 SQL 重跑。不連正式 Supabase，不代表已跑多連線競態壓測。
- 完整 PWA 回歸：67 通過、既有 WebKit 離線 1 略過；刊登成功後 mock 未回傳商品重讀資料的兩項失敗已修正。修正後市集組共 14 項在 Chromium／iPhone WebKit 全部通過，涵蓋那兩項重測。
- PWA build 成功：`index-MaoS2Stf.js`。新版使用現有 gateway；實際新交易仍等待上述 SQL 部署。
- Android arm64 Release 打包成功並 USB 安裝 `Success`，保留既有 App 資料。
- APK：[`release-builds/Sorti-dual-mode-marketplace-arm64.apk`](../release-builds/Sorti-dual-mode-marketplace-arm64.apk)，44,506,370 bytes。
- SHA256：`8BADF5FFCDE8351FA8D54C2A99B8D7F0D3E268DB29AE7E24DBF981A1335EB2A3`。
- PWA 面交單方確認畫面：`pwa-runtime/dual-mode-meetup-webkit-iphone.png`，為隔離瀏覽器測試資料，沒有寫入正式商品或訂單。

本機重跑資料庫測試：先 `npm install --no-save --package-lock=false --prefix .local-tools @electric-sql/pglite`，再 `node scripts/test-marketplace-dual-mode.mjs`。測試工具目錄已加入 gitignore；不增加正式 App 依賴。

## 雲端部署確認（2026-10-11）

使用者回報已執行完整 SQL。以正確參數探測 `create_market_requests`、`market_order_action`，皆回應 HTTP 401／42501 permission denied，確認函式存在且匿名不可執行；未建立測試訂單或修改正式資料。PWA 本機與臨時 HTTPS 連結皆回應 200，載入 `index-MaoS2Stf.js`。此檢查不代表雙帳號實際交易驗證已完成。
