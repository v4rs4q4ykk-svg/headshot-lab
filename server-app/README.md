# Headshot Lab server

This version removes the GitHub issue step from player searches. A same-origin
server searches BO3's public player records and streams verified Maps 1–2
headshots as matches arrive. The browser requests up to 60 candidates for 20
complete available series, then saves the result locally. Shared source
responses use an isolated named server cache when available; cache permission,
read or write failures fall back to direct source requests. Player lists expire
after five minutes and completed matches after one day.

Saved stats display immediately. First-time searches need source network calls;
they are automatic but not guaranteed to be instantaneous. Rate limits, missing
records and unavailable sources are shown as errors or partial coverage.

No source keys, GitHub tokens, payment information or paid data plan is required.
PrizePicks lines remain manual. Matchup/map metadata loads independently after
headshot history starts arriving. The experimental map model is unchanged.

Run `node build.mjs`, `node --test tests/api.test.mjs`, and
`node --test tests/test_analysis.cjs`. `node dev.mjs` serves the exact built
Worker implementation for browser tests. `node tests/browser.cjs` exercises
an actual cold Dragon search, comparisons, filters and a cached reload.
