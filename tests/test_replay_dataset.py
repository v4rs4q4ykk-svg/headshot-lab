import unittest

from replay_dataset import normalize_map
from headshot_lab import analyze


def source_row(match_id="100", map_index=1):
    return {
        "match_id": match_id,
        "map_index": map_index,
        "match_date": "2026-04-20T18:19:28",
        "rounds_played": 21,
        "match_url": "https://example.com/test-match",
        "players": [
            {"steamid": 101, "name": "Alpha", "side": "ct", "headshots": 1},
            {"steamid": 101, "name": "Alpha", "side": "t", "headshots": 1},
            {"steamid": 202, "name": "Bravo", "side": "t", "headshots": 0},
        ],
        "kills": [
            {"attacker_steamid": 101, "headshot": True},
            {"attacker_steamid": 101, "headshot": False},
            {"attacker_steamid": 101, "headshot": True},
            {"attacker_steamid": 202, "headshot": False},
        ],
    }


class DatasetAdapterTests(unittest.TestCase):
    def test_count_real_headshot_events_not_headshot_percentage(self):
        records, provenance = normalize_map(source_row())
        self.assertEqual(len(records), 2)  # ct/t are ONE player
        self.assertEqual({r["player_id"]: r["headshots"] for r in records}, {"101": 2, "202": 0})
        self.assertEqual(records[0]["played_at"], "2026-04-20T18:19:28+00:00")
        self.assertEqual(provenance["source"], "blanchon/cs2_dataset_demo_test")

    def test_combine_maps_one_two_no_map_three(self):
        rows = []
        for index, count in ((1, 2), (2, 3), (3, 99)):
            row = source_row(map_index=index)
            row["kills"] = [{"attacker_steamid": 101, "headshot": True}] * count
            normalized, _ = normalize_map(row)
            rows.extend(normalized)
        result = analyze(rows, "101", 4.5, windows=(1,))
        self.assertEqual(result["matches"][0]["headshots"], 5)
        self.assertEqual(result["windows"]["1"]["overs"], 1)

    def test_missing_kills_is_not_zero(self):
        row = source_row()
        del row["kills"]
        with self.assertRaisesRegex(ValueError, "missing"):
            normalize_map(row)

    def test_missing_attacker_is_rejected(self):
        row = source_row()
        row["kills"][0]["attacker_steamid"] = None
        with self.assertRaisesRegex(ValueError, "without attacker"):
            normalize_map(row)


if __name__ == "__main__":
    unittest.main()
