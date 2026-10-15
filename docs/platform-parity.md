# App / PWA 功能同步清單

兩個前端共用 Supabase、AI 後端、測驗資料與捐贈回收資料。手機測試的 AI 連線使用現有 HTTPS PWA 入口加 `/api`，App 會帶登入 token，`/detect-items` 映射為 gateway 的 `/detect`。臨時入口需要電腦與 tunnel 維持運作；更換網址後 App 需要重新打包。功能更新需同步維護兩個前端。

| 功能 | Android | PWA |
| --- | --- | --- |
| 註冊、登入、登出 | 有 | 有 |
| 原始測驗、情境圖與人格 | 有 | 有 |
| 相機 / 相簿分析、Gemini + 模型 | 有 | 有 |
| 辨識框、手動新增、名稱分類、移動縮放、刪除 | 有 | 有 |
| 單件裁切預覽、以最新框匯入物品管理 | 有 | 有 |
| 物品清單、搜尋、照片、依狀況找處理管道 | 有 | 有 |
| 每日三選一、重拍、回饋、限制當日 | 有 | 有 |
| 月份切換、打卡照片與回饋紀錄 | 有 | 有 |
| 分析歷史、物品明細與建議 | 有 | 有 |
| AI 對話、帶入分析物品 | 有 | 有 |
| 市集雙欄商品、後端搜尋分類／排序／價格篩選、分頁 | 有 | 有 |
| 我的交易：購買、刊登、銷售訂單；統一訊息中心 | 有 | 有 |
| 三步刊登、既有物品帶入、預覽確認、購物車與結帳 | 有 | 有 |
| 賣家商品管理、訂單狀態與交易訊息 | 有 | 有 |
| 縣市行政區捐贈回收資訊、損壞物排除捐贈 | 有 | 有 |
| 個人資料、大頭貼、性別、電子郵件、新密碼儲存 | 有 | 有 |
| 深色模式、首頁每日提醒、關於與資料隱私說明 | 有 | 有 |

## 平台差異與資料限制

- Android 啟動時恢復 AsyncStorage 中的 Supabase Session，再依帳號測驗紀錄進入首頁／首次測驗；刷新 Token 不重置導覽。PWA 同網域使用持久化登入，重新整理或重新開啟不要求重登。明確登出會清除 Session；暫時恢復失敗可重試。
- App / PWA 都有 Google 登入，使用 Supabase OAuth PKCE：Android 由系統瀏覽器返回 `sorti://auth/callback`，PWA 回到原網域交換驗證碼。未啟用 Provider 顯示設定訊息，不假裝登入成功；一次性設定見 `docs/google-login.md`。真實 Google 登入仍需後台啟用與實帳授權驗證。

- Android 使用原生相機；PWA 使用 Safari / 瀏覽器的相機與相簿選取，需 HTTPS 與瀏覽器權限。
- 深色模式在裝置本機保存；帳號資料、大頭貼及首頁提醒透過 Supabase 同步。
- 每日任務文字與回饋仍各自在裝置保存，打卡照片與日期共用雲端；換裝置可看照片，但舊裝置的回饋文字不會自動出現。這是兩邊既有儲存格式的限制。
- 系統推播尚未實作；提醒開關代表首頁提示，不會背景發送通知。
- AI / 登入 / 雲端同步需要網路；歷史照片不會因本次改版自動重新裁切。

## 檢查

`npm run pwa:check`、`npx tsc --noEmit`、`npm test -- --runInBand`、`npm run pwa:test`、`npm run pwa:build`，Native 修改後另打包 APK。

## 以 Android 為基準的介面對齊

- 兩平台共用 `src/design/platformAppearance.ts` 的明暗色彩與四個底部入口：首頁、物品、二手市集、設定。捐贈與回收保留首頁獨立卡片和側邊選單入口。
- PWA 手機首頁對齊 Native 的品牌列、人格徽章、空間分析主卡、常用功能、用不到的物品及收納助理，打卡累計和今日完成狀態讀取同一雲端資料。
- PWA 各頁共用置中標題、返回首頁與功能選單；情境測驗、測驗結果與商品名稱等內容標題保留。側邊選單使用可關閉、可鍵盤操作的對話框，加入測驗與每日任務入口；Native 選單也加入同樣入口。
- Logo、表單、卡片、按鈕、物品縮圖及設定分組以 Native 的樣式對齊。登入／註冊也可顯示或隱藏密碼。寬螢幕保留較寬內容，手機維持相同資訊順序。
- 原生相機和瀏覽器選檔、Native 彈窗和 HTML 對話框仍遵循各平台行為；不宣稱兩個渲染引擎像素完全相同。

## 空間分區與個人化 RAG 建議

- App 與 PWA 的收納建議／歷史共用 Markdown 文字整理與採購拆分，轉為標題、段落、步驟呈現，不直接顯示 `###`、`**`、程式碼圍欄或舊資料的跳脫換行；保留原始建議文字，不修改已保存紀錄。

- 空間區塊顯示名稱統一為「空間分布」；不顯示額外的「辨識結果」標題。照片框選／物品修正以獨立圓角框線卡片呈現，與空間分布區塊區隔，兩平台同步。

- 「開始分析」只執行空間理解、物品辨識與裁切預覽，不自動產生收納建議。先顯示空間分區與物品框選／手動新增區，使用者按下方「產生建議」才送出最新物品、格局、偏好與 RAG 請求。Native 在按鈕後進入建議頁，PWA 在按鈕下方顯示建議。
- 編輯物品或偏好後，PWA 清除舊建議與來源，需再次按「產生建議」；建議失敗可重試，保留辨識及裁切結果供匯入。

- `/detect-items` 先對 EXIF 正規化照片分析可見區域多邊形（地板、牆面、出入口、工作面及收納區），生成分區示意圖，再執行模型與 Gemini 物品辨識。
- App 結果與建議頁、PWA 分析頁同步顯示格局、收納櫃、動線與不確定資訊；兩邊可填 500 字以內的收納需求與限制。
- 照片建議帶入分區與櫃子觀察、原始測驗人格與視覺／分類偏好、額外需求、最新物品清單，實際檢索 RAG 並顯示來源標題。
- 分區是單張照片的可見區域近似示意，不是像素級精準分割或測量過的 3D／平面圖；看不到的櫃內容量與尺寸不可假設。
- 空間或 RAG 暫時失敗會明確顯示訊息，保留物品框選與裁切，不宣稱已完成空間分析或已引用知識庫。
- 既有歷史只保存照片／物品／建議文字；本次分區圖保留在分析流程，不新增資料庫欄位。

## 物品清單新增、刪除與卡片管理

App / PWA 同步提供手動新增（名稱、分類、正整數數量、選填照片）、刪除確認、卡片縮圖、搜尋、分類與狀態篩選。保留辨識裁切匯入及依可用／損壞狀況的出售、捐贈、回收入口。

新增與刪除使用既有 `public.items` 及 RLS；手動照片放私人 `analysis-photos` 的本人 items 路徑。刪除移除物品列，不刪除分析主紀錄或已刊登商品。

保留中／待丟棄／待售是個人管理意向，與物品是否損壞、商品是否刊登獨立。狀態保存在本人的 `auth.users.user_metadata.item_dispositions`，兩個前端透過同一資料服務讀寫，不需追加 SQL。待售不會自動建立商品；未標記的物品預設保留中。這是小規模帳號清單的實作，同一帳號跨裝置同時變更多個狀態可能以最後寫入為準；大量清單宜另迁移為 items 欄位。

## 整理後照片模擬

Android 辨識確認頁與 PWA 分析頁在「產生建議」上方提供「產生模擬圖」，不必先產生文字建議才顯示入口。按下模擬圖時，若尚無建議會先在背景用人格、偏好、最新物品、空間格局與 RAG 取得整理方案，先在原照片拖曳選取整理範圍，再以原照片、範圍、已確認物品及方案呼叫受登入保護的 `/api/organization-preview`。此背景方案不會自動顯示為文字建議；「產生建議」仍獨立操作。由後端本機 SD 1.5 Inpainting 重繪，IP-Adapter 使用所選原場景作低權重參考，物品框僅供整理區域物品清單過濾；Gemini 只負責整理方案與英文提示轉換，不生成圖片。未明確點擊不會生成圖片。可重試、重新產生、切換整理前與模擬整理後。變更照片、物品、需求或建議清除舊模擬圖，生成中停用編輯避免錯配。Native 建議詳情不再重複提供入口。

