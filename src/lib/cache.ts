/**
 * Ultra-fast In-Memory & SessionStorage Cache Helper
 * Avoids repeated network roundtrips and prevents slow/infinite loadings.
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheItem<any>>();

export const FastCache = {
  get<T>(key: string, maxAgeMs = 1000 * 60 * 5): T | null {
    // 1. Check memory cache (fastest)
    const mem = memoryCache.get(key);
    if (mem && Date.now() - mem.timestamp < maxAgeMs) {
      return mem.data as T;
    }

    // 2. Check sessionStorage
    try {
      const raw = sessionStorage.getItem(`fmk_cache_${key}`);
      if (raw) {
        const parsed: CacheItem<T> = JSON.parse(raw);
        if (Date.now() - parsed.timestamp < maxAgeMs) {
          memoryCache.set(key, parsed);
          return parsed.data;
        }
      }
    } catch {
      // Ignore storage errors
    }

    return null;
  },

  set<T>(key: string, data: T): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
    };
    memoryCache.set(key, item);
    try {
      sessionStorage.setItem(`fmk_cache_${key}`, JSON.stringify(item));
    } catch {
      // Ignore storage quota errors
    }
  },

  invalidate(keyPrefix: string): void {
    for (const k of memoryCache.keys()) {
      if (k.startsWith(keyPrefix)) {
        memoryCache.delete(k);
      }
    }
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(`fmk_cache_${keyPrefix}`)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      // Ignore
    }
  },

  clear(): void {
    memoryCache.clear();
    try {
      sessionStorage.clear();
    } catch {
      // Ignore
    }
  }
};
