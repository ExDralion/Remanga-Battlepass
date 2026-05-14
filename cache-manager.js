(() => {
  const smb = window.SMBP;
  if (!smb || smb.LRUCache) return;

  class LRUCache {
    constructor(maxSize = 100) {
      this.maxSize = Math.max(1, Number(maxSize) || 100);
      this.cache = new Map();
      this.expirations = new Map();
    }

    get(key) {
      if (!this.cache.has(key)) return undefined;
      if (this.#isExpired(key)) {
        this.delete(key);
        return undefined;
      }

      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }

    has(key) {
      if (!this.cache.has(key)) return false;
      if (this.#isExpired(key)) {
        this.delete(key);
        return false;
      }
      return true;
    }

    set(key, value, ttlMs = null) {
      if (this.cache.has(key)) {
        this.cache.delete(key);
      } else if (this.cache.size >= this.maxSize) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey !== undefined) this.delete(oldestKey);
      }

      this.cache.set(key, value);

      if (Number.isFinite(ttlMs) && ttlMs > 0) {
        this.expirations.set(key, Date.now() + ttlMs);
      } else {
        this.expirations.delete(key);
      }

      return value;
    }

    delete(key) {
      this.expirations.delete(key);
      return this.cache.delete(key);
    }

    clear() {
      this.cache.clear();
      this.expirations.clear();
    }

    pruneExpired() {
      let removed = 0;
      for (const key of [...this.cache.keys()]) {
        if (this.#isExpired(key)) {
          this.delete(key);
          removed += 1;
        }
      }
      return removed;
    }

    get size() {
      this.pruneExpired();
      return this.cache.size;
    }

    getStats() {
      return {
        size: this.size,
        maxSize: this.maxSize,
        utilization: this.maxSize ? Number(((this.size / this.maxSize) * 100).toFixed(1)) : 0
      };
    }

    #isExpired(key) {
      const expiresAt = this.expirations.get(key);
      return Number.isFinite(expiresAt) && Date.now() >= expiresAt;
    }
  }

  smb.LRUCache = LRUCache;
})();
