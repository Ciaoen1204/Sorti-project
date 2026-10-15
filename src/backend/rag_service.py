from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
import math
import os
import re
from typing import Any, Dict, List, Literal

from opencc import OpenCC
from dotenv import load_dotenv
from google import genai
from gemini_config import get_api_key

from knowledge_base import (
    KnowledgeChunk,
    build_kondo_documents,
    format_documents,
)
from prompts import (
    build_direct_answer_prompt,
    build_photo_analysis_prompt,
    build_step_instruction_prompt,
    describe_persona,
    persona_response_focus,
)


load_dotenv()


AIRequestMode = Literal["chat", "photo_analysis"]


DEFAULT_GEMINI_CANDIDATES = [
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
]


@dataclass(frozen=True)
class _ScoredChunk:
    chunk: KnowledgeChunk
    score: float


_SEARCH_CONVERTER = OpenCC("t2s")

def _tokenize(text: str) -> List[str]:
    text = _SEARCH_CONVERTER.convert(text)
    for word, synonym in {'课本':'书籍','讲义':'文件','充电线':'线材'}.items():
        if word in text:
            text += ' ' + synonym
    for word, synonym in {'desk':'书桌','paper':'文件','document':'文件','book':'书籍','cable':'线材','drawer':'抽屉','wardrobe':'衣柜','closet':'衣柜','clothes':'衣物','clothing':'衣物','bag':'包包','bathroom':'浴室','kitchen':'厨房','bottle':'瓶子','shelf':'层架','sentimental':'纪念品','donate':'捐赠','recycle':'回收','towel':'毛巾'}.items():
        if re.search(r'\b'+word+r'(?:s)?\b',text,re.I):text+=' '+synonym
    tokens: List[str] = []

    for chinese_part in re.findall(r"[\u4e00-\u9fff]+", text):
        if len(chinese_part) == 1:
            tokens.append(chinese_part)
        else:
            tokens.extend(
                chinese_part[index : index + 2]
                for index in range(len(chinese_part) - 1)
            )

    tokens.extend(
        part.lower()
        for part in re.findall(r"[A-Za-z0-9]+", text)
    )

    stopwords = {'整理','收纳','怎么','么整','么收','如何','什么','办法','可以','东西','我的','我想','上有','要怎','样的','一个','我们','你们','他们'}
    return [token for token in tokens if token not in stopwords]


def _score_chunk(
    question_terms: Counter[str],
    chunk_terms: Counter[str],
    document_frequency: Counter[str],
    total_documents: int,
) -> float:
    score = 0.0

    for term, question_count in question_terms.items():
        chunk_count = chunk_terms.get(term)

        if not chunk_count:
            continue

        idf = (
            math.log(
                (total_documents + 1)
                / (document_frequency[term] + 1)
            )
            + 1.0
        )

        score += question_count * chunk_count * idf

    return score


class _SimpleRetriever:
    def __init__(
        self,
        knowledge_base: "_SimpleKnowledgeBase",
        top_k: int,
    ):
        self._knowledge_base = knowledge_base
        self._top_k = top_k

    def invoke(self, question: str) -> List[KnowledgeChunk]:
        matches = self._knowledge_base.similarity_search_with_score(
                question,
                k=self._top_k,
            )
        best = matches[0].score if matches else 0
        return [item.chunk for item in matches if item.score > 0 and item.score >= best * 0.35]


class _SimpleKnowledgeBase:
    def __init__(self, documents: List[KnowledgeChunk]):
        self._documents = documents
        self._document_terms: List[Counter[str]] = []
        self._document_frequency: Counter[str] = Counter()

        for document in documents:
            terms = Counter(
                _tokenize(
                    f"{document.metadata.get('title', '')} {document.metadata.get('keywords', '')} "
                    f"{document.page_content}"
                )
            )

            self._document_terms.append(terms)
            self._document_frequency.update(terms.keys())

    def similarity_search_with_score(
        self,
        question: str,
        k: int = 4,
    ) -> List[_ScoredChunk]:
        question_terms = Counter(_tokenize(question))

        if not question_terms:
            return []

        scored_documents = [
            _ScoredChunk(
                chunk=document,
                score=_score_chunk(
                    question_terms,
                    document_terms,
                    self._document_frequency,
                    len(self._documents),
                ) / math.sqrt(max(1, sum(document_terms.values()))),
            )
            for document, document_terms in zip(
                self._documents,
                self._document_terms,
            )
        ]

        scored_documents.sort(
            key=lambda item: item.score,
            reverse=True,
        )

        return scored_documents[:k]

    def as_retriever(
        self,
        search_kwargs: Dict[str, Any] | None = None,
    ) -> _SimpleRetriever:
        top_k = (search_kwargs or {}).get("k", 4)
        return _SimpleRetriever(self, top_k)


