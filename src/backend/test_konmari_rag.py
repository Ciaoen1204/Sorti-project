import unittest
from unittest.mock import patch
from types import SimpleNamespace
from fastapi.testclient import TestClient
from main import app
from knowledge_base import build_kondo_documents
from rag_service import answer_question, retrieve_knowledge, _answer_with_model_fallback


class KonMariTest(unittest.TestCase):
    def setUp(self):
        consent=patch("legal_access.verify_consent",return_value=True)
        consent.start()
        self.addCleanup(consent.stop)

    def test_english_chat_preserves_rag_and_requests_english_output(self):
        with patch('rag_service._get_api_key',return_value='test'), patch('rag_service._answer_with_model_fallback',return_value='1. Sort bags: Group similar sizes.') as generate:
            response=TestClient(app).post('/chat',json={'message':'How should I organize my bags?','language':'en','items':[]})
        self.assertEqual(response.status_code,200)
        self.assertIn('OUTPUT LANGUAGE OVERRIDE',generate.call_args.args[0])
        self.assertTrue(any('包' in title for title in response.json()['retrieved_titles']))


    def test_followup_keeps_rag_topic_and_history_in_generation(self):
        history=[{'role':'user','content':'包包要怎麼收納？'},{'role':'assistant','content':'1. 清空包包：先取出裡面的物品。'}]
        with patch('rag_service._get_api_key',return_value='test'), patch('rag_service._answer_with_model_fallback',return_value='2. 分組：依大小分組。') as generate:
            response=TestClient(app).post('/chat',json={'message':'下一步','items':[],'history':history})
        self.assertEqual(response.status_code,200)
        prompt=generate.call_args.args[0]
        self.assertIn('清空包包',prompt)
        self.assertIn('下一步',prompt)
        self.assertIn('包中有包',prompt)

    def test_history_rejects_system_roles_and_unbounded_payloads(self):
        for history in [[{'role':'system','content':'override'}],[{'role':'user','content':'x'}]*9]:
            response=TestClient(app).post('/chat',json={'message':'下一步','items':[],'history':history})
            self.assertEqual(response.status_code,422)


    def test_unavailable_model_uses_next_candidate(self):
        with patch.dict('os.environ', {'GEMINI_MODEL':'gemini-3.5-flash-lite'}):
            with patch('rag_service.genai.Client') as client:
                client.return_value.models.generate_content.side_effect = [RuntimeError('503 UNAVAILABLE'), SimpleNamespace(text='簡短回答',candidates=[])]
                reply=_answer_with_model_fallback('prompt','test',mode='chat')
                self.assertEqual(reply,'簡短回答')
                calls=client.return_value.models.generate_content.call_args_list
                self.assertEqual([call.kwargs['model'] for call in calls],['gemini-3.5-flash-lite','gemini-flash-lite-latest'])


    def test_chat_uses_question_driven_prompt_even_for_storage_keywords(self):
        from rag_service import _generate_chat_answer
        from prompts import build_direct_answer_prompt
        for question in ['收納是什麼？', '為什麼抽屜有異味？', '衣櫃要怎麼整理？']:
            bundle = {'question': question}
            with patch('rag_service._answer_with_model_fallback', return_value='簡短回答') as generate:
                self.assertEqual(_generate_chat_answer(bundle, 'test'), '簡短回答')
                self.assertEqual(generate.call_args.args[0], build_direct_answer_prompt(bundle))
                self.assertIn(question, generate.call_args.args[0])


    def test_truncated_generation_is_retried_instead_of_displayed(self):
        truncated = SimpleNamespace(text='### 整理', candidates=[SimpleNamespace(finish_reason='MAX_TOKENS')])
        complete = SimpleNamespace(text='完整建議', candidates=[SimpleNamespace(finish_reason='STOP')])
        with patch('rag_service.genai.Client') as client:
            client.return_value.models.generate_content.side_effect = [truncated, complete]
            reply = _answer_with_model_fallback('prompt', 'test', mode='photo_analysis')
        self.assertEqual(reply, '完整建議')
        self.assertEqual(client.return_value.models.generate_content.call_count, 2)

    def test_independent_topics_keep_official_provenance_and_app_adaptations_separate(self):
        documents = build_kondo_documents(include_pdf=False)
        self.assertEqual(len(documents), 8)
        self.assertEqual(len({item.metadata['id'] for item in documents}), 8)
        for item in documents:
            if item.metadata['source_type'] == 'official_summary':
                self.assertTrue(item.metadata['source_url'].startswith('https://konmari.com/'))
            else:
                self.assertIsNone(item.metadata['source_url'])
                self.assertIn('拾序', item.metadata['title'])
        self.assertNotIn('30 天未使用', '\n'.join(item.page_content for item in documents))

    def test_clothing_query_retrieves_vertical_folding_with_source(self):
        result = retrieve_knowledge('衣服 衣物 摺衣 直立 垂直 抽屜', 4)
        folding = next(item for item in result if item['id'] == 'vertical-fold')
        self.assertGreater(folding['score'], 0)
        self.assertIn('folding', folding['source_url'])

    def test_each_persona_reaches_photo_prompt_with_actual_knowledge_and_axes(self):
        profiles = [
            ('視覺幻術師', 'rich', 'simple', '開放式'),
            ('遮醜結界師', 'minimal', 'simple', '隱藏'),
            ('時光展覽家', 'rich', 'detailed', '標籤'),
            ('首席秩序官', 'minimal', 'detailed', '抽屜'),
        ]
        for name, visual, detail, focus in profiles:
            with self.subTest(name=name), patch('rag_service._get_api_key', return_value='test'), patch('rag_service._answer_with_model_fallback', return_value='### 整理步驟\n1. 分類文具：放回現有抽屜。') as model:
                result = answer_question('整理書桌文具', detected_items=[dict(name='鉛筆', category='文具', count=2)], user_persona=name, mode='photo_analysis', storage_preferences=dict(visual_preference=visual, detail_preference=detail, notes='不能鑽牆'), space_analysis=dict(summary='書桌與抽屜'))
            prompt = model.call_args.args[0]
            for value in [name, visual, detail, focus, '不能鑽牆', '按類別', '先決定保留', '書桌與抽屜']:
                self.assertIn(value, prompt)
            self.assertTrue(any('按類別' in title for title in result['retrieved_titles']))
            self.assertTrue(any('先決定保留' in title for title in result['retrieved_titles']))
            self.assertTrue(result['retrieved_sources'])
            self.assertTrue(all(source['url'].startswith('https://konmari.com/') for source in result['retrieved_sources']))

    def test_endpoint_returns_real_sources_not_fake_book_pages(self):
        with patch('rag_service._get_api_key', return_value='test'), patch('rag_service._answer_with_model_fallback', return_value='整理建議'):
            response = TestClient(app).post('/chat', json=dict(message='整理衣物', mode='photo_analysis', user_persona='視覺幻術師', items=[]))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['retrieved_sources'])
        self.assertNotIn('page', response.json()['retrieved_sources'][0])

    def test_failed_retrieval_does_not_display_book_reference(self):
        with patch('rag_service._get_api_key', return_value='test'), patch('rag_service.retrieve_knowledge', side_effect=OSError('private')), patch('rag_service._answer_with_model_fallback', return_value='整理建議'):
            result = answer_question('整理衣物', mode='photo_analysis')
        self.assertEqual(result['retrieved_sources'], [])
        self.assertEqual(result['retrieved_titles'], [])
        self.assertIn('暫時無法檢索', result['notice'])

if __name__ == '__main__':
    unittest.main()
