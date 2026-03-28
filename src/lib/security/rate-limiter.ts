/**
 * In-Memory Sliding Window Rate Limiter
 * Limits requests per IP within a configurable time window.
 * Designed to be swapped for Redis/Memorystore in production.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;

// Global store survives HMR in Next.js dev
declare global {
  var __rateLimitStore: Map<string, RateLimitEntry> | undefined;
  var __rateLimitCleanup: NodeJS.Timeout | undefined;
}

const getStore = (): Map<string, RateLimitEntry> => {
  if (!global.__rateLimitStore) {
    global.__rateLimitStore = new Map<string, RateLimitEntry>();
  }
  return global.__rateLimitStore;
};

const store: Map<string, RateLimitEntry> = getStore();

// Exported for testing purposes
export function runCleanup(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter(t => now - t < WINDOW_MS);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

// Periodic cleanup to prevent memory leaks (every 5 minutes)
if (!global.__rateLimitCleanup) {
  global.__rateLimitCleanup = setInterval(runCleanup, 5 * 60 * 1000);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

/**
 * Check if a request from the given IP is allowed.
 */
export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const entry = store.get(ip) || { timestamps: [] };

  // Slide the window — remove timestamps older than the window
  entry.timestamps = entry.timestamps.filter(t => now - t < WINDOW_MS);

  if (entry.timestamps.length >= MAX_REQUESTS) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = WINDOW_MS - (now - oldestInWindow);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs
    };
  }

  // Record this request
  entry.timestamps.push(now);
  store.set(ip, entry);

  return {
    allowed: true,
    remaining: MAX_REQUESTS - entry.timestamps.length
  };
}

/**
 * Reset rate limit for an IP (useful for testing).
 */
export function resetRateLimit(ip: string): void {
  store.delete(ip);
}

/**
 * Clear all rate limit data (useful for testing).
 */
export function clearAllRateLimits(): void {
  store.clear();
}
