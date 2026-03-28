import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimit, clearAllRateLimits, runCleanup } from '../rate-limiter';

describe('Rate Limiter', () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  describe('checkRateLimit', () => {
    it('should allow the first request from an IP', () => {
      const result = checkRateLimit('192.168.1.1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should track remaining requests correctly', () => {
      for (let i = 0; i < 5; i++) checkRateLimit('192.168.1.1');
      const result = checkRateLimit('192.168.1.1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should block after 10 requests', () => {
      for (let i = 0; i < 10; i++) expect(checkRateLimit('192.168.1.1').allowed).toBe(true);
      const blocked = checkRateLimit('192.168.1.1');
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
    });

    it('should isolate rate limits per IP', () => {
      for (let i = 0; i < 10; i++) checkRateLimit('192.168.1.1');
      const result = checkRateLimit('192.168.1.2');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should handle "unknown" IP gracefully', () => {
      expect(checkRateLimit('unknown').allowed).toBe(true);
    });

    it('should report retryAfterMs within window range when blocked', () => {
      for (let i = 0; i < 10; i++) checkRateLimit('10.0.0.1');
      const result = checkRateLimit('10.0.0.1');
      expect(result.retryAfterMs!).toBeGreaterThan(0);
      expect(result.retryAfterMs!).toBeLessThanOrEqual(60000);
    });

    it('should handle rapid sequential requests correctly', () => {
      for (let i = 0; i < 10; i++) {
        const r = checkRateLimit('fast.user');
        expect(r.allowed).toBe(true);
        expect(r.remaining).toBe(10 - (i + 1));
      }
      expect(checkRateLimit('fast.user').allowed).toBe(false);
    });
  });

  describe('resetRateLimit', () => {
    it('should allow requests again after reset', () => {
      for (let i = 0; i < 10; i++) checkRateLimit('192.168.1.1');
      expect(checkRateLimit('192.168.1.1').allowed).toBe(false);
      resetRateLimit('192.168.1.1');
      expect(checkRateLimit('192.168.1.1').allowed).toBe(true);
    });

    it('should only reset the target IP, not others', () => {
      for (let i = 0; i < 5; i++) {
        checkRateLimit('a.a.a.a');
        checkRateLimit('b.b.b.b');
      }
      resetRateLimit('a.a.a.a');
      expect(checkRateLimit('a.a.a.a').remaining).toBe(9);
      expect(checkRateLimit('b.b.b.b').remaining).toBe(4);
    });

    it('should not throw when resetting a non-existent IP', () => {
      expect(() => resetRateLimit('never.seen.ip')).not.toThrow();
    });
  });

  describe('clearAllRateLimits', () => {
    it('should reset all IPs simultaneously', () => {
      checkRateLimit('1.1.1.1');
      checkRateLimit('2.2.2.2');
      clearAllRateLimits();
      expect(checkRateLimit('1.1.1.1').remaining).toBe(9);
      expect(checkRateLimit('2.2.2.2').remaining).toBe(9);
    });
  });

  describe('runCleanup', () => {
    it('should remove stale entries from the store', () => {
      // Add a request under a test IP
      checkRateLimit('stale.ip');

      // Manually backdate the timestamp so it falls outside the window
      const store = global.__rateLimitStore!;
      const entry = store.get('stale.ip')!;
      entry.timestamps = [Date.now() - 70 * 1000]; // 70 seconds ago, beyond 60s window

      // Run cleanup — should evict the stale entry
      runCleanup();

      // The entry should be gone; this IP should be fresh
      const result = checkRateLimit('stale.ip');
      expect(result.remaining).toBe(9);
    });

    it('should keep entries that still have recent timestamps', () => {
      checkRateLimit('active.ip');

      // Run cleanup — entry has a very fresh timestamp, should NOT be evicted
      runCleanup();

      // Should still have 9 slots used (1 was recorded before cleanup)
      const result = checkRateLimit('active.ip');
      expect(result.remaining).toBe(8); // 2 requests now: original + this call
    });

    it('should handle empty store without throwing', () => {
      clearAllRateLimits();
      expect(() => runCleanup()).not.toThrow();
    });

    it('should only delete entries with no remaining timestamps after sliding', () => {
      // IP with 1 stale + 1 fresh timestamp
      checkRateLimit('mixed.ip');
      const store = global.__rateLimitStore!;
      const entry = store.get('mixed.ip')!;
      // Add one very old timestamp alongside the fresh one
      entry.timestamps.unshift(Date.now() - 65 * 1000);

      runCleanup();

      // Entry should still exist (has a fresh timestamp), but stale one removed
      const result = checkRateLimit('mixed.ip');
      // 1 fresh survived + this call = 2 used
      expect(result.remaining).toBe(8);
    });
  });
});
