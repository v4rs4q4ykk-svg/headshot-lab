import unittest

from collect_archive import make_archive


def row(match_id, map_number, when="2026-04-20T18:19:28Z", headshots=2):
    return {
        "row": {
            "match_id": match_id,
            "map_index": map_number,
            "match_date": when,
            "rounds_played": 20,
            "match_url": "https://example.org/match/" + match_id,
            "players": [
                {"steamid": 101, "name": "Player Alpha", "side": "ct"},
                {"steamid": 101, "name": "Player Alpha", "side": "t"},
            ],
            "kills": [{"headshot": True, "attacker_steamid": 101}] * headshots,
        }
    }


class ArchiveTests(unittest.TestCase):
    def test_provenance_and_complete_series(self):
        archive = make_archive([row("100", 1, headshots=3), row("100", 2, headshots=5)],
                               "2026-09-22T21:00:00+00:00")
        self.assertFalse(archive["live_data_connected"])
        self.assertFalse(archive["prizepicks_connected"])
        self.assertEqual(archive["completed_series"], 1)
        self.assertEqual(archive["players"][0]["matches"][0]["headshots"], 8)
        self.assertEqual(archive["players"][0]["matches"][0]["source_url"],
                         "https://example.org/match/100")

    def test_partial_match_excluded(self):
        with self.assertRaisesRegex(ValueError, "no complete"):
            make_archive([row("100", 1)], "2026-09-22T21:00:00+00:00")

    def test_duplicate_map_rejected(self):
        with self.assertRaisesRegex(ValueError, "duplicate"):
            make_archive([row("100", 1), row("100", 1), row("100", 2)],
                         "2026-09-22T21:00:00+00:00")


if __name__ == "__main__":
    unittest.main()
