"""Verify the shared legal body against the supplied original PDFs (no rewriting)."""
import json,re,hashlib,sys
from pathlib import Path
from pypdf import PdfReader
root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]) if len(sys.argv)>1 else Path.home()/"Downloads"
docs=json.loads((root/"src/data/legalPolicies.json").read_text(encoding="utf8"))
normalize=lambda s:re.sub(r"\s","",s)
for kind,title in [("terms","服務條款"),("privacy","隱私權政策")]:
 pdf=source/f"拾序_{title}_v1.1.pdf"
 assert hashlib.sha256(pdf.read_bytes()).hexdigest()==docs[kind]["sourceSha256"]
 lines=[]
 for page in PdfReader(pdf).pages:
  for line in page.extract_text().splitlines():
   text=line.strip()
   if not text or re.fullmatch(r"\d+",text) or re.fullmatch(r"拾序\s*｜\s*"+title+r"\s*｜\s*v1.1",text):continue
   lines.append(text)
 body="\n".join(docs[kind]["blocks"])
 assert normalize("".join(lines))==normalize(body)
 assert "\ufffd" not in body
 urls=re.findall(r"https?://[^\s，。；）]+",body)
 assert urls==docs[kind]["links"]
 print(kind,"PASS: original hash, complete body, no replacement glyph, exact PDF hyperlink URLs")
