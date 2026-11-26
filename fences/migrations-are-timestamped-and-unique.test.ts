/**
 * @owner FinTrack Engineering
 * @reason Um caminho de schema com migrations por carimbo de tempo único (Conformidade 5.5, Lição A2).
 * @review-date 2027-05-26
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('migrations are timestamped (14 digits) and unique', () => {
  const dir = path.resolve(process.cwd(), 'migrations');
  assert.ok(fs.existsSync(dir), 'migrations/ directory must exist');

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql'));
  assert.ok(files.length > 0, 'migrations/ must contain at least one .sql file');

  const timestamps = new Set<string>();
  for (const file of files) {
    const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(file);
    assert.ok(match, `Invalid migration filename "${file}". Expected YYYYMMDDHHMMSS_name.sql`);
    assert.ok(!timestamps.has(match[1]), `Duplicate migration timestamp ${match[1]}`);
    timestamps.add(match[1]);
  }
});
