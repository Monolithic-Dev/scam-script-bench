# scam-script-bench

A small, open, **synthetic** benchmark for detecting payment-pressure scams and telling them apart from genuine, tricky-looking messages (real bank fraud alerts, pharmacy refills, delivery notices).

Created during the Build, Ship, Shape: Amazon Developer Hackathon 2026 as the companion to [`second-opinion`](https://github.com/Monolithic-Dev/second-opinion) (Open Source mini challenge).

## Why
Most scam-detector demos report no numbers. This gives a tiny, honest yardstick: a `dev` split to build against and a frozen `test` split written by a *different author*, with benign cases deliberately hard.

## Contents
| Path | What |
|---|---|
| `data/dev.jsonl` | 30 scripts (15 scam / 15 benign) for building detectors |
| `data/test.jsonl` | 30 scripts (15 / 15), frozen, different author, run once |
| `data/test2.jsonl` | 40 scripts (20 / 20) added later as a fresh held-out split (`u-` ids, author `team-v2`). Written before the detector was re-tuned; see the second-opinion eval report |
| `schema/script.schema.json` | JSON Schema for one record |
| `scripts/validate.mjs` | Validates files against the schema and split rules |
| `scripts/score.mjs` | Scores a predictions file against labels |
| `docs/dataset-spec.md` | Categories, authoring rules, ethics |
| `docs/scoring-spec.md` | Metrics, operating points, prediction format |

## Quick start
```bash
npm install
npm run validate
node scripts/score.mjs --labels data/test.jsonl --pred my-predictions.jsonl
```
Prediction line: `{"id":"t-007","verdict":"hold"}` with verdict `allow | caution | hold`.

## Limitations
English only, US-style scripts, 60 examples — a sanity yardstick, not a production benchmark. All text is invented: no real people, phone numbers, URLs, brands' private details, or victims. Defensive use only.

## License
MIT.