@lru_cache(maxsize=1)
def get_vectorstore() -> _SimpleKnowledgeBase:
    return _SimpleKnowledgeBase(build_kondo_documents())


def get_retriever(top_k: int = 4) -> _SimpleRetriever:
    return get_vectorstore().as_retriever(
        search_kwargs={"k": top_k},
    )


def retrieve_knowledge(
    question: str,
    top_k: int = 4,
    required_ids: tuple[str, ...] = (),
) -> List[Dict[str, Any]]:
    scored_documents = (
        get_vectorstore().similarity_search_with_score(
            question,
            k=len(get_vectorstore()._documents),
        )
    )
    required = [item for item in scored_documents if item.chunk.metadata.get("id") in required_ids]
    selected = required + [item for item in scored_documents if item not in required]
    scored_documents = selected[:max(top_k, len(required))]

    result: List[Dict[str, Any]] = []

    for index, scored_document in enumerate(
        scored_documents,
        start=1,
    ):
        document = scored_document.chunk

        result.append(
            {
                "title": document.metadata.get(
                    "title",
                    f"片段 {index}",
                ),
                "content": document.page_content,
                "id": document.metadata.get("id"),
                "source_url": document.metadata.get("source_url"),
                "source_type": document.metadata.get("source_type"),
                "source_label": document.metadata.get("source_label"),
                "required": document.metadata.get("id") in required_ids,
                "score": float(scored_document.score),
            }
        )

    return result


def _format_detected_items(
    detected_items: List[Dict[str, Any]] | None,
) -> str:
    if not detected_items:
        return "目前沒有提供偵測到的物品清單。"

    lines: List[str] = []

    for index, item in enumerate(
        detected_items,
        start=1,
    ):
        item_name = (
            item.get("name")
            or item.get("label")
            or item.get("item")
            or "未命名物品"
        )
        category = item.get("category") or "未分類"
        count = item.get("count", 1)
        confidence = item.get("confidence")

        confidence_text = ""

        if isinstance(confidence, (int, float)):
            confidence_text = f"，信心值：{confidence:.2f}"

        lines.append(
            f"{index}. {item_name}"
            f"｜類別：{category}"
            f"｜數量：{count}"
            f"{confidence_text}"
        )

    return "\n".join(lines)


def _normalize_chat_reply_text(text: str) -> str:
    """
    清理一般聊天回答。

    一般聊天不依賴 Markdown 標題，因此可移除裝飾符號。
    """
    normalized_lines: List[str] = []

    for line in (text or "").splitlines():
        cleaned_line = re.sub(r'[\*#>"]', "", line)
        cleaned_line = re.sub(
            r"\s+",
            " ",
            cleaned_line,
        ).strip()

        if cleaned_line:
            normalized_lines.append(cleaned_line)

    return "\n".join(normalized_lines).strip()


def _normalize_photo_reply_text(text: str) -> str:
    """
    清理照片分析回答，但保留 Markdown 標題與項目符號。

    前端會依據「### 建議採購」解析採購項目，
    因此不能刪除 #、- 等格式符號。
    """
    normalized_lines: List[str] = []

    for line in (text or "").splitlines():
        cleaned_line = line.strip()

        if not cleaned_line:
            continue

        # 移除模型偶爾加上的程式碼區塊標記。
        if cleaned_line.startswith("```"):
            continue

        # 僅壓縮行內多餘空白，不破壞 Markdown 結構。
        cleaned_line = re.sub(
            r"[ \t]+",
            " ",
            cleaned_line,
        )

        normalized_lines.append(cleaned_line)

    return "\n".join(normalized_lines).strip()


def _is_organizing_question(question: str) -> bool:
    """判斷一般聊天問題是否屬於收納整理類意圖。"""
    normalized_question = (question or "").strip()

    if not normalized_question:
        return False

    organizing_keywords = [
        "整理",
        "收納",
        "怎麼清",
        "斷捨離",
        "分類",
        "歸位",
        "擺放",
        "放哪裡",
        "怎麼放",
        "怎麼收",
        "丟掉",
        "留著",
        "起手式",
        "開始整理",
        "房間亂",
        "桌面亂",
        "衣櫃",
        "抽屜",
        "櫃子",
        "清單",
    ]

    return any(
        keyword in normalized_question
        for keyword in organizing_keywords
    )


