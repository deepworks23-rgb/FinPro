/**
 * Normalizes an IP address for rate limiting:
 * - Strips IPv4-mapped IPv6 prefix (`::ffff:1.2.3.4` -> `1.2.3.4`).
 * - Collapses IPv6 addresses to their `/64` prefix so rotating hosts in the same `/64` share one bucket.
 */
export function normalizeClientIp(rawIp: string): string {
  const cleaned = rawIp.trim().split('%')[0].toLowerCase();
  if (!cleaned) return 'unknown';

  if (cleaned.startsWith('::ffff:')) {
    const v4Part = cleaned.slice(7);
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v4Part)) {
      return v4Part;
    }
  }

  if (cleaned.includes(':')) {
    const expanded = expandIpv6(cleaned);
    if (expanded) {
      return `${expanded.slice(0, 4).join(':')}::/64`;
    }
  }

  return cleaned;
}

function expandIpv6(addr: string): string[] | null {
  const halves = addr.split('::');
  if (halves.length > 2) return null;

  const left = halves[0] ? halves[0].split(':').filter(Boolean) : [];
  const right = halves[1] ? halves[1].split(':').filter(Boolean) : [];

  if (halves.length === 1) {
    if (left.length !== 8) return null;
    return left.map((g) => g.padStart(4, '0'));
  }

  const missing = 8 - (left.length + right.length);
  if (missing < 0) return null;

  const middle = Array.from({ length: missing }, () => '0000');
  return [...left, ...middle, ...right].map((g) => g.padStart(4, '0'));
}

interface AttemptEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  maxAttempts?: number;
  windowMs?: number;
  nowFn?: () => number;
}

/**
 * In-memory login rate limiter keyed by (identifier + normalized IP/64) with automatic expiration cleanup.
 */
export class LoginRateLimiter {
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly nowFn: () => number;
  private readonly entries = new Map<string, AttemptEntry>();

  constructor(options: RateLimitOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 5;
    this.windowMs = options.windowMs ?? 15 * 60 * 1000;
    this.nowFn = options.nowFn ?? (() => Date.now());
  }

  private makeKey(identifier: string, rawIp: string): string {
    return `${identifier.trim().toLowerCase()}|${normalizeClientIp(rawIp)}`;
  }

  prune(): void {
    const now = this.nowFn();
    for (const [key, entry] of this.entries.entries()) {
      if (entry.resetAt <= now) {
        this.entries.delete(key);
      }
    }
  }

  check(identifier: string, rawIp: string): { allowed: boolean; retryAfterSec: number } {
    this.prune();
    const key = this.makeKey(identifier, rawIp);
    const entry = this.entries.get(key);
    if (!entry) {
      return { allowed: true, retryAfterSec: 0 };
    }
    if (entry.count >= this.maxAttempts) {
      const remainingMs = Math.max(0, entry.resetAt - this.nowFn());
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil(remainingMs / 1000)),
      };
    }
    return { allowed: true, retryAfterSec: 0 };
  }

  recordFailure(identifier: string, rawIp: string): void {
    this.prune();
    const now = this.nowFn();
    const key = this.makeKey(identifier, rawIp);
    const existing = this.entries.get(key);
    if (!existing || existing.resetAt <= now) {
      this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    existing.count += 1;
  }

  reset(identifier: string, rawIp: string): void {
    const key = this.makeKey(identifier, rawIp);
    this.entries.delete(key);
  }

  size(): number {
    return this.entries.size;
  }
}
