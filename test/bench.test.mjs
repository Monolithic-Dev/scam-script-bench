import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { jaccard, readJsonl, shingles } from '../scripts/lib.mjs';
import { score, toMarkdown } from '../scripts/score.mjs';
import { validate } from '../scripts/validate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const real = { dev: join(root, 'data', 'dev.jsonl'), test: join(root, 'data', 'test.jsonl') };

test('the shipped dataset passes every validation rule', () => {
  assert.deepEqual(validate(real), []);
});

test('each split has 15 scam and 15 benign records, with hard cases on both sides', () => {
  for (const [split, path] of Object.entries(real)) {
    const rows = readJsonl(path);
    assert.equal(rows.length, 30, split);
    assert.equal(rows.filter((r) => r.label === 'scam').length, 15, split);
    assert.ok(rows.filter((r) => r.label === 'benign' && r.difficulty === 'tricky').length >= 6, `${split} tricky benign`);
    assert.ok(rows.filter((r) => r.label === 'scam' && r.difficulty === 'tricky').length >= 3, `${split} tricky scams`);
    assert.ok(new Set(rows.filter((r) => r.label === 'scam').map((r) => r.category)).size >= 6, `${split} categories`);
  }
});

function tmpFile(rows) {
  const dir = mkdtempSync(join(tmpdir(), 'ssb-'));
  const p = join(dir, 'x.jsonl');
  writeFileSync(p, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return p;
}

test('validation catches the mistakes it exists to catch', () => {
  const rows = readJsonl(real.dev);
  const problemsFor = (mutate) => validate({ dev: tmpFile(mutate(structuredClone(rows))) }).join(' | ');

  assert.match(problemsFor((r) => { r[1].id = r[0].id; return r; }), /duplicate id/);
  assert.match(problemsFor((r) => { r[0].split = 'test'; return r; }), /does not match file/);
  assert.match(problemsFor((r) => { r[0].text += ' see https://example.com'; return r; }), /URL or phone number/);
  assert.match(problemsFor((r) => { r[0].text += ' call 555-123-4567'; return r; }), /URL or phone number/);
  assert.match(problemsFor((r) => { r[0].category = 'pharmacy'; return r; }), /does not belong to label/);
  assert.match(problemsFor((r) => { r[0].channel = 'carrier-pigeon'; return r; }), /channel/);
  assert.match(problemsFor((r) => { delete r[0].difficulty; return r; }), /difficulty/);
  assert.match(problemsFor((r) => r.slice(1)), /expected 15 scam/);
  assert.match(problemsFor((r) => { for (const x of r) if (x.label === 'benign') x.difficulty = 'easy'; return r; }), /at least 40%/);
  assert.match(problemsFor((r) => { for (const x of r) if (x.label === 'scam') x.category = 'gift_card'; return r; }), /distinct scam categories/);
  assert.match(problemsFor((r) => { r[1].text = r[0].text; return r; }), /near-duplicate/);
  assert.match(problemsFor((r) => { r[0].extra = 1; return r; }), /additional properties/);
});

test('dev and test must come from different author groups', () => {
  const dev = readJsonl(real.dev);
  const test2 = readJsonl(real.test).map((r) => ({ ...r, author: dev[0].author }));
  assert.match(validate({ dev: real.dev, test: tmpFile(test2) }).join(' | '), /appears in both dev and test/);
});

test('a malformed line reports its line number', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ssb-'));
  const p = join(dir, 'bad.jsonl');
  writeFileSync(p, '{"id":"d-001"}\n{oops\n');
  assert.throws(() => readJsonl(p), /bad\.jsonl:2: invalid JSON/);
});

