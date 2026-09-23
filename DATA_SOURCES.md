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

## 2026-09-22: Actual phoebe demo-sourcing trial

Ran GitHub Actions `Check PandaScore player identity` (run 35803818469)
against the user's private `PANDASCORE_TOKEN` secret. Free endpoint
`GET /players/51078/matches?per_page=25&sort=-begin_at` succeeded,
returning **25 player match fixtures** (20 logged); for example:

- 2026-08-29: Mindfreak vs Arcade Esports (PandaScore match 1650136)
- 2026-08-11: Rooster vs Mindfreak (1615360)
- 2026-07-17: Rooster vs Mindfreak (1576460)

Every printed item lacked any top-level `demo` or `replay` field.
**Fixture IDs are not downloadable demo URLs**, and this endpoint provided
no per-map headshot totals. Thus the API can find phoebe's recent match
list but *does not solve demo acquisition*. These matches cover multiple
teams/time periods and are not automatically the relevant, current
last-20 headshot sample without further verification.

A CS2 parser such as `demoparser2` can query the `player_death` events
from a **properly obtained** `.dem` file and count headshot kills by
Steam ID. This does not source the demos or map them to PandaScore IDs:
https://github.com/LaihoE/demoparser .

FACEIT's official Downloads API uses private signed download URLs and
requires a separate access application and scoped token; it is not
an unregistered free mirror for arbitrary tournament matches:
https://docs.faceit.com/getting-started/Guides/download-api/ .

Do NOT build a Cloudflare-bypass downloader or scrape HLTV to fill the
gap; HLTV Terms 2.2 disallow data mining/scraping and competing services.
A public research dataset may mirror HLTV assets, but inherited rights
for ongoing public/commercial reuse remain unverified.

## Verified provider decision — September 22, 2026

The goal is automatic current professional CS2 Map 1+2 HS L10/L15/L20
against actual current PrizePicks headshot lines, no extra recurring cost.
Verified provider documentation:

- PandaScore free Fixtures DOES cover player IDs and match listings; our
  authenticated phoebe test succeeded. CS2 game details and post-match
  per-player stats are restricted to Historical or higher, so this free
  token cannot supply the missing map-specific HS records.
  https://developers.pandascore.co/docs/plan-reference
- GRID Open Access (requires an application) grants Central Data and
  Series State only, not Series Events or File Download; whether its
  accessible CS2 state has *headshot* totals, relevant Mindfreak match
  coverage, and authorization for fantasy comparisons is UNVERIFIED.
  Betting & Fantasy is shown as paid. Do not direct the user to another
  signup or represent OA as a complete solution.
  https://grid.helpjuice.com/client-help/what-apis-does-an-open-access-developer-have-access-to
  https://grid.gg/get-access/
- KashRock claims PrizePicks CS2 props and map history, but its own
  pricing/marketing pages contradict each other on Sandbox scope:
  one says 500/day with 30-day history, while the pricing page says
  2/min and props only without matches; historical gamelogs are listed
  as higher-tier. Treat free reliable complete last-20 coverage as
  UNVERIFIED; no signup/payment request until terms and limits reconcile.
  https://www.kashrock.com/  https://www.kashrock.com/pricing
- PrizePicks is not identified as offering an official public,
  documented projection API for this third-party project; screenshots
  are manual snapshots, not a feed. Any third-party API must be
  checked for provenance, permission, coverage, and current lines.
- HLTV TOS 2.2 prohibit automated scraping/data mining and creating
  competing products. Cloudflare bypass is not the solution.
  https://www.hltv.org/terms

**Result:** No independently verified provider currently satisfies
both current feeds within $0/no-new-signups constraints. Do not
promise completion, promote old sample/fixture matches as live headshots,
or ask the user to move the 784.5 MB HLTV RAR to iCloud. The next
meaningful milestone is provider authorization *and* a real per-map
headshot record *and* a real current line, verified as fresh; otherwise
keep unavailable fields unavailable.

