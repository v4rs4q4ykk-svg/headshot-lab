# Headshot Lab — data-source decision log (2026-09-22)

## Non-negotiable requirements

- $0 recurring budget; iPhone-only owner workflow.
- Up-to-date professional tournament CS2 Map 1 + Map 2 headshot counts
  for exact player and match IDs, with source timestamps.
- Automatic PrizePicks projection-line collection only from an authorized feed.
- Missing or partial records must never be displayed as zero or as current.
- Do not buy trial subscriptions or promise source coverage until actual access,
  terms, coverage and correct map-headshot values are verified.

## Sources considered

| Source | What we verified | Decision |
| --- | --- | --- |
| HF dataset viewer for `blanchon/cs2_dataset_demo_test` | Our on-demand GitHub Actions HTTP request returned 401 Unauthorized; schema unverified | Blocked, no retry loop or paid workaround |
| FACEIT developer API | Developer enrollment requires third-party registration and user's account was blocked at verification; FACEIT matchmaking is not assumed to match professional tournaments | Not an active source |
| GRID | Its open-access application mentions free access and includes Fantasy Esports/Betting, but its current plans page says betting-related products require an appropriate commercial arrangement | Permission and applicability must be confirmed; not a verified free solution |
| KashRock | Pages conflict about Sandbox coverage: pricing says CS2 props only, whereas home/docs claim more data/30-day history | Do not promise historical headshots on the free tier; access must be tested and permissions checked |
| GGScore | Advertises free tier of 3 requests/day and match/player box scores, but map-1/2 headshot coverage is unverified | Not sufficient evidence for a fully automated free tracker |

## Evidence URLs

- https://github.com/v4rs4q4ykk-svg/headshot-lab/actions
- https://grid.gg/open-access-application-form/
- https://grid.gg/plans/
- https://www.kashrock.com/pricing
- https://www.kashrock.com/
- https://ggscore.net/

No live stats/projections connector has been enabled; all green GitHub unit tests
remain calculation/schema tests on sample data. The project is not yet a live app.

## Source inspection: OldFella/hltv_api (2026-09-22)

- Inspected its public README, `src/routers/matches.py`, and
  `src/domain/models.py` directly in its GitHub repository.
- The advertised `/matches/{matchid}/stats?by_map=true` endpoint's
  `PlayerMatchStats` response model has: id, name, kills (`k`), deaths
  (`d`), swing, ADR, KAST, rating. **No headshot count is present.**
- Repository code search also returned no matches for `headshot` or
  `headshots` on its indexed default branch.
- Decision: DO NOT connect as Headshot Lab's headshot feed. The existence of
  per-map *player stats* is not evidence of per-map *headshots*. No additional
  registration or payment is warranted. The live API's availability has not
  been tested here because its documented schema already lacks the required
  field.
- Upstream code: https://github.com/OldFella/hltv_api/blob/main/src/domain/models.py
- Upstream endpoint: https://github.com/OldFella/hltv_api/blob/main/src/routers/matches.py
