from google import genai
from gemini_config import get_api_key

if __name__ == "__main__":
    try:
        client = genai.Client(api_key=get_api_key())
        for model in client.models.list():
            print(model.name)
    except Exception as error:
        print("模型查詢失敗：", type(error).__name__)
