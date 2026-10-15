# 整理後模擬圖：本機 SD 1.5

圖片由 `stable-diffusion-v1-5/stable-diffusion-inpainting` 生成，IP-Adapter 提供原物品圖片參考。Gemini 仍用於收納建議與短英文提示轉換，沒有 Gemini 圖像生成呼叫。

## 已安裝的電腦

目前 CUDA PyTorch 2.6.0+cu124、RTX 3050 Ti Laptop 4GB。已下載模型至 `src/backend/preview-models`（Git 忽略），fp16 safetensors，512px、32 steps、首次 strength 0.9／IP-Adapter scale 0.08，重試 strength 1.0／scale 0、CPU offload。模型第一次使用時載入，之後保留在同一後端程序。

其他電腦在 CUDA PyTorch 安裝完成後，從專案根目錄執行：

```powershell
python -m pip install -r src/backend/requirements-preview.txt
python scripts/prepare-sd-preview.py
```

模型來源為公開 Hugging Face 倉庫；需數 GB 磁碟與首次下載網路，圖片推論在本機。不需要新增圖片生成 API key。模型授權條款仍依原模型倉庫。若使用不同模型路徑，可在後端 `.env` 設定 `SD_INPAINT_MODEL_PATH`、`SD_IP_ADAPTER_PATH`；預設使用專案內下載的資料夾。這些路徑是電腦本機路徑，不能填網址。

## 操作

1. 拍照或選照片，開始分析。
2. 確認空間與辨識物品，修正名稱、分類、框或新增漏掉的物品。
3. 在「整理後模擬圖」原照片上拖曳選取整理範圍，可重複選取最多 20 區、復原上一範圍或清除。避開桌腳、家具輪廓與不需修改的牆面。
4. 按「產生模擬圖」。未先產生文字建議時，仍會在背景取得人格偏好與 RAG 的整理方案；不會自動顯示文字建議。之後可另外按「產生建議」。
5. 電腦保持運行，手機可比較整理前及模擬整理後。

## 資料與生成流程

兩邊傳送原照片、最新物品框、中文整理方案及正規化矩形遮罩。後端 EXIF 校正及限制圖片最大 1600px，在遮罩附近裁切、等比填充至 512px，僅將整理範圍內有交集的物品送入英文提示轉換，明確描述整理後的留白、集中擺放與可用空間。IP-Adapter 改以單張原場景區域作低權重參考，不再將物品拼貼成整張參考圖，避免複製拼貼構圖與雜亂。CLIP 仍有文字長度限制，未辨識到物品時也可生成。

SD 生成完畢後縮放回原區域，僅在遮罩內合成，邊緣向內柔化，保留遮罩外像素。沒有重新推算房間的三維幾何，也沒有物品去背搬移合成。矩形範圍是使用者選取，不是 SAM 自動桌面分割。IP-Adapter 是外觀參考，不能保證原物品全部保持或數量精確；範圍內的桌面與物品細節仍可能改變。畫面明確標示 AI 示意，需現場確認。

## 背景工作與失敗處理

`POST /organization-preview` 回傳工作編號，`POST /organization-preview/status` 以編號查詢處理中／完成／失敗。編號為 256-bit 隨機能力憑證，不記錄於日誌；HTTPS gateway 兩個入口都驗證 Supabase 登入。後端只綁定 127.0.0.1，不應直接公開到網際網路。只有一件 GPU 工作可執行，其他請求顯示稍後重試，記憶體保留最多 8 件、30 分鐘過期，後端重啟會遺失工作。前端每 8 秒查詢，最長 15 分鐘，圖片不自動永久儲存。關閉畫面會停止前端查詢，已開始的 GPU 工作仍會完成。

模型缺少、GPU 不可用、文字方案無法取得或生成失敗均顯示可重試訊息，不回退到 Gemini 圖像模型，也不以假圖冒充生成成果。圖片生成不消耗 Gemini 圖像額度，但整理方案與提示轉換仍會使用 Gemini 文字額度。

## 參考

- [Diffusers Inpainting](https://huggingface.co/docs/diffusers/en/using-diffusers/inpaint)
- [IP-Adapter](https://huggingface.co/docs/diffusers/en/using-diffusers/ip_adapter)
- [SD 1.5 Inpainting 模型](https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-inpainting)
- [IP-Adapter 模型](https://huggingface.co/h94/IP-Adapter)


## 整理改善檢查（2026-10-11）

針對「原本雜亂幾乎沒改善」，提高重繪幅度、降低原場景圖片參考權重，並把整理後的留白與整齊擺放放在英文提示前端。生成後用 Gemini 視覺模型比較原圖／候選圖的同一選取範圍，檢查改善、保留物品、保留家具、沒有新增雜亂四項。這是視覺判斷，仍可能誤判，不能保證物品一模一樣或實際空間容量。

未改善、只改光線、變得更亂、家具變形或物品被大量替換的候選不顯示；最多自動重試一次，兩次都不通過時回傳明確訊息。重試永遠使用原照片，不把拒絕的模擬圖送回模型。檢查服務不可用或回傳無效判斷時也不顯示未確認的圖。這會增加生成時間及 Gemini 視覺呼叫；圖片本身仍只由本機 SD 生成。

實測另發現視覺模型可能將更高的紙堆誤認為改善，因此檢查提示要求「雜亂明顯減少且可用工作面增加」，拒絕僅改對齊、換色或換一種堆法。第二次不採圖片參考，避免原雜亂布局繼續主導生成；仍保留原照片及原遮罩作局部重繪輸入。

測試曾使用公開雜亂桌面照片（[Yinan Chen / Good Free Photos，CC0](https://www.goodfreephotos.com/other-photos/rooms/office-desk-area.jpg.php)）。較小的書本堆範圍在收緊後兩次生成均未通過可用空間改善檢查，因此未回傳候選；這證明拒絕流程可用，並不代表 SD 1.5 已能穩定重排所有桌面物品。整理範圍應包含原物品與預計擺放的桌面，不宜只框物品本身。

把範圍擴到包含預計擺放的桌面後，同一公開測試照片有候選通過較嚴格檢查，約 54 秒。圖片只改善所選右側書本區，範圍外的水瓶等保留原照。這是單一樣本，不作普遍成功率或每件物品精確還原的保證。每次重新生成先清除舊模擬圖，失敗時僅保留原照及建議，不把舊結果誤當新成功結果。
