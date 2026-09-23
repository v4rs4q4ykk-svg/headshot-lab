import unittest
from demo_headshots import headshot_rows


class DemoHeadshotsTests(unittest.TestCase):
    def test_exact_steam_id_not_name_and_ignore_non_hs(self):
        rows = [
            {"headshot": True, "attacker_steamid": 1234, "attacker_name": "phoebe"},
            {"headshot": False, "attacker_steamid": 1234, "attacker_name": "phoebe"},
            {"headshot": True, "attacker_steamid": "1234", "attacker_name": "phoebe"},
            {"headshot": True, "attacker_steamid": 5678, "attacker_name": "phoebe"},
            {"headshot": True, "attacker_steamid": None, "attacker_name": None},
        ]
        result = headshot_rows(rows)
        self.assertEqual(result, [
            {"steamid": "1234", "name": "phoebe", "headshots": 2},
            {"steamid": "5678", "name": "phoebe", "headshots": 1}
        ])

    def test_missing_flags_or_player_ids_do_not_become_zeros(self):
        with self.assertRaisesRegex(ValueError, "lacks"):
            headshot_rows([{"attacker_steamid": 1234}])
        with self.assertRaisesRegex(ValueError, "true/false"):
            headshot_rows([{"headshot": 1, "attacker_steamid": 1234}])
        with self.assertRaisesRegex(ValueError, "invalid attacker Steam ID"):
            headshot_rows([{"headshot": True, "attacker_steamid": "fake"}])


if __name__ == "__main__":
    unittest.main()
