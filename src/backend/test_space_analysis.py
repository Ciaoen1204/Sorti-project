import io
import json
import unittest
from unittest.mock import patch
from PIL import Image
from fastapi.testclient import TestClient
from main import app
from schemas import SpaceAnalysis
from space_analysis import analyze_space, parse_space_analysis
from rag_service import answer_question


def scene():
    return dict(room_type='書房', summary='左側層架、右側工作桌', regions=[dict(id='r1', name='左側層架', kind='storage', polygon=[dict(x=.1,y=.1),dict(x=.4,y=.1),dict(x=.4,y=.8),dict(x=.1,y=.8)], observation='開放式層架')], storage_units=[dict(name='左側層架', region_id='r1', observation='可見兩層')], circulation=['桌前通道保持暢通'], limitations=['櫃內容量未知'])

class SpaceTest(unittest.TestCase):
    def test_polygons_reject_bad_bounds_empty_area_and_unknown_storage(self):
        for invalid in (float('nan'), -1, 2):
            data = scene(); data['regions'][0]['polygon'][0]['x'] = invalid
            with self.assertRaises(ValueError): parse_space_analysis(json.dumps(data))
        data = scene(); data['regions'][0]['polygon'] = [dict(x=.1,y=.1)]*3
        with self.assertRaises(ValueError): parse_space_analysis(json.dumps(data))
        data = scene(); data['storage_units'][0]['region_id'] = 'missing'
        with self.assertRaises(ValueError): parse_space_analysis(json.dumps(data))

    def test_overlay_is_generated_from_valid_regions(self):
        data = scene()
        for region in data['regions']: region['polygon'] = [[p['x'],p['y']] for p in region['polygon']]
        output = io.BytesIO(); Image.new('RGB',(100,100),'white').save(output,'JPEG')
        with patch('space_analysis.get_api_key',return_value='test'), patch('space_analysis._answer_with_model_fallback',return_value=json.dumps(data)):
            result = analyze_space(output.getvalue())
        self.assertTrue(result.overlay_uri.startswith('data:image/jpeg;base64,'))
        self.assertEqual(result.regions[0].name,'左側層架')

    def test_space_runs_before_both_object_models(self):
        order=[]
        with patch('main.prepare_image',return_value=b'image'), patch('main.analyze_space',side_effect=lambda _: (order.append('space'),SpaceAnalysis(**scene()))[1]), patch('main.detect_items',side_effect=lambda _: (order.append('model'),dict(detection_boxes=[],model_name='test'))[1]), patch('main.detect_with_gemini',side_effect=lambda _: (order.append('objects'),[])[1]):
            response=TestClient(app).post('/detect-items',files={'image':('photo.jpg',b'image','image/jpeg')})
        self.assertEqual(response.status_code,200)
        self.assertEqual(order,['space','model','objects'])
        self.assertEqual(response.json()['space_status'],'completed')
        self.assertEqual(response.json()['space_analysis']['storage_units'][0]['name'],'左側層架')

    def test_photo_rag_uses_layout_preferences_and_real_source_titles(self):
        knowledge=[dict(title='定位法則',content='常用物放在順手位置',score=1)]
        with patch('rag_service.retrieve_knowledge',return_value=knowledge) as retrieval, patch('rag_service._get_api_key',return_value='test'), patch('rag_service._answer_with_model_fallback',return_value='建議') as model:
            result=answer_question('如何整理',detected_items=[dict(name='書',category='書籍',count=2)], user_persona='首席秩序官',mode='photo_analysis',space_analysis=scene(),storage_preferences=dict(visual_preference='minimal',detail_preference='detailed',notes='不能鑽牆'))
        query=retrieval.call_args.args[0]
        prompt=model.call_args.args[0]
        for text in ['左側層架','不能鑽牆','書籍','首席秩序官']: self.assertIn(text,query)
        for text in ['定位法則','常用物放在順手位置','左側層架','不能鑽牆','首席秩序官']: self.assertIn(text,prompt)
        self.assertEqual(result['retrieved_titles'],['定位法則'])

    def test_rag_failure_does_not_claim_sources(self):
        with patch('rag_service.retrieve_knowledge',side_effect=RuntimeError('private')), patch('rag_service._get_api_key',return_value='test'), patch('rag_service._answer_with_model_fallback',return_value='建議'):
            result=answer_question('如何整理',mode='photo_analysis')
        self.assertEqual(result['retrieved_titles'],[])
        self.assertIn('暫時無法檢索',result['notice'])

if __name__ == '__main__': unittest.main()
