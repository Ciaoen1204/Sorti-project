> 歷史開發記錄：本功能已於 2026-10-11 依使用者要求移除，下列 API、畫面與腳本不再提供。

# 原圖物品重排 MVP（2026-10-11）

本版取代主要模擬流程中的 SD 1.5；不載入 diffusion、IP-Adapter 或 CUDA，不下載權重。先做輪廓確認，再平移原始 RGBA 圖層。照片解碼與 EXIF 方向正規化後的 RGB 是像素驗證基準，未縮小原圖。PNG 輸出；不能把 PNG 位元組與來源 JPEG 檔案位元組直接比較。

## 已檢查的既有架構

| 檔案 | 實際既有功能／本次用途 |
| --- | --- |
| `src/backend/detection_service.py` | 原有 `best.pt`，實際檢查為 `yolo26n.yaml`、`DetectionModel`、`detect` 任務；不是 segmentation checkpoint。保留既有 YOLO26n 辨識。 |
| `src/backend/vision_detection.py` | Gemini 物品名稱與 0–1000 全圖矩形框；原有模型／AI 合併、手動編輯及裁切仍保留。 |
| `src/backend/space_analysis.py` | Gemini 空間分區多邊形及儲物區描述，原本不含單件輪廓；不是深度、容量或 3D 場景。 |
| `src/backend/rag_service.py`、`knowledge_base.py` | 原有人格偏好、空間限制與 KonMari 官方公開技巧摘要 RAG；模擬先沿用相同建議，再交給 Gemini 結構化配置。新增只記數量的請求／Token 統計。 |
| `src/services/supabaseData.ts` | 原有登入、RLS、私人照片資料操作，未改資料庫或新增公開 bucket。 |

## 實際修改／新增檔案

| 檔案 | 責任 |
| --- | --- |
| `src/backend/organization_preview.py` | `SceneObject`、分類、分割快取、RGBA 提取、局部背景修補、Gemini JSON 配置、有限次幾何修正、CPU 合成、原像素與 ID 驗證。 |
| `src/backend/preview_usage.py`（新增） | ContextVar 統計當次模型請求和可取得的 Token，無金鑰／提示／照片日誌。 |
| `src/backend/rag_service.py` | 共用 Gemini fallback 呼叫加入統計；沿用原後端金鑰。 |
| `src/backend/main.py`、`preview_jobs.py` | 沿用兩個既有 preview 路由與單工背景任務，增加 prepare／compose 階段。 |
| `src/backend/requirements.txt` | 明列 CPU 的 NumPy 和 OpenCV；不加入 SAM／LaMa 大型依賴。 |
| `src/services/previewSelection.ts`、`aiApi.ts` | 兩平台共用資料格式、確認旗標、工作輪詢、配置與警告。 |
| `src/components/OrganizationPreviewCard.tsx`、`PreviewMaskEditor.tsx` | Android 輪廓確認／取消搬動、原圖表面選取、前後比較與位置原因。 |
| `web/OrganizationPreview.tsx`、`PreviewMaskEditor.tsx` | PWA 對應操作，保留相同使用者任務。 |
| `scripts/verify-original-pixel-preview.py`（新增） | 可重現的真實 HTTP 背景 API＋Gemini 像素重排驗證，明確使用合成紅杯素材。 |
| `src/backend/test_organization_preview.py`、`__tests__/OrganizationPreviewCard.test.tsx`、`__tests__/previewSelection.test.ts`、`web/tests/pwa.spec.ts` | 像素 A–H、快取／失效／錯誤、階段確認、取消勾選與回歸。 |
| `docs/platform-parity.md`、本文件 | 同步操作、實際驗證與限制記錄。 |

## 分割與原物品圖層

既有空間分布與 YOLO 框不能當成精準物品輪廓。新增 Gemini **文字 JSON 輪廓**，不呼叫任何影像生成模型。要求每件穩定 ID；同名物品按 ID 分開。從原圖裁切物品群並加上下文邊界，僅將 Gemini 的參考 JPEG 縮小；原圖合成仍用原解析度。

