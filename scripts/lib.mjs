import { readFileSync } from 'node:fs';

export const SCAM_CATEGORIES = [
  'gift_card', 'wire_crypto', 'bank_impersonation', 'government_impersonation', 'tech_support_remote',
  'family_emergency', 'prize_lottery', 'verification_code', 'delivery_fee', 'romance_investment',
];

/** Read a JSONL file into records; throws with the offending line number on bad JSON. */
export function readJsonl(path) {
  const rows = [];
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    try {
      rows.push(JSON.parse(line));
    } catch (e) {
      throw new Error(`${path}:${i + 1}: invalid JSON (${e.message})`);
    }
  });
  return rows;
}

/** Lowercase word 3-grams, for near-duplicate detection. */
export function shingles(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9$\s]/g, ' ').split(/\s+/).filter(Boolean);
  const out = new Set();
  for (let i = 0; i + 2 < words.length; i++) out.add(words.slice(i, i + 3).join(' '));
  if (out.size === 0) out.add(words.join(' '));
  return out;
}

export function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