生成工作以背景工作編號回傳，兩邊每 8 秒查詢狀態，最長等待 15 分鐘。單張 512px 局部重繪採 fp16、CPU offload，限制同時一張 GPU 工作；工作與結果僅留在電腦記憶體，30 分鐘過期。範圍外以原圖合成保留（EXIF 校正、最大 1600px），邊界只向選取範圍內柔化。畫面提供中文 AI 模擬說明；未加圖片浮水印以避免修改範圍外像素。不能保證範圍內每件物品的外觀、數量、尺寸或櫃體容量。模型安裝與實際限制見 `docs/sd-preview.md`。預覽僅保留在當次畫面，既有單件裁切匯入與建議歷史不受影響。選取範圍、照片、物品、需求或建議變更時清除舊圖；未選取範圍不會送出生成請求。

驗證：Native 預覽按鈕、原圖/模擬切換與建議更新清除測試；Chromium/WebKit 檢查明確點擊才請求、失敗重試、原建議保留及前後對照；後端檢查原照片和建議傳入、浮水印、API 驗證及錯誤不洩漏憑證。

實際整合驗證：既有房間測試照片呼叫圖像模型回傳 HTTP 429，現有 Gemini 圖像生成額度受限，尚未成功取得實際生成圖片；前後對照與重試流程已以 API 測試資料通過，需先處理 Gemini 帳號額度／計費再做真實生成驗證。兩平台型別檢查、Native 30 項測試、後端 28 項測試與 Chromium/WebKit 模擬圖流程均通過。

## 按鈕可讀性與首頁整理偏好

文字按鈕採用主題的 primary/onPrimary 或 cardBg/textMain 配色；修正相機確認與重新拍攝的底色/文字配對，以及深色模式模擬圖按鈕。一般文字按鈕以最小高度、內距與可換行文字取代固定高度，文字行高至少為字級的 1.5 倍。空間辨識與建議的底部操作列改為正常佈局，避免較大文字遮住內容，長匯入按鈕移到建議頁可捲動區獨立一列。相機快門、照片辨識框與縮放控制的幾何尺寸保留。

Android 與 PWA 首頁的整理偏好標籤均可按下查看人格名稱、兩項偏好、原始特質與原始描述，可關閉或重新測驗；未設定時提供開始測驗入口。原始四種人格資料集中在 `src/data/storagePersonas.ts`，測驗與首頁共用，PWA 匯出仍驗證原始 7 題、28 個選項與 4 種人格，情境圖片不變。Native 首頁優先讀取登入帳號的雲端偏好，僅網路失敗時使用本機快取。

本次驗證：兩平台型別檢查通過，Native 全部 37 項測試通過；PWA 原始七題、四人格說明、未設定入口與深色長文字共 12 項 Chromium/WebKit 測試通過，另檢查既有物品、每日任務、交易與分析流程。主題主要與次要按鈕文字的對比均達 4.5:1；可換行按鈕與相機／辨識框幾何保留有 regression 測試。Android APK 打包成功，PWA 已重新打包並驗證公開 HTTPS 連結的最新資源。

## 收納建議步驟卡片

Android 與 PWA 的當次分析及歷史詳情都透過共用 `advicePresentation` 分段顯示：空間與動線使用淡綠提示區，整理步驟使用獨立白底卡片、圓形編號、動作標題及說明，採購資訊保持獨立。所有文字換行顯示、無省略或固定高度，支援深色模式。舊版單句步驟及跨行說明會完整保留；不重新生成或覆寫雲端歷史建議。後端輸出規則增加短動作標題與冒號後簡短說明，仍維持三步、區域/物品/動作、個人偏好與 RAG 規則。

本次驗證：Native/PWA 型別檢查通過、Native 39 項測試通過、Chromium/WebKit 的當次建議與歷史紀錄共 6 項測試通過、後端空間/RAG 5 項測試通過。新版 PWA 重新打包並驗證 HTTPS 最新資源；新版 Android `Sorti-advice-step-cards-arm64.apk` 已安裝到 USB 測試手機。

## Google 登入返回與重試（2026-10-11）

Android/PWA 分開 Google 跳轉與密碼登入的忙碌狀態，Google 不再令一般登入顯示「處理中」。跳轉完成後、Android 回到前景及 PWA 從瀏覽器歷史恢復時，恢復 Google 重試入口；Google 成功回傳仍由既有 PKCE/session gate 自動登入首頁或首次測驗，不要求再次輸入 SORTI 帳密。Google Provider 已查核啟用；真實帳號授權尚未代使用者操作。手機原生帳號選擇器尚未接入，目前仍使用系統瀏覽器 OAuth。

驗證：兩邊型別檢查通過，Native 登入／session 7 項測試、Chromium/WebKit Google 未設定、取消返回重試與 PKCE 成功保留登入共 6 項測試通過。PWA 已重新打包並確認公開網址最新資源；新版 `Sorti-google-return-arm64.apk` 已安裝到 USB 手機。

## 人格偏好與 KonMari 知識依據

依使用者要求，Android/PWA 建議頁移除額外的「整理偏好」文字與「參考整理技巧」來源卡片，不再顯示知識庫標題。人格偏好與 RAG 仍直接用於生成建議：兩平台都傳入雲端測驗偏好、最新物品、可見格局與需求，後端仍檢索整理技巧並加入生成提示。首頁人格特質入口保留。PWA 回歸測試同時確認額外介面消失及實際請求仍含人格、偏好、需求與空間資料；後端測試確認四種人格及真正檢索內容進入提示。

後端 `konmari_knowledge.json` 分別儲存 7 項官方技巧摘要及 1 項 SORTI 實務調整，每項都有標題、關鍵字、來源類型與查核日期。這是參考《怦然心動的人生整理魔法》作者近藤麻理惠官方公開 KonMari 方法的摘要，未匯入書籍全文，也不提供虛構引文／頁碼。舊 `kondo_rules.txt` 保留但不再作為預設檢索來源，避免把 30 天觀察箱等自訂規則誤標為作者方法。

照片建議必帶「按類別與順序整理」及「先決定保留再收納」的真實知識片段，再檢索適合物品／偏好的其他技巧。四人格決定展示／隱藏、大分類／細分類的做法，不等於強迫添購容器或丟棄收藏。單次照片整理是按類別整理的局部起點；心動與去留需使用者自行判斷，保留安全及必要文件限制，損壞物不導向捐贈。檢索採用既有本機關鍵字排序，不宣稱已使用語意向量嵌入。

驗證：兩平台型別檢查、Native 41 項測試、後端 34 項測試及 Chromium/WebKit 分析與歷史流程通過；實際 Gemini 生成取得完整三步、人格對應的展示／大類收納與 3 項官方來源。增加生成預算並在供應商回報 MAX_TOKENS 時切換模型，避免把截斷回覆顯示為成功建議。PWA 已重新打包並確認公開連結載入最新版；Android `Sorti-persona-konmari-arm64.apk` 已成功安裝到 USB 測試手機。


## 使用者 ZIP 功能比對與補齊（2026-10-11）

已逐一檢查 `Sorti-main.zip` 的 21 個原生畫面，功能映射與原版示意／未完成項目見 [archive-feature-audit.md](archive-feature-audit.md)。AST 比對確認原測驗 7 題、28 個選項與 4 種人格完全一致；8 個原始圖片及 `src/assets/models/best.pt` 的 SHA-256 與 ZIP 全部一致，未覆蓋新功能、設定或憑證。

Android/PWA 物品管理均新增拍照辨識匯入捷徑、待整理／已定位篩選、可設定或清空的存放位置，以及實際雲端建立日期／AI 匯入或手動新增來源。整理進度由有無位置決定，與保留／待售／待丟棄意向獨立，搜尋可包含位置。新增物品會重設篩選，避免剛新增的物品被已定位篩選隱藏。位置在本人帳號 metadata 保存，寫入前確認物品所有權，透過共用資料服務匯出，不須新增 SQL；多裝置同時寫入可能最後寫入覆蓋的限制與既有意向 metadata 相同。

拍攝提示抽為共用原始文字；PWA 補上首次提示及「以後不再提醒」，選好照片後收起提示，保留預覽／重拍／確認分析。PWA 補齊斷捨離引導和零辨識物品時的儲存建議，可在整理紀錄讀回，沒有新增假物品；Android 零物品儲存顯示正確訊息與整理紀錄入口。個人偏好與 RAG 繼續用於生成，沒有恢復已移除的額外偏好／來源卡片。

完整測試發現 Safari 手勢放開時 React 狀態更新可能尚未完成，PWA 辨識框改用實際 pointerup 座標保存繪製、移動與縮放的最終結果，避免漏新增或漏尺寸變動，並新增框數量確認。兩平台原始手動物品功能皆保留。