def _answer_with_model_fallback(
    prompt_value: str,
    api_key: str,
    *,
    mode: AIRequestMode = "chat",
    max_output_tokens: int = 2000,
    temperature: float = 0.35,
    image_bytes: bytes | None = None,
    image_mime_type: str = "image/jpeg",
    json_response: bool = False,
) -> str:
    preferred_model = os.getenv(
        "GEMINI_MODEL",
        "",
    ).strip()

    models = [
        model
        for model in (
            [preferred_model]
            + DEFAULT_GEMINI_CANDIDATES
        )
        if model
    ]

    unique_models = list(dict.fromkeys(models))
    last_error: Exception | None = None

    for model_name in unique_models:
        try:
            from google.genai import types
            client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=25000, retry_options=types.HttpRetryOptions(attempts=1)))

            response = client.models.generate_content(
                model=model_name,
                contents=(
                    [prompt_value, types.Part.from_bytes(data=image_bytes, mime_type=image_mime_type)]
                    if image_bytes is not None else prompt_value
                ),
                config=types.GenerateContentConfig(
                    temperature=temperature,
                    max_output_tokens=max_output_tokens,
                    **({'response_mime_type': 'application/json'} if json_response else {}),
                ),
            )

            candidates = getattr(response, "candidates", None) or []
            if candidates and "MAX_TOKENS" in str(getattr(candidates[0], "finish_reason", "")):
                last_error = RuntimeError("Generation exceeded its output budget")
                continue

            raw_reply = (
                getattr(response, "text", None)
                or getattr(response, "content", None)
                or str(response)
            )

            if json_response:
                return str(raw_reply).strip()
            if mode == "photo_analysis":
                return _normalize_photo_reply_text(
                    str(raw_reply),
                )

            return _normalize_chat_reply_text(
                str(raw_reply),
            )

        except Exception as error:
            last_error = error
            error_text = str(error)

            retryable_model_errors = [
                "NOT_FOUND",
                "RESOURCE_EXHAUSTED",
                "PERMISSION_DENIED",
                "UNAVAILABLE",
                "ReadTimeout",
                "timed out",
                "DEADLINE_EXCEEDED",
                "INTERNAL",
            ]

            if not any(
                token in error_text
                for token in retryable_model_errors
            ):
                raise

    raise RuntimeError(
        "所有候選 Gemini 模型皆不可用，"
        f"最後錯誤：{last_error}"
    )


def _generate_chat_answer(
    bundle: Dict[str, Any],
    api_key: str,
) -> str:
    """一般聊天模式：依問題意圖選擇步驟教學或簡答 Prompt。"""
    # Let the explicit question determine the format instead of forcing steps
    # whenever a message merely mentions storage, a drawer, or a wardrobe.
    prompt_value = build_direct_answer_prompt(bundle)
    if bundle.get('language') == 'en':
        prompt_value += '\nOUTPUT LANGUAGE OVERRIDE: Answer in natural English. For organizing requests use 2-4 concise steps (around 60-100 English words total); for follow-up questions use 1-3 short sentences. Preserve internal markers such as 【選項】 only if needed. RAG references may be Chinese: use their relevant ideas but explain in English. Do not translate user names or invent facts.' 

    return _answer_with_model_fallback(
        prompt_value,
        api_key,
        mode="chat",
        max_output_tokens=2000,
        temperature=0.35,
    )


def _generate_photo_analysis_answer(
    detected_items_text: str,
    api_key: str,
    space_context: str = '', preferences_context: str = '', rag_context: str = '', language: str = 'zh-TW',
) -> str:
    """
    照片分析使用獨立 Prompt，整合可見格局、人格偏好與 RAG，保留採購段落格式。
    """
    print("目前使用：PHOTO_ANALYSIS_SYSTEM_PROMPT")

    prompt_value = build_photo_analysis_prompt(
        {
            "detected_items": detected_items_text,
            "space_context": space_context or '無法取得空間分區；不要假設格局。',
            "preferences_context": preferences_context,
            "rag_context": rag_context or '未檢索到相關資料。',
        }
    )

    if language == 'en':
        prompt_value += '\nOUTPUT LANGUAGE OVERRIDE: Write descriptions and actions in English, keeping only the structural section headings 整理步驟, 空間與動線 and 建議採購 in Chinese for the app parser. Use brief numbered steps.'
    return _answer_with_model_fallback(
        prompt_value,
        api_key,
        mode="photo_analysis",
        max_output_tokens=8192,
        temperature=0.2,
    )


