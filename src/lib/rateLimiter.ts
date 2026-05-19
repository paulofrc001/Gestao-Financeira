export interface RateLimitResult {
  limited: boolean;
  retryAfter: number; // in milliseconds
  remaining: number;
}

export class SlidingWindowRateLimiter {
  // Store timestamps of requests keyed by unique identifiers (e.g. "global", "user_123", "chat_comp")
  private tracker = new Map<string, number[]>();

  /**
   * Checks if a request should be rate-limited
   * @param id Unique identifier (e.g., user identifier or action name)
   * @param maxRequests Maximum requests allowed in the time window
   * @param windowMs Time window duration in milliseconds
   */
  public check(id: string, maxRequests: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    let timestamps = this.tracker.get(id) || [];

    // Clean up timestamps outside the active window
    timestamps = timestamps.filter(ts => now - ts < windowMs);

    if (timestamps.length >= maxRequests) {
      // Sort to find the oldest request in the current window
      timestamps.sort((a, b) => a - b);
      const oldestActive = timestamps[0];
      const retryAfter = Math.max(0, windowMs - (now - oldestActive));
      
      console.warn(`[RateLimiter] BLOCKED '${id}'. Limit: ${maxRequests}/${windowMs / 1000}s. Retrying in ${(retryAfter / 1000).toFixed(1)}s`);
      
      return {
        limited: true,
        retryAfter,
        remaining: 0
      };
    }

    // Add current timestamp and store
    timestamps.push(now);
    this.tracker.set(id, timestamps);

    const remaining = maxRequests - timestamps.length;
    console.log(`[RateLimiter] APPROVED '${id}'. Remaining: ${remaining}/${maxRequests}`);

    return {
      limited: false,
      retryAfter: 0,
      remaining
    };
  }

  /**
   * Reset tracking for a key
   */
  public reset(id: string): void {
    this.tracker.delete(id);
  }

  /**
   * Clears all tracking records
   */
  public clear(): void {
    this.tracker.clear();
  }
}

// In-memory rate limiting instances
export const clientRateLimiter = new SlidingWindowRateLimiter();
export const serverRateLimiter = new SlidingWindowRateLimiter();