驗證：兩平台型別檢查通過，Native 48 項測試通過，PWA Chromium/WebKit 全套 59 項通過；WebKit service worker 離線測試依既有設定跳過 1 項，未宣稱 iPhone 離線能力已實測。物品定位保存／清空／所有權拒絕、雲端讀回、篩選、提示持久化、零物品建議保存、原測驗、框移動縮放、單件裁切、打卡、帳號與交易流程均有相關檢查。PWA 已重新打包並驗證公開 HTTPS 載入最新 bundle；Android 新版 `Sorti-archive-features-arm64.apk` 已成功安裝至 USB 測試手機。


### SD 局部重繪驗證（2026-10-11）
Native 與 PWA 都有原圖範圍塗選、多區域、復原／清除、生成／重試、整理前後比較。共用正規化座標與背景查詢協定，保留原物品辨識框與單件裁切匯入。已完成本機 RTX 3050 Ti 4GB 真實模型載入與生成測試；首次測試約 23 秒（非速度保證）。後端測試逐像素驗證選取範圍外不變，並檢查無效範圍、圖片參考、單工限制與工作過期。PWA 測試涵蓋未框選阻擋、拖曳塗選、背景查詢與清除範圍失效舊圖。

本次完成 Android 新版 APK 並以 USB 安裝；PWA 最新 bundle `index-C98cdqjD.js` 已在原 HTTPS 連結提供。Native 53 項測試（全套 52 項及新增範圍手勢 1 項）、後端 35 項、PWA 59 項通過；既有 WebKit 離線 service worker 測試 1 項仍跳過。兩邊 TypeScript 檢查通過。真實背景 API 測試約 36 秒，選取範圍外像素差異為零，輸出驗證留於 `pwa-runtime/sd15-real-verification.json`。


### 模擬圖改善不足修正（2026-10-11）
Android 與 PWA 的同一生成服務提高重繪幅度、降低原雜亂畫面參考權重，移除物品拼貼參考；提示優先要求留白、集中擺放、可用動線。生成後以原圖與候選圖檢查有無改善、保留物品與家具、是否新增雜亂。未改善的圖不顯示，從原照自動重試一次，兩次失敗提供原因；生成／檢查期間兩邊一致停用編輯。檢查是 AI 視覺判斷，仍有誤判，未宣稱絕對還原物品或保證生成一定成功。
後端回歸新增未改善拒絕、重試始終使用原照、第二張通過才回傳、無效視覺判斷拒絕與場景參考非拼貼的案例。Native/PWA TypeScript、相關 Native 功能測試、Chromium/iPhone WebKit 模擬流程及後端 39 項測試通過。兩邊重新打包；Android APK 為 `release-builds/Sorti-sd-improvement-arm64.apk`。

此修正版公開 PWA bundle 為 `index-8tw46yyW.js`，健康檢查正常。USB 手機目前未連線，安裝命令未成功，未宣稱手機已更新；APK 已產生，可重新連線安裝。

追加修正：重新生成前兩邊都清除舊模擬圖，避免新候選被拒絕時仍看到舊的不理想圖片。Native 測試涵蓋這個回歸；PWA 同步驗證失敗後沒有舊圖。較完整的桌面範圍實測一張通過檢查，耗時約 54 秒；僅代表該樣本，SD 1.5 整理效果仍不保證。最終 PWA bundle 更新為 `index-DjVCG1OH.js`。


### 原圖物品重排取代 SD（2026-10-11）
Native/PWA 同步改為先分析物品輪廓、顯示原圖 RGBA 層、確認／取消可移動物品，再依真實人格與 RAG 建議配置。表面內部框選、前後比較、每件位置與警告均有對應操作。CPU OpenCV/Pillow 僅平移原圖像素，局部小洞 Telea 修補；大洞／遮擋／透明／輪廓失敗／放不下留原位，不啟用 SD、GPU、SAM 或 LaMa 權重下載。原始測驗、物品框編集與單件裁切仍保留。
完整架構、檔案、API、保護規則、測試與未可靠實作的限制見 [original-pixel-preview.md](original-pixel-preview.md)。後端 47／Native 55／PWA 59 項通過；既有 WebKit 離線 1 項跳過。兩邊型別檢查與打包完成；新版 APK `Sorti-original-pixels-arm64.apk` 已成功安裝手機，PWA bundle `index-C_Nczgp0.js`。

實際 HTTP／Gemini 的合成紅杯重排結果為 changed，原物品及 editable_mask 外像素驗證通過；實拍雜亂桌面樣本則安全 no_change，不宣稱可靠重排。重跑入口 `scripts/verify-original-pixel-preview.py`，詳見交付文件。


### 移除整理模擬圖（2026-10-11）
依使用者要求，同時移除 Android／PWA 的模擬圖卡片、輪廓確認／範圍塗選／前後比較入口，以及對應前端呼叫、後端背景生成與查詢路由和 gateway 映射。保留照片辨識框、手動新增／編輯／移動縮放、單件裁切匯入、空間分布與依人格／RAG 產生整理建議。上方模擬圖開發記錄屬於歷史，不代表目前仍提供功能。

移除後驗證：Native 46 項、後端 30 項測試通過，Native／PWA 型別檢查通過；Chromium 與 iPhone WebKit 的空間分布／人格 RAG 建議流程 2 項通過且確認沒有模擬圖入口。公開 PWA bundle `index-DjSz9BI3.js` 已驗證，後端與 gateway 原模擬圖路由均回應 404。
Android `release-builds/Sorti-no-preview-arm64.apk` 打包成功並已 USB 安裝，adb 回報 Success。


### 整理建議 AI API 錯誤提示修正（2026-10-11）
實際檢查本機後端／公開 HTTPS 健康正常；一般聊天與 photo_analysis 整理建議均實際呼叫 Gemini 得到 HTTP 200，後者約 11 秒、378 字。使用者先前完整狀態碼尚未取得，不能斷言原始失敗根因或保證永不再發生。
Native／PWA 共用 `src/services/aiResponse.ts`，處理 gateway／Cloudflare HTML 錯誤頁，不再僅顯示英文 API request 或 JSON Unexpected token。中文提示涵蓋連線中斷、逾時、登入過期、429 次數限制及 422 格式錯誤，包含 HTTP 數字；保留後端原有明確 JSON detail。失敗不清除物品／空間／偏好，仍可按原有按鈕重試，未自動重送可能重複計費的 AI 請求。
Native API 5 項測試與兩平台型別檢查通過；PWA bundle `index-nuygjlG3.js` 已打包並公開驗證。Android 新 APK `release-builds/Sorti-ai-api-fix-arm64.apk` 打包成功；目前 USB 裝置列表空白，因此這次修正未安裝手機。
Chromium／iPhone WebKit 2 項建議流程回歸通過，包括 HTML 502 中文提示及 HTTP 碼、空間與偏好保留、按鈕重試取得建議。首次新增測試因誤用「產生建議」取代當時的「重新產生建議」失敗，修正選擇器後通過，沒有用未通過結果冒充成功。


### 二手市集整合改版（2026-10-11）
Android／PWA 移除買家／賣家身分切換；市集預設雙欄圖片商品，保留四個主導覽。搜尋、分類、價格區間及排序在 Supabase 執行後分頁，每次 20 件；我的刊登狀態以 exact HEAD 查詢實際總數，不用當頁數量冒充總數。我的交易統一購買／刊登／銷售訂單。訊息中心一次查詢買賣雙方對話及最後一則訊息，對象使用真實帳號識別碼；聊天室沿用既有 10 秒輪詢，沒有未讀數假資料。

兩平台均提供選擇個人物品／拍照相簿 → 可編輯資訊 → 預覽確認 → 成功查看／返回／管理刊登。只複製物品欄位，不假設 items→listings 外鍵。共用價格驗證、貨幣格式、搜尋分頁 hook；既有購物車唯一性、貨到付款、按賣家運費與原子結帳 RPC 保留。捐贈與回收保留在物品管理、首頁及我的交易次要入口，損壞物不推薦捐贈。

雲端只讀檢查發現交易工作流程尚未部署；經使用者明確同意，已將原有 `supabase/marketplace-workflow.sql` 套用至目前專案，遷移名稱 `install_existing_marketplace_workflow`。保留全部資料，安裝既有狀態轉換及參與者存取保護；未新建表或更改價格規則。確認函式存在、authenticated 可執行、anon 不可執行、相關表 RLS 開啟；未登入實際呼叫遭拒。實機已載入真實商品與整合聊天的最後訊息。

詳細修改清單、驗證、限制及實機檢查見 [市集改版交付](marketplace-redesign.md)。歷史段落中的買賣身分切換描述不代表目前 UI。

