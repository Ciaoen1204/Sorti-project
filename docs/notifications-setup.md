# SORTI 聊天與交易通知設定

程式已支援 Android 與 PWA 通知中心、聊天／訂單分類開關、已讀及點擊導覽。使用中每 15 秒更新通知；背景推播走 Firebase Cloud Messaging。未完成下列設定前，背景推播不會啟用。現有每日任務提醒仍不等於排程推播。

## 1. 建立 Firebase 專案

1. 開啟 [Firebase Console](https://console.firebase.google.com/)，按「新增專案」。可不啟用 Analytics。
2. 在「專案設定 → 一般」新增 Android 應用程式，套件名稱填 **com.sorti**。
3. 下載 `google-services.json`，放入專案 **android/app/google-services.json**。這個檔案已排除 Git。
4. Android 需要重新打包、安裝，不能只重新整理舊 APK。
5. 在同一專案新增「網頁應用程式」，取得 apiKey、projectId、appId、messagingSenderId，填入本機 `.env` 的對應欄位：

```env
FIREBASE_PROJECT_ID=
FIREBASE_WEB_API_KEY=
FIREBASE_WEB_APP_ID=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_WEB_VAPID_KEY=
```

6. 到「專案設定 → Cloud Messaging → Web Push certificates」，產生金鑰配對，將公開金鑰填入 `FIREBASE_WEB_VAPID_KEY`。重新執行 `npm run pwa:build`。
7. 確認專案已啟用 Firebase Cloud Messaging API v1 與 FCM Registration API。若啟用推播時回傳 API 未啟用，依 Google Cloud Console 指示啟用該專案的 API。

網頁設定及 VAPID 公開金鑰可放前端；**服務帳戶私密金鑰不可放 `.env` 前端欄位、APK、PWA、Git 或對話中**。

## 2. 啟用 Supabase 通知資料

經確認後執行整份 `supabase/marketplace-notifications.sql`。它新增通知資料、分類偏好、裝置登記、發送紀錄與事件觸發器。聊天通知只給對方；訂單事件通知給除操作者之外的交易當事人。保留既有訂單與聊天，不回補舊通知。

通知正文不包含聊天內容、電話或地址，避免鎖定畫面洩漏交易私訊。通知中心顯示最近 100 則；已讀與分類偏好在同帳號各裝置同步。

## 3. 設定推播發送後端

1. Firebase「專案設定 → 服務帳戶」產生服務帳戶私密金鑰，妥善存放在 Git 以外的位置。
2. Supabase「Edge Functions → Secrets」新增：
   - `FIREBASE_SERVICE_ACCOUNT`：服務帳戶 JSON 的完整內容。
   - `MARKET_PUSH_SECRET`：自行產生的長隨機字串，用於保護排程呼叫。
3. 本次已部署 `market-push` 至目前專案，未設定秘密時會拒絕呼叫。日後更新可部署 `supabase/functions/market-push/index.ts`。使用 Supabase CLI 時先確認 `supabase functions deploy --help`，再部署 `market-push` 並加 `--no-verify-jwt`。此函式自己檢查 `Authorization: Bearer <MARKET_PUSH_SECRET>`；不接受一般使用者觸發。
4. Supabase Cron 建立每分鐘一次的 HTTP POST 工作，URL 填 `https://<project-ref>.supabase.co/functions/v1/market-push`，Authorization header 填 `Bearer <MARKET_PUSH_SECRET>`，Content-Type 填 `application/json`，body 填 `{}`。秘密儲存在後台／Vault，不貼進可公開的 SQL。
5. 如需更快發送，可另外用 Database Webhook 監聽 `public.market_notifications` 的 INSERT，POST 到同一個網址並設定相同 Authorization header；保留 Cron 作為重試保障。

每批最多認領 50 則通知，認領鎖 2 分鐘；失敗採退避重試，最多 8 次。已成功的裝置有送出紀錄，重試會跳過；無效 FCM token 會移除。網路中斷後的極端情況仍可能重送，這不是恰好一次傳遞保證。分類關閉時不送背景推播，但保留通知紀錄。

## 4. 手機允許通知

- Android：設定 → 通知中心與通知設定 →「允許此手機背景通知」，允許系統權限。關閉 App 不等於系統設定中的「強制停止」；強制停止後需重新開啟。
- iPhone：使用支援 Web Push 的 iOS 16.4 以上版本，Safari 加入主畫面，再從主畫面開啟 PWA，到通知設定允許背景通知。一般 Safari 分頁不能代替主畫面 PWA。
- PWA 必須使用 HTTPS。臨時網址換掉後需重新開啟、重新登記；正式使用應採固定網址。
- 「停止此裝置背景通知」會移除此裝置登記，不會關閉其他裝置。登出會先取消裝置登記；若取消失敗會要求連線後重試，避免共用手機收到前一帳號通知。
- 通知中心的分類開關控制整個帳號的聊天／訂單提醒；系統層通知是否允許仍由手機設定決定。

## 5. 實機驗收

使用兩個測試帳號，分別驗證新私訊、購買請求、接受／拒絕、出貨、面交交付、收貨、取消及交易問題。各測開啟中、背景、關閉後、分類關閉、系統權限拒絕、登出切換帳號。點擊通知應到對應聊聊／訂單。請勿用正式訂單來測出貨或收貨。

尚未配置 Firebase 及部署發送程序時，只能驗證站內流程；不得宣稱已完成關閉後推播驗收。

參考：[React Native Firebase Messaging](https://rnfirebase.io/messaging/usage)、[Firebase Web Messaging](https://firebase.google.com/docs/cloud-messaging/web/get-started)、[FCM HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api)。

## 2026-10-12 設定進度
Android sorti-56a5d／com.sorti 與 PWA Web App／VAPID 均已設定並打包。服務帳戶已安全上傳至 Edge Secrets；排程授權密碼存入 Vault，sorti-market-push-every-minute 已啟用。發送端授權呼叫 HTTP 200。尚無登記裝置，不能宣稱已完成背景推播驗收。接下來在新版 Android／HTTPS PWA 的通知設定開啟裝置通知，使用兩個帳號測試新訊息及交易事件；iPhone 必須由主畫面 PWA 開啟。一般排程延遲約一分鐘，失敗時採退避重試。
