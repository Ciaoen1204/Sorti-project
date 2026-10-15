# Sorti-main.zip 功能比對

來源：使用者提供的 `C:\Users\User\Downloads\Sorti-main.zip`，2026-10-11 查核。ZIP 有 127 個檔案、21 個原生畫面，沒有 PWA。只讀取來源與靜態資料進行比對，沒有執行 ZIP 程式或覆蓋目前專案的設定與憑證。

ZIP SHA-256：`d76253c70207480994f2045508f7f8831c96dfae037409d47708a40ab4979a1a`。

測驗 AST 比對確認 7 題、28 個選項及 4 種人格的完整資料一致；ZIP 中 8 個原始圖片檔逐一 SHA-256 比對，全部一致。包含 7 張測驗情境圖與原有空間圖片。原辨識模型 `src/assets/models/best.pt` 的 SHA-256 也與 ZIP 一致。新版正式 Logo 是額外新增資產。

| ZIP 畫面／功能 | Android 對應 | PWA 對應與查核結果 |
| --- | --- | --- |
| Login：帳密登入、密碼顯示、註冊入口 | LoginScreen | Auth；真實 Supabase 登入及 Google PKCE，保留 Session。ZIP 原本僅跳測驗，現版不繞過驗證。 |
| Register：姓名、帳號、密碼、確認密碼 | RegisterScreen | Auth 註冊表單；新增必要 Email、驗證信與錯誤處理。 |
| Quiz：前導、7 題圖片／選項、上一題、人格及偏好結果 | QuizScreen | Quiz；原始資料及圖片完整保留，結果同步雲端。 |
| Home：人格、打卡累積、拍照分析、各功能入口 | HomeScreen | Home；真實人格與打卡數，人格可開原始特質。原版固定 80 分不是實際評分。 |
| AIAnalysisCapture：注意事項、不再提醒、拍照／相簿、預覽、重拍、確認分析 | AIAnalysisCaptureScreen | Analysis / PhotoPicker；本次補齊共用注意事項與帳號範圍的「以後不再提醒」，拍照／相簿入口保持分開。iOS 選檔選單由 Safari 管理。 |
| AIAnalysisProcessing：分析進度、錯誤 | AIAnalysisProcessingScreen | Analysis；開始分析明確請求、忙碌狀態、預覽保留及重試，不提早生成建議。 |
| AIAnalysisResult：照片框、依類別統整、手動框選、名稱分類、移動縮放、刪除 | AIAnalysisResultScreen | DetectionEditor / Analysis；完整保留並支援單件裁切匯入、空間分布、直接生成模擬圖。 |
| AIAnalysisAdvice：斷捨離、如何收納、建議採購、儲存、回首頁／打卡 | AIAnalysisAdviceScreen | Analysis / AdviceContent；本次補齊斷捨離引導及沒有物品時的儲存建議。有人格與 RAG 的真實建議、採購分段、儲存歷史、裁切匯入。主導覽仍可回首頁或每日任務。 |
| AIAnalysisHistory：時間、摘要、照片、詳情 | AIAnalysisHistoryScreen | History；目前帳號雲端紀錄與載入重試，原版最多 20 筆的範圍保留。 |
| AIAnalysisHistoryDetail：原照片、物品名稱分類數量、完整建議及採購 | AIAnalysisHistoryDetailScreen | History 詳情；原文完整呈現、步驟卡片、帶入物品聊天。 |
| AIChat：人格、物品上下文、對話、送出、等待／錯誤 | AIChatScreen | Chat；既有後端 /chat 與帳號對話紀錄，保留辨識／歷史物品上下文。 |
| ItemManagement：拍照、分類、待整理／已定位、照片、位置、匯入時間 | ItemManagementScreen | Items；本次補齊拍照辨識匯入捷徑、整理進度、可設定的真實存放位置與雲端匯入時間；與保留／待售／待丟棄意向分開。原版清單是 mockItems，現版不用假物品。 |
| Market：搜尋、分類、商品圖／價格／地區、購物車、刊登入口 | MarketScreen | Market；真實商品、買家／賣家中心分開，分類與搜尋可操作。 |
| AddProduct：拍照／相簿、名稱、價格、地區、描述、刊登 | AddProductScreen | AddProduct；商品寫入雲端、有分類與重試。 |
| ProductDetail：照片、價格、名稱、描述、地區、聊聊、購物車、立即購買 | ProductDetailScreen | Product；帶真實商品開交易對話／購物車／結帳。 |
| Chat：商品上下文、訊息、送出、時間、捲到最新 | ChatScreen | MarketInbox；真實買賣雙方對話，排除原版自動捏造的賣家回覆。 |
| Cart：照片、商品、地區、價格、移除、小計、結帳 | CartScreen | Cart；持久化本人購物車及可完成的移除／結帳。 |
| Checkout：付款方式、商品明細、小計、運費、總額、確認 | CheckoutScreen | Checkout；可填真實收件資訊，COD 訂單由資料庫原子建立，不接受客戶端偽造金額。 |
| EditProfile：大頭貼、姓名、帳號、Email、性別、密碼、儲存 | EditProfileScreen | Profile；照片上傳、共用帳號資料更新，Email 變更需驗證。ZIP 原版僅返回，現版實際儲存。 |
| Settings：個人資料、密碼、語言、深色、提醒、關於、隱私、登出 | SettingsScreen | Settings / Profile；深色持久化、真實登出、關於／隱私說明。提醒是首頁任務提示，非系統推播。 |
| CalendarCheckIn：上下月、日曆、照片、拍照／相簿、打卡累積 | CalendarCheckInScreen | Daily / CheckInCalendar；保留月曆及歷史照片，沿用使用者要求的當日限制、三選一任務、重拍與完成回饋，不恢復未到日期先拍的舊錯誤。 |

原後端 `/`、`/chat`、`/detect-items` 仍在，原 YOLO 模型保留；PWA 經驗證代理的 `/api/detect` 串接相同辨識。新增空間理解、Gemini 輔助辨識、單件裁切與 RAG 不取代原模型或框選操作。知識庫保留前一版已查核的官方 KonMari 摘要，未將舊版自訂技巧重新標成書籍原文。

ZIP 的三項示意／未完成內容需與已完成操作區分：

- 房間分數：原 Home 寫死 `80`，沒有分析演算法或歷史評分資料，現版不顯示假分數。
- 魔法金幣：原 Checkout 只跳成功 Alert 並清空本機購物車，沒有錢包、點數扣款或真實訂單。現版貨到付款可操作，點數付款仍標示未開放。
- 系統推播：原開關只切元件狀態，沒有推播服務。現版提供會保存、在首頁生效的每日任務提示，沒有宣稱可接收系統推播。

ZIP 的「忘記密碼」、關於、隱私、登出部分入口也有無事件處理／僅導覽的情況。現版關於、隱私、登出已實作；未把沒有行為的忘記密碼文字當成功能恢復。

物品存放位置以本人的 `auth.users.user_metadata.item_storage_locations` 保存，修改前確認物品屬於本人，最多 100 字，清空回待整理；由共用 `supabaseData.ts` 讀寫，PWA 透過 prepare 匯出。不須另外跑 SQL。與現有管理意向同屬小型清單 metadata 實作；多裝置同時編輯不同位置可能最後寫入覆蓋，大量清單建議移成 items 欄位。

自動查核資料：`pwa-runtime/archive-function-audit.json`。本次測試結果及發布狀態記於 `docs/platform-parity.md`。
