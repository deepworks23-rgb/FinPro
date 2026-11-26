import test from 'node:test';
import assert from 'node:assert/strict';
import { LoginRateLimiter, normalizeClientIp } from './rateLimit';

test('normalizeClientIp collapses IPv6 addresses to /64 and unwraps IPv4-mapped addresses', () => {
  assert.equal(normalizeClientIp('::ffff:192.0.2.10'), '192.0.2.10');
  assert.equal(normalizeClientIp('2001:db8:85a3:0:0:8a2e:370:7334'), '2001:0db8:85a3:0000::/64');
  assert.equal(normalizeClientIp('2001:db8:85a3::1'), '2001:0db8:85a3:0000::/64');
  assert.equal(normalizeClientIp('2001:db8:85a3::ffff:9999'), '2001:0db8:85a3:0000::/64');
});

test('LoginRateLimiter blocks rotating IPv6 hosts within the same /64 after maxAttempts', () => {
  let now = 1_000_000;
  const limiter = new LoginRateLimiter({ maxAttempts: 5, windowMs: 60_000, nowFn: () => now });
  const id = 'user@example.com';

  for (let i = 1; i <= 5; i++) {
    assert.equal(limiter.check(id, `2001:db8:85a3::${i}`).allowed, true);
    limiter.recordFailure(id, `2001:db8:85a3::${i}`);
  }

  const blocked = limiter.check(id, '2001:db8:85a3::99');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSec, 60);
});

test('LoginRateLimiter does not lock out an identifier from a different IP', () => {
  let now = 1_000_000;
  const limiter = new LoginRateLimiter({ maxAttempts: 2, windowMs: 60_000, nowFn: () => now });
  const id = '+258 84 123 4567';

  limiter.recordFailure(id, '198.51.100.1');
  limiter.recordFailure(id, '198.51.100.1');

  assert.equal(limiter.check(id, '198.51.100.1').allowed, false);
  assert.equal(limiter.check(id, '203.0.113.5').allowed, true);
});

test('LoginRateLimiter reset() and prune() clear entries deterministically', () => {
  let now = 1_000_000;
  const limiter = new LoginRateLimiter({ maxAttempts: 2, windowMs: 30_000, nowFn: () => now });

  limiter.recordFailure('a@example.com', '10.0.0.1');
  limiter.recordFailure('b@example.com', '10.0.0.2');
  assert.equal(limiter.size(), 2);

  limiter.reset('a@example.com', '10.0.0.1');
  assert.equal(limiter.size(), 1);

  now += 31_000;
  limiter.prune();
  assert.equal(limiter.size(), 0);
  assert.equal(limiter.check('b@example.com', '10.0.0.2').allowed, true);
});