const labels = [
  { id: 'a', label: 'scam', category: 'gift_card', difficulty: 'easy' },
  { id: 'b', label: 'scam', category: 'gift_card', difficulty: 'easy' },
  { id: 'c', label: 'scam', category: 'wire_crypto', difficulty: 'tricky' },
  { id: 'd', label: 'benign', category: 'pharmacy', difficulty: 'easy' },
  { id: 'e', label: 'benign', category: 'family_chat', difficulty: 'tricky' },
  { id: 'f', label: 'benign', category: 'utility_bill', difficulty: 'easy' },
];

test('scoring: hold and flag operating points are computed by hand-checked arithmetic', () => {
  const pred = [
    { id: 'a', verdict: 'hold' },     // caught
    { id: 'b', verdict: 'caution' },  // flagged only
    { id: 'c', verdict: 'allow' },    // missed
    { id: 'd', verdict: 'allow' },
    { id: 'e', verdict: 'caution' },  // false flag
    { id: 'f', verdict: 'hold' },     // false hold
  ];
  const r = score(labels, pred);
  assert.deepEqual([r.hold.tp, r.hold.fp, r.hold.tn, r.hold.fn], [1, 1, 2, 2]);
  assert.equal(r.hold.recall, 1 / 3);
  assert.equal(r.hold.precision, 1 / 2);
  assert.equal(r.hold.fpr, 1 / 3);
  assert.ok(Math.abs(r.hold.f1 - 0.4) < 1e-12);
  assert.deepEqual([r.flag.tp, r.flag.fp, r.flag.tn, r.flag.fn], [2, 2, 1, 1]);
  assert.equal(r.flag.recall, 2 / 3);
  assert.deepEqual(r.perCategory, { gift_card: { total: 2, caughtAtHold: 1, caughtAtFlag: 2 }, wire_crypto: { total: 1, caughtAtHold: 0, caughtAtFlag: 0 } });
  const errors = Object.fromEntries(r.misclassified.map((m) => [m.id, m.error]));
  assert.deepEqual(errors, { b: 'only flagged, not held', c: 'missed scam', e: 'false flag', f: 'false hold' });
});

test('scoring: perfect and empty detectors, divide-by-zero is null, missing predictions count as allow', () => {
  const perfect = score(labels, labels.map((l) => ({ id: l.id, verdict: l.label === 'scam' ? 'hold' : 'allow' })));
  assert.equal(perfect.hold.recall, 1);
  assert.equal(perfect.hold.precision, 1);
  assert.equal(perfect.hold.fpr, 0);
  assert.deepEqual(perfect.misclassified, []);

  const none = score(labels, []);
  assert.equal(none.hold.recall, 0);
  assert.equal(none.hold.precision, null, 'no positive predictions: precision is undefined, not 0');
  assert.equal(none.hold.f1, null);
  assert.equal(none.missingPredictions.length, 6);

  const allBenign = score(labels.filter((l) => l.label === 'benign'), []);
  assert.equal(allBenign.hold.recall, null, 'no scams in the labels: recall is undefined');
});

test('scoring: unknown verdicts and unknown ids are reported, not silently accepted', () => {
  const r = score(labels, [{ id: 'a', verdict: 'maybe' }, { id: 'zzz', verdict: 'hold' }]);
  assert.equal(r.problems.length, 2);
  assert.match(r.problems.join(' '), /unknown verdict/);
  assert.match(r.problems.join(' '), /no such script/);
});

test('the markdown report states both operating points and lists the failures', () => {
  const md = toMarkdown(score(labels, [{ id: 'a', verdict: 'hold' }]), 'demo');
  assert.match(md, /hold \(blocks the action\)/);
  assert.match(md, /flag \(hold or caution\)/);
  assert.match(md, /Misclassified/);
  assert.match(md, /missed scam/);
});

test('similarity helper: identical texts match, different texts do not', () => {
  assert.equal(jaccard(shingles('buy gift cards today now'), shingles('buy gift cards today now')), 1);
  assert.ok(jaccard(shingles('buy gift cards today now'), shingles('your appointment is on thursday')) < 0.1);
});
