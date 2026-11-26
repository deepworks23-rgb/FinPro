/**
 * @owner FinTrack Engineering
 * @reason Garantir isolamento estrito por utilizador: sem cache partilhado de API, sem userId vindo do cliente e prefixo S3 validado por utilizador (Lição B1/K28).
 * @review-date 2027-05-26
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('API enforces no-store cache headers, derives user strictly from session, and scopes S3 keys', () => {
  const apiAppPath = path.resolve(process.cwd(), 'apiApp.ts');
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const apiSrc = fs.readFileSync(apiAppPath, 'utf8');
  const pkgSrc = fs.readFileSync(pkgPath, 'utf8');

  assert.match(
    apiSrc,
    /Cache-Control['"]\s*,\s*['"][^'"]*no-store[^'"]*['"]/,
    'apiApp.ts must set Cache-Control no-store on /api responses'
  );
  assert.equal(
    /req\.(body|params|query)\.(userId|user_id)\b/.test(apiSrc),
    false,
    'apiApp.ts must never trust userId/user_id from req.body, req.params, or req.query'
  );
  assert.match(
    apiSrc,
    /avatarS3Key\.startsWith\(`avatars\/\$\{user\.id\}\/`\)/,
    'sanitizeUser must verify avatarS3Key belongs to user.id before presigning'
  );
  assert.ok(
    pkgSrc.includes('fences/user-isolation-routes.test.ts'),
    'package.json fences script must include user-isolation-routes.test.ts'
  );
});
