#!/usr/bin/env node
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { jaccard, readJsonl, SCAM_CATEGORIES, shingles } from './lib.mjs';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const PRIVATE_DATA = /https?:\/\/|www\./i;
const PHONE = /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/;
const NEAR_DUPLICATE = 0.8;
const PREFIX = { dev: 'd-', test: 't-', test2: 'u-' };
/** Records per label in each split. */
const PER_LABEL = { dev: 15, test: 15, test2: 20 };

/**
 * Validate one or more splits. Returns a list of human-readable problems (empty when everything is fine).
 * `files` is { dev: path, test: path }; any split may be omitted.
 */
export function validate(files, { schemaPath = join(root, 'schema', 'script.schema.json') } = {}) {
  const Ajv = require('ajv/dist/2020').default;
  const ajv = new Ajv({ allErrors: true, strict: true });
  const check = ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')));
  const problems = [];
  const bySplit = {};

  for (const [split, path] of Object.entries(files)) {
    const rows = readJsonl(path);
    bySplit[split] = rows;
    const ids = new Set();
    for (const r of rows) {
      const where = `${split}/${r?.id ?? '?'}`;
      if (!check(r)) {
        for (const e of check.errors) problems.push(`${where}: ${e.instancePath || '(record)'} ${e.message}`);
        continue;
      }
      if (r.split !== split) problems.push(`${where}: split "${r.split}" does not match file "${split}"`);
      if (!r.id.startsWith(PREFIX[split])) problems.push(`${where}: id prefix does not match the split`);
      if (ids.has(r.id)) problems.push(`${where}: duplicate id`);
      ids.add(r.id);
      if (PRIVATE_DATA.test(r.text) || PHONE.test(r.text)) problems.push(`${where}: contains a URL or phone number (use invented, generic text)`);
      const isScamCat = SCAM_CATEGORIES.includes(r.category);
      if ((r.label === 'scam') !== isScamCat) problems.push(`${where}: category "${r.category}" does not belong to label "${r.label}"`);
    }

    const scams = rows.filter((r) => r.label === 'scam');
    const benign = rows.filter((r) => r.label === 'benign');
    const want = PER_LABEL[split] ?? 15;
    if (scams.length !== want) problems.push(`${split}: expected ${want} scam records, found ${scams.length}`);
    if (benign.length !== want) problems.push(`${split}: expected ${want} benign records, found ${benign.length}`);
    const tricky = benign.filter((r) => r.difficulty === 'tricky').length;
    if (tricky < Math.ceil(benign.length * 0.4)) problems.push(`${split}: at least 40% of benign records must be tricky (found ${tricky}/${benign.length})`);
    const cats = new Set(scams.map((r) => r.category));
    if (cats.size < 6) problems.push(`${split}: at least 6 distinct scam categories required (found ${cats.size})`);
  }

  const splits = Object.keys(bySplit);
  for (let i = 0; i < splits.length; i++) {
    for (let j = i + 1; j < splits.length; j++) {
      const a = new Set(bySplit[splits[i]].map((r) => r.author));
      for (const x of new Set(bySplit[splits[j]].map((r) => r.author))) {
        if (a.has(x)) problems.push(`author label "${x}" appears in both ${splits[i]} and ${splits[j]}`);
      }
    }
  }

  const all = Object.entries(bySplit).flatMap(([split, rows]) => rows.map((r) => ({ split, r, sh: shingles(r.text ?? '') })));
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      if (jaccard(a.sh, b.sh) >= NEAR_DUPLICATE) problems.push(`near-duplicate texts: ${a.split}/${a.r.id} and ${b.split}/${b.r.id}`);
    }
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = {};
  for (const split of ['dev', 'test', 'test2']) {
    const p = join(root, 'data', `${split}.jsonl`);
    if (existsSync(p)) files[split] = p;
  }
  const problems = validate(files);
  if (problems.length) {
    console.error(`${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  const counts = Object.entries(files).map(([s, p]) => `${s}: ${readJsonl(p).length}`).join(', ');
  console.log(`OK (${counts})`);
}
