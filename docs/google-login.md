# Google 登入設定（SORTI）

程式已支援 Android / PWA 的 Google OAuth PKCE 登入、回到 App 及保存登入狀態。2026-10-11 查核 Google Provider 已啟用；真實帳號授權仍需在装置上確認，供應商啟用不代表回傳網址與 Google 用戶端設定已完整驗證。以下保留一次性後台設定步驟。Email 登入不受影響。

## 1. 建立 Google OAuth 用戶端

1. 開啟 [Google Cloud Console](https://console.cloud.google.com/)，建立或選擇專案。
2. 進入 **Google Auth Platform**，設定 Branding、Audience，填寫應用程式名稱 SORTI、支援 Email 和聯絡 Email。
3. 測試期間選 External / Testing，將實際測試的 Google 帳號加入 Test users；日後開放民眾使用需發布，並依 Google 要求完成必要驗證。
4. Clients → Create client，類型選 **Web application**（Google 回傳給 Supabase，由 Supabase 再導回手機）。
5. Authorized JavaScript origins 加入目前 PWA 網址：`https://introduces-cat-concord-yukon.trycloudflare.com`。
6. Authorized redirect URIs 加入：`https://riqpljtpfcwuejvoyfoh.supabase.co/auth/v1/callback`。
7. 建立後取得 Client ID、Client Secret。

## 2. 啟用 Supabase Google Provider

1. 開啟 [此專案 Authentication Providers](https://supabase.com/dashboard/project/riqpljtpfcwuejvoyfoh/auth/providers)。
2. 選 Google，開啟 Enable，填入剛取得的 Client ID / Client Secret，儲存。
3. **Client Secret 只填 Supabase 後台，不放 App、PWA、Git 或對話。**不需要把 Google Secret 加進 `.env`。

## 3. 設定返回網址

開啟 [Supabase URL Configuration](https://supabase.com/dashboard/project/riqpljtpfcwuejvoyfoh/auth/url-configuration)，在 Redirect URLs 加入：

目前手機測試的 Site URL 請設成 `https://introduces-cat-concord-yukon.trycloudflare.com`，不要保留 `http://localhost:3000`。Redirect URLs 另加入完整返回網址 `https://introduces-cat-concord-yukon.trycloudflare.com/?auth_callback=google`，僅允許精確返回路徑。只有 Site URL 或只有網域、不含返回路徑的 allow list 設定，無法確保 OAuth 返回正確。

- `sorti://auth/callback`（Android App）
- `https://introduces-cat-concord-yukon.trycloudflare.com/?auth_callback=google`（目前 PWA 測試版）
- `http://127.0.0.1:4173/**`（本機開發，可選）

正式上線使用固定 HTTPS 網址，Site URL 設成正式網址，Redirect URLs 只允許實際使用的網址。臨時隧道重建換網址時，Google origins 與 Supabase Redirect URLs 都需更新。

## 4. 測試

若 iPhone Google 授權後顯示 localhost / 無法連接伺服器，即使 Supabase 已建立使用者，仍不代表此裝置已取得 Session。先修正上述 Site URL 與 Redirect URLs，儲存後從原本 HTTPS 網址重新發起 Google 登入；不要手動改失敗頁面的網址搬移驗證碼。程式 PWA 使用 `location.origin + '/?auth_callback=google'`，Android 使用 `sorti://auth/callback`。無 Supabase 管理權限時，無法由前端公開金鑰修改或查核後台 allow list。

- Android 登入頁按「使用 Google 登入」，在系統瀏覽器選帳號，授權後返回 SORTI。Google 的 client 是 Web 類型，因此此方式不需要 Android SHA-1 設定。
- PWA 在 Safari / 瀏覽器中按同一按鈕；PKCE 回到發起登入的同一瀏覽器和網址，勿切换裝置或無痕視窗完成驗證。
- 未完成人格測驗的帳號進入原始測驗，已完成的帳號進首頁。
- 關閉後重新開啟 App / 相同網址的 PWA，保留有效登入；主動登出或 Refresh Token 被撤銷／過期時才需要再次登入。
- iPhone「主畫面 PWA」與 Safari 分頁可能使用不同儲存環境，各自第一次需要登入。變更網站網域、清除網站資料或無痕瀏覽也無法沿用原本登入。固定網域是長期保留 PWA 登入的必要條件。

選完 Google 帳號及授權後，PKCE 驗證會建立 SORTI Session 並自動進首頁或初次測驗，不需要再輸入 SORTI 密碼。取消或返回時，一般登入按鈕不會沿用 Google 的忙碌狀態；Android 恢復前景及 PWA pageshow 會恢復 Google 重試入口。

目前使用系統瀏覽器 OAuth。瀏覽器已有 Google 登入可沿用該帳號；手機設定內的 Google 帳號不一定等於瀏覽器已登入。要完全不開瀏覽器並使用手機原生帳號選擇器，需要另接 Android Credential Manager、Google Android OAuth 用戶端與簽章 SHA-1，並以 ID token 向 Supabase 建立登入；此原生方式尚未實作。Google 仍可能要求首次授權或安全驗證。

官方依據：[Supabase Google 登入](https://supabase.com/docs/guides/auth/social-login/auth-google)、[Native deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)、[Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)。真實帳號測試仍需使用者在手機選擇帳號並授權。
