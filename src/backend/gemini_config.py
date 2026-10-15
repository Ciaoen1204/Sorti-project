import os
from pathlib import Path
from dotenv import load_dotenv

# All Gemini features use the same backend-only key.
load_dotenv(Path(__file__).resolve().parent / ".env", override=True)


def get_api_key() -> str:
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not key:
        raise ValueError("請在 src/backend/.env 設定 GEMINI_API_KEY。")
    return key.strip()
