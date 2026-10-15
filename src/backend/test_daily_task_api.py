import unittest
from datetime import timedelta
from unittest.mock import patch

from fastapi.testclient import TestClient
import main
from daily_tasks import taipei_today


class DailyTaskApiTests(unittest.TestCase):
    def setUp(self):
        consent = patch("legal_access.verify_consent",return_value=True)
        consent.start()
        self.addCleanup(consent.stop)
        self.client = TestClient(main.app)
        self.today = taipei_today().isoformat()

    def test_english_language_is_forwarded_to_task_generation(self):
        with patch.object(main,'generate_daily_task',return_value=['Clear one shelf.','Sort pens.','Pair socks.']) as generate:
            response=self.client.post('/daily-task',json={'date':self.today,'language':'en'})
        self.assertEqual(response.status_code,200)
        self.assertEqual(generate.call_args.args[1],'en')

    def test_returns_three_tasks(self):
        tasks = ["整理桌面。", "整理鞋櫃。", "整理抽屜。"]
        with patch.object(main, "generate_daily_task", return_value=tasks):
            response = self.client.post("/daily-task", json={"date": self.today})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["tasks"], tasks)

    def test_photo_feedback_uses_selected_task(self):
        with patch.object(main, "generate_task_feedback", return_value="桌面很整齊！") as feedback:
            response = self.client.post("/daily-task/feedback", data={"date": self.today, "task": "整理桌面。"},
                                        files={"image": ("photo.jpg", b"photo", "image/jpeg")})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["feedback"], "桌面很整齊！")
            feedback.assert_called_once_with("整理桌面。", b"photo", "image/jpeg")

    def test_future_feedback_does_not_call_gemini(self):
        with patch.object(main, "generate_task_feedback") as feedback:
            response = self.client.post("/daily-task/feedback", data={"date": (taipei_today() + timedelta(days=1)).isoformat(), "task": "整理桌面。"},
                                        files={"image": ("photo.jpg", b"photo", "image/jpeg")})
            self.assertEqual(response.status_code, 400)
            feedback.assert_not_called()

    def test_non_image_is_rejected(self):
        with patch.object(main, "generate_task_feedback") as feedback:
            response = self.client.post("/daily-task/feedback", data={"date": self.today, "task": "整理桌面。"},
                                        files={"image": ("file.txt", b"text", "text/plain")})
            self.assertEqual(response.status_code, 415)
            feedback.assert_not_called()


if __name__ == "__main__":
    unittest.main()
