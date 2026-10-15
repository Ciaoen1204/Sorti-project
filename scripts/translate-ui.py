"""Translate reviewed UI-only strings with the user's explicit authorization."""
import json,sys,time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'src/backend'))
from google import genai
from google.genai import types
from gemini_config import get_api_key
source=json.loads((root/'pwa-runtime/ui-strings.json').read_text(encoding='utf-8'))
output=root/'src/i18n/en.json';output.parent.mkdir(parents=True,exist_ok=True)
existing=json.loads(output.read_text(encoding='utf-8')) if output.exists() else {}
missing=[s for s in source if s not in existing]
batches=[missing[i:i+40] for i in range(0,len(missing),40)]
key=get_api_key()
def translate(batch):
    prompt='Translate these Traditional Chinese UI strings into natural concise English for 拾序, a home organizing app. Return only a JSON array of strings in EXACT input order, same count. Keep numbers, literal escapes, placeholder markers, punctuation used for interpolation, and brand 拾序. Some inputs are fragments; translate fragments without adding missing context. Do not add explanations or markdown. Data: '+json.dumps(batch,ensure_ascii=False)
    for attempt in range(3):
        try:
            with genai.Client(api_key=key,http_options=types.HttpOptions(timeout=30000,retry_options=types.HttpRetryOptions(attempts=1))) as client:
                r=client.models.generate_content(model='gemini-3.5-flash-lite',contents=prompt,config=types.GenerateContentConfig(response_mime_type='application/json',max_output_tokens=8192,temperature=0.1))
            result=json.loads(r.text)
            if not isinstance(result,list) or len(result)!=len(batch) or not all(isinstance(x,str) and x.strip() for x in result):raise ValueError('Invalid translation count/type')
            return dict(zip(batch,result))
        except Exception as e:
            if attempt==2:raise RuntimeError(f'{type(e).__name__} code={getattr(e,"code",None)}') from None
            time.sleep(1+attempt)
with ThreadPoolExecutor(max_workers=1) as pool:
    jobs=[pool.submit(translate,b) for b in batches]
    for i,job in enumerate(as_completed(jobs),1):
        existing.update(job.result());output.write_text(json.dumps(existing,ensure_ascii=False,indent=2,sort_keys=True),encoding='utf-8');print(f'Batches {i}/{len(jobs)}; strings {len(existing)}/{len(source)}',flush=True)
