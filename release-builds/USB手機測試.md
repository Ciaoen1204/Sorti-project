# Android USB 手機測試

在專案根目錄開啟 PowerShell。

手機允許 USB 偵錯後，可直接執行下列腳本，完成安裝、AI USB 轉接與啟動：

```powershell
.\release-builds\install-usb-test.ps1
```

以下為個別操作步驟。

1. 手機開啟開發人員選項與 USB 偵錯，使用可傳輸資料的 USB 線接上電腦，並允許電腦的偵錯授權。
2. 確認手機連線：

   ```powershell
   & C:\Android\Sdk\platform-tools\adb.exe devices -l
   ```

   狀態應為 `device`；若為 `unauthorized`，請在手機允許偵錯授權。

3. 安裝本次打包的 APK：

   ```powershell
   & C:\Android\Sdk\platform-tools\adb.exe install -r .\release-builds\Sorti-usb-test-arm64.apk
   ```

4. 將手機 AI 請求轉接到電腦後端，每次重新接上 USB 後重做：

   ```powershell
   & C:\Android\Sdk\platform-tools\adb.exe reverse tcp:8000 tcp:8000
   & C:\Android\Sdk\platform-tools\adb.exe reverse --list
   ```

5. 若電腦後端尚未啟動，另開 PowerShell：

   ```powershell
   cd .\src\backend
   python -m uvicorn main:app --host 127.0.0.1 --port 8000
   ```

   電腦瀏覽 `http://127.0.0.1:8000/` 應回傳 `status: ok`。保留後端執行，手機 AI 測試時保留 USB 連線。

6. 手機開啟 SORTI，測試登入、拍照與 AI 對話。此 APK 已內含 JavaScript，不需要啟動 Metro。

每日任務也使用電腦 AI 後端：請保持 USB 連線、8000 埠轉接及後端執行。所有 Gemini 功能共用 `src/backend/.env` 的 `GEMINI_API_KEY`，模型由 `GEMINI_MODEL` 設定。金鑰不寫入手機 APK。`POST /daily-task` 只接受台灣當天日期（`YYYY-MM-DD`），回傳三個簡短收納任務供選擇。手機依登入帳號儲存任務、選擇與回饋，重開畫面不會換題；照片可預覽與重拍，確認後經 `/daily-task/feedback` 取得 Gemini 照片回饋並儲存打卡。當天完成後仍可重新拍攝並更新回饋；未來日期不開放，過去紀錄僅供查看。

## 重新打包

註冊與登入使用 `.env` 中的 `SUPABASE_URL` 和 `SUPABASE_PUBLISHABLE_KEY` 連線到雲端，不需要手機和電腦在同一個網路。這些設定會寫入 APK；修改 `.env` 後，必須重新打包並安裝 APK，已安裝的 App 不會自動讀取電腦上的新設定。

若出現 `Network request failed`，先確認手機能開啟 `${SUPABASE_URL}/auth/v1/health`（將 `${SUPABASE_URL}` 換成實際網址）。若手機能連線但 App 仍失敗，請重新打包並安裝，確認 App 使用最新設定。

```powershell
# 若 R: 尚未映射，先執行下行；R: 必須為未使用的磁碟代號。
subst R: (Get-Location).Path
Set-Location R:\android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain
cd ..
Copy-Item -LiteralPath .\android\app\build\outputs\apk\release\app-release.apk -Destination .\release-builds\Sorti-usb-test-arm64.apk
```

此版本適用 ARM64 手機、Android 7.0 以上，使用專案的測試簽章。
原生 C++ 編譯需使用上述英文字母路徑，以避開 Windows 中文路徑問題。
