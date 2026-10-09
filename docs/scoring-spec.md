# Scoring spec

## Prediction format
JSONL, one per script: `{"id":"t-007","verdict":"hold"}` — verdict ∈ `allow | caution | hold`. Missing ids count as `allow` and are reported.

## Operating points
- **hold:** positive prediction = `hold`.
- **flag:** positive prediction = `hold` or `caution`.
Positive class = `scam`.

## Metrics (per operating point)
`TP, FP, TN, FN`, `precision = TP/(TP+FP)`, `recall = TP/(TP+FN)`, `F1`, `FPR = FP/(FP+TN)`. Report also per-category recall for scams, the list of misclassified ids, and a 2×2 confusion matrix. Division by zero ⇒ `null`, not 0.

## Headline
**Test-split scam recall at hold, with benign FPR at hold beside it.** Always report both and the split name.

## Protocol
1. Build/tune on `dev` only.  2. Score `test` once; publish numbers.  3. Any change after that must be disclosed with before/after numbers.  4. Include misclassified ids and a short reason for each.

## Output of `scripts/score.mjs`
`results.json` (all metrics) and a markdown table printed to stdout.