最終驗證：Jest 54 項、PWA 65 項通過／1 項略過，兩平台型別通過，lint 0 errors／53 warnings。APK `release-builds/Sorti-marketplace-arm64.apk` 已成功 USB 安裝。

### 二手市集面交／寄送雙模式（2026-10-11）

Android／PWA 已同步實作交易方式刊登、指定商品直接購買、依賣家＋方式分組的購買請求、共用訂單詳情、賣家接拒單、版本化面交安排、雙方交付確認、手動寄件與買家收貨、雙方同意取消、交易問題及訂單聊天互通。保留原物品帶入與既有功能；不宣稱真實物流／付款驗證或平台仲裁。

**雲端 `supabase/marketplace-dual-mode.sql` 尚未套用**：目前 Supabase 連接工具不可用，新交易需完成部署後才能正式操作。本機 SQL 35 項／Jest 60 項通過、兩端型別與 lint 無錯；市集 Chromium／iPhone WebKit 14 項通過。新版 APK `Sorti-dual-mode-marketplace-arm64.apk` 已成功 USB 安裝，PWA 已重新打包。既有單以 v1 保留語意，新增單才使用 v2 接單流程；本輪沒有新增正式假交易。

具體欄位、流程、驗證範圍與待部署步驟見 [雙模式實作交付](marketplace-dual-mode-implementation.md)。

2026-10-11 雲端部署補充：使用者已執行雙模式 SQL；兩個交易 RPC 已確認存在並拒絕匿名呼叫。PWA 臨時連結正常載入新版。雙帳號面交／寄送交易尚待實際驗證。

### PWA 交易確認修正（2026-10-11）

PWA 的 v2 交易操作改用頁面內確認區，不依賴 window.confirm；接受訂單、確認交付等操作仍須使用者再次確認。Android 保留原生確認對話框，兩端交易權限與 RPC 相同。PWA 失敗後顯示伺服器錯誤並重新載入訂單，可再次操作。Native／PWA 型別檢查通過，Chromium／iPhone WebKit 四項測試通過，重新打包 index-BMq5fkBG.js；本次無 Native 程式變更。尚未取得使用者實際錯誤文字，不能斷定原問題由確認視窗造成。

### 市集體驗第一批（2026-10-11）

依使用者確認採深綠＋薄荷綠，首頁、商品詳情、刊登同步 Android／PWA，其他模組的主題設定保留。首頁維持真實雙欄商品與原分類、排序及分頁，刊登入口固定於導航上方；Native 補下拉刷新與已載入件數。商品缺少面交／寄送方式時禁用購買和購物車，保留詢問賣家；自己的缺漏商品提供補充方式入口。隱藏帳號 UUID 片段，以一般賣家說明呈現；公開暱稱／頭像待 SQL 與隱私方案確認，未宣稱已完成。Native 商品刷新錯誤顯示重試，讀取未完成時不允許購買。

刊登改為照片、商品資訊、交易與刊登三步，最後一步內切换預覽，返回修改保留條款；既有物品可帶入資料、兩平台保留照片替換。Native／PWA 型別檢查通過，修改檔案 lint 無 errors，Jest 15 suites／60 tests、PWA Chromium／iPhone WebKit 16 tests 通過。PWA bundle index-Bi0pWa6S.js，HTTPS 回應 200。APK release-builds/Sorti-market-refresh-arm64.apk 已 USB 更新 Success；SHA256 B58A2550043794628A5787EFA0B4F6A7AB0D48706DE957DAA5DC1E797E96556F。

PWA 模擬資料截圖 pwa-runtime/market-legacy-webkit-iphone.png、market-listing-webkit-iphone.png。本輪未修改資料庫與付款／運費規則；未完成雲端雙帳號交易驗收，也未以自動化測試取代 PWA 接單問題的實際錯誤診斷。第二批聊天、預約與訂單版面待後續實作。

### 商品聊聊獨立頁（2026-10-11）

PWA 商品詳情「詢問賣家」建立／取得真實對話後，切換 market-thread 獨立聊天頁，不在商品下方嵌入聊天。對話識別碼保存在 sessionStorage，刷新仍可載入；提供返回商品。Android 原有 ProductDetail → Chat 導覽已符合需求，無 Native 變更。PWA 型別檢查與 Chromium／iPhone WebKit 導覽、刷新、返回測試共兩項通過；PWA 已重新打包 index-B4d_9zA7.js。

### 市集配色跟隨首頁（2026-10-11）

依使用者最新指示，移除 Native 市集／商品詳情／刊登的固定 appearance.dark，以及 PWA 的市集路由強制深色。兩端均使用首頁的全域主題與既有設定，預設淺色，開啟深色模式時同步；保留新版交易與獨立聊聊流程。

配色修正驗證：兩端型別檢查通過，Chromium／iPhone WebKit 兩項配色及獨立聊天流程測試通過；PWA index-DY0OnjlJ.js，HTTPS 已確認 200 與新版 bundle。

Android 配色修正 APK 已打包成功：release-builds/Sorti-market-home-colors-arm64.apk，USB 安裝回應 Success。

### 通訊式聊聊版面（2026-10-11）

Android／PWA 使用首頁主題，對方訊息靠左、自己靠右，圓角泡泡、真實日期時間與底部輸入列。PWA 添加日期分隔、角色圖示、可捲動聊天紀錄與近底部時跟隨新訊息；未建立已讀與在線資料，不顯示虛構狀態。Android 保留獨立聊天路由及鍵盤處理，將無事件的出價改成查看商品。兩端型別檢查通過，聊天相關 PWA 四項回歸通過，最終泡泡及導覽兩項測試通過；截图 pwa-runtime/messenger-webkit-iphone.png。PWA index-BKQbo_kk.js；APK release-builds/Sorti-messenger-arm64.apk 打包並 USB 安裝 Success。未操作正式帳號傳送測試訊息，Android 鍵盤及真機完整對話仍需實際驗證。

### 交付入口與交易成立後對話（2026-10-11）

Android／PWA 在面交確認狀態卡片旁顯示目前角色的「我已交付商品」或「我已收到商品」。未確認面交安排、未解決問題或待回覆取消時，按鈕停用並顯示下一步；已確認的一方不再顯示重複操作。保留資料庫原有雙方確認及交易條件。PWA 聯絡交易對象改開獨立聊天頁並可返回訂單；兩端從訂單聊天傳入 accepted_at，共用 loadMarketplaceMessages 在查詢使用 created_at >= accepted_at，不刪除原訊息，一般商品聊聊仍保留原對話。兩端型別檢查通過，六項交易／聊天 UI 回歸與兩項時間篩選／刷新測試通過；未新增 SQL 或改變交易規則。

交付與交易聊天 APK：release-builds/Sorti-handover-chat-arm64.apk，Gradle 成功，USB 安裝 Success；PWA 已重新打包供現有 gateway 使用。

### 面交／賣家寄送新流程（2026-10-11）

使用者已同意移除正式面交提案與確認流程，接單後透過交易聊聊協商；賣家先確認交付，買家才可確認收貨。Native／PWA 移除預約表單及卡片，交付卡仍依角色顯示主要操作，首屏進度、狀態與我的交易分類改成待面交／待出貨／待收貨。寄送維持實際寄件後填寫資訊，再由買家收貨完成。共享查詢依真實方式及交付旗標篩選，保留 v1 訂單。交易取消、問題、版本及保留規則不改。

兩端型別檢查通過、修改檔案 lint 無 errors、Jest 61 tests／15 suites 通過，隔離 PostgreSQL 相容測試 41 checks，最終 Chromium／iPhone WebKit 12 項交易回歸通過（先前寄送測試使用錯誤欄位名稱，修正測試後通過）。APK release-builds/Sorti-fulfillment-flow-arm64.apk 打包成功並 USB 安裝 Success；PWA 已重新打包。

雲端仍須執行 supabase/marketplace-handover-flow.sql：本工作階段無 Supabase 連接工具，不能直接套用。尚未宣稱雲端新規則或真實雙帳號交易已通過；未套用前舊 RPC 仍要求面交安排，可能拒絕新版交付操作。

2026-10-11 更新：使用者回報已執行 marketplace-handover-flow.sql。交易 RPC 匿名操作被正確拒絕；PWA HTTPS 200，bundle index-CLPR0Hec.js。無管理連接工具可查函式定義，仍需雙帳號實際交付確認，不能把此 API 探測視為完整交易驗收。

### 交付確認視窗可見性（2026-10-11）
PWA 將頁面頂端的確認區塊改為掛載 body 的固定置中視窗，aria-modal 並聚焦確認按鈕，避免長頁面操作看不到下一步。兩端依角色顯示確認交付／確認收到商品。交易規則與 SQL 保持不變。Native／PWA 型別檢查及 Chromium、iPhone WebKit 六項交易測試通過，新增長頁面確認視窗位於可視區與焦點檢查；這些為模擬 API 測試，尚未驗證使用者雲端訂單。PWA bundle index-Dyc_Vk9r.js。

