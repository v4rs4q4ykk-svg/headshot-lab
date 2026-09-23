import copy
import unittest
from unittest.mock import Mock
from research_pipeline import completed_series, full_bo3_veto, resolve, fixture, vetoes
from request_history_issue import parse_request


def match_data():
    return {"id": 99, "slug": "test-fixture", "status": "finished", "game_version": 2,
            "start_date": "2026-09-20T12:00:00Z", "bo_type": 3,
            "team1": {"id": 1, "name": "A"}, "team2": {"id": 2, "name": "B"},
            "games": [{"id": 11, "number": 1, "status": "finished", "rounds_count": 24, "map_name": "de_nuke"},
                      {"id": 12, "number": 2, "status": "finished", "rounds_count": 20, "map_name": "de_mirage"}]}


def row(pid, team, hs, nick="different-game-nick"):
    return {"headshots": hs, "kills": 18, "steam_profile_id": pid+100,
            "team_clan": {"team_id": team},
            "steam_profile": {"player_id": pid, "nickname": nick,
                              "player": {"id": pid, "nickname": "canonical", "team_id": team}}}


class PipelineTests(unittest.TestCase):
    def test_source_player_id_survives_changed_nickname_and_collects_both_teams(self):
        results = completed_series(match_data(), {1:[row(5,1,7), row(6,2,5)],2:[row(5,1,9,"new"),row(6,2,4)]})
        self.assertEqual(results[5]["record"]["headshots"], 16)
        self.assertEqual(results[5]["record"]["opponent"]["id"], 2)
        self.assertEqual(results[6]["record"]["opponent"]["id"], 1)
        self.assertEqual(results[5]["record"]["rosters"]["2"], [6])

    def test_shared_nickname_does_not_cross_ids(self):
        self.assertEqual(completed_series(match_data(),{1:[row(5,1,7)],2:[row(6,1,9)]}), {})

    def test_duplicate_player_or_map_and_impossible_hs_rejected(self):
        self.assertEqual(completed_series(match_data(),{1:[row(5,1,7),row(5,1,8)],2:[row(5,1,9)]}), {})
        self.assertEqual(completed_series(match_data(),{1:[row(5,1,99)],2:[row(5,1,9)]}), {})
        m=match_data();m["games"].append(copy.deepcopy(m["games"][0]))
        self.assertEqual(completed_series(m,{1:[row(5,1,7)],2:[row(5,1,9)]}), {})

    def test_partial_maps_do_not_create_zero(self):
        m=match_data();m["games"][1]["status"]="upcoming"
        self.assertEqual(completed_series(m,{1:[row(5,1,7)]}), {})

    def test_veto_roles_and_unique_maps_required(self):
        a=[{"order":i+1,"team_id":1+i%2,"action":action,"map":"de_"+str(i)}
           for i,action in enumerate(["ban","ban","pick","pick","ban","ban","decider"])]
        self.assertTrue(full_bo3_veto(a))
        a[3]["team_id"]=1
        self.assertFalse(full_bo3_veto(a))

    def test_resolve_duplicates_requires_selection(self):
        c=Mock();c.get.return_value=[{"id":5,"nickname":"person"},{"id":6,"nickname":"person"}]
        self.assertEqual(len(resolve(c,"person")),2)
        self.assertEqual(resolve(c,"person",6)[0]["id"],6)
        self.assertEqual(resolve(c,"person",7),[])

    def test_request_can_find_missing_name_and_rejects_path_or_duplicate_id(self):
        self.assertEqual(parse_request("CS2 research: person","Nickname: person\nRequest ID: abc"),("person",None,"abc"))
        with self.assertRaises(ValueError):
            parse_request("CS2 research: person","Nickname: person\nRequest ID: ../../bad")
        with self.assertRaises(ValueError):
            parse_request("CS2 research: person","Nickname: person\nPlayer ID: 5\nPlayer ID: 6")


if __name__ == '__main__': unittest.main()
