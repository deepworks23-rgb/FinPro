/**
 * @owner FinTrack Engineering
 * @reason Documentação não aponta para arquivos inexistentes no repositório (Lição I1).
 * @review-date 2027-05-26
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function collectMarkdownFiles(rootDir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(path.join(rootDir, entry.name));
    }
  }
  const docsDir = path.join(rootDir, 'docs');
  if (fs.existsSync(docsDir)) {
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith('.md')) results.push(full);
      }
    };
    walk(docsDir);
  }
  return results;
}

test('relative markdown links in root and docs/ point to existing files', () => {
  const rootDir = process.cwd();
  const mdFiles = collectMarkdownFiles(rootDir);
  assert.ok(mdFiles.length > 0, 'Expected markdown files in root or docs/');

  const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;

  for (const filePath of mdFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const dir = path.dirname(filePath);
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(content)) !== null) {
      const target = match[1].trim();
      if (
        !target ||
        target.startsWith('#') ||
        target.startsWith('http://') ||
        target.startsWith('https://') ||
        target.startsWith('mailto:')
      ) {
        continue;
      }
      const cleanTarget = target.split('#')[0];
      if (!cleanTarget) continue;
      const resolved = path.resolve(dir, cleanTarget);
      assert.ok(
        fs.existsSync(resolved),
        `Broken link "${target}" in ${path.relative(rootDir, filePath)}`
      );
    }
  }
});