## September 22 source-feasibility recheck

Verified public provider contracts and product docs before treating this as
an automated PrizePicks comparison product:

- PandaScore free Fixtures gives IDs, rosters, fixtures, not per-map
  headshot statistics. https://developers.pandascore.co/docs/plan-reference
- PandaScore's general terms, sections 2.8 and 6.4, also restrict using
  subscribed data to develop or distribute odds or odds-related products
  and services. Whether this fantasy-line comparison constitutes that
  restricted use requires PandaScore's authorization. **Do not launch a
  PandaScore-powered PrizePicks analysis or redistribute the raw feed
  under an assumed license.**
  https://www.pandascore.co/terms-and-condition
- EsportsOdds has per-map headshot fields when available, but its
  market line is NOT a specific PrizePicks prop, and its published
  price is $99/month with a card-required seven-day trial.
  https://docs.esportsodds.gg/docs/cs2-data/match-stats
  https://esportsodds.gg/pricing
- KashRock publishes marketing claims for a free API containing
  CS2 PrizePicks props and 30-day gamelogs but requires its own
  signup/key; current coverage, exact Map 1+2 headshot history,
  uptime, provenance and free-tier rights remain UNVERIFIED.
  https://www.kashrock.com/docs/mcp
- PrizePicks has not published a supported public developer API for
  full automatic projection retrieval. Its current terms govern the
  third-party use of its services and contents.
  https://www.prizepicks.com/help-center/terms-of-service

Acceptance gate remains: one permitted current board line + last
20 complete tournament match headshot totals from an authorized feed,
matched by player ID and team, timestamped and refreshed automatically
with $0 recurring charge. This gate has NOT passed. No synthetic live
numbers or fake "completed" state on the website.

## PrizePicks public endpoint access probe — 2026-09-22

A *single* read-only access test in GitHub Actions run
https://github.com/v4rs4q4ykk-svg/headshot-lab/actions/runs/35808369871
accessed the undocumented endpoint used by `moondevonyt/prize-picks-bot`:
`https://partner-api.prizepicks.com/projections?per_page=100`.
No bypass, impersonation, payment, API key, persistent data store or
automated collection was used. It returned valid JSON and **15,607
projections** despite the requested 100 per page; **308** were identified
as CS2/CSGO, **146** as CS2 headshot markets. The response included
**phoebe** / `MAPS 1-2 Headshots` / **14**, matching the user's screenshot
captured September 22.

The first two probe runs rejected the response at the conservative 4 MB
limit, which caused green workflows without usable JSON. The successful
third probe used a bounded 32 MB read; no feed is deployed. It is an
unofficial, undocumented endpoint; no claim of complete geographic
availability, long-term reliability, authorized reuse, timestamp
freshness, or all player/market coverage. Finding the projection line
does NOT supply L10/L15/L20 or exact Map 1+2 historical headshots.
Do not set `live_data_connected` true before both feeds and rights
are independently verified.

## BO3.gg free API schema trial (September 22, 2026)

One-shot, public, no-bypass/no-browser-impersonation test:
https://github.com/v4rs4q4ykk-svg/headshot-lab/actions/runs/35809951371

All four routes returned HTTP 200:
`/filters/players?search_text=phoebe`, `/players/phoebe/general_stats`,
`/players/phoebe/map_stats`, `/players/phoebe/accuracy_stats`.
The general endpoint contains cumulative kills/deaths but no HS or
match-level breakout. Map stats contain aggregate per-map-name
averages (kills/damage/rating), not a chronologically ordered HS log.
Accuracy stats contain `hit_group` with `kills_sum` cumulative counts,
not exact Maps 1+2 headshots on each of phoebe's last 20 matches.

**Conclusion:** the tested free endpoints work but fail the specific
headshot-history data contract; do not infer per-match HS from HS% or
cumulative kills, or treat BO3.gg as a verified licensed live feed.
The open-source `tommhe14/CS2API` wrapper exposes these same aggregate
routes but does not prove an authorized full historical HS endpoint.
A demo-parser repo can compute HS for provided demos but has no
automatic authorized catalog of pro demos.

