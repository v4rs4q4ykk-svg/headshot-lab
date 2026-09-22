import unittest

from headshot_lab import analyze, match_totals


TOTALS = [19, 15, 23, 19, 14, 23, 19, 16, 23, 20]


def fixture():
    rows = []
    for i, total in enumerate(TOTALS):
        for map_number, headshots in ((1, total // 2), (2, total - total // 2)):
            rows.append({
                "match_id": f"match-{i:02d}",
                "player_id": "player-a",
                "played_at": f"2026-09-{20-i:02d}T18:00:00Z",
                "map_number": map_number,
                "headshots": headshots,
                "completed": True,
            })
    return rows


class HeadshotLabTests(unittest.TestCase):
    def test_last_ten_example(self):
        result = analyze(fixture(), "player-a", 17.5)
        last_ten = result["windows"]["10"]
        self.assertEqual([m["headshots"] for m in result["matches"]], TOTALS)
        self.assertEqual(last_ten["overs"], 7)
        self.assertEqual(last_ten["unders"], 3)
        self.assertEqual(last_ten["pushes"], 0)
        self.assertEqual(last_ten["average"], 19.1)
        self.assertEqual(last_ten["over_pct"], 70.0)
        self.assertEqual(result["windows"]["15"]["status"], "insufficient_data")
        self.assertEqual(result["windows"]["20"]["status"], "insufficient_data")

    def test_only_maps_one_and_two(self):
        rows = fixture()
        rows.append({**rows[0], "map_number": 3, "headshots": 999})
        self.assertEqual(match_totals(rows, "player-a")[0]["headshots"], 19)

    def test_missing_map_not_zero(self):
        rows = fixture()
        rows = [r for r in rows if not (r["match_id"] == "match-00" and r["map_number"] == 2)]
        result = analyze(rows, "player-a", 17.5)
        self.assertEqual(result["complete_matches"], 9)
        self.assertEqual(result["windows"]["10"]["status"], "insufficient_data")

    def test_unfinished_match_ignored(self):
        rows = fixture()
        rows[0]["completed"] = False
        self.assertEqual(len(match_totals(rows, "player-a")), 9)

    def test_push_is_not_over(self):
        result = analyze(fixture(), "player-a", 19)
        self.assertEqual(result["windows"]["10"]["pushes"], 3)
        self.assertEqual(result["windows"]["10"]["overs"], 4)

    def test_no_mixing_players(self):
        rows = fixture()
        rows.extend({**r, "player_id": "player-b", "headshots": 99} for r in fixture())
        self.assertEqual(analyze(rows, "player-a", 17.5)["windows"]["10"]["overs"], 7)

    def test_duplicate_record_rejected(self):
        rows = fixture()
        rows.append(dict(rows[0]))
        with self.assertRaisesRegex(ValueError, "duplicate map"):
            match_totals(rows, "player-a")

    def test_bad_headshots_rejected(self):
        rows = fixture()
        rows[0]["headshots"] = None
        with self.assertRaisesRegex(ValueError, "nonnegative integer"):
            match_totals(rows, "player-a")

    def test_bad_projection_rejected(self):
        with self.assertRaises(ValueError):
            analyze(fixture(), "player-a", "n/a")


if __name__ == "__main__":
    unittest.main()
