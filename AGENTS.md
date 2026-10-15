# SORTI 開發規則

使用者要求 Android App 與 PWA 功能同步。新增或修改任何使用者功能時：

- 同時檢查 `src/screens` 的 React Native 畫面與 `web` 的 PWA 畫面，兩邊都要有對應入口及可完成的操作。
- 保留既有流程，尤其原始收納測驗的 7 題、28 個選項、4 種人格與情境圖片，以及照片辨識框、手動新增、名稱分類編輯、框移動及縮放、單件裁切匯入。
- 雲端資料操作集中於 `src/services/supabaseData.ts`。PWA 由 `npm run pwa:prepare` 匯出，勿直接修改 `web/data.generated.ts`。
- 業務資料與驗證規則優先共用；平台相機、檔案選取與導覽可以不同，但使用者要能完成相同任務。
- 更新 `docs/platform-parity.md`，執行兩邊的型別檢查與適當的功能測試；PWA 發布測試前重新打包，Native 修改後產生新版 APK。
- 系統推播目前沒有後端實作，不得把單純開關描述為已可接收推播。若遇平台能力限制，說明實際行為，不顯示無作用的控制項。
