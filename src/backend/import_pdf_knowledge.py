"""Build a backend-only, page-traceable index from a user supplied PDF."""
from __future__ import annotations
import argparse, hashlib, json, re
from pathlib import Path
from pypdf import PdfReader
from opencc import OpenCC
from knowledge_base import _split_text

def parse_pages(spec: str, total: int) -> list[int]:
    result = set()
    for part in spec.split(','):
        limits = [int(v) for v in part.split('-')]
        start, end = limits[0], limits[-1]
        if not 1 <= start <= end <= total:
            raise ValueError('Page range outside PDF')
        result.update(range(start, end + 1))
    return sorted(result)

def import_pdf(source: Path, output: Path, pages: str, title: str) -> dict:
    reader=PdfReader(source)
    converter=OpenCC('s2twp')
    selected=parse_pages(pages,len(reader.pages))
    sections=[]
    current=None
    for page_number in selected:
        lines=[converter.convert(re.sub(r'\s+', ' ', line).strip()) for line in (reader.pages[page_number-1].extract_text() or '').splitlines() if line.strip()]
        if not lines: continue
        heading=re.match(r'^([1-5]\.\d+\.)\s*(.*)$',lines[0])
        new_section=heading is not None or lines[0].startswith('結語') or current is None
        if new_section:
            heading_text=(heading[1]+' '+(heading[2] or (lines[1] if len(lines)>1 else ''))) if heading else lines[0]
            current={'title':heading_text,'parts':[]}
            sections.append(current)
            if heading: lines=lines[1 if heading[2] else 2:]
            else: lines=lines[1:]
        # PDF line wrapping is not a paragraph boundary in this edition.
        text=''.join(lines)
        text=re.sub(r'¤(?:\s*¤)*','',text).strip()
        if text: current['parts'].append((page_number,text))
    records=[]
    for section in sections:
        combined='';spans=[]
        for page,text in section['parts']:
            start=len(combined);combined+=text+'\n';spans.append((start,len(combined),page))
        cursor=0
        for content in _split_text(combined,650,90,['\n','。','；','，']):
            offset=combined.find(content,cursor)
            if offset<0: raise ValueError('Cannot map chunk to PDF pages')
            end=offset+len(content)
            chunk_pages=[page for start,stop,page in spans if start<end and stop>offset]
            first,last=min(chunk_pages),max(chunk_pages)
            records.append({'id':f'user-book-{len(records)+1:04d}','title':f'{title}｜{section["title"]}（PDF {first}–{last} 頁）','content':content,'source_type':'user_pdf','source_url':None,'source_label':'使用者提供書籍 PDF','pdf_page_start':first,'pdf_page_end':last,'section':section['title']})
            cursor=max(offset+1,end-110)
    if not records: raise ValueError('No readable body text')
    payload={'title':title,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'pdf_pages':len(reader.pages),'included_pages':selected,'coverage':'僅包含選定的實際正文頁；非完整全書。','records':records}
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
    return {'pdf_pages':len(reader.pages),'body_pages':len(selected),'sections':len(sections),'chunks':len(records),'characters':sum(len(r['content']) for r in records)}

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('source',type=Path)
    parser.add_argument('--output',type=Path,default=Path(__file__).parent/'rag_data'/'user_book.json')
    parser.add_argument('--pages',required=True)
    parser.add_argument('--title',required=True)
    args=parser.parse_args()
    print(json.dumps(import_pdf(args.source,args.output,args.pages,args.title),ensure_ascii=True))