APK release-builds/Sorti-handover-confirm-arm64.apk 打包成功並 USB 安裝 Success；公開 HTTPS 已確認供應 index-Dyc_Vk9r.js。

### 移除空白交易操作卡（2026-10-11）
PWA 只有存在可顯示操作時才渲染 market-actions 卡片，涵蓋 v2 與舊訂單；完成交易不再留下空白框。Android 既有按鈕逐項渲染沒有外層空卡，本次無 Native 程式修改。兩端型別檢查通過，面交／寄送在 Chromium 與 iPhone WebKit 四項回歸通過，包含完成後操作卡不存在的驗證。PWA 已重新打包 index-32TLO45C.js。

### 寄送管道設計（2026-10-11）
新增 docs/marketplace-delivery-design.md 規劃四家超商、宅配及面交的刊登、選擇、收件與出貨操作。Android／PWA 使用相同管道與驗證，沿用首頁主題。目前仅設計文件，尚未修改程式、資料庫或發布；實作涉及結構化管道、訂單快照與 RPC 驗證，需依既有要求確認具體 SQL 後套用。

### 六種交易管道下拉選單實作（2026-10-11）

使用者已核准 marketplace-delivery-channels.sql。Native／PWA 刊登改為下拉選取面交、7-ELEVEN、全家、萊爾富、OK 超商及宅配，新增／移除不重複方式並分別填整數運費。商品與預覽逐管道顯示費用。下單選單只提供賣家選項，超商填門市名稱、店號及地址，宅配填地址；同品牌共用門市，每賣家＋管道分單，費用取同組最高。缺漏欄位先驗證再鎖定提交；初始管道與 meetup/shipping 大類同步。

supabaseData.ts 集中映射 delivery_options、RPC channels／stores 與訂單 shipping_channel／pickup_store，PWA 已透過 prepare 匯出。舊訂單及未編輯舊商品保留一般寄送；舊商品編輯須明確重選管道，避免自動冒充支援超商。未串接門市搜尋、物流追蹤或建立託運單。SQL 新增欄位及替換 create_market_requests，不替換交付函式；保留安全锁、角色與版本驗證、冪等及訂單快照。

兩端型別檢查通過，修改 TS/TSX lint 無 errors，匯出脚本 node --check 通過；既有 Jest 61 tests 通過，隔離 PostgreSQL 69 checks 通過；最終 PWA 面交／寄送、物品轉刊登、選單、門市及直接購買 14 項回歸通過。舊商品編輯回歸已配合要求重新選管道再重跑。iPhone 刊登截圖已檢視，選單及文字正常。

PWA 已重新打包 index-jq4bEqyq.js，既有 HTTPS 回應 200 並供應新版。Android release-builds/Sorti-delivery-channels-arm64.apk 打包成功並 USB 安裝 Success。雲端仍須由使用者在 SQL Editor 執行 supabase/marketplace-delivery-channels.sql，目前無管理連接工具，不宣稱已套用或已通過正式雙帳號交易。

2026-10-11 更新：使用者回覆「好」。唯讀 REST 選取 delivery_options 與 shipping_channel/pickup_store 已通過欄位解析，匿名角色被 42501 拒絕，沒有讀取交易資料；不存在欄位的對照查詢回報 42703。可確認 schema 已識別新增欄位，不能據此宣稱已驗證正式帳號的刊登與 RPC 下單流程。

### 日期欄位及返回導覽（2026-10-11）
PWA 日期輸入取消 Safari 固有外觀並限制 min-width、max-width 及 box-sizing，避免出貨日期超出卡片。頂部返回箭頭改用瀏覽器上一頁，不再硬導向首頁；首頁底部入口仍提供直接回首頁。Android 使用原生導覽返回及 TextInput 日期欄位，本次無 Native 修改。兩端型別檢查通過；Chromium 與 iPhone WebKit 返回及日期邊界四項測試通過。PWA 已重新打包 index-DG9CD7AT.js。

### iOS 出貨日期欄位再次修正（2026-10-11）
使用者真機回報日期仍超寬；PWA 出貨表單改用獨立 flex 欄位容器，日期輸入 width:0 配 min/max-width:100%，抑制 iOS 固有寬度，保留原生日期選取。Native 使用 TextInput 無此網頁原生控件，本次無 Native 修改。兩端型別檢查通過，Chromium／iPhone WebKit 寄送流程兩項通過，驗證日期與文字欄位寬度及左緣差異不超過 1px。PWA 已打包 index-COdpVWcA.js，真機仍需使用者重新整理確認。

### 出貨無反應與全面回歸（2026-10-11）
截圖選 2026-10-12，客戶日期為 2026-10-11。已透過 Supabase MCP 唯讀檢查目前環境對應 riqpljtpfcwuejvoyfoh 的 market_order_action 函式，確認包含出貨邏輯且拒絕未來時間；未修改雲端資料或交易規則。共用 shipmentDate 檢查 YYYY-MM-DD、無效日期、未來日期，以台北午夜輸出 ISO。PWA 限制可選日期到今天，原生 HTML 驗證失敗與 API 錯誤在出貨按鈕旁呈現，送出按鈕顯示處理中文字且停用；Native 同步驗證及就近錯誤、處理中文字。保留輸入供重試，不假設請求成功就顯示出貨。

全面 PWA Chromium/iPhone WebKit：87 passed、1 skipped（WebKit service worker 離線測試能力限制）；涵蓋登入、測驗、拍照框選裁切、物品管理、捐贈、每日任務、偏好／RAG、市集、聊天、刊登、下單、交付、寄送及返回。修正舊購物車測試漏新增 channel 參數後重跑全套通過。新增未來日期按送出時有就近提示且不呼叫 RPC，正確日期改為已出貨待收貨。Jest 16 suites/62 tests、隔離 PostgreSQL 69 checks、兩端型別檢查通過，修改檔案 lint 無 errors。Android APK release-builds/Sorti-shipment-feedback-arm64.apk 打包並 USB 安裝 Success；PWA index-db8SkQtH.js，HTTPS 200 且供應新版。

範圍限制：自動測試使用模擬外部 API 與隔離資料庫，不能保證所有裝置、所有內容、真實物流或雲端雙帳號操作均已驗收。未用正式訂單作寫入測試；需使用者改成已實際寄出的日期後實機確認。


### 訂單卡片品名與圖片（2026-10-11）
Native／PWA 買家與賣家訂單卡片改為商品縮圖＋品名＋價格，訂單編號移入可展開訂單資訊並顯示完整編號，長編號可換行。圖片使用 order_items.image_path_snapshot 公開商品圖路徑與既有 MarketImage 錯誤占位，不額外讀取商品或修改資料庫。Native v2 也提供展開資訊入口。兩端型別檢查通過，PWA 已重新打包 index-lRjlptwq.js。

訂單卡片：Chromium／iPhone WebKit 四項市集與購物車訂單回歸通過；APK release-builds/Sorti-order-product-cards-arm64.apk 打包成功、USB 安裝 Success。


### 賣家賣場與多件結帳（2026-10-11）
Android 與 PWA 商品詳情提供「逛逛賣家賣場」，只載入該賣家上架中的商品，支援分頁、逐件加入購物車及前往購物車。結帳依選取商品提供共同交易方式；同賣家同管道合併訂單，運費取最高一件；無共同方式時分單。沿用現有 create_market_requests，不新增資料表或變更交易規則。

驗證：Native 與 PWA 型別檢查通過；Jest 63 項通過；Chromium／iPhone WebKit 賣場多件加入與合購 4 項通過，既有市集／直接購買／管道選單 6 項回歸通過。PWA 已重新打包；Android APK：release-builds/Sorti-seller-store-arm64.apk，已安裝至 USB 手機。瀏覽器交易測試使用模擬 API，未建立正式測試訂單。


### 物品清單直接出售
Android／PWA 從物品清單按出售，帶入品名、分類及單件照片至刊登資訊頁。可使用原照片，或重新拍照、從相簿選取；無照片仍須補照片才能刊登。沿用既有照片上傳流程，不更動資料庫。

驗證：兩端型別檢查通過，物品管理／App 測試 4 項通過，Chromium 與 iPhone WebKit 照片帶入／刊登流程 4 項通過。PWA 已重建，APK：release-builds/Sorti-inventory-sell-photo-arm64.apk。


