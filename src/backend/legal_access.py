"""Server-side consent check. Uses the caller JWT and publishable key, never admin credentials."""
import os
from pathlib import Path
from urllib.request import Request, urlopen
import json
from dotenv import dotenv_values
from starlette.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

def verify_consent(authorization):
    if not authorization or not authorization.startswith("Bearer "):
        return False
    env = dotenv_values(Path(__file__).resolve().parents[2] / ".env")
    url = os.getenv("SUPABASE_URL") or env.get("SUPABASE_URL")
    key = os.getenv("SUPABASE_PUBLISHABLE_KEY") or env.get("SUPABASE_PUBLISHABLE_KEY")
    if not url or not key:
        return False
    try:
        req = Request(url.rstrip("/") + "/rest/v1/rpc/has_current_legal_acceptance",data=b"{}",headers={"Authorization":authorization,"apikey":key,"Content-Type":"application/json"},method="POST")
        with urlopen(req,timeout=12) as response:
            return json.load(response) is True
    except Exception:
        return False

async def legal_access(request,call_next):
    if request.method != "OPTIONS" and request.url.path not in ("/",):
        accepted=await run_in_threadpool(verify_consent,request.headers.get("authorization"))
        if not accepted:
            return JSONResponse({"detail":"請先登入並完成政策確認；無法讀取確認紀錄時不開放服務。"},status_code=403)
    return await call_next(request)
