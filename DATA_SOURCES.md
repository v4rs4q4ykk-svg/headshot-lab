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

## BO3.gg CS2API wrapper audit (2026-09-22)

- Inspected `tommhe14/CS2API`, including `cs2api/api.py` and
  `cs2api/__init__.py`.
- It calls BO3.gg website endpoints via `https://api.bo3.gg/api/v1` while
  sending forged desktop-Chrome-style request headers; this is **not proof of
  official, permitted, durable third-party API access**.
- The public wrapper exposes player aggregate `general_stats`, `map_stats`
  and `accuracy_stats`, and player match lists. The inspected wrapper does
  not establish exact headshot totals per player per map in the last 20
  professional matches, or stable availability on GitHub Actions.
- Do **not** deploy it as an automatic public feed or present its player
  stats as headshot totals without independently confirming permission,
  exact schema, data provenance and repeated uptime. Do not build
  Cloudflare-bypass measures into Headshot Lab.
- References: https://github.com/tommhe14/CS2API/blob/main/cs2api/api.py
  and https://github.com/tommhe14/CS2API/blob/main/cs2api/__init__.py

### Project decision gate

At present the combination of **$0**, **fully automatic**, **no new signup**,
**current pro headshots** and **PrizePicks lines** is not feasible to promise.
Next work should target a single source with demonstrably permitted access and
a correctly mapped recent player's complete Map 1+2 record. A public GitHub
repository or a successful calculation unit test is not by itself a usable
data license or live feed.

## User's phoebe test: matched identity vs reusable data (2026-09-22)

- Screenshot supplied in chat shows **phoebe**, Mindfreak vs Rooster,
  **14 Maps 1–2 headshots**, Wednesday 5:00 AM displayed by PrizePicks.
  Screenshot shows **kairo 11.5, lawlkay 13, Bay 12.5** for the same fixture.
  This is a frozen screenshot, *not* a feed or current projection value.
- Cross-checked **Phoebe 'phoebe' Winter**, Mindfreak, HLTV player ID
  **23613**, https://www.hltv.org/player/23613/phoebe .
  Public fixture: https://www.hltv.org/matches/2398629/mindfreak-vs-rooster-esl-challenger-league-season-52-oceania-cup-2 .
  Do not convert or overwrite the screenshot's displayed kickoff time: the
  site may use a different time zone or source and dates need reconciliation.
- The accessible HLTV map statistics page includes **K (hs)**, which can
  provide exact per-map kill headshot counts. However **its Terms of Service,
  section 2.2 explicitly prohibit scraping/data mining and creating a similar
  product**. Do NOT automate HLTV collection or lift a headshot database from
  HLTV for this project without rights/authorization. Terms:
  https://www.hltv.org/terms .
- `data/board_snapshot.json` and the dashboard's screenshot-test search
  preserve player identity and user-provided old lines, while keeping
  headshot windows unavailable. Source pages are **outbound links only**.
  A snapshot case should never be promoted to “live data connected”.
- Search by exact identity and team, match ID, competition, and source date;
  avoid merging unrelated players who share nicknames. Need independent,
  permitted current match-history source and permitted PrizePicks data
  source for automatic L10/L15/L20 vs live projection.
