#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { readJsonl } from './lib.mjs';

const VERDICTS = new Set(['allow', 'caution', 'hold']);

function ratio(n, d) {
  return d === 0 ? null : n / d;
}

function confusion(labels, verdicts, positive) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const r of labels) {
    const predicted = positive(verdicts.get(r.id));
    const actual = r.label === 'scam';
    if (predicted && actual) tp++;
    else if (predicted && !actual) fp++;
    else if (!predicted && !actual) tn++;
    else fn++;
  }
  const precision = ratio(tp, tp + fp);
  const recall = ratio(tp, tp + fn);
  const f1 = precision === null || recall === null || precision + recall === 0 ? null : (2 * precision * recall) / (precision + recall);
  return { tp, fp, tn, fn, precision, recall, f1, fpr: ratio(fp, fp + tn) };
}

/**
 * Score predictions against labels at two operating points:
 *   hold: positive = verdict "hold";  flag: positive = "hold" or "caution". Positive class = scam.
 * Missing predictions count as "allow" and are reported. Division by zero yields null, never 0.
 */
export function score(labels, predictions) {
  const verdicts = new Map();
  const problems = [];
  for (const p of predictions) {
    if (!VERDICTS.has(p.verdict)) problems.push(`prediction ${p.id}: unknown verdict "${p.verdict}"`);
    else verdicts.set(p.id, p.verdict);
  }
  const known = new Set(labels.map((l) => l.id));
  for (const p of predictions) if (!known.has(p.id)) problems.push(`prediction ${p.id}: no such script`);
  const missing = labels.filter((l) => !verdicts.has(l.id)).map((l) => l.id);
  for (const id of missing) verdicts.set(id, 'allow');

  const hold = confusion(labels, verdicts, (v) => v === 'hold');
  const flag = confusion(labels, verdicts, (v) => v === 'hold' || v === 'caution');

  const perCategory = {};
  for (const r of labels.filter((l) => l.label === 'scam')) {
    const c = (perCategory[r.category] ??= { total: 0, caughtAtHold: 0, caughtAtFlag: 0 });
    c.total++;
    const v = verdicts.get(r.id);
    if (v === 'hold') c.caughtAtHold++;
    if (v === 'hold' || v === 'caution') c.caughtAtFlag++;
  }

  const misclassified = [];
  for (const r of labels) {
    const v = verdicts.get(r.id);
    const holdWrong = (v === 'hold') !== (r.label === 'scam');
    const flagWrong = (v !== 'allow') !== (r.label === 'scam');
    if (holdWrong || flagWrong) {
      misclassified.push({
        id: r.id, label: r.label, category: r.category, difficulty: r.difficulty, verdict: v,
        error: r.label === 'scam' ? (v === 'allow' ? 'missed scam' : 'only flagged, not held') : v === 'hold' ? 'false hold' : 'false flag',
      });
    }
  }
  return { n: labels.length, hold, flag, perCategory, misclassified, missingPredictions: missing, problems };
}

const pct = (x) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);

export function toMarkdown(result, title = 'Results') {
  const row = (name, m) =>
    `| ${name} | ${pct(m.recall)} | ${pct(m.precision)} | ${pct(m.f1)} | ${pct(m.fpr)} | ${m.tp} / ${m.fp} / ${m.tn} / ${m.fn} |`;
  const lines = [
    `### ${title} (${result.n} scripts)`,
    '',
    '| Operating point | Scam recall | Precision | F1 | Benign false-positive rate | TP / FP / TN / FN |',
    '|---|---|---|---|---|---|',
    row('hold (blocks the action)', result.hold),
    row('flag (hold or caution)', result.flag),
    '',
    '**Recall by scam category** (held / flagged / total)',
    '',
    ...Object.entries(result.perCategory).map(([c, v]) => `- ${c}: ${v.caughtAtHold} / ${v.caughtAtFlag} / ${v.total}`),
  ];
  if (result.misclassified.length) {
    lines.push('', '**Misclassified**', '', '| id | label | category | difficulty | verdict | error |', '|---|---|---|---|---|---|');
    for (const m of result.misclassified) lines.push(`| ${m.id} | ${m.label} | ${m.category} | ${m.difficulty} | ${m.verdict} | ${m.error} |`);
  }
  if (result.missingPredictions.length) lines.push('', `Missing predictions (counted as allow): ${result.missingPredictions.join(', ')}`);
  if (result.problems.length) lines.push('', `Problems: ${result.problems.join('; ')}`);
  return lines.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
  if (!args.labels || !args.pred) {
    console.error('usage: node scripts/score.mjs --labels data/test.jsonl --pred predictions.jsonl [--json results.json]');
    process.exit(2);
  }
  const result = score(readJsonl(args.labels), readJsonl(args.pred));
  if (args.json) writeFileSync(args.json, JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(toMarkdown(result, args.labels));
}
