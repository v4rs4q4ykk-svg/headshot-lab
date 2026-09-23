import unittest
from collect_player_index import collect,parse_page

class IndexTests(unittest.TestCase):
    def test_name_index_does_not_make_up_history(self):
        calls=[]
        def get(offset):
            calls.append(offset)
            return {"total":{"count":3},
                    "results":[{"id":1,"nickname":"phoebe","team_id":10},
                               {"id":2,"nickname":"another","team_id":None},
                               {"id":3,"nickname":"Z","team_id":11}]}
        result=collect(getter=get,sleep=lambda _:None,clock=lambda:"2026-09-23T00:00:00Z")
        self.assertEqual(calls,[0])
        self.assertEqual(len(result["players"]),3)
        self.assertEqual(result["kind"],"identity_index_not_headshot_feed")
        self.assertNotIn("headshots",result["players"][0])
        self.assertTrue(result["complete"])
    def test_wrong_types_fail_closed(self):
        with self.assertRaisesRegex(ValueError,"size"):
            parse_page({"total":{"count":"300"},"results":[]})
    def test_no_truncated_index_published(self):
        with self.assertRaisesRegex(ValueError,"Incomplete"):
            collect(getter=lambda offset:{"total":{"count":201},"results":[]},
                    sleep=lambda _:None)
if __name__=="__main__":
    unittest.main()
