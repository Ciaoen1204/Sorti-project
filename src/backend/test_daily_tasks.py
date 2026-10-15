import unittest
from datetime import date, timedelta
from unittest.mock import patch

import daily_tasks


class DailyTasksTests(unittest.TestCase):
    def setUp(self):
        daily_tasks._tasks.clear()

    def test_future_and_past_dates_never_call_gemini(self):
        today = daily_tasks.taipei_today()
        with patch.object(daily_tasks, "_answer_with_model_fallback") as generate:
            for offset in (-1, 1):
                with self.assertRaises(ValueError):
                    daily_tasks.generate_daily_task(today + timedelta(days=offset))
            generate.assert_not_called()

    def test_same_day_uses_cached_task(self):
        with patch.object(daily_tasks, "_get_api_key", return_value="test"), patch.object(
            daily_tasks, "_answer_with_model_fallback", return_value="整理桌面，完成後拍照打卡。\n整理抽屜，完成後拍照打卡。\n整理鞋櫃，完成後拍照打卡。"
        ) as generate:
            day = daily_tasks.taipei_today()
            self.assertEqual(daily_tasks.generate_daily_task(day), daily_tasks.generate_daily_task(day))
            generate.assert_called_once()

    def test_bad_output_is_not_cached(self):
        with patch.object(daily_tasks, "_get_api_key", return_value="test"), patch.object(
            daily_tasks, "_answer_with_model_fallback", return_value="x" * 101
        ):
            with self.assertRaises(RuntimeError):
                daily_tasks.generate_daily_task(daily_tasks.taipei_today())
            self.assertEqual(daily_tasks._tasks, {})

    def test_task_generated_across_midnight_is_rejected(self):
        day = date(2026, 10, 9)
        with patch.object(daily_tasks, "taipei_today", side_effect=[day, day + timedelta(days=1)]), patch.object(
            daily_tasks, "_get_api_key", return_value="test"
        ), patch.object(daily_tasks, "_answer_with_model_fallback", return_value="整理桌面。\n整理抽屜。\n整理鞋櫃。"):
            with self.assertRaises(ValueError):
                daily_tasks.generate_daily_task(day)
            self.assertEqual(daily_tasks._tasks, {})

    def test_duplicate_choices_are_rejected(self):
        with patch.object(daily_tasks, "_get_api_key", return_value="test"), patch.object(
            daily_tasks, "_answer_with_model_fallback", return_value="整理桌面。\n整理桌面。\n整理鞋櫃。"
        ):
            with self.assertRaises(RuntimeError):
                daily_tasks.generate_daily_task(daily_tasks.taipei_today())

    def test_feedback_sends_photo_and_selected_task_to_gemini(self):
        with patch.object(daily_tasks, "_get_api_key", return_value="test"), patch.object(
            daily_tasks, "_answer_with_model_fallback", return_value="桌面物品擺放整齊，做得很好！"
        ) as generate:
            feedback = daily_tasks.generate_task_feedback("整理桌面。", b"photo", "image/jpeg")
            self.assertIn("整齊", feedback)
            self.assertIn("整理桌面", generate.call_args.args[0])
            self.assertEqual(generate.call_args.kwargs["image_bytes"], b"photo")


if __name__ == "__main__":
    unittest.main()