本版主協定 `coordinate_frame=full_image_1000`：`box_2d=[ymin,xmin,ymax,xmax]` 和 polygon `[x,y]` 都相對當次**明確裁切的輸入圖**正規化，後端加回裁切偏移換算為原圖。另支援明確標示 `bbox_1000` 的框內 polygon；沒有 frame 不猜測。空值、越界、NaN、框不相符與矩形假輪廓會拒絕或使用本機分割。參考 [Gemini 官方影像理解／segmentation](https://ai.google.dev/gemini-api/docs/image-understanding) 的格式；本版保留既有 generate_content SDK，不另外改整個 AI client。

Gemini polygon 作為 GrabCut 的前景先驗，再由 [OpenCV GrabCut](https://docs.opencv.org/4.x/d8/d83/tutorial_py_grabcut.html) 細化。Gemini 不可用則嘗試框內 GrabCut，顯示本機輪廓警告。空遮罩、過度擴張／近乎整個矩形、重疊輪廓、透明或遮擋、接觸圖片邊界等，保留原位置。RGBA 的 RGB 直接來自原圖，二值 alpha 來自遮罩；不縮放、不旋轉、不補畫物品背面。未聲稱存在來源沒有提供的 confidence。

前端提供透明圖層預覽；使用者確認輪廓才搬動，可取消選取。錯誤輪廓可取消搬動並返回原有手動物品框修正後重新分析。**尚無逐像素畫筆修遮罩，也沒有 SAM 2 細化**，不是已完成能力。

## 背景、配置與合成

僅對被接受搬動物品的來源 silhouette 使用 [OpenCV Telea inpaint](https://docs.opencv.org/4.x/df/d3d/tutorial_py_inpainting.html)。合計缺口不得超過全圖 2%；寬大且內部深的缺口拒絕，細長小孔另以 distance transform 判斷。這是保守上限，不是視覺品質保證。**LaMa 未配置／未下載**：大洞直接不搬動，給出理由。原本遮住的紋路不可從單張照片知道，所有這些區域記錄於 `estimated_background_regions`，不能稱真實還原。

使用者綠色框代表已確認的桌面內部支撐區，須避開桌緣、桌腳與固定結構。桌體在表面外完全保護；床、櫃、門牆等已辨識固定物件全框保護。家具預設不搬，MVP 不提供強行搬家具。未確認／不可靠小物保留原位並保留碰撞占用範圍。

Gemini 收到原圖、原位置與 RGBA 尺寸、固定物件、表面、已確認 ID、包含真實人格與 RAG 的既有建議，回傳原圖像素座標、surface_id、原因；所有位置均經後端檢查。非零旋轉、縮放、越界、未知／重複 ID、無支撐、撞上保留物品等不能直接採用。有限最多 250 次邊緣配置修正；仍不可行就原位。不提供「完美已整理」的假成功。

不允許不可靠的前後遮擋：保留物品及尚未搬動來源位置預留，目標不能與其他原物品撞在一起。來源二值 alpha 内的 RGB 在新位置逐像素相同。editable_mask 是被移除來源與新位置 alpha 的聯集，最後強制以原圖還原遮罩外 RGB。合成後再比對原物品像素、遮罩外像素和 ID 集合。

`validation` 區分可證明的像素／ID規則與 `visual_quality=requires-human-review`。程式不能保證物品辨識沒有遺漏、輪廓完整、紋路真實、陰影自然或單張照片的透視／深度正確。

## API、隱私與費用

`POST /organization-preview` multipart：既有 image、advice、regions、items，加 `stage=prepare|compose`、`scene_id`。prepare 回傳原圖參照、輪廓透明層、分割來源、警告和確認 token；compose 的 items 加 `confirmed`、`movable`。同路由回傳 job_id，`POST /organization-preview/status` 查詢。完成資料包括 original_image_uri、image_uri、objects、placements、editable_mask、estimated_background_regions、warnings、outcome（changed／no_change）、gemini_usage。

既有 PWA gateway 仍檢查 Supabase JWT，照片與 API no-store，不新增資料表／RLS／公開 Storage。後端只綁 localhost，工作與 scene token 是 256-bit 隨機 capability，有 30 分鐘 TTL；scene 再綁原圖像素、物品框／名稱／ID和表面。這不是新增的帳號權限架構，請勿將 localhost 後端直接公開上網。單工背景工作最多 8 個；分割快取最多 4 場景，超出會淘汰。照片上限 1600 萬像素、20 件待分割物品，總遮罩像素量也有上限；資料在記憶體，不永久儲存，重啟會失效。

相同照片、物品與表面重複 prepare 可快取。前端把同一方案保存直到照片／偏好變更，不每次重取 RAG 建議。每個階段記錄包括 fallback 嘗試的 requests，成功回應能取得的 prompt_token_count、candidates_token_count、total_token_count；失敗供應商無 metadata 時無法估算其 Token。沒有新增付費生圖 API，CPU 合成沒有 API 費用；Gemini 分割／配置仍使用目前帳號計費，**不是零費用，也不能保證每月 300 元**。尚未加入帳戶級月額封頂／供應商帳單查詢；正式營運需設供應商預算和配額。

## 啟動與使用

後端：在 `src/backend` 執行 `python -m pip install -r requirements.txt`，後端 `.env` 使用既有 GEMINI_API_KEY，再 `python -m uvicorn main:app --host 127.0.0.1 --port 8000`。PWA：專案根目錄 `npm run pwa:build`、`npm run pwa:serve`；沿用既有 HTTPS tunnel。既有 SD 權重留在磁碟但不被新流程載入，舊 prepare-sd-preview.py 不需要執行。

在拍照分析完成後，保留既有辨識框／手動新增與名稱分類編輯。選取同一平面桌面內部，按「分析物品輪廓」，檢查透明層、取消有問題／不想搬的物品，按「確認輪廓並產生模擬圖」。查看整理前／後、每件位置原因及保留原位理由。房間中使用相同核心，MVP 只重排已確認桌面小物，不宣稱房間 3D 重建、櫃內容量、旋轉背面、互相遮擋大堆疊已可靠完成。

## 驗證指令與素材

```powershell
python -m unittest discover -s src/backend -p 'test_*.py'
npm test -- --runInBand
npx tsc --noEmit
npm run pwa:check
npm run pwa:build
npm run pwa:test -- --workers=2
# 需既有 backend Gemini 金鑰，會真正呼叫模型：
python scripts/verify-original-pixel-preview.py
```

後端 47 項通過（重排 17 項，含 A–H）；Native 55 項通過；兩平台型別檢查通過；PWA 全套 59 通過、既有 WebKit 離線測試跳過 1 項。針對 Chromium／WebKit 的新兩階段確認測試也 2／2 通過。

像素核心的木紋＋紅杯素材是**明確標示的合成測試素材**，不是模型成果，輸出 `pwa-runtime/pixel-fixture-before.png`／`pixel-fixture-after.png`。真實照片來源及授權見 `pwa-runtime/clutter-desk-source.txt`；真實 Gemini／CPU 流程的圖層、前後 PNG、輪廓 JSON、pixel-real-verification.json 留在本機 runtime。測試替身僅驗證失敗／API／UI協定，未冒充模型成品。真實照片測試仍可能保留原位，請以 JSON 的 outcome 和 warnings 為準，不等同全部雜亂已改善。

Android 新 APK `release-builds/Sorti-original-pixels-arm64.apk` 已成功 USB 安裝。PWA bundle `index-C_Nczgp0.js` 已重新打包。真機登入／私人照片不會由程式自動假冒使用者；iPhone 相機、光線和真實家具輪廓需使用者現場確認。

最終實際驗證：透過 localhost HTTP prepare → status → compose → status，真實 Gemini 呼叫與本機 GrabCut 將合成紅杯原像素移到 (280, 20)，outcome=changed、editable_mask 外改變像素 0、source_object_pixels_equal=true；每階段 3 次 fallback 嘗試，成功回應總 Token 分別 1751／1455。結果 `pwa-runtime/pixel-api-after.png`、來源 RGBA 和 `pixel-api-verification.json`。這是**合成素材＋真實模型／API**，不是實拍照片成果。真實雜亂桌面樣本最新測試 outcome=no_change：筆的背景缺口不適合保守修補，保留原圖並警告，未把失敗顯示成整理成功。
公開 HTTPS 已確認載入新版 bundle，health=ok；手機 com.sorti lastUpdateTime=2026-10-11 14:47:47。