### 交易步驟進度條
Android／PWA 訂單詳情改用直式連線進度條，顯示已完成勾選、目前階段與尚未到達階段。依面交／寄送呈現對應文字，避免手機長文字換行擠在一起。共用 transactionProgress 判斷階段，沒有變更交易規則或資料庫。

驗證：Native／PWA 型別檢查通過；交易邏輯 9 項測試通過；Chromium／iPhone WebKit 訂單進度與寬度 2 項通過，已檢視 iPhone 畫面。PWA 已重建，Android：release-builds/Sorti-order-progress-arm64.apk。


### 買賣通知（2026-10-11）
Android 與 PWA 提供通知中心、使用中浮層提醒、已讀與點擊前往訂單／聊聊，設定頁有相同入口。聊天／訂單互動分類偏好雲端同步，最近 100 則通知每 15 秒更新；新事件由資料庫觸發器建立，只通知交易對方。推播裝置登記與移除、Android FCM、PWA Service Worker 接收及點擊處理已備妥。登出先移除裝置以避免換帳號洩漏。
通知 SQL 已經使用者同意套用；market-push Edge Function 已部署，使用排程秘密驗證，未配置時拒絕請求。Firebase 專案／Android google-services.json／PWA 公開設定／服務帳戶秘密／排程仍待使用者設定，**尚未完成關閉後實際送達驗收**。詳見 docs/notifications-setup.md，不把單純開關描述為已可接收推播。

驗證：Native／PWA 型別檢查通過；Jest 65 項通過；Chromium／iPhone WebKit 通知、聊天、訂單與導覽 12 項通過；本機 PostgreSQL 通知路由、RLS、裝置權限及發送鎖檢查通過；Deno 後端型別檢查通過；線上未授權推播請求回傳 401。PWA 已重建。Android 新版打包完成，USB 裝置未連線，未安裝本次版本。

### Firebase Android 設定（2026-10-12）
已確認 google-services.json 為 sorti-56a5d／com.sorti，且排除 Git。Android 與 PWA 型別檢查通過。Android 使用既有 Firebase SDK 串接；PWA 仍需 Web App 設定及 VAPID，後端仍需服務帳戶與排程設定。手機未連線，尚未完成實機背景推播驗收。

Android Firebase 設定已成功通過 processReleaseGoogleServices，release APK 建置成功：release-builds/Sorti-firebase-notifications-arm64.apk。尚未安裝至手機或完成背景推播實測。

PWA Firebase 網頁設定與 VAPID 公開金鑰已於 2026-10-12 加入本機環境，使用 sorti-56a5d；服務帳戶及後端排程尚未設定，背景發送尚未驗收。

### 推播後端啟用（2026-10-12）
Firebase 服務帳戶已驗證並存入 Supabase Edge Secrets，排程密碼同步存入 Vault；未寫入前端或 Git。market-push 授權呼叫回傳 HTTP 200，claimed=5、sent=0、retrying=0。pg_cron／pg_net 已啟用，每分鐘處理待送通知；Vault 一般使用者無讀取權限。登記裝置為 0，尚未完成 Android／PWA 實際接收與點擊通知驗收，手機未連線。遷移：supabase/migrations/20261012110850_marketplace_push_schedule.sql。

### Google 登入回跳檢查（2026-10-12）
PWA 使用 location.origin + /?auth_callback=google；Android 使用 sorti://auth/callback。雲端 Site URL 仍是 http://localhost:3000，回跳清單只有舊隧道及 Android。已準備將 Site URL 更新為 https://findlaw-computed-accessing-gnome.trycloudflare.com，Redirect URLs 只保留 Android 與該站精確回跳路徑。自動審核拒絕先前含萬用字元的修改，等待使用者明確授權後再套用；尚未修復雲端。

2026-10-12 使用者明確同意後，已成功將 Auth Site URL 改為目前 HTTPS 測試網址，Redirect URLs 僅允許該站 /?auth_callback=google 與 sorti://auth/callback，移除舊隧道。其他雲端設定未變更；仍需手機重新發起 Google 登入驗收。

### 大 Logo 歡迎頁
Android 與 PWA 未登入時先顯示大 Logo、登入與註冊入口；選擇後才開啟表單。有效登入仍直接前往首頁／初次測驗。

歡迎頁驗證完成：Native／PWA 型別檢查、App 渲染、Chromium／iPhone WebKit 歡迎頁入口與排版 2 項通過；PWA 已打包且公開網址 HTTP 200。Android APK：release-builds/Sorti-welcome-arm64.apk，建置成功。

登入介面：Android／PWA 使用左上角 44px 返回箭頭，PWA 移除整列返回按鈕；登入底部提示「還沒註冊帳號嗎？請先完成帳號註冊」，註冊文字可點擊。

登入排版驗證：Native／PWA 型別檢查通過，Chromium／iPhone WebKit 返回與註冊操作、手機寬度檢查 2 項通過；PWA 已重新打包；Android 建置成功：release-builds/Sorti-login-layout-arm64.apk。

登入／註冊參考版型：兩端移除表單外框、圖示輸入框與密碼顯示、Google 分隔入口；註冊加入實際至少 8 字元提示及信箱驗證說明。未加入角色選擇或未實作條款。

參考版型驗證完成：Native／PWA 型別檢查、App 渲染、兩種手機瀏覽器登入註冊入口及密碼顯示切換通過；iPhone 截圖檢查並修正輸入框雙邊框。PWA 已重新打包；Android：release-builds/Sorti-auth-refresh-arm64.apk。

歡迎頁放大 SORTI／收納管理文字；兩端登入註冊縮小欄位間距，PWA 清除全站 label margin 與表單 gap 疊加的留白。

間距調整已通過兩端型別檢查與 Chromium／iPhone WebKit 操作測試；已檢查 iPhone 截圖。PWA 已重新打包，Android 建置成功：release-builds/Sorti-auth-spacing-arm64.apk。

歡迎頁字級微調：兩端 SORTI 34px，主標語放大至手機 26px 起，說明 18px，維持自動換行。

歡迎頁字級調整已通過兩端型別檢查與兩種手機瀏覽器測試；PWA 已打包，Android APK：release-builds/Sorti-welcome-type-arm64.apk。

註冊圖示微調：兩端移除姓名、使用者名稱欄位左側圖示，保留輸入；確認密碼圖示改為勾勾。

PWA 登入／註冊聚焦修正：僅外層 auth-input 顯示焦點框，移除內層 input 重複 outline；Native 已檢查，使用單一容器邊框，不受 CSS 影響。

Android／PWA 登入及註冊按鈕加入同一 Google 官方彩色 G 本機圖示，不依賴執行時外部圖片。來源：https://developers.google.com/identity/images/g-logo.png。

依使用者要求暫停註冊信箱驗證：Supabase enable_confirmations=false；Android／PWA 註冊提示改為完成即可登入，保留有效 session 自動進入初次測驗流程。SMTP 暫不設定。

歡迎頁兩端品牌字放大為 SORTI 42px、收納管理 20px，標語與說明移除句號。

首頁收納助理改為右下角浮動按鈕，兩端都開啟既有 AI 對話；位於底部導覽上方，與原本通知鈴鐺上下錯開，移除原首頁整列助理卡。

通知入口改為設定頁：Android／PWA 移除浮動通知鈴鐺，保留設定中的通知中心與偏好、使用中新通知提示及系統推播。

物品分類與整理進度標籤：兩端選取色統一為主題柔綠背景、主色文字與邊框，移除黃色選取色，支援深色主題。

首頁浮動收納機器人：兩端改米白／鼠尾草綠、小屋笑臉機器人圖示及文字，支援深色主題；沿用原對話入口。

浮動助理視覺修訂：依使用者回饋移除小屋笑臉，Android／PWA 改用既有拾序熊 Logo、米白圓形按鈕與收納助理標示。

浮動熊助理背景兩端改用首頁 primarySoft／soft 主題色及主題邊框，移除米白色底，保留輕陰影。

浮動助理兩端改為透明背景熊 Logo，頭頂「收納助理」對話框，整組按鈕保留原開啟 AI 對話功能。

首頁助理改為右側 48x52 小熊標籤，移除常駐對話框；向下捲動收起、向上或回頁首顯示，兩端選單原收納助理入口保留。

依使用者要求恢復上一版助理：兩端透明背景熊熊、頭頂收納助理對話框、固定右下角導覽列上方，移除側邊標籤及捲動收起。

兩端熊熊對話框及尾角外框加深為主題綠色。

首頁熊助理兩端支援拖曳，放開吸附左右邊界，限制於可視區及底部導覽上方；拖曳不觸發聊天、輕點及 PWA 鍵盤啟動仍可開啟對話，旋轉／視窗縮放重新限制位置。

