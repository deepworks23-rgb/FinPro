/**
 * @owner FinTrack Engineering
 * @reason Impedir vazamento de segredos ou credenciais reais no repositório rastreado (Conformidade 5.17, Lição H7).
 * @review-date 2027-05-26
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SECRET_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'Neon Access Key', regex: /\bnak_live_[A-Za-z0-9]{16,}/ },
  { name: 'Neon Secret Key', regex: /\bnsk_live_[A-Za-z0-9]{16,}/ },
  { name: 'Neon Postgres Password Token', regex: /\bnpg_[A-Za-z0-9]{8,}/ },
  { name: 'Private Key Block', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    name: 'Hardcoded Postgres URL with non-placeholder password',
    regex: /postgresql:\/\/[^:\s]+:(?!password|replace|MY_|<)[^@\s]{6,}@[^\s"']+/i,
  },
];

test('no tracked files contain live secret patterns', () => {
  const trackedRaw = execFileSync('git', ['ls-files'], { encoding: 'utf8' });
  const trackedFiles = trackedRaw
    .split(/\r?\n/)
    .map((f) => f.trim())
    .filter(Boolean);

  assert.ok(trackedFiles.length > 0, 'git ls-files returned no files');

  for (const relPath of trackedFiles) {
    if (relPath === 'fences/no-secrets-in-tracked-files.test.ts') continue;
    const fullPath = path.resolve(process.cwd(), relPath);
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    for (const pattern of SECRET_PATTERNS) {
      assert.equal(
        pattern.regex.test(content),
        false,
        `Potential secret (${pattern.name}) found in tracked file: ${relPath}`
      );
    }
  }
});
