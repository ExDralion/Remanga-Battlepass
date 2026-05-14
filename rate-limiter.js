(() => {
  const smb = window.SMBP;
  if (!smb || smb.rateLimiter) return;

  function parseWaitMsFromMessage(message) {
    const source = String(message || '');
    const match = source.match(/wait\s+(\d+)\s*s/i);
    if (!match) return 0;
    return Math.max(1000, Number(match[1] || 0) * 1000);
  }

  class RateLimiter {
    constructor() {
      this.requests = new Map();
      this.blocks = new Map();
    }

    async checkLimit(endpoint, maxRequestsPerMinute = 180) {
      const now = Date.now();
      const since = now - 60_000;
      const history = (this.requests.get(endpoint) || []).filter(ts => ts > since);
      this.requests.set(endpoint, history);

      const block = this.blocks.get(endpoint);
      if (block && now < block) {
        return {
          allowed: false,
          reason: 'blocked',
          waitMs: block - now,
          currentRate: history.length
        };
      }

      if (block && now >= block) {
        this.blocks.delete(endpoint);
      }

      if (history.length >= maxRequestsPerMinute) {
        const waitMs = Math.max(500, (history[0] + 60_000) - now);
        this.blocks.set(endpoint, now + waitMs);
        return {
          allowed: false,
          reason: 'rate_limit_exceeded',
          waitMs,
          currentRate: history.length
        };
      }

      history.push(now);
      this.requests.set(endpoint, history);
      return {
        allowed: true,
        currentRate: history.length,
        remainingRequests: Math.max(0, maxRequestsPerMinute - history.length)
      };
    }

    async sendWithRateLimit(endpoint, requestFn, maxRequestsPerMinute = 180) {
      for (;;) {
        const check = await this.checkLimit(endpoint, maxRequestsPerMinute);
        if (!check.allowed) {
          const waitMs = Math.max(500, Number(check.waitMs || 0));
          if (typeof smb?.sleep === 'function') {
            await smb.sleep(waitMs);
            continue;
          }
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue;
        }

        try {
          return await requestFn();
        } catch (error) {
          const message = String(error?.message || '');
          const parsedWaitMs = parseWaitMsFromMessage(message);
          if (
            message.includes('429') ||
            message.includes('Too Many Requests') ||
            /rate limited/i.test(message)
          ) {
            const waitMs = parsedWaitMs || 60_000;
            this.blocks.set(endpoint, Date.now() + waitMs);
            if (typeof smb?.sleep === 'function') {
              await smb.sleep(waitMs);
              continue;
            }
            await new Promise(resolve => setTimeout(resolve, waitMs));
            continue;
          }
          throw error;
        }
      }
    }

    getStatus() {
      const now = Date.now();
      const status = {};
      for (const [endpoint, requests] of this.requests.entries()) {
        status[endpoint] = {
          requestsPerMinute: requests.filter(ts => ts > now - 60_000).length,
          blockedUntil: this.blocks.get(endpoint) || null
        };
      }
      return status;
    }

    clear() {
      this.requests.clear();
      this.blocks.clear();
    }
  }

  smb.RateLimiter = RateLimiter;
  smb.rateLimiter = new RateLimiter();
})();
