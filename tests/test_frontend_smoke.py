import json
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class FrontendSmokeTests(unittest.TestCase):
    def test_board_snapshot_is_explicitly_not_live(self):
        snapshot = json.loads((ROOT / "data/board_snapshot.json").read_text(encoding="utf-8"))
        self.assertEqual(snapshot["kind"], "manually_captured_board_snapshot")
        self.assertIs(snapshot["live_data_connected"], False)
        self.assertIs(snapshot["prizepicks_live_connected"], False)
        self.assertEqual(snapshot["observed_date"], "2026-09-22")
        phoebe = [p for p in snapshot["players"] if p["name"] == "phoebe"]
        self.assertEqual(len(phoebe), 1)
        self.assertEqual(phoebe[0]["team"], "Mindfreak")
        self.assertEqual(phoebe[0]["line"], 14)
        self.assertEqual(phoebe[0]["hl_tv_player_id"], 23613)

    def test_frontend_contains_separate_snapshot_and_live_sections(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn('id="board-search"', html)
        self.assertIn('id="board-players"', html)
        self.assertIn('id="search"', html)
        self.assertIn("manually_captured_board_snapshot", html)
        self.assertIn("NO LIVE FEED", html)

    @unittest.skipUnless(shutil.which("node"), "node unavailable for JS syntax test")
    def test_inline_javascript_syntax(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        scripts = re.findall(r"<script\b[^>]*>(.*?)</script\s*>", html, flags=re.I | re.S)
        self.assertTrue(scripts, "expected an inline dashboard script")
        for script in scripts:
            with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8") as temp:
                temp.write(script)
                temp.flush()
                result = subprocess.run(["node", "--check", temp.name],
                                        capture_output=True, text=True, check=False)
                self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
