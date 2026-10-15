import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from import_pdf_knowledge import import_pdf, parse_pages
from knowledge_base import KnowledgeChunk, load_pdf_documents
from rag_service import _SimpleKnowledgeBase, _tokenize

class PdfKnowledgeTest(unittest.TestCase):
    def test_selected_body_pages_only_and_traceable_chunks(self):
        pages=[SimpleNamespace(extract_text=lambda:'掃碼廣告'),SimpleNamespace(extract_text=lambda:'4.8.\n包包收納\n依包包大小套放，保留可見的提把。'),SimpleNamespace(extract_text=lambda:'同一組包包不要套太多層。')]
        with tempfile.TemporaryDirectory() as directory:
            source=Path(directory)/'input.pdf';source.write_bytes(b'test-source')
            output=Path(directory)/'index.json'
            with patch('import_pdf_knowledge.PdfReader',return_value=SimpleNamespace(pages=pages)):
                report=import_pdf(source,output,'2-3','測試書籍')
            records=load_pdf_documents(output)
            self.assertEqual(report['body_pages'],2)
            self.assertEqual(records[0].metadata['pdf_page_start'],2)
            self.assertEqual(records[-1].metadata['pdf_page_end'],3)
            self.assertNotIn('掃碼廣告',''.join(r.page_content for r in records))
            self.assertIn('包包',records[0].page_content)
            self.assertEqual(records[0].metadata['source_type'],'user_pdf')

    def test_invalid_page_ranges_fail(self):
        for pages in ['0','5-3','1-9']:
            with self.assertRaises(ValueError):parse_pages(pages,4)

    def test_simplified_and_traditional_queries_match(self):
        self.assertEqual(_tokenize('抽屜與包包'),_tokenize('抽屉与包包'))

    def test_unrelated_chunks_do_not_fill_retrieval_slots(self):
        store=_SimpleKnowledgeBase([KnowledgeChunk('包包依大小套放',{'title':'包包收納'}),KnowledgeChunk('毛巾直立摺放',{'title':'衣物摺放'})])
        results=store.as_retriever().invoke('包包怎麼收？')
        self.assertEqual(len(results),1)
        self.assertIn('包包',results[0].page_content)
        self.assertEqual(store.as_retriever().invoke('火星軌道'),[])

if __name__=='__main__':unittest.main()