拖曳驗證：Native／PWA 型別檢查通過，Chromium／iPhone WebKit 左右拖曳吸附、不誤開及點擊進入聊天 2 項通過；PWA 已打包，Android：release-builds/Sorti-assistant-drag-arm64.apk 建置成功，原生拖曳仍需實機操作驗收。

兩端移除首頁右上角重複設定按鈕，保留底部導覽設定入口與標頭 Logo 置中。

首頁右上角兩端加入個人中心人物圖示，連至現有個人資料編輯頁；底部設定入口保留。

首頁個人中心按鈕兩端移除背景及外框，人物圖示 30px，保留 48px 點擊區。

個人中心兩端改用使用者提供 user.png（profile-user.png），維持無背景按鈕、30px 圖示、48px 點擊區，深色主題調整圖示顏色。

依使用者要求移除首頁右上角個人中心，兩端 Logo 與 SORTI 名稱整組右移 20px；個人資料仍可從設定編輯。

首頁標頭修改驗證：兩端型別檢查通過；Chromium／iPhone WebKit 確認無個人中心按鈕且品牌右移 20px，2 項通過。PWA 已重新打包，Android APK：release-builds/Sorti-brand-right-arm64.apk 建置成功。

首頁品牌改為真正靠右對齊（移除右側空白與位移），兩端左側保留選單。

首頁重整：兩端新增暱稱／頭貼問候（點擊編輯，支援 Google 頭貼及自訂頭貼），保留人格特質入口，拍照主入口改為開始整理，真實物品數與打卡成果、待定位／出售提示，今日小步驟及紀錄。無未完成任務資料時不虛構接續任務。

個人化首頁驗證：兩端型別檢查通過、Chromium／iPhone WebKit 暱稱、真實統計、個人資料入口及原導覽與拖曳助理共 6 項通過；iPhone 截圖已檢查。Android 建置成功：release-builds/Sorti-personal-home-arm64.apk。

首頁兩端移除「收納工作台」文字，保留人格特質標籤。

首頁人格標籤兩端改為「收納人格特質」，保留原人格名稱與點擊說明。

首頁兩端標籤順序調整為「收納人格特質：人格名稱」。

移除側邊選單右上角叉叉，保留遮罩點擊／返回關閉與選單項目導覽。

空間分析分區示意圖兩端不再顯示，保留背景空間分析與收納建議輸入，以及文字分布、物品辨識框及手動編輯。

收納助理共用後端回覆改為預設 80–160 字、最多 3 步每步 1 句，移除長篇開場與固定追問，保留人格與 RAG；照片分析建議格式不受影響，舊對話不改寫。

整理建議共用後端修正：查核實際可用模型，改用 gemini-2.5-flash 與有限備援，所有模型請求設 25 秒逾時並停用 SDK 內部重試，避免照片建議長時間無回應。

收納助理通訊式介面：兩端熊頭貼與名稱、左右主題色對話泡泡、時間、底部輸入與箭頭送出、回覆狀態及自動捲動；保留人格／物品背景與聊天儲存。
驗證：Native/PWA 型別檢查通過；Chromium mobile 與 iPhone WebKit 測試訊息送出、雲端重載、長對話捲動及輸入列位置；PWA 已重建，Android arm64 release APK 已產生。尚未以實機驗證鍵盤彈出。

聊天輸入修正：PWA 輸入焦點取消綠色 outline，僅聊天輸入時隱藏底部導覽列，離開輸入恢復；聊天容器依 visualViewport 高度及位移調整，讓輸入列留在鍵盤上方。Native AIChat 已無底部導覽列，輸入框無網頁 focus outline，保留 KeyboardAvoidingView，無需改動。

收納助理兩端共用 chatPresentation：整理回覆以編號步驟卡呈現，最新助理回覆顯示兩個延伸問題按鈕，點選直接送出並儲存。後端要求短標題／一句動作與兩個相關問題；舊訊息不改寫，長文預設收合可展開，格式不完整時提供兩個通用整理提問。照片建議流程不受影響。
驗證：兩端型別檢查通過；共用解析器 3 項單元測試與 Chromium/WebKit 延伸問題點選測試通過；Android arm64 APK、PWA 已打包。後端直接生成曾成功包含兩個問題，但運行中 /chat 實測回傳 503，安全錯誤分類 UNAVAILABLE，未宣稱線上 AI 回覆穩定可用。

收納助理更正為依問題回答：一般聊天統一使用問題導向 prompt，由當次需求決定簡答／比較／必要步驟，不因出現衣櫃或收納等字就強制流程。兩端移除通用延伸問題備援，只顯示回覆實際提供的相關問題；照片收納建議不變。
本次驗證：Native/PWA 型別檢查、共用聊天解析器 3 項測試、後端 7 項測試及兩種手機瀏覽器對話操作測試通過；PWA 重建與 Android arm64 APK 完成，後端已重啟載入新 prompt。未宣稱實際模型服務 UNAVAILABLE 已解決。

AI 服務連線修復：實際查詢可用模型與生成測試，舊 gemini-2.5-flash-lite 回傳 NOT_FOUND、舊主模型／備援回傳 UNAVAILABLE。後端改以實測可回覆的 gemini-3.5-flash-lite 優先，保留有限備援、25 秒逾時與統一後端憑證。Android/PWA 共用後端，無畫面／資料流程變更。

本次實測聊天 API 兩次 HTTP 200，約 1.5／1.6 秒，觀念題簡答、操作題步驟及兩題延伸問題皆確認。備援僅保留實測成功的 gemini-flash-lite-latest 別名（同系列，不宣稱獨立供應商容錯），移除當下不可用的其他候選。後端測試 8 項通過，兩端無須更新安裝包即可使用後端修復。

聊天互動調整：資訊足夠時先回答並結束，不再強制兩個延伸問題；僅必要澄清時提問一個問題及可選情況，操作選單只在有幫助時出現。兩端有選項時均提供「其他／自行輸入」並聚焦輸入框；選擇操作或自行補充時帶入上一則回答作為 API 上下文，直接回答、避免例行下一輪選單。舊延伸問題不再作為互動選單。
驗證：兩端型別檢查、共用解析器 4 項、後端 8 項與 Chromium/WebKit 操作流程測試通過；實際聊天 API 觀念題及點選操作後均 HTTP 200 且無後續選單。PWA 已重新打包，Android arm64 APK 已產生。

使用者提供 PDF 匯入共用後端 RAG：89 頁中選取 63 頁實際正文，82 個具章節／PDF 頁碼的片段，加原 8 筆共 90 筆。Android/PWA 聊天及照片建議皆透過原 API 使用同一索引，無畫面入口或操作變更；索引僅存後端且忽略 Git，不包含於 APK／PWA。書籍內容不完整，不聲稱完整全書。詳見 rag-pdf-import.md。
驗證：後端 12 項測試、Native/PWA 型別檢查通過；執行中的 /chat 實測 HTTP 200，包包收納問題取用 PDF 45–47 頁並產生具體建議。已重啟後端載入索引；此為後端資料與檢索修正，無 Native/PWA 原始碼變更，無需重裝 APK。

收納助理逐步對話：共用 RAG 參考＋使用者物品／限制，一次只給一個具體動作（通常 40–100 字、最多 120 字），必要時提供下一步，解決後停止；概念問題直接簡答。Android/PWA 都帶最近 8 則有界對話（每則最多 1200 字）供後端生成與延續主題檢索，自由輸入追問也保有上下文。後端禁止 system 角色與過量歷史；照片建議流程不變。步驟卡保留模型原始 2／3 等編號。
驗證：Native/PWA 型別檢查通過；前端共用邏輯 9 項、後端 14 項及 Chromium/WebKit 聊天互動測試通過。真實 API 三輪逐步／追問／下一步均 HTTP 200 並含 PDF RAG 檢索紀錄；否定套包方案實測產生 74 字替代建議。PWA 已重建、Android arm64 APK 已產生，後端已重啟。

收納助理改為完整步驟卡：結合 RAG 與使用者限制，一次提供所需完整 2–4 步，每步短標題＋一句動作；不用下一步逐次解鎖。兩端步驟訊息以獨立圓角小卡、數字標示、清楚間距呈現，不收合完整步驟。最新步驟回覆下有提問邀請與「提出問題」聚焦輸入框，保留最近對話供針對某一步補充，追問不重貼整套流程；舊可選操作不再顯示。照片建議不變。
本次驗證：Native/PWA 型別檢查、前端共用 9 項測試、後端 14 項測試、Chromium/WebKit 三步卡片與提出問題互動測試通過；真實 API 回傳三個完整步驟、無下一步選單，後續追問以簡答補充。PWA 已重建，Android 完整步驟卡 arm64 APK 已產生。