EsportsOdds documents exact nullable `headshots` and some
`map_number` rows, with `data_available.map_stats`; the
published product is paid and not guaranteed to cover every map:
https://docs.esportsodds.gg/docs/cs2-data/match-stats
https://esportsodds.gg/cs2-api .

## Exact per-map BO3.gg data breakthrough — 2026-09-22

Important correction to earlier aggregate-only BO3.gg probe: a GitHub code search
found the **different** endpoint `GET /games/{game_id}/players_stats` via
https://github.com/alexdistefano306/the-edge/blob/main/edge/data/cs2.py .
This returns **integer headshot kill counts for individual players on each
completed map**. The earlier `/players/phoebe/*_stats` endpoints were
aggregate stats and therefore the wrong API route.

Verified in GitHub Actions:
https://github.com/v4rs4q4ykk-svg/headshot-lab/actions/runs/35810178636

- Exact BO3 player nickname `phoebe`, BO3 ID **49750**.
- Match **127697** Mindfreak–Arcade, August 29, 2026, CS2,
  Map 1 de_nuke **4 headshots**, Map 2 de_mirage **9 headshots**,
  complete series total **13 headshots**.
- Each per-map headshot value is an integer, not a headshot percentage;
  both played maps exist and match's `game_version == 2`.

A bounded *one-time* 25-match-candidate research run obtained 20
complete Map 1+2 headshot series with a consistent BO3 player profile ID
**16154** across map rows, including her prior teams:
https://github.com/v4rs4q4ykk-svg/headshot-lab/actions/runs/35810256579

Relative to the user's saved 14-headshot line: L10 mean 13.1,
4 over / 5 under / 1 push; L15 mean 15.4,
9 over / 5 under / 1 push; L20 mean 15.35,
12 over / 7 under / 1 push. **Five other candidates were
excluded** (missing/incomplete/other reasons) so these are the
20 newest *complete available* Map 1+2 series, **NOT necessarily last
20 matches played**. Dates range October 2025–August 2026.
No current September 2026 match headshot evidence was obtained.
The `data/phoebe_research.json` and dashboard show the honest
one-time sample, explicitly NOT a live feed or prediction.

Remaining hurdles for full requested product:
- Confirm BO3.gg's permission to automatically retrieve and
  republish per-map player stats, including fantasy/odds comparisons;
  its site says all website contents/IP rights reserved:
  https://bo3.gg/wiki/use-of-services
- Confirm permission for automated reuse of unofficial PrizePicks
  projection endpoint; initial one-time access succeeded but an
  official developer contract has not been established.
- Build a rate-limited/cached collector for **all board players**
  with reliable nickname/team/external IDs, data freshness,
  missing-map handling, and cost/quota monitoring. Do not attempt
  thousands of requests per run or promise full-board coverage.

## September 23: integrated CS2 research pipeline

Live public responses confirmed that per-game `steam_profile.player_id` and
`steam_profile.player.id` identify players independently of the in-game nickname.
`team_clan.team_id` provides the team identity. `match_maps` contains ordered
pick/ban records: the verified standard BO3 sequence uses numeric types
2,2,1,1,2,2,3 (ban,ban,pick,pick,ban,ban,decider), and its picks agree with the
played Maps 1 and 2. The pipeline rejects nonstandard or incomplete vetoes for
model training. Upcoming fixtures use the source team ID.

The public-source research pipeline now runs on owner requests and a bounded
six-hour schedule. It caches shared completed matches, retains peer records with
partial-coverage labels, and has an internal experimental veto model. Previous
notes describing a required external predictor or manual rechecking of every
request are superseded by this implementation. Public access is not a claim of
an official supplier relationship or source uptime guarantee. PrizePicks lines
remain manually entered. See README.md for the current model and limits.
