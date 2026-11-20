import json
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app
from vision_detection import parse_vision_boxes, merge_detections, detect_with_gemini

def box(name, x=0, width=.4):
    return dict(name=name, category='用品', x=x, y=0, width=width, height=.5)

class VisionDetectionTest(unittest.TestCase):
    def test_invalid_output_retries_once_with_schema(self):
        valid = json.dumps([dict(name='cup', category='items', box_2d=[0, 0, 100, 100])])
        with patch('vision_detection.get_api_key', return_value='test'), patch('vision_detection._answer_with_model_fallback', side_effect=['broken', valid]) as model:
            self.assertEqual(len(detect_with_gemini(b'image')), 1)
        self.assertEqual(model.call_count, 2)
        self.assertIn('response_schema', model.call_args.kwargs)

    def test_repeated_invalid_output_fails_instead_of_empty_success(self):
        with patch('vision_detection.get_api_key', return_value='test'), patch('vision_detection._answer_with_model_fallback', return_value='broken') as model:
            with self.assertRaises(ValueError): detect_with_gemini(b'image')
        self.assertEqual(model.call_count, 2)

    def test_coordinates_and_no_invented_confidence(self):
        result = parse_vision_boxes(json.dumps([dict(name='木製盒', category='收納用品', box_2d=[100, 200, 500, 600])]))[0]
        self.assertEqual(result['source'], 'gemini')
        self.assertAlmostEqual(result['x'], .2)
        self.assertAlmostEqual(result['height'], .4)
        self.assertNotIn('confidence', result)

    def test_duplicates_rename_without_double_count_and_keep_separate_objects(self):
        model = dict(detection_boxes=[box('廚房用品')], model_name='best.pt')
        result = merge_detections(model, [box('木製盒'), box('木製盒', x=.6), box('木製盒', x=.6)])
        self.assertEqual(result['total_detections'], 2)
        self.assertEqual(result['detected_items'][0]['count'], 2)
        self.assertEqual(result['detection_boxes'][0]['source'], 'combined')
        self.assertEqual(result['detection_boxes'][1]['source'], 'gemini')

    def test_small_object_inside_container_is_not_discarded(self):
        result = merge_detections(dict(detection_boxes=[box('盒子', width=.8)]), [dict(box('小物', width=.1), height=.1)])
        self.assertEqual(result['total_detections'], 2)

    def test_bad_ai_boxes_rejected_and_model_only_fallback(self):
        for coordinates in ([1, 2, 0, 0], [0, float('nan'), 100, 100], [True, 0, 100, 100]):
            with self.assertRaises(ValueError):
                parse_vision_boxes(json.dumps([dict(name='物品', category='用品', box_2d=coordinates)]))
        result = merge_detections(dict(detection_boxes=[box('桌子')]), [])
        self.assertEqual(result['total_detections'], 1)
        self.assertEqual(result['detection_boxes'][0]['source'], 'model')

class HybridEndpointTest(unittest.TestCase):
    def setUp(self):
        consent = patch('legal_access.verify_consent', return_value=True)
        consent.start()
        self.addCleanup(consent.stop)
        patcher = patch('main.analyze_space', side_effect=RuntimeError('space unavailable'))
        patcher.start()
        self.addCleanup(patcher.stop)

    def request(self):
        return TestClient(app).post('/detect-items', files={'image': ('photo.jpg', b'image', 'image/jpeg')})

    @patch('main.prepare_image', return_value=b'image')
    @patch('main.detect_items', return_value={'detection_boxes': [box('桌子')], 'model_name': 'best.pt'})
    @patch('main.detect_with_gemini', side_effect=RuntimeError('private provider details'))
    def test_ai_unavailable_keeps_model(self, *mocks):
        response = self.request()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['ai_status'], 'unavailable')
        self.assertEqual(response.json()['total_detections'], 1)
        self.assertNotIn('private provider details', response.text)

    @patch('main.prepare_image', return_value=b'image')
    @patch('main.detect_items', side_effect=RuntimeError('model failed'))
    @patch('main.detect_with_gemini', return_value=[box('杯子')])
    def test_model_unavailable_ai_still_works(self, *mocks):
        response = self.request()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['ai_status'], 'completed')
        self.assertEqual(response.json()['detection_boxes'][0]['source'], 'gemini')

    @patch('main.prepare_image', return_value=b'image')
    @patch('main.detect_items', side_effect=RuntimeError('model failed'))
    @patch('main.detect_with_gemini', side_effect=RuntimeError('private provider details'))
    def test_both_fail_do_not_claim_empty_success(self, *mocks):
        response = self.request()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private provider details', response.text)

if __name__ == '__main__':
    unittest.main()