def _build_chat_bundle(
    inputs: Dict[str, Any],
    top_k: int,
) -> Dict[str, Any]:
    retriever = get_retriever(top_k)

    history=inputs.get('history', [])[-8:]
    recent_questions=' '.join(turn.get('content','')[:500] for turn in history if turn.get('role')=='user')[-1000:]
    retrieved_documents = retriever.invoke(
        f"{inputs['question']} {inputs['question']} {recent_questions}",
    )

    return {
        "question": inputs["question"],
        "history": history,
        "language": inputs.get("language", "zh-TW"),
        "user_persona": inputs["user_persona"],
        "persona_focus": persona_response_focus(
            inputs["user_persona"],
        ),
        "detected_items": inputs["detected_items"],
        "context": format_documents(
            retrieved_documents,
        ),
        "retrieved_titles": [
            document.metadata.get(
                "title",
                f"片段 {index}",
            )
            for index, document in enumerate(
                retrieved_documents,
                start=1,
            )
        ],
    }


def _get_api_key() -> str:
    return get_api_key()


def get_answer_chain(
    top_k: int = 4,
    mode: AIRequestMode = "chat",
):
    """
    建立回答鏈。

    保留這個函式供舊程式使用，但新增 mode 支援。
    """
    api_key = _get_api_key()

    class _Chain:
        def invoke(
            self,
            payload: Dict[str, Any],
        ) -> Dict[str, Any]:
            if mode == "photo_analysis":
                reply = _generate_photo_analysis_answer(
                    payload["detected_items"],
                    api_key,
                )

                return {
                    "reply": reply,
                    "retrieved_titles": [],
                }

            bundle = _build_chat_bundle(
                payload,
                top_k,
            )

            return {
                "reply": _generate_chat_answer(
                    bundle,
                    api_key,
                ),
                "retrieved_titles": bundle[
                    "retrieved_titles"
                ],
            }

    return _Chain()


def answer_question(
    question: str,
    detected_items: List[Dict[str, Any]] | None = None,
    user_persona: str | None = None,
    top_k: int = 4,
    mode: AIRequestMode = "chat",
    space_analysis: Dict[str, Any] | None = None,
    storage_preferences: Dict[str, Any] | None = None,
    history: List[Dict[str, str]] | None = None,
    language: str = "zh-TW",
) -> Dict[str, Any]:
    """
    統一回答入口。

    mode="chat"
        使用人格、RAG 知識庫、步驟或簡答 Prompt。

    mode="photo_analysis"
        依空間觀察、人格偏好與 RAG 資料生成建議，最後判斷是否需要採購用品。
    """
    normalized_mode: AIRequestMode = (
        "photo_analysis"
        if mode == "photo_analysis"
        else "chat"
    )

    formatted_items = _format_detected_items(
        detected_items,
    )

    print("rag_service 收到的 mode：", mode)
    print("正規化後的 mode：", normalized_mode)

    if normalized_mode == "photo_analysis":
        import json
        # The photo pipeline uses its own prompt, with actual retrieved knowledge.
        space_text = json.dumps(space_analysis or {}, ensure_ascii=False)
        preferences = {'persona': describe_persona(user_persona), 'focus': persona_response_focus(user_persona), **(storage_preferences or {})}
        preferences_text = json.dumps(preferences, ensure_ascii=False)
        query = f"房間格局 動線 現有收納櫃 分類定位 {question} {formatted_items} {space_text} {preferences_text}"
        notice = ''
        try:
            knowledge = [item for item in retrieve_knowledge(query, min(max(top_k, 3), 6), required_ids=('category-order', 'choose-keep')) if item['score'] > 0 or item.get('required')]
        except Exception as error:
            print('Photo RAG unavailable:', type(error).__name__)
            knowledge = []
            notice = '知識庫暫時無法檢索，本次建議僅使用可見空間、物品與偏好。'
        context = '\n\n'.join(f"[{item['title']}]（{item.get('source_label') or '整理知識'}）\n{item['content']}" for item in knowledge)
        return {
            "reply": _generate_photo_analysis_answer(formatted_items, _get_api_key(), space_text, preferences_text, context, language),
            "retrieved_titles": [item['title'] for item in knowledge],
            "notice": notice,
            "retrieved_sources": [dict(title=item['title'], url=item['source_url'], source_label=item.get('source_label') or 'KonMari 官方') for item in knowledge if item.get('source_url')],
        }

    chain = get_answer_chain(
        top_k=top_k,
        mode="chat",
    )

    payload = {
        "question": question,
        "detected_items": formatted_items,
        "user_persona": describe_persona(
            user_persona,
        ),
        "context": "",
        "history": (history or [])[-8:],
        "language": language,
    }

    return chain.invoke(payload)
