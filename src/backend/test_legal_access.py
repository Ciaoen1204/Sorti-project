import unittest
from unittest.mock import patch,MagicMock
from fastapi.testclient import TestClient
import main
from legal_access import verify_consent
class LegalAccessTests(unittest.TestCase):
 def test_missing_identity_fails_closed(self):
  self.assertFalse(verify_consent(None))
  with patch('main.answer_question') as ai:
   self.assertEqual(TestClient(main.app).post('/chat',json={'message':'test'}).status_code,403)
   ai.assert_not_called()
 def test_upstream_failure_fails_closed(self):
  with patch('legal_access.urlopen',side_effect=OSError('offline')):
   self.assertFalse(verify_consent('Bearer test'))
 def test_unconfirmed_user_cannot_call_ai(self):
  with patch('legal_access.verify_consent',return_value=False),patch('main.generate_daily_task') as ai:
   self.assertEqual(TestClient(main.app).post('/daily-task',json={'date':'2026-10-15'}).status_code,403)
   ai.assert_not_called()
if __name__=='__main__':unittest.main()
