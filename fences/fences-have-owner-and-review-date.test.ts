/**
 * @owner FinTrack Engineering
 * @reason Toda cerca tem dono, motivo e data de revisão (Conformidade 5.9, Lição D6).
 * @review-date 2027-05-26
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('every fence file declares @owner, @reason, and @review-date', () => {
  const fencesDir = path.resolve(process.cwd(), 'fences');
  const files = fs.readdirSync(fencesDir).filter((f) => f.endsWith('.test.ts'));
  assert.ok(files.length > 0, 'Expected at least one fence in fences/');

  for (const file of files) {
    const content = fs.readFileSync(path.join(fencesDir, file), 'utf8');
    assert.match(content, /@owner\s+\S+/, `${file} missing @owner`);
    assert.match(content, /@reason\s+\S+/, `${file} missing @reason`);
    assert.match(content, /@review-date\s+\d{4}-\d{2}-\d{2}/, `${file} missing @review-date YYYY-MM-DD`);
  }
});
