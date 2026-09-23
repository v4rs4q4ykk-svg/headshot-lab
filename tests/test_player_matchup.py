import unittest
from unittest.mock import patch

import fetch_player_history as research


class MatchupResearchTests(unittest.TestCase):
    def test_collect_keeps_verified_opponent_maps_and_rounds(self):
        listing = [{"slug": "fixture-1"}]
        match = {
            "id": 73, "game_version": 2, "status": "finished",
            "start_date": "2026-09-20T12:00:00Z",
            "teams": [{"id": 11, "name": "Own"}, {"id": 22, "name": "Other"}],
            "games": [
                {"id": 101, "number": 1, "status": "finished", "rounds_count": 24, "map_name": "de_nuke"},
                {"id": 102, "number": 2, "status": "finished", "rounds_count": 30, "map_name": "de_mirage"},
            ],
        }
        def fake_get(path, args=None):
            if path == "/matches":
                return listing
            if path == "/matches/fixture-1":
                return match
            if path.startswith("/games/"):
                return [{"steam_profile": {"nickname": "person"},
                         "steam_profile_id": 42, "clan_name": "Own",
                         "headshots": 8 if path.endswith("101/players_stats") else 11}]
            raise AssertionError(path)
        with patch.object(research, "get", side_effect=fake_get), patch.object(research.time, "sleep"):
            result = research.collect(7, "person")
        self.assertEqual(result["schema_version"], 2)
        self.assertEqual(result["matches"][0]["opponent"], {"id": 22, "name": "Other"})
        self.assertEqual(result["matches"][0]["maps"], [
            {"name": "de_nuke", "rounds": 24}, {"name": "de_mirage", "rounds": 30}])
        self.assertEqual(result["matches"][0]["headshots"], 19)

    def test_ambiguous_team_and_map_stay_unknown(self):
        match = {"teams": [{"id": 11, "name": "One"}, {"id": 22, "name": "Other"}]}
        self.assertIsNone(research.opponent_identity(match, "Unknown"))
        self.assertIsNone(research.opponent_identity({"teams": [{"name": "One"}]}, "One"))
        self.assertIsNone(research.map_identity({"map_name": None}))
        self.assertIsNone(research.map_identity({"map_name": "<script>"}))


if __name__ == "__main__":
    unittest.main()
