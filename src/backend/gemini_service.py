from gemini_config import get_api_key
from rag_service import _answer_with_model_fallback


def generate_reply(prompt: str) -> str:
    return _answer_with_model_fallback(prompt, get_api_key())
