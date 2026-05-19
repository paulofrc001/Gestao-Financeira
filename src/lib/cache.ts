export interface CacheEntry<T = any> {
  value: T;
  expiresAt: number;
}

export class InMemoryCache {
  private cache = new Map<string, CacheEntry>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs = 5 * 60 * 1000) { // Default to 5 minutes
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Generates a stable string key from any serializable request payload
   */
  public generateKey(prefix: string, payload: any): string {
    try {
      const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
      return `${prefix}:${serialized}`;
    } catch {
      return `${prefix}:${String(payload)}`;
    }
  }

  /**
   * Retrieves an item from the cache. If expired, deletes it and returns null.
   */
  public get<T = any>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      console.log(`[Cache] Entry expired for key: ${key}`);
      this.cache.delete(key);
      return null;
    }

    console.log(`[Cache] HIT for key: ${key}`);
    return entry.value as T;
  }

  /**
   * Stores an item in the cache with a specific TTL
   */
  public set<T = any>(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.cache.set(key, { value, expiresAt });
    console.log(`[Cache] SET for key: ${key}, expires in ${(ttlMs ?? this.defaultTtlMs) / 1000}s`);
  }

  /**
   * Invalidates a single key
   */
  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clears all cached requests
   */
  public clear(): void {
    this.cache.clear();
    console.log('[Cache] Cleared all entries.');
  }

  /**
   * Periodically cleans up expired keys to prevent memory leaks
   */
  public pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton instance for the app
export const geminiCache = new InMemoryCache();
