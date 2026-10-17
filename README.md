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

## Baseline results (`second-opinion` detector)

Scored using the [Second Opinion](https://github.com/Monolithic-Dev/second-opinion) deterministic risk engine (`rules-2026.10.3` and `rules-2026.10.4`):

| Split | Scripts | Hold Recall | Hold FPR | Flag Recall | Flag FPR |
|---|---|---|---|---|---|
| `dev` | 30 (15 scam / 15 benign) | 86.7% | 0.0% | 100.0% | 6.7% |
| `test` (held-out) | 30 (15 scam / 15 benign) | 46.7% | 0.0% | 80.0% | 6.7% |
| `test2` (fresh team-v2) | 40 (20 scam / 20 benign) | 95.0% | 0.0% | 100.0% | 5.0% |

- **Hold operating point** blocks the action and initiates family approval. 0% false holds across all splits ensures normal payments are never mistakenly blocked.
- Full category breakdown and ablation details are published in `second-opinion/eval/results/`.

## Limitations
English only, US-style scripts, 100 examples across 3 splits — a sanity yardstick, not a production benchmark. All text is invented: no real people, phone numbers, URLs, brands' private details, or victims. Defensive use only.

## License
MIT.