新增物品照片修正：共用 createRemoteItem 上傳參數改為正確的照片 URI 與 owner/items 資料夾順序，Android/PWA 同步修復。PWA 新增表單採固定間距的按鈕群組，拍照／相簿與儲存／取消分組，極窄螢幕改單欄，避免貼齊或溢出。Native 原有新增 Modal 按鈕為垂直排列，保留既有操作。
驗證：Native/PWA 型別檢查、共用照片與 Native 物品畫面 6 項測試通過；Chromium/WebKit 新增／篩選／刪除與照片上傳失敗重試測試通過（儲存與 Storage 使用模擬服務，未寫入使用者真實資料）。手機表單截圖檢查完成，PWA 已重建；Android arm64 APK 已產生。

深色模式配色調整：兩端共用 appearance.dark 改為中性炭灰底、稍亮灰色卡片、霧綠主色與柔和米白文字，保留深淺層次與低飽和暖色強調；PWA 初始 CSS 同步。淺色模式與功能流程不變。
驗證：兩端型別檢查、Chromium/WebKit 深色與長按鈕可讀性測試通過，已檢查畫面截圖；主要文字／卡片對比 12.51、次要文字 7.36、按鈕文字 7.64、主色／柔和底 5.96。PWA 已重建、Android arm64 APK 已產生。

語言與無綠深夜配色：兩端共用中性炭灰／銀灰／米白深色 token；設定新增繁中／英文切換並存於裝置偏好。共用英文字典用於畫面、導覽、按鈕、輸入提示與對話框，PWA 同步 html lang；雲端 enum、姓名、物品名稱、訊息與既有紀錄保留原值。AI 聊天／照片建議／新每日任務及照片回饋依選定語言生成，英文常見收納名詞可檢索中文 RAG。語系匯入不重做測驗或更動原始題數／資料。
本次驗證：Native/PWA 型別檢查、前端 21 suites／76 tests、後端 26 tests 通過；Chromium/WebKit 六項語言保存／中性深色／照片新增／聊天流程測試通過。英文聊天實際 HTTP 200、成功取用 4 筆中文 RAG 並英文回答。已視覺檢查英文深夜首頁，PWA 重建、Android 英文中性深夜版 arm64 APK 完成；未以 Android 實機安裝確認。

品牌顯示名稱改為「拾序」：Native/PWA 品牌文字、登入／歡迎／關於、英文文案、瀏覽器標題、PWA 安裝名稱、Android launcher 名稱及 iOS display metadata 同步。AI 後端自我介紹與自訂 RAG 來源標籤亦更新。保留 React Native 註冊名 SORTI、com.sorti、Firebase/Supabase 識別與資料儲存 key，不影響既有登入／資料／安裝升級。
驗證：Native/PWA 型別檢查、前端 76 項、後端 26 項及兩種手機瀏覽器語言切換測試通過；可見畫面文案掃描未殘留 SORTI／Sorti，PWA 已重建、拾序 Android arm64 APK 已產生，後端已重啟載入新品牌。未變更現有服務／套件識別。


### 2026-10-15 政策 v1.1、年齡及確認紀錄

Android 與 PWA 共用 `src/data/legalPolicies.json` 的兩份 PDF 完整正文，均可未登入閱讀並返回原註冊輸入；設定均提供服務條款、隱私權政策、聯絡我們。兩個確認欄位預設未選；Email、Google 及既有帳號均由伺服器確認紀錄控制存取。聯絡頁可開啟 mailto 或複製信箱，沒有獨立刪除選單、沒有自動送信或刪除成功訊息。Native 使用原生剪貼簿套件，PWA 使用 Clipboard API 並保留可選取信箱作為失敗替代。

Migration `supabase/legal-consent-v1.1.sql` **尚未套用遠端**；部署／實機限制、AI 示範資料與保存期限的既有落差，詳見 `docs/legal-integration.md`。不能把頁面與核取框完成描述成法遵、邀請控管、刪除或遠端部署均完成。

### 2026-10-15 政策閱讀版面調整

Android／PWA 註冊頁保留原有表單與註冊／Google 按鈕，同意區移至按鈕下方，使用行內政策連結及緊湊卡片。兩份政策皆提供快速滑到底部、底部手動閱讀勾選與確認返回。閱讀進度只保存在本次畫面生命週期，非跨裝置同意依據；快速滑動不自動打勾，兩份文件確認後只回填表單政策選項，年齡仍須本人勾選。最終服務確認仍需伺服器保存成功。migration 未套用的限制保持不變，沒有為了消除錯誤而繞過後端確認。

### 歡迎頁移除底部政策列

Android 與 PWA 歡迎頁只保留品牌、文案及登入／註冊按鈕，移除底部政策列。未登入仍可由註冊頁閱讀政策，設定與確認頁入口保持可用。

### 政策須明確確認後才解鎖外部同意

Android／PWA 的文件勾選只是閱讀頁草稿，必須另按「確認並返回」才記為本次文件確認；兩份文件確認前，外層同意核取框禁用，確認後仍需本人手動勾選，不會自動同意。僅開啟、滑動或勾選後直接返回，都不算完成。Native 政策名稱改用獨立可觸控元件並擴大點擊範圍，PWA 導覽使用獨立事件並實測觸控。伺服器保存成功才開放服務的規則不變。

### 確認文字與核取框對齊

Android／PWA 同意卡片的核取框固定尺寸，文字緊鄰右側並對齊首行；長文換行留在文字欄，縮小列間空白，不改變文件確認解鎖及伺服器保存規則。

### Android 安裝說明與正方形核取框

兩端設定新增 Android Chrome 加到主畫面／安裝應用程式說明。修正 PWA 通用表單 input 的 important 最小高度誤套到 checkbox，核取框固定正方形、文字單行對齊；Native 同步使用固定尺寸正方形。既有文件確認解鎖規則不變。

### 政策浮動按鈕精簡

兩端移除同意卡片的受邀測試／年齡聲明提示文案，保留核取框與原政策正文。移除文件頂部重複快捷按鈕，右下角滑到底部改為明顯實心按鈕；確認及伺服器限制不變。

### 深夜模式熊輪廓

Android 與 PWA 在深夜模式替右上品牌熊及浮動收納助理熊增加白色輪廓，白邊沿透明圖形外緣呈現，不添加方形背景；淺色模式保持原圖。Native 共用 BearMark，PWA 使用 alpha drop-shadow。

### 側邊選單熊與焦點樣式

深夜模式側邊選單品牌熊同樣顯示白色輪廓；Native 選單使用共用 SortiBrand。PWA 移除自動聚焦產生的大矩形外框，鍵盤聚焦改為文字底線，保留鍵盤可辨識狀態。

### 通用設定卡片分隔線

PWA 移除通用設定首列語言上方多餘的分隔線，保留語言／深色模式之間的分隔。已檢查 Native 原本首列沒有多餘線條，無需修改。

### 拍攝入口與側邊選單移除箭頭

兩端首頁拍攝／開始整理入口移除尾端箭頭，PWA 側邊選單移除各項尾端箭頭；Native 選單與開始拍攝確認按鈕原本沒有尾端箭頭，維持原狀。原相機圖示及點擊操作保留。

### 物品篩選圓框

兩端分類／定位狀態圓框統一使用當前主題 border 顏色，選取狀態以背景及文字區別。PWA 明確覆寫原生 button 立體邊框及陰影，深淺模式一致，隱藏分類列水平捲軸但保留滑動。

### 深色篩選選取對比

兩端深色模式的分類與定位狀態選取項改為淺灰紫主色底、深色文字，未選中維持深色底；邊線保持統一，淺色模式不變。

### 捐贈窗口內容區分

兩端共用各縣市窗口的專屬聯絡／平台資訊，依衛福部 2026-06 更新名錄於 2026-10-15 查核；明確標示諮詢／轉介，避免把窗口當成已確認收件單位。未公布品項不編造，新北、臺北等導向對應官方平台，其他保留官方名錄。此更新不表示所有據點接受任意二手物品。

### 首次權限引導

Android／PWA 第一次開啟顯示通知、相機權限引導，可略過；系統提示由使用者按繼續觸發。只申請系統權限，不在未登入／未確認前註冊推播 token。PWA 相機串流立即停止，不拍照上傳。iPhone 非主畫面模式不顯示無效通知授權請求，改提示加入主畫面。首次引導以裝置本機記錄，不作政策確認依據。

### 月曆日期不拆行

PWA 日格改為固定高度與小內距，日期數字強制單行；打卡勾號獨立置於數字下方，避免兩位數被拆開。Native 日期文字同步保留足夠數字寬度。
