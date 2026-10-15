from __future__ import annotations

import os
import sys
import tempfile
import json
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from datetime import date as Date
from starlette.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware


BACKEND_DIR = Path(__file__).resolve().parent

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from detection_service import detect_items
from item_crops import crop_items
from vision_detection import prepare_image, detect_with_gemini, merge_detections
from rag_service import answer_question
from space_analysis import analyze_space
from schemas import ChatRequest, ChatResponse, DetectItemsResponse
from schemas import DailyTaskRequest, DailyTaskResponse, DailyTaskFeedbackResponse
from daily_tasks import generate_daily_task, generate_task_feedback, taipei_today


app = FastAPI(title="拾序 LLM RAG Chatbot API")
from legal_access import legal_access
app.middleware("http")(legal_access)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home() -> dict[str, str]:
    return {
        "status": "ok",
        "message": "拾序 AI Chatbot API is running",
    }


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    """
    一般聊天與照片分析共用此端點。

    - mode="chat"：使用聊天機器人 Prompt
    - mode="photo_analysis"：使用照片分析 Prompt
    """
    try:
        # 優先使用直接傳入的人格。
        # 若舊版前端仍傳 user_profile，則保留相容處理。
        user_persona = req.user_persona

        if not user_persona and req.user_profile:
            user_persona = (
                req.user_profile.get("personality_type")
                or req.user_profile.get("personality_desc")
            )

        result = answer_question(
            question=req.message,
            language=req.language,
            history=[turn.model_dump() for turn in req.history],
            detected_items=req.items,
            user_persona=user_persona,
            mode=req.mode,
            space_analysis=req.space_analysis.model_dump(exclude={'overlay_uri'}) if req.space_analysis else None,
            storage_preferences=req.storage_preferences.model_dump() if req.storage_preferences else None,
        )

        return ChatResponse(
            reply=result["reply"],
            notice=result.get("notice", ""),
            retrieved_titles=result.get("retrieved_titles", []),
            retrieved_sources=result.get("retrieved_sources", []),
        )

    except Exception as error:
        print("Chat API 發生錯誤：", type(error).__name__, [code for code in ("RESOURCE_EXHAUSTED", "PERMISSION_DENIED", "NOT_FOUND", "output budget", "UNAVAILABLE", "timed out") if code in str(error)], flush=True)
        raise HTTPException(
            status_code=503,
            detail='目前無法產生收納建議，請保留分析結果並稍後重試。',
        ) from error


@app.post("/daily-task", response_model=DailyTaskResponse)
def daily_task(req: DailyTaskRequest) -> DailyTaskResponse:
    if req.date != taipei_today():
        raise HTTPException(status_code=400, detail="只能取得今天的任務。")
    try:
        return DailyTaskResponse(date=req.date, tasks=generate_daily_task(req.date, req.language) if req.language=="en" else generate_daily_task(req.date))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        print("Daily task API 發生錯誤：", type(error).__name__)
        raise HTTPException(status_code=503, detail="目前無法產生每日任務，請稍後重試。") from error


@app.post("/daily-task/feedback", response_model=DailyTaskFeedbackResponse)
async def daily_task_feedback(
    date: Date = Form(...),
    task: str = Form(..., min_length=1, max_length=100),
    image: UploadFile = File(...),
    language: Literal["zh-TW", "en"] = Form("zh-TW"),
) -> DailyTaskFeedbackResponse:
    if date != taipei_today():
        raise HTTPException(status_code=400, detail="只能完成今天的任務。")
    mime = image.content_type or ""
    if mime not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="請使用 JPEG、PNG 或 WebP 照片。")
    data = await image.read(10 * 1024 * 1024 + 1)
    if not data or len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="照片不能為空且需小於 10 MB。")
    try:
        feedback = await run_in_threadpool(generate_task_feedback, task, data, mime, language) if language=="en" else await run_in_threadpool(generate_task_feedback, task, data, mime)
        if date != taipei_today():
            raise HTTPException(status_code=400, detail="日期已更新，請完成今天的任務。")
        return DailyTaskFeedbackResponse(feedback=feedback)
    except HTTPException:
        raise
    except Exception as error:
        print("Task feedback API 發生錯誤：", type(error).__name__)
        raise HTTPException(status_code=503, detail="暫時無法產生照片回饋，請保留照片並重試。") from error


@app.post("/crop-items")
async def crop_uploaded_items(image: UploadFile = File(...), boxes: str = Form(...)):
    try:
        parsed = json.loads(boxes)
        if not isinstance(parsed, list):
            raise ValueError('物品範圍格式無效。')
        content = await image.read(8 * 1024 * 1024 + 1)
        if len(content) > 8 * 1024 * 1024:
            raise ValueError('照片過大，請重新拍攝。')
        return {'items': await run_in_threadpool(crop_items, content, parsed)}
    except (ValueError, KeyError, TypeError, OSError) as error:
        raise HTTPException(status_code=400, detail='無法裁切物品照片，請確認照片與物品範圍。') from error


@app.post("/detect-items", response_model=DetectItemsResponse)
async def detect_uploaded_items(
    image: UploadFile = File(...),
) -> DetectItemsResponse:
    temp_path: str | None = None

    try:
        content = await image.read(8 * 1024 * 1024 + 1)
        if len(content) > 8 * 1024 * 1024:
            raise HTTPException(status_code=413, detail='照片過大，請重新拍攝。')
        normalized = await run_in_threadpool(prepare_image, content)
        # Stage one runs before object detection, on the same EXIF-normalized image.
        space = None
        space_notice = ''
        try:
            space = await run_in_threadpool(analyze_space, normalized)
        except Exception as error:
            print('Space analysis unavailable:', type(error).__name__)
            space_notice = '空間分區暫時無法取得；保留物品辨識，建議不會假設完整格局。'
        suffix = '.jpg'

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix,
        ) as temp_file:
            temp_file.write(normalized)
            temp_path = temp_file.name

        model_error = False
        try:
            model_result = await run_in_threadpool(detect_items, temp_path)
        except Exception:
            model_error = True
            model_result = {'detection_boxes': [], 'model_name': 'best.pt'}
        try:
            ai_boxes = await run_in_threadpool(detect_with_gemini, normalized)
            result = merge_detections(model_result, ai_boxes)
            result.update(ai_status='completed', notice='模型暫時無法使用，本次由 Gemini 辨識。' if model_error else '')
        except Exception as error:
            print('Gemini vision unavailable:', type(error).__name__)
            if model_error:
                raise HTTPException(status_code=503, detail='目前無法辨識照片，請稍後重試。') from error
            result = merge_detections(model_result, [])
            result.update(ai_status='unavailable', notice='Gemini 輔助暫時無法使用，本次保留模型辨識結果。')

        result.update(space_analysis=space, space_status='completed' if space else 'unavailable', space_notice=space_notice)
        return DetectItemsResponse(**result)

    except HTTPException:
        raise
    except Exception as error:
        print("Detect API 發生錯誤：", type(error).__name__)
        raise HTTPException(
            status_code=500,
            detail='無法處理這張照片，請重新拍攝或換一張照片。',
        ) from error

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
