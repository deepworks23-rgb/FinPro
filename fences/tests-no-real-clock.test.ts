/**
 * @owner FinTrack Engineering
 * @reason Testes não usam relógio real (`new Date()`), evitando falhas dependentes de hora/fuso (Conformidade 5.19, Lição D1).
 * @review-date 2027-05-26
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function findTestFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findTestFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

test('unit tests do not call new Date() without explicit timestamp', () => {
  const rootDir = process.cwd();
  const files = [...findTestFiles(path.join(rootDir, 'src'))];
  const rootRateTest = path.join(rootDir, 'rateLimit.test.ts');
  if (fs.existsSync(rootRateTest)) files.push(rootRateTest);

  assert.ok(files.length > 0, 'Expected unit test files');

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    assert.equal(
      /\bnew\s+Date\s*\(\s*\)/.test(content),
      false,
      `Found non-deterministic new Date() in ${path.relative(rootDir, file)}`
    );
  }
});
