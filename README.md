# Headshot Lab

CS2 player, opponent and map research with a target recurring cost of $0.

**App:** https://v4rs4q4ykk-svg.github.io/headshot-lab/

## Use it

1. Search a nickname and select the correct source identity.
2. Saved research opens immediately. For a missing player, use **Open collection
   request**, submit the prefilled GitHub issue with the repository owner account,
   and return to the app. The result loads automatically.
3. Enter the current Maps 1–2 headshot line from PrizePicks. Lines remain on your
   device; they are not fetched or published automatically.
4. Choose an upcoming match, inspect the opponent history and map splits, or test
   a map combination. The research board compares collected players against the
   individual lines you enter.

## Data pipeline

`research_pipeline.py` uses BO3.gg's public JSON endpoints. It matches players by
`steam_profile.player_id` and the nested player ID, which supports changed
in-game nicknames without conflating players with the same name. A result needs
both completed Maps 1 and 2 with consistent player/team identity and integer
headshot counts. Missing records are excluded and counted in coverage metadata.
Map 3 is excluded from headshot totals.

Each fetched map also supplies the other players in that match. Those peer
records are cached with **partial coverage** until a direct player scan is run.
A source lookup can resolve a nickname absent from the local identity index;
duplicate nicknames require selecting an ID. The source itself can still lack
players or matches.

The collector also stores the upcoming team fixtures and recent ordered BO3
picks/bans. Requests are serial, paginated and capped. Completed match responses
are cached for one day; team veto samples for two hours. Authorization and rate
limit errors stop source requests. There is no Cloudflare bypass or proxy.

GitHub Actions refreshes up to four directly requested profiles every six hours,
oldest first. Scheduled jobs can be delayed by GitHub. The app shows collection
times. This is periodically refreshed research, not a real-time headshot feed.

## Map model

Confirmed source maps override estimates. Otherwise `analysis.js` models the
first two bans and two picks in a BO3 using recent team tendencies, a 60-day
half-life, additive smoothing of 0.5, and equal weight for either acting order.
It enumerates the possible paths and reports the distribution for Maps 1 and 2.

Requirements: at least five complete standard BO3 vetoes for each team using the
same seven-map pool, and latest vetoes no older than 30 days. The pool is inferred
from the latest complete vetoes; it is not verification of tournament rules.
Different or stale pools and inadequate samples produce an unavailable result.

The map-weighted headshot baseline combines the model's map weights with player
HS/round and typical map lengths. Five map-equivalents of shrinkage toward the
player's overall HS rate reduce the effect of small samples. Missing map samples
use the overall rate and their model weight is disclosed. These estimates have
not been calibrated or backtested. Roster changes and roles are not modeled;
historical hit rates are not outcome probabilities.

## Coverage limits

- A direct scan checks up to 60 newest finished candidates for 20 complete
  available series. It may skip matches with absent data or only one map.
- Head-to-head and map splits use the saved records, not an exhaustive career
  database. Source team IDs distinguish organizations; current roster equality
  is not implied.
- The player identity index is partial. A missing nickname can be searched at the
  source through the collection request flow, but all-player availability cannot
  be guaranteed.
- New collection requires the repository owner's GitHub account to submit the
  request. A static GitHub Pages site cannot securely start privileged Actions
  jobs on its own without an authentication service.
- No automatic PrizePicks projection feed or in-match headshot feed is connected.
- The public source has no availability guarantee for this app. No API keys or
  user credentials are stored in the page or repository.

## Verification

- `python3 -m unittest discover -s tests -v` checks source identity, missing data,
  complete-map aggregation, safe requests and calculation contracts.
- `node --test tests/test_analysis.cjs` checks veto probability normalization,
  confirmed-map precedence, stale/mismatched pools, missing samples and pushes.
- `tests/browser.cjs` checks player lookup, line comparison, opponent filters,
  mobile/desktop width, and the automatic request-result flow in Chromium.
  The **Check CS2 research interface** Action saves screenshots.

Older experiments and screenshots remain under `data/` and `DATA_SOURCES.md` for
provenance. They are not used as current projection lines in the research view.
