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

    def test_frontend_discloses_manual_lines_and_refresh(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn('id="projection"', html)
        self.assertIn('id="fixture-select"', html)
        self.assertIn("PrizePicks lines are entered manually", html)
        self.assertIn("every six hours", html)

    @unittest.skipUnless(shutil.which("node"), "node unavailable for JS validation")
    def test_javascript_and_calculation_contracts(self):
        for filename in ("app.js", "analysis.js"):
            result = subprocess.run(["node", "--check", str(ROOT / filename)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
        result = subprocess.run(["node", "--test", str(ROOT / "tests/test_analysis.cjs")], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
