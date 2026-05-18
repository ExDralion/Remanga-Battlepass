// SailorM Battlepass compact content bundle.
// Generated from: shared.js, cache-manager.js, rate-limiter.js, batch-executor.js, tasks.js, ui.js


// ===== shared.js =====

(() => {
  if (window.SMBP) return;

  const STORE_KEY = 'smbp-settings';
  const DIAGNOSTICS_KEY = 'smbp-diagnostics';
  const VERSION = '1.0.0';
  const MAX_DIAGNOSTIC_ENTRIES = 120;
  const DEFAULT_SETTINGS = {
    rewardsHidePaid: false,
    inlineTaskButtonsEnabled: true,
    inlineTaskButtonText: 'Выполнить',
    inlineTaskButtonRunningText: 'Выполняется...',
    inlineTaskButtonDoneText: 'Готово',
    inlineTaskButtonErrorText: 'Ошибка',
    inlineTaskButtonColor: '#166c46',
    deckTaskPreferredDeckIds: '10',
    commentTaskText: 'Спасибо за главу!',
    commentReplyTaskText: 'Спасибо за ответ!',
    searchHistory: {},
    failedSearchHistory: {},
    titleBlacklist: {},
    chapterHistory: {},
    similarHistory: {},
    commentHistory: [],
    commentVoteHistory: [],
    commentReplyHistory: [],
    profileHistory: [],
    friendRequestHistory: [],
    guildRequestHistory: [],
    exchangeTargetHistory: []
  };

  const GAME_IDS = {
    memory: 48,
    puzzle: 46,
    quiz: 49,
    difference: 63
  };

  const EVENT_TO_GAME = {
    46: 'puzzle',
    48: 'memory',
    49: 'quiz',
    63: 'difference'
  };

  const TASK_SECTIONS = [
    'daily',
    'dailyRefresh',
    'weekly',
    'weeklyRefresh',
    'monthly',
    'monthlyRefresh',
    'permanent',
    'special'
  ];

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/\u0451/g, '\u0435')
      .replace(/[«»"'`]/g, '')
      .replace(/[.,!?():;]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getRateLimitKey(path, method = 'GET') {
    try {
      const url = new URL(path, location.origin);
      return `${String(method || 'GET').toUpperCase()} ${url.pathname}`;
    } catch (_error) {
      return `${String(method || 'GET').toUpperCase()} ${String(path || '')}`;
    }
  }

  function extractApiErrorMessage(payload, fallback = '') {
    if (!payload) return String(fallback || '').trim();
    if (typeof payload === 'string') return payload.trim() || String(fallback || '').trim();
    if (typeof payload?.detail === 'string') return payload.detail.trim();
    if (Array.isArray(payload?.detail) && payload.detail.length) {
      const nested = extractApiErrorMessage(payload.detail[0], fallback);
      if (nested) return nested;
    }
    if (typeof payload?.message === 'string') return payload.message.trim();
    if (Array.isArray(payload?.message) && payload.message.length) {
      const nested = extractApiErrorMessage(payload.message[0], fallback);
      if (nested) return nested;
    }
    if (Array.isArray(payload?.non_field_errors) && payload.non_field_errors.length) {
      const nested = extractApiErrorMessage(payload.non_field_errors[0], fallback);
      if (nested) return nested;
    }
    if (Array.isArray(payload)) {
      for (const item of payload) {
        const nested = extractApiErrorMessage(item, fallback);
        if (nested) return nested;
      }
    }
    if (typeof payload === 'object') {
      for (const value of Object.values(payload)) {
        const nested = extractApiErrorMessage(value, fallback);
        if (nested) return nested;
      }
    }
    return String(fallback || '').trim();
  }

  async function api(path, { method = 'GET', body, maxRequestsPerMinute } = {}) {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    const normalizedMethod = String(method || 'GET').toUpperCase();

    const runRequest = async () => {
      const maxAttempts = normalizedMethod === 'GET' ? 3 : 1;
      let lastError = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const response = await fetch(path, {
          method,
          headers,
          credentials: 'include',
          body: body !== undefined ? JSON.stringify(body) : undefined
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          let message = text || `HTTP ${response.status}`;
          try {
            const payload = JSON.parse(text);
            message = extractApiErrorMessage(payload, message) || payload?.msg || message;
          } catch (_error) {
            message = text || message;
          }
          lastError = new Error(`${message}${message.includes('HTTP ') ? '' : ` (HTTP ${response.status})`}`);
          if (normalizedMethod === 'GET' && [429, 502, 503, 504].includes(Number(response.status)) && attempt < maxAttempts) {
            await sleep(450 * attempt);
            continue;
          }
          throw lastError;
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) return response.json();
        return response.text();
      }

      throw lastError || new Error('API request failed');
    };

    if (!window.SMBP?.rateLimiter) return runRequest();

    return window.SMBP.rateLimiter.sendWithRateLimit(
      getRateLimitKey(path, method),
      runRequest,
      Number(maxRequestsPerMinute) || 180
    );
  }

  const apiGet = path => api(path);
  const apiPost = (path, body) => api(path, { method: 'POST', body });
  const apiPut = (path, body) => api(path, { method: 'PUT', body });

  function flattenTasks(content) {
    const items = [];
    for (const section of TASK_SECTIONS) {
      const list = Array.isArray(content?.[section]) ? content[section] : [];
      for (const task of list) items.push({ ...task, section });
    }
    return items;
  }

  function isTaskReady(task) {
    return Number(task?.progress || 0) >= Number(task?.goal || 0) && !task?.claimed;
  }

  function isTaskDone(task) {
    return Number(task?.progress || 0) >= Number(task?.goal || 0);
  }

  function gameFromTask(task) {
    return EVENT_TO_GAME[Number(task?.event)] || null;
  }

  function formatTaskProgress(task) {
    return `${Number(task?.progress || 0)} / ${Number(task?.goal || 0)}`;
  }

  async function claimTask(taskId) {
    return apiPost('/api/battlepass/tasks/', { task: taskId });
  }

  async function manageMinigame(gameId) {
    return apiPost('/api/battlepass/manage-minigames/', { game_id: gameId });
  }

  async function loadSettings() {
    if (!chrome?.storage?.local) return { ...DEFAULT_SETTINGS };
    return new Promise(resolve => {
      chrome.storage.local.get([STORE_KEY], data => {
        resolve({ ...DEFAULT_SETTINGS, ...(data?.[STORE_KEY] || {}) });
      });
    });
  }

  async function saveSettings(patch) {
    const next = { ...(await loadSettings()), ...patch };
    if (!chrome?.storage?.local) return next;
    return new Promise(resolve => {
      chrome.storage.local.set({ [STORE_KEY]: next }, () => resolve(next));
    });
  }

  async function loadDiagnostics() {
    if (!chrome?.storage?.local) return [];
    return new Promise(resolve => {
      chrome.storage.local.get([DIAGNOSTICS_KEY], data => {
        const entries = Array.isArray(data?.[DIAGNOSTICS_KEY]) ? data[DIAGNOSTICS_KEY] : [];
        resolve(entries);
      });
    });
  }

  async function saveDiagnostics(entries) {
    const normalizedEntries = Array.isArray(entries)
      ? entries.slice(0, MAX_DIAGNOSTIC_ENTRIES)
      : [];
    if (!chrome?.storage?.local) return normalizedEntries;
    return new Promise(resolve => {
      chrome.storage.local.set({ [DIAGNOSTICS_KEY]: normalizedEntries }, () => resolve(normalizedEntries));
    });
  }

  function normalizeDiagnosticEntry(entry = {}) {
    return {
      id: String(entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      at: entry.at || new Date().toISOString(),
      level: String(entry.level || 'info'),
      scope: String(entry.scope || 'general'),
      type: String(entry.type || 'event'),
      message: String(entry.message || '').trim(),
      details: entry?.details && typeof entry.details === 'object' ? entry.details : null
    };
  }

  async function recordDiagnostic(entry = {}) {
    const nextEntry = normalizeDiagnosticEntry(entry);
    const current = await loadDiagnostics();
    current.unshift(nextEntry);
    await saveDiagnostics(current);
    return nextEntry;
  }

  async function clearDiagnostics() {
    return saveDiagnostics([]);
  }

  function createToastRoot() {
    let root = document.getElementById('smbp-toast-root');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'smbp-toast-root';
    root.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;display:flex;pointer-events:none';
    document.documentElement.appendChild(root);
    return root;
  }

  let activeToast = null;
  let activeToastTimer = null;

  function toast(message) {
    const root = createToastRoot();
    let item = activeToast;

    if (!item || !item.isConnected) {
      item = document.createElement('div');
      item.style.cssText = [
        'max-width:220px',
        'padding:8px 10px',
        'border-radius:10px',
        'border:1px solid rgba(255,255,255,.07)',
        'background:rgba(12,12,14,.9)',
        'backdrop-filter:blur(12px)',
        'box-shadow:0 10px 26px rgba(0,0,0,.28)',
        'color:#f5f7fb',
        'font:11px/1.3 "Segoe UI",system-ui,sans-serif',
        'opacity:0',
        'transform:translateY(6px)',
        'transition:opacity .16s ease, transform .16s ease'
      ].join(';');
      root.appendChild(item);
      activeToast = item;
    }

    item.textContent = message;
    requestAnimationFrame(() => {
      if (!item.isConnected) return;
      item.style.opacity = '1';
      item.style.transform = 'translateY(0)';
    });

    if (activeToastTimer) clearTimeout(activeToastTimer);
    activeToastTimer = setTimeout(() => {
      if (!item.isConnected) return;
      item.style.opacity = '0';
      item.style.transform = 'translateY(6px)';
      setTimeout(() => {
        if (item.isConnected) item.remove();
        if (activeToast === item) activeToast = null;
      }, 180);
      activeToastTimer = null;
    }, 1800);
  }

  window.SMBP = {
    STORE_KEY,
    DIAGNOSTICS_KEY,
    VERSION,
    DEFAULT_SETTINGS,
    GAME_IDS,
    EVENT_TO_GAME,
    TASK_SECTIONS,
    sleep,
    normalizeText,
    extractApiErrorMessage,
    api,
    apiGet,
    apiPost,
    apiPut,
    flattenTasks,
    isTaskReady,
    isTaskDone,
    gameFromTask,
    formatTaskProgress,
    claimTask,
    manageMinigame,
    loadSettings,
    saveSettings,
    loadDiagnostics,
    saveDiagnostics,
    recordDiagnostic,
    clearDiagnostics,
    toast
  };
})();



// ===== cache-manager.js =====

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


// ===== rate-limiter.js =====

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


// ===== batch-executor.js =====

(() => {
  const smb = window.SMBP;
  if (!smb || smb.BatchExecutor) return;

  class BatchExecutor {
    constructor(batchSize = 5, delayBetweenBatches = 1500) {
      this.batchSize = Math.max(1, Number(batchSize) || 5);
      this.delayBetweenBatches = Math.max(0, Number(delayBetweenBatches) || 0);
      this.isRunning = false;
      this.paused = false;
      this.stopRequested = false;
      this.currentBatch = 0;
      this.totalBatches = 0;
      this.results = [];
    }

    async executeBatch(items, taskRunner, hooks = null) {
      const options = typeof hooks === 'function' ? { onProgress: hooks } : (hooks || {});
      this.isRunning = true;
      this.paused = false;
      this.stopRequested = false;
      this.currentBatch = 0;
      this.results = [];
      this.totalBatches = Math.ceil(items.length / this.batchSize);

      for (let index = 0; index < items.length; index += this.batchSize) {
        if (this.stopRequested) break;

        while (this.paused && !this.stopRequested) {
          await smb.sleep(100);
        }

        if (this.stopRequested) break;

        this.currentBatch = Math.floor(index / this.batchSize) + 1;
        const batchItems = items.slice(index, index + this.batchSize);

        options.onProgress?.({
          currentBatch: this.currentBatch,
          totalBatches: this.totalBatches,
          processedItems: index,
          totalItems: items.length
        });

        const settled = await Promise.allSettled(batchItems.map(item => taskRunner(item)));
        this.results.push(...settled);
        const hookResult = await options.onBatchComplete?.({
          currentBatch: this.currentBatch,
          totalBatches: this.totalBatches,
          batchItems,
          results: settled,
          processedItems: Math.min(index + batchItems.length, items.length),
          totalItems: items.length
        });

        if (hookResult?.stop) {
          this.stopRequested = true;
        }

        if (!this.stopRequested && index + this.batchSize < items.length && this.delayBetweenBatches > 0) {
          await smb.sleep(this.delayBetweenBatches);
        }
      }

      this.isRunning = false;
      return this.getResults();
    }

    pause() {
      this.paused = true;
    }

    resume() {
      this.paused = false;
    }

    stop() {
      this.stopRequested = true;
      this.isRunning = false;
    }

    getResults() {
      const successful = this.results.filter(entry => entry.status === 'fulfilled').length;
      const failed = this.results.filter(entry => entry.status === 'rejected').length;
      return {
        successful,
        failed,
        total: this.results.length,
        details: this.results
      };
    }
  }

  smb.BatchExecutor = BatchExecutor;
  smb.batchExecutor = new BatchExecutor();
})();


// ===== tasks.js =====

(() => {
  const smb = window.SMBP;
  if (!smb) return;

  const SECTION_LABELS = {
    daily: 'Daily',
    dailyRefresh: 'Daily refresh',
    weekly: 'Weekly',
    weeklyRefresh: 'Weekly refresh',
    monthly: 'Monthly',
    monthlyRefresh: 'Monthly refresh',
    permanent: 'Permanent',
    special: 'Special'
  };

  const AUTO_SEARCH_EVENTS = new Set([8, 9]);
  const AUTO_WORLD_EVENTS = new Set([7]);
  const AUTO_READING_EVENTS = new Set([4]);
  const AUTO_LIKE_EVENTS = new Set([5]);
  const AUTO_MEMORY_EVENTS = new Set([48]);
  const AUTO_DIRECT_GAME_EVENTS = new Set([46, 49, 63]);
  const AUTO_EXPERT_RATING_EVENTS = new Set([30]);
  const AUTO_COMMENT_EVENTS = new Set([20]);
  const AUTO_COMMENT_REPLY_EVENTS = new Set([21]);
  const AUTO_OPINION_RATING_EVENTS = new Set([22]);
  const AUTO_SIMILAR_EVENTS = new Set([59]);
  const AUTO_PERSONAL_PROFILE_EVENTS = new Set([34]);
  const AUTO_PROFILE_EVENTS = new Set([35]);
  const AUTO_FRIEND_REQUEST_EVENTS = new Set([41]);
  const AUTO_GUILD_REQUEST_EVENTS = new Set([61]);
  const AUTO_EXCHANGE_EVENTS = new Set([56]);
  const AUTO_INVENTORY_EVENTS = new Set([57]);
  const AUTO_DECK_CARD_EVENTS = new Set([54]);
  const AUTO_CARD_UPGRADE_EVENTS = new Set([58]);
  const AUTO_SHOP_PURCHASE_EVENTS = new Set([52]);
  const AUTO_TICKET_SPEND_EVENTS = new Set([14]);
  const SHOP_CUSTOMIZATION_TYPES = ['avatar', 'wallpaper', 'frame', 'theme'];
  const SHOP_MIN_CUSTOMIZATION_COST = 1500;
  const TICKET_CHAPTER_SOURCE_DIRS = [
    'martial_peak',
    'omniscient-reader_',
    'sss-level-hunter_',
    'return-volcano',
    'the-strongest-mercenary_',
    'machines_'
  ];
  const TICKET_TITLE_POOL_LIMIT = 30;
  const TICKET_CANDIDATE_LIMIT = 12;
  const TICKET_CHAPTER_PAGE_LIMIT = 3;
  const TICKET_CHAPTERS_PER_TITLE_LIMIT = 4;
  const CARD_UPGRADE_TYPES = {
    common: { id: 1, label: 'Обычный', required: 2 },
    exclusive: { id: 2, label: 'Эксклюзивный', required: 3 },
    random: { id: 3, label: 'Рандомный', required: 3 }
  };
  const CARD_UPGRADE_BLOCKED_RANKS = new Set(['rank_re', 'rank_s']);
  const EXCHANGE_SEED_USER_IDS = [80189, 24, 627468, 78208, 47343, 474677];
  const COMMENT_SOURCE_DIRS = [
    'bad-born-blood',
    'omniscient-reader_',
    'the-beginning-after-the-end_',
    'solo-leveling-ragnarok',
    'she-and-her-cat'
  ];
  const TAG_ID_OVERRIDES = {
    categories: {
      'животные компаньоны': 70
    },
    genres: {}
  };
  const MANUAL_ONLY_TASK_NAMES = new Set([
    'Давний знакомый',
    'Больше золота',
    'Коллекционер историй'
  ]);
  const TEMPORARY_BROKEN_EVENT_REASONS = new Map([]);
  const FILTER_QUERY_PAGES = 12;
  const FILTER_PER_TAG_QUERY_PAGES = 2;
  const FILTER_TAG_GROUP_SIZE = 4;
  const FILTER_TAG_GROUP_QUERY_PAGES = 2;
  const FILTER_PARALLEL_QUERY_BATCH_SIZE = 3;
  const FILTER_DETAIL_PROBE_BATCH_SIZE = 4;
  const FILTER_CHAPTER_PROBE_BATCH_SIZE = 4;
  const TITLE_POOL_LIMIT = 30;
  const WORLD_TRAVEL_QUERY_PAGES = 6;
  const WORLD_TRAVEL_PROBE_BATCH_SIZE = 4;
  const WORLD_TRAVEL_PLAN_LIMIT = 18;
  const READING_CHAPTER_COUNT_FILTERS = [
    { min: 100, ordering: '-chapter_date', pages: 3, reason: 'chapters:100+:fresh', score: 10 },
    { min: 50, ordering: '-chapter_date', pages: 3, reason: 'chapters:50+:fresh', score: 8 },
    { min: 100, ordering: '-count_chapters', pages: 2, reason: 'chapters:100+:long', score: 7 },
    { min: 50, max: 200, ordering: '-score', pages: 2, reason: 'chapters:50-200:score', score: 6 }
  ];
  const LIKE_PLAN_QUERY_PAGES = 6;
  const LIKE_PLAN_PROBE_BATCH_SIZE = 4;
  const SEARCH_HISTORY_LIMIT = 40;
  const REMANGA_API_ORIGIN = 'https://api.remanga.org';
  const READING_FAST_CHUNK_SIZE = 3;
  const READING_FAST_ITEM_DELAY_MS = 350;
  const READING_FAST_SETTLE_ATTEMPTS = 8;
  const READING_FAST_SETTLE_DELAY_MS = 450;
  const LIKE_MAX_CHAPTERS_PER_TITLE_FLOOR = 6;
  const LIKE_MAX_TITLE_SHARE = 4;
  const LIKE_FAST_CHUNK_SIZE = 3;
  const LIKE_FAST_ITEM_DELAY_MS = 350;
  const LIKE_FAST_SETTLE_ATTEMPTS = 8;
  const LIKE_FAST_SETTLE_DELAY_MS = 450;

  function createCache(maxSize) {
    return smb.LRUCache ? new smb.LRUCache(maxSize) : new Map();
  }

  const tagCache = {
    genres: createCache(80),
    categories: createCache(80)
  };
  const tagDirectoryCache = {
    genres: null,
    categories: null
  };
  const titleDetailsCache = createCache(120);

  function buildStateFromPayloads(tasksPayload, currentPayload) {
    const content = tasksPayload?.content || {};
    const tasks = smb.flattenTasks(content);
    const readyTasks = tasks.filter(smb.isTaskReady);
    const automatableTasks = tasks.filter(task => {
      if (isIgnoredManualTask(task)) return false;
      return !!smb.gameFromTask(task) || isAutoSearchTask(task) || isWorldTravelTask(task) || isChapterReadTask(task) || isLikeTask(task) || isAutonomousMemoryTask(task) || isDirectGameTask(task) || isExpertRatingTask(task) || isCommentTask(task) || isCommentReplyTask(task) || isOpinionRatingTask(task) || isSimilarTask(task) || isPersonalProfileTask(task) || isProfileTask(task) || isFriendRequestTask(task) || isGuildJoinTask(task) || isExchangeTask(task) || isInventoryTask(task) || isDeckCardTask(task) || isCardUpgradeTask(task) || isShopPurchaseTask(task) || isTicketSpendTask(task);
    });

    const battlepassState = currentPayload?.content?.battlepass || {};
    const battlepass = battlepassState?.battlepass || {};

    return {
      tasksPayload,
      currentPayload,
      tasks,
      readyTasks,
      automatableTasks,
      exp: Number(battlepassState?.exp || 0),
      expPerLevel: Number(battlepass?.exp_per_level || 0),
      battlepassName: battlepass?.name || 'Battlepass'
    };
  }

  async function loadState() {
    const [tasksPayload, currentPayload] = await Promise.all([
      smb.apiGet('/api/battlepass/tasks/'),
      smb.apiGet('/api/battlepass/current/')
    ]);

    return buildStateFromPayloads(tasksPayload, currentPayload);
  }

  function getRewardVersionMap(battlepassState) {
    const versions = Array.isArray(battlepassState?.versions) ? battlepassState.versions : [];
    return new Map(versions.map(item => [
      String(item?.version || ''),
      Boolean(item?.isOwned)
    ]));
  }

  function getClaimedRewardLevels(battlepassState) {
    const levels = Array.isArray(battlepassState?.levels) ? battlepassState.levels : [];
    return new Map(levels.map(item => [
      String(item?.version || ''),
      Number(item?.level || 0)
    ]));
  }

  function normalizeRewardName(rewards) {
    const names = (Array.isArray(rewards) ? rewards : [])
      .map(reward => String(reward?.reward_name || '').trim())
      .filter(Boolean);
    if (!names.length) return 'Награда';
    return names.join(', ');
  }

  function buildRewardsStateFromPayload(currentPayload) {
    const content = currentPayload?.content || {};
    const battlepassState = content?.battlepass || {};
    const battlepass = battlepassState?.battlepass || {};
    const exp = Number(battlepassState?.exp || 0);
    const expPerLevel = Number(battlepass?.exp_per_level || 0) || 1000;
    const currentLevel = Math.floor(exp / expPerLevel);
    const versionAccess = getRewardVersionMap(battlepassState);
    const claimedLevels = getClaimedRewardLevels(battlepassState);
    const levels = Array.isArray(content?.levels) ? content.levels : [];
    const rewards = [];

    for (const levelEntry of levels) {
      const level = Number(levelEntry?.level || 0);
      if (!level) continue;
      const versions = levelEntry?.rewards || {};
      for (const version of ['free', 'paid']) {
        const versionRewards = Array.isArray(versions?.[version]) ? versions[version] : [];
        if (!versionRewards.length) continue;
        const claimedLevel = Number(claimedLevels.get(version) || 0);
        const isOwned = versionAccess.has(version) ? Boolean(versionAccess.get(version)) : version === 'free';
        const enoughExp = exp / expPerLevel >= level;
        const claimed = claimedLevel >= level;
        rewards.push({
          id: `${version}:${level}`,
          level,
          version,
          name: normalizeRewardName(versionRewards),
          rewards: versionRewards,
          claimed,
          claimable: isOwned && enoughExp && !claimed,
          locked: !isOwned,
          enoughExp,
          claimedLevel
        });
      }
    }

    const claimableRewards = rewards.filter(item => item.claimable);
    return {
      currentPayload,
      battlepassName: battlepass?.name || 'Battlepass',
      exp,
      expPerLevel,
      currentLevel,
      claimedLevels: Object.fromEntries(claimedLevels),
      ownedVersions: Object.fromEntries(versionAccess),
      rewards,
      claimableRewards
    };
  }

  async function loadRewardsState() {
    const currentPayload = await smb.apiGet('/api/battlepass/current/');
    return buildRewardsStateFromPayload(currentPayload);
  }

  async function claimReward(level, version = 'free') {
    return smb.apiPost('/api/battlepass/current/', {
      level: Number(level || 0),
      level_version: String(version || 'free')
    });
  }

  function getLatestClaimableRewards(claimableRewards) {
    const latestByVersion = new Map();
    for (const reward of Array.isArray(claimableRewards) ? claimableRewards : []) {
      const version = String(reward?.version || 'free');
      const current = latestByVersion.get(version);
      if (!current || Number(reward?.level || 0) > Number(current?.level || 0)) {
        latestByVersion.set(version, reward);
      }
    }
    return Array.from(latestByVersion.values())
      .sort((left, right) => String(left.version || '').localeCompare(String(right.version || '')));
  }

  async function claimReadyRewards(progressCb) {
    const state = await loadRewardsState();
    const claimTargets = getLatestClaimableRewards(state.claimableRewards);

    for (const reward of claimTargets) {
      const coveredCount = state.claimableRewards
        .filter(item => item.version === reward.version && Number(item.level || 0) <= Number(reward.level || 0))
        .length;
      progressCb?.(`Забираю награды: ${reward.version} до ${reward.level} уровня (${coveredCount})`);
      try {
        await claimReward(reward.level, reward.version);
      } catch (error) {
        progressCb?.(`Пакетный сбор не сработал, забираю ${reward.version} по одному: ${error?.message || error}`);
        const fallbackRewards = state.claimableRewards
          .filter(item => item.version === reward.version)
          .sort((left, right) => Number(left.level || 0) - Number(right.level || 0));
        for (const fallbackReward of fallbackRewards) {
          progressCb?.(`Забираю награду: ${fallbackReward.version} ${fallbackReward.level} уровень`);
          await claimReward(fallbackReward.level, fallbackReward.version);
          await smb.sleep(150);
        }
      }
      await smb.sleep(150);
    }

    return {
      claimed: state.claimableRewards.length,
      ready: state.claimableRewards,
      claimedRewards: state.claimableRewards,
      claimTargets
    };
  }

  async function claimReadyTasks(progressCb) {
    const state = await loadState();
    let claimed = 0;

    for (const task of state.readyTasks) {
      progressCb?.(`Забираю: ${task.name}`);
      await smb.claimTask(task.id);
      claimed += 1;
      await smb.sleep(150);
    }

    return {
      claimed,
      ready: state.readyTasks
    };
  }

  function collectTaskFamily(tasks, predicate) {
    return (Array.isArray(tasks) ? tasks : [])
      .filter(task => predicate(task))
      .map(task => ({
        id: Number(task?.id || 0),
        name: String(task?.name || ''),
        progress: Number(task?.progress || 0),
        goal: Number(task?.goal || 0),
        claimed: Boolean(task?.claimed)
      }));
  }

  function describeFamilyProgress(beforeFamily, afterFamily, currentTaskId) {
    const beforeMap = new Map((beforeFamily || []).map(task => [Number(task.id || 0), task]));
    return (afterFamily || []).map(task => {
      const beforeTask = beforeMap.get(Number(task.id || 0));
      return {
        ...task,
        beforeProgress: Number(beforeTask?.progress || 0),
        changed: Number(task?.progress || 0) !== Number(beforeTask?.progress || 0),
        current: Number(task?.id || 0) === Number(currentTaskId || 0)
      };
    });
  }

  function getTaskRoute(task) {
    return null;
  }

  function summarizeBySection(tasks) {
    const summary = {};
    for (const task of tasks) {
      const key = task.section || 'other';
      if (!summary[key]) {
        summary[key] = {
          label: SECTION_LABELS[key] || key,
          total: 0,
          ready: 0,
          done: 0
        };
      }
      summary[key].total += 1;
      if (smb.isTaskReady(task)) summary[key].ready += 1;
      if (smb.isTaskDone(task)) summary[key].done += 1;
    }
    return summary;
  }

  async function waitForTaskUpdate(taskId, predicate, options = {}) {
    const attempts = Math.max(Number(options.attempts || 0), 1);
    const delayMs = Math.max(Number(options.delayMs || 0), 0);
    let lastTask = options.initialTask || null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0 && delayMs > 0) {
        await smb.sleep(delayMs);
      }

      const state = await loadState();
      const nextTask = state.tasks.find(item => item.id === taskId) || lastTask;
      if (nextTask) lastTask = nextTask;
      if (nextTask && predicate(nextTask, state)) {
        return nextTask;
      }
    }

    return lastTask;
  }

  async function executeTaskBatches(items, options) {
    const {
      taskId,
      initialTask,
      initialProgress = 0,
      goal = 0,
      batchSize = 2,
      delayBetweenBatches = 250,
      attempts = 4,
      delayMs = 150,
      progressCb,
      batchStartMessage,
      runItem,
      onNoProgress,
      maxNoProgressItems = 0
    } = options;

    let currentProgress = Number(initialProgress || 0);
    let finalTask = initialTask || null;
    let consecutiveNoProgress = 0;
    const processedItems = [];
    const failures = [];
    const noProgressItems = [];

    if (!items.length) {
      return { processedItems, failures, noProgressItems, finalTask, currentProgress };
    }

    if (!smb.BatchExecutor) {
      for (const item of items) {
        await runItem(item);
        processedItems.push(item);
        finalTask = await waitForTaskUpdate(
          taskId,
          nextTask => Number(nextTask.progress || 0) > currentProgress || smb.isTaskReady(nextTask),
          {
            attempts,
            delayMs,
            initialTask: finalTask
          }
        );
        if (Number(finalTask?.progress || 0) > currentProgress) {
          currentProgress = Number(finalTask.progress || 0);
          consecutiveNoProgress = 0;
          progressCb?.(`Прогресс вырос: ${currentProgress} / ${goal}`);
        } else if (onNoProgress) {
          consecutiveNoProgress += 1;
          progressCb?.(onNoProgress(item));
        }

        if (
          Number(finalTask?.progress || 0) >= goal ||
          smb.isTaskReady(finalTask) ||
          (maxNoProgressItems > 0 && consecutiveNoProgress >= maxNoProgressItems)
        ) {
          break;
        }
      }

      return { processedItems, failures, noProgressItems, finalTask, currentProgress };
    }

    const executor = new smb.BatchExecutor(batchSize, delayBetweenBatches);
    await executor.executeBatch(items, runItem, {
      onProgress: ({ currentBatch, totalBatches }) => {
        if (totalBatches > 1 && batchStartMessage) {
          progressCb?.(batchStartMessage(currentBatch, totalBatches));
        }
      },
      onBatchComplete: async ({ batchItems, results }) => {
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            processedItems.push(result.value);
          } else {
            failures.push({
              item: batchItems[index],
              error: result.reason
            });
          }
        });

        finalTask = await waitForTaskUpdate(
          taskId,
          nextTask => Number(nextTask.progress || 0) > currentProgress || smb.isTaskReady(nextTask),
          {
            attempts,
            delayMs,
            initialTask: finalTask
          }
        );

        if (Number(finalTask?.progress || 0) > currentProgress) {
          currentProgress = Number(finalTask.progress || 0);
          consecutiveNoProgress = 0;
          progressCb?.(`Прогресс вырос: ${currentProgress} / ${goal}`);
        } else if (onNoProgress) {
          noProgressItems.push(...batchItems);
          consecutiveNoProgress += batchItems.length;
          const labels = batchItems.map(item => onNoProgress(item)).filter(Boolean);
          if (labels.length === 1) {
            progressCb?.(labels[0]);
          } else if (labels.length > 1) {
            progressCb?.('Пакет выполнен без прироста прогресса.');
          }
        }

        return {
          stop: Number(finalTask?.progress || 0) >= goal ||
            smb.isTaskReady(finalTask) ||
            (maxNoProgressItems > 0 && consecutiveNoProgress >= maxNoProgressItems)
        };
      }
    });

    return { processedItems, failures, noProgressItems, finalTask, currentProgress };
  }

  function isAutoSearchTask(task) {
    return AUTO_SEARCH_EVENTS.has(Number(task?.event));
  }

  function isIgnoredManualTask(task) {
    return MANUAL_ONLY_TASK_NAMES.has(String(task?.name || '').trim()) || TEMPORARY_BROKEN_EVENT_REASONS.has(Number(task?.event));
  }

  function getAutomationBlockReason(task) {
    return isIgnoredManualTask(task)
      ? getManualTaskReason(task)
      : '';
  }

  function assertTaskAutomatable(task) {
    const reason = getAutomationBlockReason(task);
    if (reason) {
      window.SMBP?.recordDiagnostic?.({
        level: 'warn',
        scope: 'tasks',
        type: 'task_blocked',
        message: reason,
        details: {
          taskId: Number(task?.id || 0) || null,
          event: Number(task?.event || 0) || null,
          name: String(task?.name || '').trim()
        }
      }).catch(() => {});
      throw new Error(reason);
    }
  }

  function isWorldTravelTask(task) {
    return AUTO_WORLD_EVENTS.has(Number(task?.event));
  }

  function isChapterReadTask(task) {
    return AUTO_READING_EVENTS.has(Number(task?.event));
  }

  function isLikeTask(task) {
    return AUTO_LIKE_EVENTS.has(Number(task?.event));
  }

  function isAutonomousMemoryTask(task) {
    if (AUTO_MEMORY_EVENTS.has(Number(task?.event))) return true;
    const text = smb.normalizeText(`${task?.name || ''} ${task?.description || ''}`);
    return text.includes('найди пару') || text.includes('потренируйте память') || text.includes('найди его');
  }

  function isDirectGameTask(task) {
    return AUTO_DIRECT_GAME_EVENTS.has(Number(task?.event));
  }

  function isExpertRatingTask(task) {
    if (AUTO_EXPERT_RATING_EVENTS.has(Number(task?.event))) return true;
    const text = smb.normalizeText(`${task?.name || ''} ${task?.description || ''}`);
    return text.includes('оцените тайтл') || text.includes('оцените произведение') || text.includes('поставь оценку') || text.includes('оценка эксперта');
  }

  function isCommentTask(task) {
    return AUTO_COMMENT_EVENTS.has(Number(task?.event));
  }

  function isCommentReplyTask(task) {
    return AUTO_COMMENT_REPLY_EVENTS.has(Number(task?.event));
  }

  function isOpinionRatingTask(task) {
    return AUTO_OPINION_RATING_EVENTS.has(Number(task?.event));
  }

  function isSimilarTask(task) {
    return AUTO_SIMILAR_EVENTS.has(Number(task?.event));
  }

  function isPersonalProfileTask(task) {
    return AUTO_PERSONAL_PROFILE_EVENTS.has(Number(task?.event));
  }

  function isProfileTask(task) {
    return AUTO_PROFILE_EVENTS.has(Number(task?.event));
  }

  function isFriendRequestTask(task) {
    return AUTO_FRIEND_REQUEST_EVENTS.has(Number(task?.event));
  }

  function isGuildJoinTask(task) {
    if (AUTO_GUILD_REQUEST_EVENTS.has(Number(task?.event))) return true;
    const text = smb.normalizeText(`${task?.name || ''} ${task?.description || ''}`);
    return text.includes('я мы одно целое') || (text.includes('гильд') && text.includes('заяв'));
  }

  function isExchangeTask(task) {
    return AUTO_EXCHANGE_EVENTS.has(Number(task?.event));
  }

  function isInventoryTask(task) {
    return AUTO_INVENTORY_EVENTS.has(Number(task?.event));
  }

  function isShopPurchaseTask(task) {
    if (AUTO_SHOP_PURCHASE_EVENTS.has(Number(task?.event))) return true;
    const text = smb.normalizeText(`${task?.name || ''} ${task?.description || ''}`);
    return text.includes('вперёд за покупками') || (text.includes('предмет кастомизации') && text.includes('купи'));
  }

  function isTicketSpendTask(task) {
    if (AUTO_TICKET_SPEND_EVENTS.has(Number(task?.event))) return true;
    const text = smb.normalizeText(`${task?.name || ''} ${task?.description || ''}`);
    return (
      text.includes('потрать тикеты') ||
      text.includes('купи ее') ||
      (text.includes('тикет') && text.includes('глав'))
    );
  }

  function isDeckCardTask(task) {
    return AUTO_DECK_CARD_EVENTS.has(Number(task?.event));
  }

  function isCardUpgradeTask(task) {
    if (AUTO_CARD_UPGRADE_EVENTS.has(Number(task?.event))) return true;
    const text = smb.normalizeText(`${task?.name || ''} ${task?.description || ''}`);
    return (
      text.includes('похоже на триплет') ||
      (text.includes('карточ') && text.includes('апгрейд')) ||
      (text.includes('карточ') && text.includes('улучш')) ||
      (text.includes('карт') && text.includes('апгрейд'))
    );
  }

  function getTaskVisualKind(task) {
    if (isWorldTravelTask(task)) return 'world';
    if (isChapterReadTask(task)) return 'reading';
    if (isLikeTask(task)) return 'like';
    if (isExpertRatingTask(task)) return 'expert';
    if (isCommentReplyTask(task)) return 'reply';
    if (isOpinionRatingTask(task)) return 'opinion';
    if (isAutonomousMemoryTask(task)) return 'memory';
    if (isDirectGameTask(task)) return 'game';
    if (isCommentTask(task)) return 'comment';
    if (isSimilarTask(task)) return 'similar';
    if (isPersonalProfileTask(task)) return 'profile';
    if (isProfileTask(task)) return 'profile';
    if (isFriendRequestTask(task)) return 'friend';
    if (isGuildJoinTask(task)) return 'guild';
    if (isExchangeTask(task)) return 'exchange';
    if (isCardUpgradeTask(task)) return 'cards';
    if (isDeckCardTask(task)) return 'cards';
    if (isInventoryTask(task)) return 'inventory';
    if (isShopPurchaseTask(task)) return 'shop';
    if (isTicketSpendTask(task)) return 'ticket';
    if (isAutoSearchTask(task)) return 'catalog';
    if (smb.gameFromTask(task)) return 'minigame';
    return 'task';
  }

  function getManualTaskReason(task) {
    const eventId = Number(task?.event || 0);
    const text = smb.normalizeText(`${task?.name || ''} ${task?.description || ''}`);

    if (TEMPORARY_BROKEN_EVENT_REASONS.has(eventId)) {
      return TEMPORARY_BROKEN_EVENT_REASONS.get(eventId);
    }

    if (text.includes('покуп')) {
      return 'Требует покупки или другого платного действия на сайте.';
    }
    if (text.includes('улучш') || text.includes('инвентар')) {
      return 'Требует ручного выбора предмета или улучшения в интерфейсе.';
    }
    if (text.includes('знаком') || text.includes('друз')) {
      return 'Связана с социальным действием, которое пока безопаснее оставить ручным.';
    }
    if (text.includes('золот') || text.includes('донат') || text.includes('пополн')) {
      return 'Зависит от золота или пополнения баланса, поэтому не автоматизируется.';
    }

    return 'Оставлена в ручном режиме, чтобы не ломать сценарий и не трогать чувствительные действия.';
  }

  function getSearchField(task) {
    return Number(task?.event) === 8 ? 'genres' : 'categories';
  }

  function extractTagNames(task) {
    const description = String(task?.description || '');
    const match = description.match(/(?:жанр|жанра|жанры|категория|категории)\s*:\s*(.+?)(?:[.!]|$)/i);
    if (!match?.[1]) return [];
    return match[1]
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  async function fetchCatalog(params) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const entry of value) query.append(key, String(entry));
      } else if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    }
    return smb.apiGet(`/api/v2/search/catalog/?${query.toString()}`);
  }

  async function fetchTagDirectory(field) {
    const key = field === 'genres' ? 'genres' : 'categories';
    if (tagDirectoryCache[key]) return tagDirectoryCache[key];
    const payload = await smb.apiGet(`/api/v2/titles/${key}/`);
    const items = Array.isArray(payload) ? payload : [];
    tagDirectoryCache[key] = items;
    for (const item of items) {
      const normalizedName = smb.normalizeText(item?.name);
      if (normalizedName && Number(item?.id || 0) > 0) {
        tagCache[key].set(normalizedName, Number(item.id));
      }
    }
    return items;
  }

  async function getCommentSourceDirs(limit = 20) {
    const orderedDirs = [];
    const seen = new Set();

    for (const dir of COMMENT_SOURCE_DIRS) {
      if (!dir || seen.has(dir)) continue;
      seen.add(dir);
      orderedDirs.push(dir);
    }

    for (let page = 1; page <= 10 && orderedDirs.length < limit; page += 1) {
      const data = await fetchCatalog({
        count: 30,
        ordering: '-score',
        page
      }).catch(() => null);
      if (!data?.results?.length) break;

      for (const title of data.results) {
        const dir = String(title?.dir || '').trim();
        if (!dir || seen.has(dir)) continue;
        const details = await getTitleDetails(dir).catch(() => null);
        const commentsCount = Number(details?.count_comments || 0);
        if (commentsCount <= 0) continue;
        seen.add(dir);
        orderedDirs.push(dir);
        if (orderedDirs.length >= limit) break;
      }

      if (!data?.next) break;
    }

    return orderedDirs;
  }

  async function resolveTagId(field, tagName) {
    const normalized = smb.normalizeText(tagName);
    const overrideId = Number(TAG_ID_OVERRIDES[field]?.[normalized] || 0);
    if (overrideId > 0) {
      tagCache[field].set(normalized, overrideId);
      return overrideId;
    }
    if (tagCache[field].has(normalized)) return tagCache[field].get(normalized);

    const directory = await fetchTagDirectory(field);
    const match = directory.find(tag => {
      return smb.normalizeText(tag?.name) === normalized || smb.normalizeText(tag?.dir) === normalized;
    });

    if (Number(match?.id || 0) > 0) {
      tagCache[field].set(normalized, Number(match.id));
      return Number(match.id);
    }

    return null;
  }

  function createCandidateMap() {
    return new Map();
  }

  function addCandidate(map, title, reason, score = 0) {
    if (!title?.dir) return;
    const current = map.get(title.dir) || {
      dir: title.dir,
      rus_name: title.rus_name || title.en_name || title.dir,
      avg_rating: Number(title.avg_rating || 0),
      seedScore: 0,
      reasons: new Set()
    };

    current.rus_name = title.rus_name || current.rus_name;
    current.avg_rating = Math.max(current.avg_rating, Number(title.avg_rating || 0));
    current.seedScore += score;
    if (reason) current.reasons.add(reason);
    map.set(title.dir, current);
  }

  function normalizeResolvedTag(tag) {
    if (tag && typeof tag === 'object') {
      return {
        id: Number(tag.id || 0) || null,
        name: String(tag.name || tag.title || tag.dir || '').trim(),
        key: smb.normalizeText(tag.name || tag.title || tag.dir || '')
      };
    }
    return {
      id: null,
      name: String(tag || '').trim(),
      key: smb.normalizeText(tag)
    };
  }

  function getTitleTagIndexes(title, field) {
    const byId = new Set();
    const byName = new Set();
    for (const tag of title?.[field] || []) {
      const id = Number(tag?.id || 0);
      if (id > 0) byId.add(id);
      const name = smb.normalizeText(tag?.name || tag?.dir || tag?.title || '');
      if (name) byName.add(name);
    }
    return { byId, byName };
  }

  function countMatchingTags(title, field, tagNames) {
    const current = getTitleTagIndexes(title, field);
    return (Array.isArray(tagNames) ? tagNames : [])
      .map(normalizeResolvedTag)
      .reduce((count, tag) => {
        const matchedById = tag.id && current.byId.has(tag.id);
        const matchedByName = tag.key && current.byName.has(tag.key);
        return count + (matchedById || matchedByName ? 1 : 0);
      }, 0);
  }

  function getMatchedTagNames(title, field, tagNames) {
    const current = getTitleTagIndexes(title, field);
    return (Array.isArray(tagNames) ? tagNames : [])
      .map(normalizeResolvedTag)
      .filter(tag => (tag.id && current.byId.has(tag.id)) || (tag.key && current.byName.has(tag.key)))
      .map(tag => tag.name)
      .filter(Boolean);
  }

  function getTagCoverageKey(tagName) {
    return smb.normalizeText(tagName);
  }

  async function getTitleDetails(dir) {
    if (titleDetailsCache.has(dir)) return titleDetailsCache.get(dir);
    const details = await smb.apiGet(`/api/v2/titles/${dir}/`);
    titleDetailsCache.set(dir, details);
    return details;
  }

  function getUnreadChapterStartIndex(title) {
    const continueIndex = Number(title?.continue_reading?.index || 0);
    const currentIndex = Number(title?.current_reading?.index || 0);
    const nextAfterCurrent = Number.isFinite(currentIndex) && currentIndex > 0
      ? currentIndex + 1
      : 0;
    const boundary = Math.max(
      Number.isFinite(continueIndex) && continueIndex > 0 ? continueIndex : 0,
      nextAfterCurrent
    );
    return boundary > 0 ? boundary : 0;
  }

  function getReadableTitleName(entity, fallback = 'тайтл') {
    return entity?.rus_name
      || entity?.main_name
      || entity?.secondary_name
      || entity?.en_name
      || entity?.dir
      || fallback;
  }

  function getReadableChapterLabel(entity, fallback = 'глава') {
    const titleName = getReadableTitleName(entity, fallback);
    const chapterId = entity?.chapterId || entity?.id || null;
    return chapterId ? `${titleName} #${chapterId}` : titleName;
  }

  function getTitleLicenseBlockReason(title) {
    const statusText = smb.normalizeText(`${title?.status?.name || ''} ${title?.translate_status?.name || ''}`);
    if (title?.is_licensed || statusText.includes('лиценз')) return 'Лицензированный тайтл';
    return '';
  }

  function isLockedChapter(chapter) {
    if (!chapter) return true;
    if (chapter?.is_bought || chapter?.is_free_today) return false;
    const priceValue = chapter?.price;
    const numericPrice = Number.parseFloat(String(priceValue ?? '').replace(',', '.'));
    const hasPrice = priceValue !== null && priceValue !== undefined && String(priceValue).trim() !== '' && (!Number.isFinite(numericPrice) || numericPrice > 0);
    return Boolean(chapter?.is_paid || hasPrice || Number(chapter?.purchase_type || 0) === 3);
  }

  function isViewedChapter(chapter) {
    return Boolean(
      chapter?.viewed ||
      chapter?.is_viewed ||
      chapter?.is_read ||
      chapter?.user_data?.viewed ||
      chapter?.user_data?.is_viewed ||
      chapter?.user?.viewed ||
      chapter?.reading?.viewed
    );
  }

  function isRatedChapter(chapter) {
    return Boolean(
      chapter?.rated ||
      chapter?.is_rated ||
      chapter?.liked ||
      chapter?.is_liked ||
      chapter?.user_data?.rated ||
      chapter?.user_data?.liked ||
      chapter?.user?.rated ||
      chapter?.user?.liked
    );
  }

  async function collectFilterCandidates(field, tagNames, map) {
    const resolvedTags = [];

    for (const tagName of tagNames) {
      const id = await resolveTagId(field, tagName);
      if (id) resolvedTags.push({ id, name: tagName });
    }

    if (!resolvedTags.length) return resolvedTags;

    async function collectCatalogPages(tags, maxPages, reason, scoreMultiplier) {
      for (let page = 1; page <= maxPages; page += 1) {
        const data = await fetchCatalog({
          count: 30,
          ordering: '-score',
          page,
          unstrict_search_fields: ['genres', 'categories'],
          [field]: tags.map(tag => tag.id)
        });

        for (const title of data?.results || []) {
          const score = countMatchingTags(title, field, tags);
          if (!score) continue;
          addCandidate(map, title, reason, score * scoreMultiplier);
        }

        if (!data?.next) break;
      }
    }

    await collectCatalogPages(resolvedTags, FILTER_QUERY_PAGES, 'filter:all', 5);

    const groupedTags = [];
    if (resolvedTags.length > FILTER_TAG_GROUP_SIZE) {
      for (let index = 0; index < resolvedTags.length; index += FILTER_TAG_GROUP_SIZE) {
        groupedTags.push(resolvedTags.slice(index, index + FILTER_TAG_GROUP_SIZE));
      }
    }

    for (let index = 0; index < groupedTags.length; index += FILTER_PARALLEL_QUERY_BATCH_SIZE) {
      const batch = groupedTags.slice(index, index + FILTER_PARALLEL_QUERY_BATCH_SIZE);
      await Promise.allSettled(batch.map(tags => collectCatalogPages(
        tags,
        FILTER_TAG_GROUP_QUERY_PAGES,
        `filter:group:${tags.map(tag => tag.name).join(', ')}`,
        6
      )));
    }

    const tagJobs = resolvedTags.map(tag => async () => {
      await collectCatalogPages([tag], FILTER_PER_TAG_QUERY_PAGES, `filter:${tag.name}`, 10);
    });

    for (let index = 0; index < tagJobs.length; index += FILTER_PARALLEL_QUERY_BATCH_SIZE) {
      const batch = tagJobs.slice(index, index + FILTER_PARALLEL_QUERY_BATCH_SIZE);
      await Promise.allSettled(batch.map(job => job()));
    }

    return resolvedTags;
  }

  async function collectFilterCandidatesLegacy(field, tagNames, map) {
    const resolvedTags = [];

    for (const tagName of tagNames) {
      const id = await resolveTagId(field, tagName);
      if (id) resolvedTags.push({ id, name: tagName });
    }

    if (!resolvedTags.length) return resolvedTags;

    for (let page = 1; page <= FILTER_QUERY_PAGES; page += 1) {
      const data = await fetchCatalog({
        count: 30,
        ordering: '-score',
        page,
        unstrict_search_fields: ['genres', 'categories'],
        [field]: resolvedTags.map(tag => tag.id)
      });

      for (const title of data?.results || []) {
        const score = countMatchingTags(title, field, resolvedTags);
        if (!score) continue;
        addCandidate(map, title, 'filter', score * 4);
      }

      if (!data?.next) break;
    }

    for (const tag of resolvedTags) {
      for (let page = 1; page <= FILTER_PER_TAG_QUERY_PAGES; page += 1) {
        const data = await fetchCatalog({
          count: 30,
          ordering: '-score',
          page,
          unstrict_search_fields: ['genres', 'categories'],
          [field]: [tag.id]
        });

        for (const title of data?.results || []) {
          const score = countMatchingTags(title, field, [tag]);
          if (!score) continue;
          addCandidate(map, title, `filter:${tag.name}`, 10);
        }

        if (!data?.next) break;
      }
    }

    return resolvedTags;
  }

  async function enrichCandidates(field, tagNames, map, visitedDirs, failedDirs, limit) {
    const enriched = [];
    const ordered = [...map.values()].sort((left, right) => {
      if (right.seedScore !== left.seedScore) return right.seedScore - left.seedScore;
      return right.avg_rating - left.avg_rating;
    }).filter(candidate => {
      if (!candidate?.dir) return false;
      if (visitedDirs.has(candidate.dir)) return false;
      if (failedDirs.has(candidate.dir)) return false;
      return true;
    });

    async function enrichOne(candidate) {
      const details = await getTitleDetails(candidate.dir);
      const score = countMatchingTags(details, field, tagNames);
      if (!score) return null;
      const matchedTags = getMatchedTagNames(details, field, tagNames);
      return {
        ...details,
        _matchScore: score,
        _seedScore: candidate.seedScore,
        _reasons: [...candidate.reasons],
        _matchedTags: matchedTags
      };
    }

    for (let index = 0; index < ordered.length && enriched.length < limit; index += FILTER_DETAIL_PROBE_BATCH_SIZE) {
      if (enriched.length >= limit) break;
      const batch = ordered.slice(index, index + FILTER_DETAIL_PROBE_BATCH_SIZE);
      const settled = await Promise.allSettled(batch.map(enrichOne));
      for (const result of settled) {
        if (enriched.length >= limit) break;
        if (result.status === 'fulfilled' && result.value) enriched.push(result.value);
      }
    }

    const tagCounts = {};
    for (const title of enriched) {
      for (const tagName of title._matchedTags || []) {
        const key = smb.normalizeText(tagName);
        tagCounts[key] = (tagCounts[key] || 0) + 1;
      }
    }

    for (const title of enriched) {
      title._rarityScore = (title._matchedTags || []).reduce((sum, tagName) => {
        const key = smb.normalizeText(tagName);
        return sum + 1 / Math.max(1, tagCounts[key] || 1);
      }, 0);
    }

    enriched.sort((left, right) => {
      if (right._matchScore !== left._matchScore) return right._matchScore - left._matchScore;
      if (right._rarityScore !== left._rarityScore) return right._rarityScore - left._rarityScore;
      if (right._seedScore !== left._seedScore) return right._seedScore - left._seedScore;
      return Number(right.avg_rating || 0) - Number(left.avg_rating || 0);
    });

    return enriched;
  }

  function filterStrongTagCandidates(candidates, tagNames) {
    const safeCandidates = Array.isArray(candidates) ? candidates : [];
    if (!safeCandidates.length) {
      return {
        candidates: [],
        minMatchScore: 0,
        maxMatchScore: 0
      };
    }

    const maxMatchScore = safeCandidates.reduce((best, item) => Math.max(best, Number(item?._matchScore || 0)), 0);
    const minMatchScore = tagNames.length <= 1
      ? 1
      : maxMatchScore >= 2
        ? 2
        : 1;

    const strongCandidates = safeCandidates.filter(item => Number(item?._matchScore || 0) >= minMatchScore);
    return {
      candidates: strongCandidates.length ? strongCandidates : safeCandidates,
      minMatchScore,
      maxMatchScore
    };
  }

  async function getFreeChapters(dir, limit = 1, options = {}) {
    const title = await getTitleDetails(dir);
    if (getTitleLicenseBlockReason(title)) return [];

    const branch = Array.isArray(title?.branches) ? title.branches[0] : null;
    if (!branch?.id) return [];
    const unreadStartIndex = getUnreadChapterStartIndex(title);
    if (options.skipStartedTitles && unreadStartIndex > 1) return [];
    const ascendingPageLimit = Math.max(1, Number(options.maxAscendingPages || 8));
    const descendingPageLimit = Math.max(0, Number(options.maxDescendingPages ?? 6));

    const chaptersOut = [];
    const seenChapterIds = new Set();
    const appendReadableChapters = chapters => {
      for (const chapter of chapters?.results || []) {
        const chapterIndex = Number(chapter?.index || 0);
        const isLocked = isLockedChapter(chapter);
        const isRead = isViewedChapter(chapter) || (unreadStartIndex > 0 && chapterIndex > 0 && chapterIndex < unreadStartIndex);
        if (seenChapterIds.has(Number(chapter?.id || 0))) continue;
        if (!chapter?.is_published || !chapter?.id || isLocked || isRead) continue;
        seenChapterIds.add(Number(chapter.id));
        chaptersOut.push({
          id: chapter.id,
          index: chapterIndex,
          isLocked,
          isRead,
          url: `https://remanga.org/manga/${dir}/${chapter.id}?page=1`
        });
        if (chaptersOut.length >= limit) break;
      }
    };

    for (let page = 1; page <= ascendingPageLimit && chaptersOut.length < limit; page += 1) {
      const chapters = await smb.apiGet(`/api/v2/titles/chapters/?branch_id=${branch.id}&chapter=&ordering=index&count=30&page=${page}&user_data=1`);
      appendReadableChapters(chapters);
      if (!chapters?.next) break;
    }

    for (let page = 1; page <= descendingPageLimit && chaptersOut.length < limit; page += 1) {
      const chapters = await smb.apiGet(`/api/v2/titles/chapters/?branch_id=${branch.id}&chapter=&ordering=-index&count=30&page=${page}&user_data=1`);
      appendReadableChapters(chapters);
      if (!chapters?.next) break;
    }

    return chaptersOut;
  }

  async function getLikableChapters(dir, limit = 10) {
    const title = await getTitleDetails(dir);
    if (getTitleLicenseBlockReason(title)) return [];

    const branch = Array.isArray(title?.branches) ? title.branches[0] : null;
    if (!branch?.id) return [];

    const chaptersOut = [];
    for (let page = 1; page <= 6 && chaptersOut.length < limit; page += 1) {
      const chapters = await smb.apiGet(`/api/v2/titles/chapters/?branch_id=${branch.id}&chapter=&ordering=-index&count=30&page=${page}&user_data=1`);
      for (const chapter of chapters?.results || []) {
        if (!chapter?.is_published || !chapter?.id || isLockedChapter(chapter) || isRatedChapter(chapter)) continue;
        chaptersOut.push({
          id: chapter.id,
          index: Number(chapter?.index || 0),
          rated: isRatedChapter(chapter),
          url: `https://remanga.org/manga/${dir}/${chapter.id}?page=1`
        });
        if (chaptersOut.length >= limit) break;
      }
      if (!chapters?.next) break;
    }

    return chaptersOut;
  }

  async function buildWorldTravelPlan(task) {
    const remaining = Math.max(0, Number(task?.goal || 0) - Number(task?.progress || 0));
    const visitedDirs = await getVisitedDirs(task.id);
    const failedDirs = await getFailedSearchDirs(task.id);
    const blacklistedDirs = await getBlacklistedTitleDirs('reading');
    const viewedChapters = await getViewedChapterIds('reading');

    if (!remaining) {
      return {
        remaining,
        selectedTitles: []
      };
    }

    const selectedTitles = [];
    const selectedDirs = new Set();
    const probedDirs = new Set();
    const relaxedProbedDirs = new Set();
    const limit = Math.min(
      Math.max(remaining + 3, Math.ceil(remaining * 1.5), 6),
      WORLD_TRAVEL_PLAN_LIMIT
    );
    const preferredMinimum = Math.min(limit, Math.max(remaining + 2, 4));
    const candidateMap = createCandidateMap();

    const shouldSkipCandidate = (candidate, ignoreHistory = false, relaxed = false) => {
      const probeSet = relaxed ? relaxedProbedDirs : probedDirs;
      if (!candidate?.dir || selectedDirs.has(candidate.dir) || probeSet.has(candidate.dir)) return true;
      if (!ignoreHistory && visitedDirs.has(candidate.dir)) return true;
      if (!ignoreHistory && failedDirs.has(candidate.dir)) return true;
      if (!ignoreHistory && blacklistedDirs.has(candidate.dir)) return true;
      return false;
    };

    const probeCandidate = async (candidate, options = {}) => {
      const relaxed = Boolean(options.relaxed);
      (relaxed ? relaxedProbedDirs : probedDirs).add(candidate.dir);
      const freeChapter = (await getFreeChapters(candidate.dir, 1, {
        skipStartedTitles: !relaxed,
        maxAscendingPages: relaxed ? 2 : 1,
        maxDescendingPages: relaxed ? 2 : 1
      })).find(chapter => !viewedChapters.has(chapter.id));
      if (!freeChapter?.id) return null;
      return {
        dir: candidate.dir,
        rus_name: candidate.rus_name,
        avg_rating: candidate.avg_rating,
        chapterId: freeChapter.id,
        chapterUrl: freeChapter.url
      };
    };

    const probeCandidates = async (candidates, ignoreHistory = false, options = {}) => {
      const ordered = candidates
        .filter(candidate => !shouldSkipCandidate(candidate, ignoreHistory, Boolean(options.relaxed)))
        .sort((left, right) => right.avg_rating - left.avg_rating);

      for (let index = 0; index < ordered.length && selectedTitles.length < limit; index += WORLD_TRAVEL_PROBE_BATCH_SIZE) {
        const batch = ordered.slice(index, index + WORLD_TRAVEL_PROBE_BATCH_SIZE);
        const settled = await Promise.allSettled(batch.map(candidate => probeCandidate(candidate, options)));
        for (const result of settled) {
          if (selectedTitles.length >= limit) break;
          if (result.status !== 'fulfilled' || !result.value?.dir || selectedDirs.has(result.value.dir)) continue;
          selectedDirs.add(result.value.dir);
          selectedTitles.push(result.value);
        }
      }
    };

    for (let page = 1; page <= WORLD_TRAVEL_QUERY_PAGES && selectedTitles.length < limit; page += 1) {
      const data = await fetchCatalog({
        count: 30,
        ordering: '-score',
        page
      });

      const pageCandidates = [];
      for (const title of data?.results || []) {
        addCandidate(candidateMap, title, 'catalog', 1);
        if (title?.dir) {
          pageCandidates.push({
            dir: title.dir,
            rus_name: title.rus_name || title.en_name || title.dir,
            avg_rating: Number(title.avg_rating || 0)
          });
        }
      }

      await probeCandidates(pageCandidates, false);
      if (!data?.next) break;
    }

    if (selectedTitles.length < preferredMinimum) {
      await probeCandidates([...candidateMap.values()], false, { relaxed: true });
    }

    if (!selectedTitles.length) {
      probedDirs.clear();
      relaxedProbedDirs.clear();
      await probeCandidates([...candidateMap.values()], true, { relaxed: true });
    }

    return {
      remaining,
      selectedTitles
    };
  }

  async function collectReadingChapterCountCandidates(map, targetSize) {
    const target = Math.max(Number(targetSize || 0), TITLE_POOL_LIMIT);

    for (const filter of READING_CHAPTER_COUNT_FILTERS) {
      if (map.size >= target) break;

      for (let page = 1; page <= Number(filter.pages || 1) && map.size < target; page += 1) {
        const params = {
          count: 30,
          ordering: filter.ordering,
          page
        };

        if (Number(filter.min || 0) > 0) {
          params.count_chapters_gte = Number(filter.min);
        }
        if (Number(filter.max || 0) > 0) {
          params.count_chapters_lte = Number(filter.max);
        }

        const data = await fetchCatalog(params);
        for (const title of data?.results || []) {
          addCandidate(map, title, filter.reason, filter.score);
          if (map.size >= target) break;
        }

        if (!data?.next) break;
      }
    }
  }

  async function buildReadingPlan(task) {
    const remaining = Math.max(0, Number(task?.goal || 0) - Number(task?.progress || 0));
    const viewedChapters = await getViewedChapterIds('reading');
    const blacklistedDirs = await getBlacklistedTitleDirs('reading');

    if (!remaining) {
      return {
        remaining,
        selectedChapters: []
      };
    }

    const candidateMap = createCandidateMap();
    const targetCandidateSize = Math.max(TITLE_POOL_LIMIT, remaining * 8);
    await collectReadingChapterCountCandidates(candidateMap, targetCandidateSize);

    for (let page = 1; page <= 6 && candidateMap.size < targetCandidateSize; page += 1) {
      const data = await fetchCatalog({
        count: 30,
        ordering: '-score',
        page
      });

      for (const title of data?.results || []) {
        addCandidate(candidateMap, title, 'catalog', 1);
      }

      if (!data?.next) break;
    }

    const selectedChapters = [];
    const selectedChapterIds = new Set();
    const ordered = [...candidateMap.values()].sort((left, right) => {
      if (right.seedScore !== left.seedScore) return right.seedScore - left.seedScore;
      return right.avg_rating - left.avg_rating;
    });
    for (const candidate of ordered) {
      if (selectedChapters.length >= Math.max(remaining * 2, 20)) break;
      if (blacklistedDirs.has(candidate.dir)) continue;

      const freeChapters = await getFreeChapters(candidate.dir, Math.max(remaining, 12));
      for (const chapter of freeChapters) {
        if (!chapter?.id || selectedChapterIds.has(chapter.id)) continue;
        if (viewedChapters.has(chapter.id)) continue;
        selectedChapterIds.add(chapter.id);
        selectedChapters.push({
          dir: candidate.dir,
          rus_name: candidate.rus_name,
          avg_rating: candidate.avg_rating,
          chapterId: chapter.id,
          chapterUrl: chapter.url
        });
        if (selectedChapters.length >= Math.max(remaining * 2, 20)) break;
      }
    }

    return {
      remaining,
      selectedChapters
    };
  }

  async function buildLikePlan(task) {
    const remaining = Math.max(0, Number(task?.goal || 0) - Number(task?.progress || 0));
    const blacklistedDirs = await getBlacklistedTitleDirs('like');
    if (!remaining) {
      return {
        remaining,
        selectedChapters: []
      };
    }

    const selectedChapters = [];
    const selectedChapterIds = new Set();
    const selectedByTitle = new Map();
    const probedDirs = new Set();
    const limit = Math.max(remaining * 2, 20);
    const maxChaptersPerTitle = Math.max(LIKE_MAX_CHAPTERS_PER_TITLE_FLOOR, Math.ceil(remaining / LIKE_MAX_TITLE_SHARE));
    const candidateMap = createCandidateMap();

    const probeCandidate = async candidate => {
      probedDirs.add(candidate.dir);
      const likableChapters = await getLikableChapters(candidate.dir, Math.max(remaining, 12));
      return likableChapters.map(chapter => ({
        dir: candidate.dir,
        rus_name: candidate.rus_name,
        avg_rating: candidate.avg_rating,
        chapterId: chapter.id,
        chapterUrl: chapter.url
      }));
    };

    const probeCandidates = async candidates => {
      const ordered = candidates
        .filter(candidate => candidate?.dir && !blacklistedDirs.has(candidate.dir) && !probedDirs.has(candidate.dir))
        .sort((left, right) => right.avg_rating - left.avg_rating);

      for (let index = 0; index < ordered.length && selectedChapters.length < limit; index += LIKE_PLAN_PROBE_BATCH_SIZE) {
        const batch = ordered.slice(index, index + LIKE_PLAN_PROBE_BATCH_SIZE);
        const settled = await Promise.allSettled(batch.map(probeCandidate));
        for (const result of settled) {
          if (selectedChapters.length >= limit) break;
          if (result.status !== 'fulfilled') continue;
          for (const chapter of result.value || []) {
            if (selectedChapters.length >= limit) break;
            if (!chapter?.chapterId || selectedChapterIds.has(chapter.chapterId)) continue;
            const perTitleCount = Number(selectedByTitle.get(chapter.dir) || 0);
            if (perTitleCount >= maxChaptersPerTitle) continue;
            selectedChapterIds.add(chapter.chapterId);
            selectedByTitle.set(chapter.dir, perTitleCount + 1);
            selectedChapters.push(chapter);
          }
        }
      }
    };

    for (let page = 1; page <= LIKE_PLAN_QUERY_PAGES && selectedChapters.length < limit; page += 1) {
      const data = await fetchCatalog({
        count: 30,
        ordering: '-score',
        page
      });

      const pageCandidates = [];
      for (const title of data?.results || []) {
        addCandidate(candidateMap, title, 'catalog', 1);
        if (title?.dir) {
          pageCandidates.push({
            dir: title.dir,
            rus_name: title.rus_name || title.en_name || title.dir,
            avg_rating: Number(title.avg_rating || 0)
          });
        }
      }

      await probeCandidates(pageCandidates);
      if (!data?.next) break;
    }

    if (!selectedChapters.length) {
      probedDirs.clear();
      await probeCandidates([...candidateMap.values()]);
    }

    return {
      remaining,
      selectedChapters
    };
  }

  async function buildExpertRatingPlan(task) {
    const remaining = Math.max(0, Number(task?.goal || 0) - Number(task?.progress || 0));
    const viewedChapters = await getViewedChapterIds('reading');

    if (!remaining) {
      return {
        remaining,
        selectedTitle: null,
        selectedChapters: []
      };
    }

    const candidateMap = createCandidateMap();
    for (let page = 1; page <= 10; page += 1) {
      const data = await fetchCatalog({
        count: 30,
        ordering: '-score',
        page
      });

      for (const title of data?.results || []) {
        addCandidate(candidateMap, title, 'catalog', 1);
      }

      if (!data?.next) break;
    }

    const ordered = [...candidateMap.values()].sort((left, right) => right.avg_rating - left.avg_rating);
    for (const candidate of ordered) {
      const details = await getTitleDetails(candidate.dir);
      if (!details?.id || details?.rated !== null) continue;
      if (Number(details?.count_chapters || 0) < 5) continue;

      const freeChapters = await getFreeChapters(candidate.dir, 12);
      const unreadChapters = freeChapters.filter(chapter => !viewedChapters.has(chapter.id)).slice(0, 5);
      if (unreadChapters.length < 5) continue;

      return {
        remaining,
        selectedTitle: {
          id: details.id,
          dir: details.dir,
          rus_name: details.main_name || details.rus_name || details.en_name || details.dir
        },
        selectedChapters: unreadChapters
      };
    }

    return {
      remaining,
      selectedTitle: null,
      selectedChapters: []
    };
  }

  async function buildSimilarPlan(task) {
    const remaining = Math.max(0, Number(task?.goal || 0) - Number(task?.progress || 0));
    const votedPairs = await getVotedSimilarPairs(task.id);

    if (!remaining) {
      return {
        remaining,
        selectedVotes: []
      };
    }

    const candidateMap = createCandidateMap();
    for (let page = 1; page <= 10; page += 1) {
      const data = await fetchCatalog({
        count: 30,
        ordering: '-score',
        page
      });

      for (const title of data?.results || []) {
        addCandidate(candidateMap, title, 'catalog', 1);
      }

      if (!data?.next) break;
    }

    const selectedVotes = [];
    const ordered = [...candidateMap.values()].sort((left, right) => right.avg_rating - left.avg_rating);
    for (const candidate of ordered) {
      if (selectedVotes.length >= Math.max(remaining * 3, 6)) break;
      const similarTitles = await fetchSimilarTitles(candidate.dir, 8);
      for (const item of similarTitles) {
        const otherDir = item?.title?.dir;
        if (!otherDir) continue;
        const pairKey = `${candidate.dir}|${otherDir}`;
        if (votedPairs.has(pairKey)) continue;
        selectedVotes.push({
          title1Dir: candidate.dir,
          title2Dir: otherDir,
          pairKey,
          baseTitle: candidate.rus_name,
          similarTitle: item?.title?.main_name || item?.title?.secondary_name || otherDir,
          voteType: 0
        });
        if (selectedVotes.length >= Math.max(remaining * 3, 6)) break;
      }
    }

    return {
      remaining,
      selectedVotes
    };
  }

  async function loadSearchHistory() {
    const settings = await smb.loadSettings();
    return settings?.searchHistory || {};
  }

  async function loadFailedSearchHistory() {
    const settings = await smb.loadSettings();
    return settings?.failedSearchHistory || {};
  }

  async function rememberVisitedTitle(taskId, dir) {
    const settings = await smb.loadSettings();
    const history = { ...(settings?.searchHistory || {}) };
    const current = Array.isArray(history[taskId]) ? history[taskId] : [];
    if (current.includes(dir)) return;

    history[taskId] = [dir, ...current].slice(0, SEARCH_HISTORY_LIMIT);
    await smb.saveSettings({ searchHistory: history });
  }

  async function getVisitedDirs(taskId) {
    const history = await loadSearchHistory();
    return new Set(Array.isArray(history?.[taskId]) ? history[taskId] : []);
  }

  async function rememberFailedSearchTitle(taskId, dir) {
    const settings = await smb.loadSettings();
    const history = { ...(settings?.failedSearchHistory || {}) };
    const current = Array.isArray(history[taskId]) ? history[taskId] : [];
    if (current.includes(dir)) return;

    history[taskId] = [dir, ...current].slice(0, SEARCH_HISTORY_LIMIT);
    await smb.saveSettings({ failedSearchHistory: history });
  }

  async function getFailedSearchDirs(taskId) {
    const history = await loadFailedSearchHistory();
    return new Set(Array.isArray(history?.[taskId]) ? history[taskId] : []);
  }

  async function loadTitleBlacklist() {
    const settings = await smb.loadSettings();
    return settings?.titleBlacklist && typeof settings.titleBlacklist === 'object'
      ? settings.titleBlacklist
      : {};
  }

  async function getBlacklistedTitleDirs(scope = 'global') {
    const blacklist = await loadTitleBlacklist();
    const globalItems = Array.isArray(blacklist.global) ? blacklist.global : [];
    const scopedItems = Array.isArray(blacklist[scope]) ? blacklist[scope] : [];
    return new Set([...globalItems, ...scopedItems].map(item => String(item?.dir || item || '').trim()).filter(Boolean));
  }

  async function rememberBlacklistedTitle(dir, reason = 'no_progress', scope = 'global') {
    const titleDir = String(dir || '').trim();
    if (!titleDir) return;
    const settings = await smb.loadSettings();
    const blacklist = {
      ...(settings?.titleBlacklist && typeof settings.titleBlacklist === 'object' ? settings.titleBlacklist : {})
    };
    const current = Array.isArray(blacklist[scope]) ? blacklist[scope] : [];
    const nextEntry = {
      dir: titleDir,
      reason: String(reason || 'no_progress'),
      at: new Date().toISOString()
    };
    const next = [nextEntry, ...current.filter(item => String(item?.dir || item || '') !== titleDir)]
      .slice(0, SEARCH_HISTORY_LIMIT * 4);
    blacklist[scope] = next;
    await smb.saveSettings({ titleBlacklist: blacklist });
  }

  async function loadChapterHistory() {
    const settings = await smb.loadSettings();
    return settings?.chapterHistory || {};
  }

  async function getViewedChapterIds(bucket = 'reading') {
    const history = await loadChapterHistory();
    return new Set(Array.isArray(history?.[bucket]) ? history[bucket] : []);
  }

  async function rememberViewedChapter(chapterId, bucket = 'reading') {
    const settings = await smb.loadSettings();
    const history = { ...(settings?.chapterHistory || {}) };
    const current = Array.isArray(history[bucket]) ? history[bucket] : [];
    if (current.includes(chapterId)) return;

    history[bucket] = [chapterId, ...current].slice(0, SEARCH_HISTORY_LIMIT * 4);
    await smb.saveSettings({ chapterHistory: history });
  }

  async function loadSimilarHistory() {
    const settings = await smb.loadSettings();
    return settings?.similarHistory || {};
  }

  async function getVotedSimilarPairs(taskId) {
    const history = await loadSimilarHistory();
    return new Set(Array.isArray(history?.[taskId]) ? history[taskId] : []);
  }

  async function rememberSimilarVote(taskId, pairKey) {
    const settings = await smb.loadSettings();
    const history = { ...(settings?.similarHistory || {}) };
    const current = Array.isArray(history[taskId]) ? history[taskId] : [];
    if (current.includes(pairKey)) return;
    history[taskId] = [pairKey, ...current].slice(0, SEARCH_HISTORY_LIMIT * 4);
    await smb.saveSettings({ similarHistory: history });
  }

  async function loadCommentHistory() {
    const settings = await smb.loadSettings();
    return Array.isArray(settings?.commentHistory) ? settings.commentHistory : [];
  }

  async function rememberCommentId(commentId) {
    const settings = await smb.loadSettings();
    const current = Array.isArray(settings?.commentHistory) ? settings.commentHistory : [];
    if (current.includes(commentId)) return;
    await smb.saveSettings({ commentHistory: [commentId, ...current].slice(0, SEARCH_HISTORY_LIMIT * 4) });
  }

  async function loadCommentVoteHistory() {
    const settings = await smb.loadSettings();
    return Array.isArray(settings?.commentVoteHistory) ? settings.commentVoteHistory : [];
  }

  async function rememberCommentVote(commentId) {
    const settings = await smb.loadSettings();
    const current = Array.isArray(settings?.commentVoteHistory) ? settings.commentVoteHistory : [];
    if (current.includes(commentId)) return;
    await smb.saveSettings({ commentVoteHistory: [commentId, ...current].slice(0, SEARCH_HISTORY_LIMIT * 4) });
  }

  async function loadCommentReplyHistory() {
    const settings = await smb.loadSettings();
    return Array.isArray(settings?.commentReplyHistory) ? settings.commentReplyHistory : [];
  }

  async function rememberCommentReply(commentId) {
    const settings = await smb.loadSettings();
    const current = Array.isArray(settings?.commentReplyHistory) ? settings.commentReplyHistory : [];
    if (current.includes(commentId)) return;
    await smb.saveSettings({ commentReplyHistory: [commentId, ...current].slice(0, SEARCH_HISTORY_LIMIT * 4) });
  }

  async function loadProfileHistory() {
    const settings = await smb.loadSettings();
    return Array.isArray(settings?.profileHistory) ? settings.profileHistory : [];
  }

  async function rememberProfileVisit(userId) {
    const settings = await smb.loadSettings();
    const current = Array.isArray(settings?.profileHistory) ? settings.profileHistory : [];
    if (current.includes(userId)) return;
    await smb.saveSettings({ profileHistory: [userId, ...current].slice(0, SEARCH_HISTORY_LIMIT * 4) });
  }

  async function loadFriendRequestHistory() {
    const settings = await smb.loadSettings();
    return Array.isArray(settings?.friendRequestHistory) ? settings.friendRequestHistory : [];
  }

  async function rememberFriendRequest(userId) {
    const settings = await smb.loadSettings();
    const current = Array.isArray(settings?.friendRequestHistory) ? settings.friendRequestHistory : [];
    if (current.includes(userId)) return;
    await smb.saveSettings({ friendRequestHistory: [userId, ...current].slice(0, SEARCH_HISTORY_LIMIT * 4) });
  }

  async function loadGuildRequestHistory() {
    const settings = await smb.loadSettings();
    return Array.isArray(settings?.guildRequestHistory) ? settings.guildRequestHistory : [];
  }

  async function rememberGuildRequest(rawDir) {
    const dir = String(rawDir || '').trim();
    if (!dir) return;
    const settings = await smb.loadSettings();
    const current = Array.isArray(settings?.guildRequestHistory) ? settings.guildRequestHistory : [];
    if (current.includes(dir)) return;
    await smb.saveSettings({ guildRequestHistory: [dir, ...current].slice(0, SEARCH_HISTORY_LIMIT * 4) });
  }

  async function loadExchangeTargetHistory(currentUserId) {
    const ownerUserId = Number(currentUserId || 0);
    const settings = await smb.loadSettings();
    const historyOwnerUserId = Number(settings?.exchangeTargetHistoryOwnerUserId || 0);
    if (!ownerUserId) return [];
    if (historyOwnerUserId !== ownerUserId) {
      await smb.saveSettings({
        exchangeTargetHistoryOwnerUserId: ownerUserId,
        exchangeTargetHistory: []
      });
      return [];
    }
    return Array.isArray(settings?.exchangeTargetHistory)
      ? settings.exchangeTargetHistory.map(Number).filter(id => id > 0)
      : [];
  }

  async function rememberExchangeTarget(currentUserId, userId) {
    const ownerUserId = Number(currentUserId || 0);
    const targetUserId = Number(userId || 0);
    if (!ownerUserId || !targetUserId) return;
    const settings = await smb.loadSettings();
    const historyOwnerUserId = Number(settings?.exchangeTargetHistoryOwnerUserId || 0);
    const current = Array.isArray(settings?.exchangeTargetHistory)
      ? (historyOwnerUserId === ownerUserId ? settings.exchangeTargetHistory : [])
        .map(Number)
        .filter(id => id > 0 && id !== targetUserId)
      : [];
    await smb.saveSettings({
      exchangeTargetHistoryOwnerUserId: ownerUserId,
      exchangeTargetHistory: [targetUserId, ...current].slice(0, SEARCH_HISTORY_LIMIT * 4)
    });
  }

  async function submitChapterView(chapterId) {
    const result = await smb.apiPost('/api/activity/views/', { chapter: chapterId });
    await smb.apiPost('/api/v2/activity/view-page/', { chapter_id: chapterId, page: 1 }).catch(error => {
      window.SMBP?.recordDiagnostic?.({
        level: 'warn',
        scope: 'tasks',
        type: 'chapter_view_page_failed',
        message: error?.message || String(error),
        details: { chapterId: Number(chapterId || 0) || null }
      }).catch(() => {});
    });
    await smb.apiPost('/api/v2/activity/view-page/', { chapter_id: chapterId, page: -1 }).catch(error => {
      window.SMBP?.recordDiagnostic?.({
        level: 'warn',
        scope: 'tasks',
        type: 'chapter_view_finish_failed',
        message: error?.message || String(error),
        details: { chapterId: Number(chapterId || 0) || null }
      }).catch(() => {});
    });
    return result;
  }

  async function submitChapterLike(chapterId) {
    return smb.apiPost('/api/v2/activity/vote/', {
      type: 'chapters',
      data: {
        vote_type: 0,
        chapter: chapterId
      }
    });
  }

  async function submitChapterLikes(chapterIds) {
    const ids = (Array.isArray(chapterIds) ? chapterIds : [chapterIds])
      .map(Number)
      .filter(id => id > 0);
    if (!ids.length) throw new Error('Не переданы главы для лайка.');
    return smb.apiPost('/api/v2/activity/vote/', {
      type: 'chapters',
      data: {
        vote_type: 0,
        chapters: ids
      }
    });
  }

  async function submitTitleRating(titleId, rating = 10) {
    const attempts = [
      { path: '/api/activity/ratings/', body: { title: titleId, rating } },
      { path: '/api/activity/ratings/', body: { title: titleId, score: rating } },
      { path: '/api/activity/rating/', body: { title: titleId, rating } },
      { path: '/api/activity/rating/', body: { title: titleId, score: rating } }
    ];
    let lastError = null;

    for (const attempt of attempts) {
      try {
        return await smb.apiPost(attempt.path, attempt.body);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Не удалось отправить оценку тайтла.');
  }

  async function submitComment(text) {
    return smb.apiPost('/api/activity/comments/', { text });
  }

  async function submitCommentReply(commentId, text) {
    return smb.apiPost('/api/activity/comments/', { text, reply_to: commentId });
  }

  async function submitCommentVote(commentId, type = 0) {
    return smb.apiPost('/api/activity/votes/', { comment: commentId, type });
  }

  async function deleteComment(commentId) {
    return smb.api(`/api/activity/comments/${commentId}/`, { method: 'DELETE' });
  }

  function isCommentingUnavailableError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('вы не можете оставлять комментарии');
  }

  async function fetchTitleComments(titleId, page = 1) {
    const payload = await smb.apiGet(`/api/v2/activity/comments/?page=${page}&title_id=${titleId}`);
    return Array.isArray(payload) ? payload : [];
  }

  async function fetchSimilarTitles(dir, limit = 5) {
    const payload = await smb.apiGet(`/api/v2/titles/${dir}/similar/?count=${limit}`);
    return Array.isArray(payload?.results) ? payload.results : [];
  }

  async function submitSimilarVote(title1Dir, title2Dir, voteType = 0) {
    return smb.apiPost('/api/activity/vote-similar/', {
      vote_type: voteType,
      title1_dir: title1Dir,
      title2_dir: title2Dir
    });
  }

  async function fetchCurrentUser() {
    return smb.apiGet('/api/v2/users/current/');
  }

  async function fetchUserProfile(userId) {
    return smb.apiGet(`/api/v2/users/${userId}/`);
  }

  async function submitProfileVisitDirect(userId) {
    const profileId = Number(userId || 0);
    if (!profileId) throw new Error('Не передан пользователь для посещения профиля.');

    const profileUrl = `/user/${profileId}/about`;
    const [profile] = await Promise.all([
      fetchUserProfile(profileId),
      smb.api(profileUrl, {
        maxRequestsPerMinute: 90
      }).catch(() => null)
    ]);

    return {
      userId: profileId,
      username: profile?.username || `user-${profileId}`,
      profileUrl
    };
  }

  async function submitOwnProfileVisitDirect() {
    const currentUser = await fetchCurrentUser();
    const userId = Number(currentUser?.content?.id || currentUser?.id || 0);
    if (!userId) throw new Error('Не удалось определить текущего пользователя.');
    return submitProfileVisitDirect(userId);
  }

  async function submitFriendRequest(currentUserId, toUserId) {
    return smb.apiPost(`/api/v2/users/${currentUserId}/friends-requests/`, {
      user_id: currentUserId,
      to_user: toUserId
    });
  }

  async function listExchangeableCards(userId, page = 1, count = 20) {
    return smb.apiGet(`/api/v2/inventory/items/cards/${userId}/?count=${count}&ordering=-id&is_favorite=false&is_exchangeable=true&card__is_exchangeable=true&page=${page}`);
  }

  async function listUserExchanges(userId, page = 1) {
    return smb.apiGet(`/api/v2/inventory/${userId}/exchanges/?ordering=-id&page=${page}`);
  }

  async function getExchangeDetail(userId, exchangeId) {
    return smb.apiGet(`/api/v2/inventory/${userId}/exchanges/${exchangeId}/`);
  }

  async function createExchangeOffer(currentUserId, payload) {
    return smb.api(`/api/v2/inventory/${currentUserId}/exchanges/`, {
      method: 'POST',
      body: payload
    });
  }

  async function patchExchangeOffer(userId, exchangeId, payload) {
    return smb.api(`/api/v2/inventory/${userId}/exchanges/${exchangeId}/`, {
      method: 'PATCH',
      body: payload
    });
  }

  async function fetchGuildTopDirs(limit = 40) {
    const publicOpen = [];
    const fallback = [];
    const seen = new Set();

    const addGuild = (guild, bucket) => {
      const dir = String(guild?.dir || '').trim();
      if (!dir || seen.has(dir)) return;
      seen.add(dir);
      bucket.push(dir);
    };

    for (let page = 1; page <= 8 && (publicOpen.length + fallback.length) < limit * 2; page += 1) {
      const payload = await smb.apiGet(`/api/v2/clubs/?page=${page}&count=20`).catch(() => null);
      const results = Array.isArray(payload?.results) ? payload.results : [];
      if (!results.length) break;

      for (const guild of results) {
        const capacity = Number(guild?.max_members_count || 0) + Number(guild?.regression?.bonuses?.additional_members_count || 0);
        const hasOpenSlot = capacity <= 0 || Number(guild?.members_count || 0) < capacity;
        if (guild?.is_public && hasOpenSlot) {
          addGuild(guild, publicOpen);
        } else {
          addGuild(guild, fallback);
        }
      }

      if (!payload?.next) break;
    }

    const ordered = [...publicOpen, ...fallback].slice(0, limit);
    if (ordered.length) return ordered;

    const html = await smb.api('/guild/top');
    const matches = String(html || '').matchAll(/\/guild\/([^/"?#]+)\/about/g);
    for (const match of matches) {
      const dir = String(match?.[1] || '').trim();
      if (!dir || seen.has(dir)) continue;
      seen.add(dir);
      ordered.push(dir);
      if (ordered.length >= limit) break;
    }

    return ordered;
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (
          (message?.type === 'smbp_run_remanga_api' || message?.type === 'smbp_run_profile_context_api') &&
          response &&
          Number.isFinite(Number(response.status || 0))
        ) {
          resolve(response);
          return;
        }
        if (!response?.ok) {
          reject(new Error(response?.error || 'Фоновый сценарий не выполнился.'));
          return;
        }
        resolve(response);
      });
    });
  }

  async function runRemangaApiRequest(endpoint, options = {}) {
    const response = await sendRuntimeMessage({
      type: 'smbp_run_remanga_api',
      endpoint,
      method: options.method || 'GET',
      body: options.body,
      headers: options.headers
    });

    if (Array.isArray(options.acceptStatuses) && options.acceptStatuses.length) {
      if (!options.acceptStatuses.includes(Number(response?.status || 0))) {
        const detail = extractApiErrorMessage(response?.data) || response?.text || `HTTP ${response?.status || 0}`;
        throw new Error(detail);
      }
      return response;
    }

    if (!response?.ok) {
      const detail = extractApiErrorMessage(response?.data) || response?.text || 'API-запрос завершился ошибкой.';
      throw new Error(detail);
    }

    return response;
  }

  async function runProfileContextApiRequest(profileUrl, endpoint, options = {}) {
    const response = await sendRuntimeMessage({
      type: 'smbp_run_profile_context_api',
      url: profileUrl,
      endpoint,
      method: options.method || 'GET',
      body: options.body,
      headers: options.headers
    });

    if (Array.isArray(options.acceptStatuses) && options.acceptStatuses.length) {
      if (!options.acceptStatuses.includes(Number(response?.status || 0))) {
        const detail = extractApiErrorMessage(response?.data) || response?.text || `HTTP ${response?.status || 0}`;
        throw new Error(detail);
      }
      return response;
    }

    if (!response?.ok) {
      const detail = extractApiErrorMessage(response?.data) || response?.text || 'Profile-context API завершился ошибкой.';
      throw new Error(detail);
    }

    return response;
  }

  function extractApiErrorMessage(payload) {
    if (!payload) return '';
    if (typeof payload === 'string') return payload.trim();
    if (typeof payload?.detail === 'string') return payload.detail.trim();
    if (Array.isArray(payload?.detail) && payload.detail.length) {
      const firstDetail = payload.detail[0];
      if (typeof firstDetail === 'string') return firstDetail.trim();
      if (typeof firstDetail?.message === 'string') return firstDetail.message.trim();
    }
    if (typeof payload?.message === 'string') return payload.message.trim();
    if (Array.isArray(payload?.non_field_errors) && payload.non_field_errors.length) {
      return String(payload.non_field_errors[0] || '').trim();
    }
    return '';
  }

  const INVENTORY_CATEGORY_META = {
    avatars: {
      shopType: 'avatars',
      filterBy: 'avatar',
      currentUserKey: 'avatar',
      imageItemType: 'avatar',
      label: 'аватары'
    },
    wallpapers: {
      shopType: 'wallpapers',
      filterBy: 'wallpaper',
      currentUserKey: 'wallpaper',
      imageItemType: 'wallpaper',
      label: 'обои'
    },
    frames: {
      shopType: 'frames',
      filterBy: 'frame',
      currentUserKey: 'frame',
      imageItemType: 'frame',
      label: 'рамки'
    },
    theme: {
      shopType: 'theme',
      filterBy: 'theme',
      currentUserKey: 'theme',
      imageItemType: 'theme',
      label: 'темы'
    }
  };

  function normalizeInventoryAssetUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(String(value), REMANGA_API_ORIGIN);
      return decodeURIComponent(url.pathname)
        .replace(/^\/media(?=\/)/i, '')
        .toLowerCase();
    } catch (_error) {
      return decodeURIComponent(String(value || ''))
        .replace(/^\/?media(?=\/)/i, '')
        .replace(/^(?!\/)/, '/')
        .toLowerCase();
    }
  }

  function readInventoryAssetFromUser(user, categoryKey) {
    const userKey = INVENTORY_CATEGORY_META[categoryKey]?.currentUserKey || categoryKey;
    const asset = user?.[userKey];
    if (!asset) return '';
    if (categoryKey === 'theme') {
      return asset?.cover?.high || asset?.cover?.mid || asset?.cover?.low || asset?.cover?.original || '';
    }
    if (categoryKey === 'avatars') {
      return asset?.high || asset?.mid || asset?.low || asset?.original || asset?.image?.high || asset?.image?.mid || '';
    }
    return asset?.high || asset?.mid || asset?.low || asset?.original || '';
  }

  function parseEmbeddedInventoryState(html) {
    const source = String(html || '');
    const marker = 'window["__RQ_R_5b_"]';
    if (!source.includes(marker)) return [];

    const entries = [];
    let searchIndex = 0;

    while (searchIndex < source.length) {
      const pushIndex = source.indexOf(`${marker}.push(`, searchIndex);
      if (pushIndex < 0) break;

      const objectStart = source.indexOf('{', pushIndex);
      if (objectStart < 0) break;

      let depth = 0;
      let inString = false;
      let escaped = false;
      let objectEnd = -1;

      for (let index = objectStart; index < source.length; index += 1) {
        const char = source[index];

        if (inString) {
          if (escaped) {
            escaped = false;
            continue;
          }
          if (char === '\\') {
            escaped = true;
            continue;
          }
          if (char === '"') {
            inString = false;
          }
          continue;
        }

        if (char === '"') {
          inString = true;
          continue;
        }

        if (char === '{') {
          depth += 1;
          continue;
        }

        if (char === '}') {
          depth -= 1;
          if (depth === 0) {
            objectEnd = index;
            break;
          }
        }
      }

      if (objectEnd < 0) break;

      const raw = source.slice(objectStart, objectEnd + 1);
      try {
        entries.push(JSON.parse(raw));
      } catch (_error) {
        // Ignore malformed dehydrated chunks and keep scanning.
      }

      searchIndex = objectEnd + 1;
    }

    return entries;
  }

  function extractCustomizationItemsByRegex(html, shopType) {
    const source = String(html || '');
    const variants = new Set([String(shopType || '').toLowerCase()]);
    if (shopType === 'wallpapers') variants.add('wallpaper');
    if (shopType === 'frames') variants.add('frame');
    if (shopType === 'theme') variants.add('themes');

    if (![...variants].some(value => source.toLowerCase().includes(value))) return [];

    const results = [];
    const seen = new Set();
    const pattern = /"id":(\d+)[^{}]{0,600}?"(?:image|cover|asset)":\{"(?:high|mid)":"([^"]+)"/g;
    for (const match of source.matchAll(pattern)) {
      const id = Number(match?.[1] || 0);
      const imageUrl = String(match?.[2] || '');
      if (!id || !imageUrl) continue;
      const normalizedAsset = normalizeInventoryAssetUrl(imageUrl);
      if (!normalizedAsset || seen.has(id)) continue;
      seen.add(id);
      results.push({
        id,
        title: '',
        imageUrl,
        normalizedAsset,
        raw: null
      });
    }

    return results;
  }

  function extractCustomizationItemsFromHtml(html, shopType) {
    const entries = parseEmbeddedInventoryState(html);
    const variants = new Set([String(shopType || '').toLowerCase()]);
    if (shopType === 'wallpapers') variants.add('wallpaper');
    if (shopType === 'frames') variants.add('frame');
    if (shopType === 'theme') variants.add('themes');
    const items = [];

    for (const entry of entries) {
      const queries = Array.isArray(entry?.queries) ? entry.queries : [];
      for (const query of queries) {
        const serializedKey = JSON.stringify(query?.queryKey || '');
        if (!variants.size || ![...variants].some(value => serializedKey.toLowerCase().includes(value))) continue;
        const pages = query?.state?.data?.json?.pages;
        if (!Array.isArray(pages)) continue;
        for (const page of pages) {
          const results = Array.isArray(page?.results) ? page.results : [];
          for (const result of results) items.push(result);
        }
      }
    }

    return items;
  }

  function coerceCustomizationCandidate(item) {
    const candidateId = Number(
      item?.id ||
      item?.item_id ||
      item?.inventory_id ||
      item?.user_item_id ||
      item?.customization_id ||
      item?.pk ||
      0
    );
    const imageUrl = item?.image?.high ||
      item?.image?.mid ||
      item?.image_item?.image?.high ||
      item?.image_item?.image?.mid ||
      item?.theme?.cover?.high ||
      item?.theme?.cover?.mid ||
      item?.cover?.high ||
      item?.cover?.mid ||
      item?.icon ||
      item?.asset?.high ||
      item?.asset?.mid ||
      '';
    const title = String(
      item?.name ||
      item?.title ||
      item?.label ||
      item?.theme?.name ||
      item?.image_item?.name ||
      item?.item?.name ||
      ''
    ).trim();

    return {
      id: candidateId,
      title,
      imageUrl,
      normalizedAsset: normalizeInventoryAssetUrl(imageUrl),
      imageItemType: String(item?.image_item?.type || item?.item?.type || item?.type || '').trim().toLowerCase(),
      isUsing: Boolean(item?.is_using || item?.is_equipped || item?.active),
      raw: item
    };
  }

  async function listCustomizationInventoryCandidates(plan, categoryKey) {
    const categoryMeta = INVENTORY_CATEGORY_META[categoryKey];
    if (!categoryMeta || !Number(plan?.userId || 0)) return [];

    const results = [];
    const seen = new Set();

    for (let page = 1; page <= 10; page += 1) {
      const endpoint = `/api/v2/inventory/${Number(plan.userId)}/?filter_by=${encodeURIComponent(categoryMeta.filterBy || categoryMeta.shopType || categoryKey)}&page=${page}&type=customizations`;
      const response = await runRemangaApiRequest(endpoint);
      const items = Array.isArray(response?.data?.results) ? response.data.results : [];
      const normalized = items
        .map(coerceCustomizationCandidate)
        .filter(item => {
          if (item.id <= 0 || !item.normalizedAsset || seen.has(item.id)) return false;
          const expectedType = String(categoryMeta.imageItemType || '').toLowerCase();
          return !expectedType || !item.imageItemType || item.imageItemType === expectedType;
        });

      for (const item of normalized) {
        seen.add(item.id);
        results.push(item);
      }

      if (!items.length || !response?.data?.next) {
        break;
      }
    }

    return results;
  }

  async function equipCustomizationItem(plan, categoryKey, itemId) {
    if (!Number(plan?.userId || 0) || !Number(itemId || 0)) {
      throw new Error('Не удалось определить пользователя или предмет кастомизации для API.');
    }

    return runRemangaApiRequest(`/api/inventory/${Number(plan.userId)}/`, {
      method: 'POST',
      body: {
        item: Number(itemId)
      }
    });
  }

  async function unequipCustomizationItem(plan) {
    if (!Number(plan?.userId || 0)) {
      throw new Error('Не удалось определить пользователя для снятия предмета кастомизации.');
    }

    return runRemangaApiRequest(`/api/inventory/${Number(plan.userId)}/`, {
      method: 'POST',
      body: {
        item: null
      },
      acceptStatuses: [200, 201, 204]
    });
  }

  async function restoreCustomizationViaApi(plan, restorePlan) {
    if (!restorePlan) return { restored: true, skipped: true };

    if (Number(restorePlan.itemId || 0) > 0) {
      await equipCustomizationItem(plan, restorePlan.categoryKey, Number(restorePlan.itemId || 0));
      return {
        restored: true,
        categoryKey: restorePlan.categoryKey,
        itemId: Number(restorePlan.itemId || 0)
      };
    }

    if (restorePlan.unequip) {
      await unequipCustomizationItem(plan);
      return {
        restored: true,
        categoryKey: restorePlan.categoryKey,
        unequipped: true
      };
    }

    return { restored: true, skipped: true };
  }

  async function swapCustomizationViaApi(plan, categoryKey) {
    const categoryMeta = INVENTORY_CATEGORY_META[categoryKey];
    if (!categoryMeta) return null;

    const currentAsset = normalizeInventoryAssetUrl(plan?.equippedImages?.[categoryKey] || '');
    const candidates = await listCustomizationInventoryCandidates(plan, categoryKey);
    const equippedCandidate = candidates.find(item => item.isUsing && item.normalizedAsset);
    const effectiveCurrentAsset = equippedCandidate?.normalizedAsset || currentAsset;
    const alternative = candidates.find(item => item.normalizedAsset && item.normalizedAsset !== effectiveCurrentAsset);
    if (!alternative) return null;

    await equipCustomizationItem(plan, categoryKey, alternative.id);
    await smb.sleep(900);
    const currentUserAfter = await fetchCurrentUser();
    const changedAsset = normalizeInventoryAssetUrl(readInventoryAssetFromUser(currentUserAfter, categoryKey));
    if (changedAsset !== alternative.normalizedAsset) {
      throw new Error(`Сайт не применил другой предмет через API (${categoryMeta.label}).`);
    }

    return {
      categoryKey,
      categoryLabel: categoryMeta.label,
      itemId: alternative.id,
      imageUrl: alternative.imageUrl,
      title: alternative.title || `${categoryMeta.label} #${alternative.id}`,
      equippedItemId: Number(equippedCandidate?.id || 0) || null,
      equippedImage: equippedCandidate?.imageUrl || '',
      equippedTitle: equippedCandidate?.title || ''
    };
  }

  async function buildInventoryPlan() {
    const currentUser = await fetchCurrentUser();
    const userId = Number(currentUser?.id || 0);
    if (!userId) throw new Error('Не удалось определить текущего пользователя.');

    return {
      userId,
      inventoryUrl: `https://remanga.org/user/${userId}/inventory?type=customization&shopType=wallpapers`,
      categoryUrls: {
        avatars: `https://remanga.org/user/${userId}/inventory?type=customization&shopType=avatars`,
        wallpapers: `https://remanga.org/user/${userId}/inventory?type=customization&shopType=wallpapers`,
        frames: `https://remanga.org/user/${userId}/inventory?type=customization&shopType=frames`,
        theme: `https://remanga.org/user/${userId}/inventory?type=customization&shopType=theme`
      },
      equippedImages: {
        avatars: currentUser?.avatar?.high || currentUser?.avatar?.mid || currentUser?.avatar?.image?.high || currentUser?.avatar?.image?.mid || '',
        wallpapers: currentUser?.wallpaper?.high || currentUser?.wallpaper?.mid || '',
        frames: currentUser?.frame?.high || currentUser?.frame?.mid || '',
        theme: currentUser?.theme?.cover?.high || currentUser?.theme?.cover?.mid || ''
      },
      profileUrl: `https://remanga.org/user/${userId}/about`
    };
  }

  async function collectProfileCandidateIds(currentId, visitedProfiles, limit) {
    const fallbackIds = [24, 627468, 474677, 80189, 78208, 47343, 1, 2, 3];
    const candidates = [];
    const seen = new Set();

    const addCandidate = userId => {
      const normalizedId = Number(userId || 0);
      if (!normalizedId || normalizedId === currentId || visitedProfiles.has(normalizedId) || seen.has(normalizedId)) {
        return;
      }
      seen.add(normalizedId);
      candidates.push(normalizedId);
    };

    fallbackIds.forEach(addCandidate);

    if (candidates.length >= limit) {
      return candidates.slice(0, limit);
    }

    const dirs = await getCommentSourceDirs(Math.max(limit * 2, 12)).catch(() => []);
    for (const dir of dirs) {
      if (candidates.length >= limit) break;
      const details = await getTitleDetails(dir).catch(() => null);
      const titleId = Number(details?.id || 0);
      const countComments = Number(details?.count_comments || 0);
      if (!titleId || !countComments) continue;

      const maxPages = Math.min(3, Math.max(1, Math.ceil(countComments / 10)));
      for (let page = 1; page <= maxPages; page += 1) {
        if (candidates.length >= limit) break;
        const comments = await fetchTitleComments(titleId, page).catch(() => []);
        if (!comments.length) break;

        for (const comment of comments) {
          addCandidate(comment?.user?.id);
          if (candidates.length >= limit) break;
        }
      }
    }

    return candidates.slice(0, limit);
  }

  async function buildProfilePlan(task) {
    const remaining = Math.max(0, Number(task?.goal || 0) - Number(task?.progress || 0));
    const currentUser = await fetchCurrentUser();
    const currentId = Number(currentUser?.id || 0);
    const visitedProfiles = new Set(await loadProfileHistory());
    const limit = Math.max(remaining * 5, 8);
    const candidates = await collectProfileCandidateIds(currentId, visitedProfiles, limit);

    return {
      remaining,
      selectedUserIds: candidates.slice(0, Math.max(remaining * 3, 3))
    };
  }

  async function buildFriendRequestPlan(task) {
    const remaining = Math.max(0, Number(task?.goal || 0) - Number(task?.progress || 0));
    const currentUser = await fetchCurrentUser();
    const currentId = Number(currentUser?.id || 0);
    const requestedUsers = new Set(await loadFriendRequestHistory());
    const limit = Math.max(remaining * 8, 12);
    const candidates = shuffleArray(await collectProfileCandidateIds(currentId, requestedUsers, limit));
    const selectedUserIds = [];

    for (const userId of candidates) {
      if (selectedUserIds.length >= Math.max(remaining * 3, 3)) break;
      const profile = await fetchUserProfile(userId).catch(() => null);
      const status = String(profile?.friend_status || '');
      if (!profile?.id || status !== 'no_friends') continue;
      selectedUserIds.push({
        userId,
        username: profile?.username || `user-${userId}`,
        friendStatus: status
      });
    }

    return {
      remaining,
      currentUserId: currentId,
      selectedUserIds
    };
  }

  async function buildGuildJoinPlan(task) {
    const remaining = Math.max(0, Number(task?.goal || 0) - Number(task?.progress || 0));
    const requestedGuilds = new Set(await loadGuildRequestHistory());
    const dirs = await fetchGuildTopDirs(Math.max(remaining * 8, 24));
    const selectedGuilds = dirs
      .filter(dir => !requestedGuilds.has(dir))
      .slice(0, Math.max(remaining * 4, 8))
      .map(dir => ({
        dir,
        url: `https://remanga.org/guild/${dir}/about`
      }));

    return {
      remaining,
      selectedGuilds
    };
  }

  async function buildOpinionRatingPlan(task) {
    const remaining = Math.max(0, Number(task?.goal || 0) - Number(task?.progress || 0));
    const selectedVotes = [];
    const selectedUrls = [];
    const seenUrls = new Set();
    const votedCommentIds = new Set(await loadCommentVoteHistory());
    const currentUser = await fetchCurrentUser().catch(() => null);
    const currentUserId = Number(currentUser?.id || 0);
    const limit = Math.max(remaining * 4, 10);

    const commentSourceDirs = await getCommentSourceDirs(Math.max(limit * 2, 16));

    for (const dir of commentSourceDirs) {
      if (selectedVotes.length >= limit) break;

      const details = await getTitleDetails(dir).catch(() => null);
      const titleId = Number(details?.id || 0);
      const countComments = Number(details?.count_comments || 0);
      if (!titleId || !countComments) continue;
      const titleUrl = `https://remanga.org/manga/${dir}/main`;
      if (!seenUrls.has(titleUrl)) {
        seenUrls.add(titleUrl);
        selectedUrls.push(titleUrl);
      }

      const maxPages = Math.min(4, Math.max(1, Math.ceil(countComments / 10)));
      for (let page = 1; page <= maxPages; page += 1) {
        const comments = await fetchTitleComments(titleId, page).catch(() => []);
        if (!comments.length) break;

        for (const comment of comments) {
          const commentId = Number(comment?.id || 0);
          const authorId = Number(comment?.user?.id || 0);
          if (!commentId || votedCommentIds.has(commentId) || (currentUserId && authorId === currentUserId)) continue;

          selectedVotes.push({
            commentId,
            titleId,
            titleDir: dir,
            titleName: details?.main_name || details?.secondary_name || dir,
            author: comment?.user?.username || 'unknown',
            score: Number(comment?.score || 0)
          });
          votedCommentIds.add(commentId);

          if (selectedVotes.length >= limit) break;
        }

        if (selectedVotes.length >= limit) break;
      }
    }

    return {
      remaining,
      selectedVotes,
      selectedUrls
    };
  }

  async function buildCommentReplyPlan(task) {
    const remaining = Math.max(0, Number(task?.goal || 0) - Number(task?.progress || 0));
    const selectedReplies = [];
    const repliedCommentIds = new Set(await loadCommentReplyHistory());
    const currentUser = await fetchCurrentUser().catch(() => null);
    const currentUserId = Number(currentUser?.id || 0);
    const limit = Math.max(remaining * 3, 6);

    const commentSourceDirs = await getCommentSourceDirs(Math.max(limit * 2, 16));

    for (const dir of commentSourceDirs) {
      if (selectedReplies.length >= limit) break;

      const details = await getTitleDetails(dir).catch(() => null);
      const titleId = Number(details?.id || 0);
      const countComments = Number(details?.count_comments || 0);
      if (!titleId || !countComments) continue;

      const maxPages = Math.min(4, Math.max(1, Math.ceil(countComments / 10)));
      for (let page = 1; page <= maxPages; page += 1) {
        const comments = await fetchTitleComments(titleId, page).catch(() => []);
        if (!comments.length) break;

        for (const comment of comments) {
          const commentId = Number(comment?.id || 0);
          const authorId = Number(comment?.user?.id || 0);
          const repliesCount = Number(comment?.count_replies || 0);
          if (!commentId || repliedCommentIds.has(commentId) || (currentUserId && authorId === currentUserId)) continue;
          if (repliesCount > 12) continue;

          selectedReplies.push({
            commentId,
            titleId,
            titleDir: dir,
            titleName: details?.main_name || details?.secondary_name || dir,
            author: comment?.user?.username || 'unknown',
            repliesCount
          });
          repliedCommentIds.add(commentId);

          if (selectedReplies.length >= limit) break;
        }

        if (selectedReplies.length >= limit) break;
      }
    }

    return {
      remaining,
      selectedReplies
    };
  }

  async function buildSearchTaskPlan(task, options = {}) {
    const remaining = Math.max(0, Number(task?.goal || 0) - Number(task?.progress || 0));
    const field = getSearchField(task);
    const tagNames = extractTagNames(task);
    const visitedDirs = await getVisitedDirs(task.id);
    const failedDirs = await getFailedSearchDirs(task.id);
    const blacklistedDirs = await getBlacklistedTitleDirs(`search:${field}`);

    if (!remaining) {
      return {
        field,
        tagNames,
        remaining,
        candidates: []
      };
    }

    if (!tagNames.length) {
      throw new Error('Не удалось разобрать теги из описания задачи.');
    }

    const candidateMap = createCandidateMap();
    const previewMode = Boolean(options.preview);
    const selectionLimit = previewMode ? Math.max(remaining, 3) : Math.max(remaining * 4, 6);
    const minimumStrongCandidates = Math.max(remaining, 1);
    let resolvedTags = [];

    resolvedTags = await collectFilterCandidates(field, tagNames, candidateMap);
    if (!resolvedTags.length) {
      throw new Error('Не удалось найти ID нужных жанров или категорий для фильтра каталога.');
    }

    const matchTags = resolvedTags.length ? resolvedTags : tagNames;

    async function buildCandidates(ignoreHistory = false) {
      const candidates = await enrichCandidates(
        field,
        matchTags,
        candidateMap,
        ignoreHistory ? new Set() : visitedDirs,
        ignoreHistory ? new Set() : new Set([...failedDirs, ...blacklistedDirs]),
        previewMode ? Math.max(selectionLimit * 3, 12) : Math.max(TITLE_POOL_LIMIT, remaining * 8)
      );
      const {
        candidates: strongCandidates,
        minMatchScore,
        maxMatchScore
      } = filterStrongTagCandidates(candidates, matchTags);
      return {
        candidates,
        strongCandidates,
        minMatchScore,
        maxMatchScore
      };
    }

    let {
      candidates,
      strongCandidates,
      minMatchScore,
      maxMatchScore
    } = await buildCandidates(false);

    if (strongCandidates.length < minimumStrongCandidates) {
      ({
        candidates,
        strongCandidates,
        minMatchScore,
        maxMatchScore
      } = await buildCandidates(true));
    }

    const selectedTitles = [];
    const seenDirs = new Set();

    const coveredTagKeys = new Set();

    async function collectSelectableTitles(source, options = {}) {
      const preferUncoveredTags = Boolean(options.preferUncoveredTags);
      const orderedSource = preferUncoveredTags
        ? [...source].sort((left, right) => {
          const leftUncovered = (left?._matchedTags || []).filter(tag => !coveredTagKeys.has(getTagCoverageKey(tag))).length;
          const rightUncovered = (right?._matchedTags || []).filter(tag => !coveredTagKeys.has(getTagCoverageKey(tag))).length;
          if (rightUncovered !== leftUncovered) return rightUncovered - leftUncovered;
          if (right._matchScore !== left._matchScore) return Number(right._matchScore || 0) - Number(left._matchScore || 0);
          if (right._rarityScore !== left._rarityScore) return Number(right._rarityScore || 0) - Number(left._rarityScore || 0);
          return Number(right.avg_rating || 0) - Number(left.avg_rating || 0);
        })
        : source;

      const eligibleSource = orderedSource.filter(title => {
        if (!title?.dir || seenDirs.has(title.dir)) return false;
        const uncoveredMatches = (title._matchedTags || []).filter(tag => !coveredTagKeys.has(getTagCoverageKey(tag)));
        if (preferUncoveredTags && !uncoveredMatches.length) return false;
        return true;
      });

      for (let index = 0; index < eligibleSource.length && selectedTitles.length < selectionLimit; index += FILTER_CHAPTER_PROBE_BATCH_SIZE) {
        if (selectedTitles.length >= selectionLimit) break;
        const batch = eligibleSource.slice(index, index + FILTER_CHAPTER_PROBE_BATCH_SIZE);
        const settled = await Promise.allSettled(batch.map(async title => ({
          title,
          freeChapter: (await getFreeChapters(title.dir, 3))[0]
        })));

        for (const result of settled) {
          if (selectedTitles.length >= selectionLimit) break;
          if (result.status !== 'fulfilled') continue;
          const { title, freeChapter } = result.value || {};
          if (!title?.dir || seenDirs.has(title.dir) || !freeChapter?.id) continue;
          const uncoveredMatches = (title._matchedTags || []).filter(tag => !coveredTagKeys.has(getTagCoverageKey(tag)));
          if (preferUncoveredTags && !uncoveredMatches.length) continue;

          seenDirs.add(title.dir);
          for (const tagName of title._matchedTags || []) {
            coveredTagKeys.add(getTagCoverageKey(tagName));
          }
          selectedTitles.push({
            ...title,
            chapterId: freeChapter.id,
            chapterUrl: freeChapter.url
          });
        }
      }
    }

    await collectSelectableTitles(strongCandidates, { preferUncoveredTags: true });
    if (selectedTitles.length < Math.max(remaining, 1)) {
      await collectSelectableTitles(candidates, { preferUncoveredTags: true });
    }
    await collectSelectableTitles(strongCandidates);
    if (selectedTitles.length < Math.max(remaining, 1)) {
      await collectSelectableTitles(candidates);
    }

    return {
      field,
      tagNames,
      remaining,
      resolvedTags,
      candidates: strongCandidates,
      allCandidates: candidates,
      minMatchScore,
      maxMatchScore,
      selectedTitles
    };
  }

  function mapPlanChapters(chapters, limit = 8) {
    return (Array.isArray(chapters) ? chapters : []).slice(0, limit).map(chapter => ({
      title: getReadableTitleName(chapter),
      dir: chapter?.dir || '',
      chapterId: Number(chapter?.chapterId || chapter?.id || 0) || null,
      url: chapter?.chapterUrl || chapter?.url || '',
      reason: chapter?.reason || ''
    }));
  }

  function makeDryRunResult(task, patch = {}) {
    const progress = Number(task?.progress || 0);
    const goal = Number(task?.goal || 0);
    return {
      dryRun: true,
      taskId: Number(task?.id || 0) || null,
      taskName: String(task?.name || 'Задача'),
      progress,
      goal,
      remaining: Math.max(0, goal - progress),
      route: 'current-page-api',
      opensTabs: false,
      changesUrl: false,
      expectedProgress: goal > 0 ? `${progress}/${goal} -> ${goal}/${goal}` : '',
      filters: [],
      selected: [],
      skipped: [],
      requests: [],
      warnings: [],
      ...patch
    };
  }

  async function buildTaskDryRunPlan(task) {
    assertTaskAutomatable(task);

    if (isAutoSearchTask(task)) {
      const plan = await buildSearchTaskPlan(task, { preview: true });
      return makeDryRunResult(task, {
        kind: getTaskVisualKind(task),
        filters: [{
          type: plan.field,
          tags: plan.resolvedTags.map(tag => ({
            name: tag.name,
            id: tag.id
          }))
        }],
        selected: mapPlanChapters(plan.selectedTitles),
        skipped: [
          ...(plan.allCandidates || [])
            .filter(title => !(plan.selectedTitles || []).some(item => item.dir === title.dir))
            .slice(0, 8)
            .map(title => ({
              title: getReadableTitleName(title),
              dir: title.dir,
              reason: 'нет подходящей бесплатной непрочитанной главы или ниже приоритет'
            }))
        ],
        requests: [
          `GET /api/v2/titles/${plan.field}/`,
          `GET /api/v2/search/catalog/?${plan.field}=...&ordering=-score`,
          `POST /api/activity/views/ x${plan.selectedTitles.length}`,
          `POST /api/v2/activity/view-page/ page=1,-1 x${plan.selectedTitles.length}`
        ],
        expectedProgress: `${Number(task?.progress || 0)}/${Number(task?.goal || 0)} -> ${Math.min(Number(task?.goal || 0), Number(task?.progress || 0) + plan.selectedTitles.length)}/${Number(task?.goal || 0)}`
      });
    }

    if (isChapterReadTask(task)) {
      const plan = await buildReadingPlan(task);
      return makeDryRunResult(task, {
        kind: 'reading',
        selected: mapPlanChapters(plan.selectedChapters),
        requests: [
          'GET /api/v2/search/catalog/',
          'GET /api/v2/titles/{dir}/',
          'GET /api/v2/titles/chapters/?user_data=1',
          `POST /api/activity/views/ x${plan.selectedChapters.length}`,
          `POST /api/v2/activity/view-page/ page=1,-1 x${plan.selectedChapters.length}`
        ],
        warnings: ['Отправка будет идти быстрыми последовательными сериями, не одним параллельным пакетом.'],
        expectedProgress: `${Number(task?.progress || 0)}/${Number(task?.goal || 0)} -> ${Math.min(Number(task?.goal || 0), Number(task?.progress || 0) + plan.selectedChapters.length)}/${Number(task?.goal || 0)}`
      });
    }

    if (isLikeTask(task)) {
      const plan = await buildLikePlan(task);
      return makeDryRunResult(task, {
        kind: 'like',
        selected: mapPlanChapters(plan.selectedChapters),
        requests: [
          'GET /api/v2/search/catalog/',
          'GET /api/v2/titles/{dir}/',
          'GET /api/v2/titles/chapters/?user_data=1',
          `POST /api/v2/activity/vote/ x${plan.selectedChapters.length}`
        ],
        warnings: ['Каждый лайк будет отдельным POST через новый endpoint ReManga; если battlepass не растёт две серии подряд, runner остановится.'],
        expectedProgress: `${Number(task?.progress || 0)}/${Number(task?.goal || 0)} -> ${Math.min(Number(task?.goal || 0), Number(task?.progress || 0) + plan.selectedChapters.length)}/${Number(task?.goal || 0)}`
      });
    }

    return makeDryRunResult(task, {
      kind: getTaskVisualKind(task),
      warnings: ['Для этой задачи пока доступен только общий предпросмотр.'],
      requests: ['Задача будет выполнена через текущий API-раннер без открытия новых вкладок.']
    });
  }

  async function runAutonomousMemoryTask(task, progressCb) {
    if (!isAutonomousMemoryTask(task)) {
      throw new Error('Эта задача не относится к автономной memory-игре.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    const currentProgress = Number(beforeTask.progress || 0);
    const goal = Number(beforeTask.goal || 0);

    if (currentProgress >= goal) {
      return {
        before: beforeTask,
        after: beforeTask,
        claimed: false
      };
    }

    progressCb?.('Отправляю завершение memory через API...');
    await smb.manageMinigame(smb.GAME_IDS.memory);

    let finalTask = await waitForTaskUpdate(
      beforeTask.id,
      nextTask => Number(nextTask.progress || 0) > currentProgress,
      {
        attempts: 10,
        delayMs: 180,
        initialTask: beforeTask
      }
    );
    if (Number(finalTask.progress || 0) <= currentProgress) {
      throw new Error('Сайт не засчитал memory после прямого API-вызова.');
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Забираю награду: ${finalTask.name}`);
      await smb.claimTask(finalTask.id);
      claimed = true;
      const claimedState = await loadState();
      finalTask = claimedState.tasks.find(item => item.id === beforeTask.id) || finalTask;
    }

    return {
      before: beforeTask,
      after: finalTask,
      claimed
    };
  }

  async function runInventoryTask(task, progressCb) {
    assertTaskAutomatable(task);

    if (!isInventoryTask(task)) {
      throw new Error('Эта задача не относится к инвентарю или кастомизации.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    const currentProgress = Number(beforeTask.progress || 0);
    const goal = Number(beforeTask.goal || 0);

    if (currentProgress >= goal) {
      return {
        before: beforeTask,
        after: beforeTask,
        claimed: false
      };
    }

    const plan = await buildInventoryPlan();
    progressCb?.('Проверяю доступные предметы и временно меняю оформление через API...');
    let changedCategory = null;
    let restorePlan = null;

    for (const categoryKey of ['frames', 'wallpapers', 'theme', 'avatars']) {
      changedCategory = await swapCustomizationViaApi(plan, categoryKey);
      if (changedCategory) {
        if (Number(changedCategory.equippedItemId || 0) > 0) {
          restorePlan = {
            categoryKey: changedCategory.categoryKey,
            itemId: Number(changedCategory.equippedItemId || 0),
            imageUrl: changedCategory.equippedImage || ''
          };
        } else {
          restorePlan = {
            categoryKey: changedCategory.categoryKey,
            itemId: null,
            imageUrl: changedCategory.imageUrl || '',
            unequip: true
          };
        }
        break;
      }
    }

    if (!changedCategory) {
      throw new Error('Не удалось найти доступный предмет кастомизации для смены через API.');
    }
    let finalTask = beforeTask;
    let claimed = false;

    try {
      finalTask = await waitForTaskUpdate(
        beforeTask.id,
        nextTask => Number(nextTask.progress || 0) > currentProgress || smb.isTaskReady(nextTask),
        {
          attempts: 12,
          delayMs: 450,
          initialTask: beforeTask
        }
      );

      if (Number(finalTask.progress || 0) <= currentProgress) {
        throw new Error('Сайт не засчитал смену оформления.');
      }

      let claimed = false;
      if (smb.isTaskReady(finalTask)) {
        progressCb?.(`Забираю награду: ${finalTask.name}`);
        await smb.claimTask(finalTask.id);
        claimed = true;
        const claimedState = await loadState();
        finalTask = claimedState.tasks.find(item => item.id === beforeTask.id) || finalTask;
      }

      return {
        before: beforeTask,
        after: finalTask,
        claimed,
        changedCategory,
        inventoryUrl: plan.inventoryUrl,
        profileUrl: plan.profileUrl
      };
    } finally {
      if (restorePlan?.itemId || restorePlan?.unequip) {
        progressCb?.(`Возвращаю исходный предмет через API: ${restorePlan.categoryKey}...`);
        try {
          const restoreResult = await restoreCustomizationViaApi(plan, restorePlan);
          if (!restoreResult?.restored) {
            progressCb?.('Не удалось подтвердить возврат исходного предмета, но задача уже обработана.');
          }
        } catch (error) {
          progressCb?.(`Не удалось вернуть исходный предмет через API: ${error?.message || error}`);
        }
      }
    }
  }

  async function runPersonalProfileTask(task, progressCb) {
    assertTaskAutomatable(task);

    if (!isPersonalProfileTask(task)) {
      throw new Error('Эта задача не относится к посещению своего профиля.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    const currentProgress = Number(beforeTask.progress || 0);
    const goal = Number(beforeTask.goal || 0);

    if (currentProgress >= goal) {
      return {
        before: beforeTask,
        after: beforeTask,
        profile: null,
        claimed: false
      };
    }

    progressCb?.('Открываю свой профиль фоновым запросом...');
    const profile = await submitOwnProfileVisitDirect();

    let finalTask = await waitForTaskUpdate(
      beforeTask.id,
      nextTask => Number(nextTask.progress || 0) > currentProgress || smb.isTaskReady(nextTask),
      {
        attempts: 12,
        delayMs: 450,
        initialTask: beforeTask
      }
    );

    if (Number(finalTask.progress || 0) <= currentProgress) {
      throw new Error('Сайт не засчитал посещение своего профиля.');
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Забираю награду: ${finalTask.name}`);
      await smb.claimTask(finalTask.id);
      claimed = true;
      const claimedState = await loadState();
      finalTask = claimedState.tasks.find(item => item.id === beforeTask.id) || finalTask;
    }

    return {
      before: beforeTask,
      after: finalTask,
      profile,
      claimed
    };
  }

  function deckApi(path, options = {}) {
    return smb.api(path, options);
  }

  function toAbsoluteMediaUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return new URL(url, location.origin).href;
  }

  function formatDeckRank(rank) {
    return String(rank || '')
      .replace(/^rank_/i, '')
      .toUpperCase() || '?';
  }

  function parseDeckIdList(value) {
    const source = Array.isArray(value)
      ? value.join(',')
      : String(value || '');
    const unique = new Set();
    const ids = [];
    const deckUrlMatches = [...source.matchAll(/(?:^|\/)deck\/(\d+)(?:\/open)?(?:[/?#]|$)/gi)]
      .map(match => Number(match[1]))
      .filter(id => Number.isInteger(id) && id > 0);
    const rawIds = [
      ...deckUrlMatches,
      ...source.split(/[,\s;]+/).map(part => Number(part))
    ];

    for (const next of rawIds) {
      if (!Number.isInteger(next) || next <= 0 || unique.has(next)) continue;
      unique.add(next);
      ids.push(next);
    }

    return ids;
  }

  async function getDeckIdCandidatesForTask(_task) {
    const settings = await smb.loadSettings();
    const ids = parseDeckIdList(settings?.deckTaskPreferredDeckIds);
    return ids.length ? ids : [10];
  }

  async function getDeckIdCandidatesFromValue(value) {
    const ids = parseDeckIdList(value);
    if (ids.length) return ids;
    const settings = await smb.loadSettings();
    const settingsIds = parseDeckIdList(settings?.deckTaskPreferredDeckIds);
    return settingsIds.length ? settingsIds : [10];
  }

  function normalizeAutomationText(value, fallback) {
    const text = String(value || '').trim();
    return text || fallback;
  }

  async function getAutomationCopySettings() {
    const settings = await smb.loadSettings();
    return {
      commentText: normalizeAutomationText(settings?.commentTaskText, 'Спасибо за главу!'),
      replyText: normalizeAutomationText(settings?.commentReplyTaskText, 'Спасибо за ответ!')
    };
  }

  async function getCurrentUserProfile() {
    return smb.apiGet('/api/v2/users/current/');
  }

  function normalizeCurrentUserPayload(payload) {
    return payload?.content && typeof payload.content === 'object' ? payload.content : payload;
  }

  function getShopItemType(item) {
    return item?.image_item?.type || (item?.theme ? 'theme' : '');
  }

  function getShopItemName(item) {
    return item?.image_item?.name || item?.theme?.name || item?.dir || `Shop item #${item?.id || '?'}`;
  }

  function getShopItemCost(item) {
    return Number(item?.cost || 0);
  }

  function isShopItemDateAvailable(item) {
    const now = Date.now();
    const start = item?.availability_start_date ? new Date(item.availability_start_date).getTime() : 0;
    const end = item?.availability_end_date ? new Date(item.availability_end_date).getTime() : Infinity;
    return (!Number.isFinite(start) || start <= now) && (!Number.isFinite(end) || now <= end);
  }

  function isSafeCustomizationShopCandidate(item) {
    const type = getShopItemType(item);
    if (!SHOP_CUSTOMIZATION_TYPES.includes(type)) return false;
    if (!Number(item?.id || 0)) return false;
    if (item?.is_bought || item?.is_using) return false;
    if (item?.deck || item?.emoji_pack || item?.dungeon_potion || item?.badge) return false;
    if (!isShopItemDateAvailable(item)) return false;
    if (item?.amount !== null && item?.amount !== undefined && Number(item.amount) <= 0) return false;
    if (Number(item?.cost_rub || 0) > 0) return false;
    if (Number(item?.paid_lightnings || 0) > 0) return false;
    if (Number(item?.cost_tickets || 0) > 0) return false;
    if (Number(item?.cost_event_points || 0) > 0) return false;
    return getShopItemCost(item) >= SHOP_MIN_CUSTOMIZATION_COST;
  }

  async function getLightningBalance() {
    const payload = await smb.apiGet('/api/v2/billing/lightning-balance/').catch(() => null);
    return {
      free: Number(payload?.balance_free || 0),
      paid: Number(payload?.balance_paid || 0)
    };
  }

  async function fetchShopCustomizationCandidates(progressCb) {
    const candidates = [];
    for (const type of SHOP_CUSTOMIZATION_TYPES) {
      for (let page = 1; page <= 3; page += 1) {
        const payload = await smb.apiGet(`/api/v2/shop/?type=${encodeURIComponent(type)}&ordering=cost&count=100&page=${page}`);
        const results = Array.isArray(payload?.results) ? payload.results : [];
        const safeItems = results.filter(isSafeCustomizationShopCandidate);
        for (const item of safeItems) {
          candidates.push({
            item,
            id: Number(item.id),
            type: getShopItemType(item),
            name: getShopItemName(item),
            cost: getShopItemCost(item)
          });
        }
        progressCb?.(`Магазин ${type}: найдено подходящих ${candidates.length}`);
        if (safeItems.length || !payload?.next || !results.length) break;
      }
    }
    return candidates;
  }

  async function buildShopPurchasePlan(progressCb) {
    const balance = await getLightningBalance();
    const availableCoins = balance.free + balance.paid;
    const candidates = (await fetchShopCustomizationCandidates(progressCb))
      .filter(candidate => candidate.cost <= availableCoins);

    if (!candidates.length) {
      throw new Error(`Не найден доступный предмет кастомизации за монеты. Баланс молний: ${availableCoins}, минимум для покупки: ${SHOP_MIN_CUSTOMIZATION_COST}.`);
    }

    const minCost = Math.min(...candidates.map(candidate => candidate.cost));
    const cheapest = candidates.filter(candidate => candidate.cost === minCost);
    const selected = cheapest[Math.floor(Math.random() * cheapest.length)];

    return {
      selected,
      minCost,
      candidates: cheapest.length,
      balance: availableCoins
    };
  }

  async function buyShopCustomizationItem(candidate) {
    return smb.apiPost(`/api/v2/shop/buy/${encodeURIComponent(candidate.id)}/`, {
      currency: 'coins'
    });
  }

  async function runShopPurchaseTask(task, progressCb) {
    assertTaskAutomatable(task);

    if (!isShopPurchaseTask(task)) {
      throw new Error('Эта задача не относится к покупке кастомизации в магазине.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    const currentProgress = Number(beforeTask.progress || 0);
    const goal = Number(beforeTask.goal || 0);

    if (currentProgress >= goal) {
      return {
        before: beforeTask,
        after: beforeTask,
        claimed: false
      };
    }

    progressCb?.('Подбираю самый дешевый предмет кастомизации в магазине...');
    const plan = await buildShopPurchasePlan(progressCb);
    progressCb?.(`Покупаю: ${plan.selected.name} (${plan.selected.type}) за ${plan.selected.cost} молний.`);
    await buyShopCustomizationItem(plan.selected);

    let finalTask = await waitForTaskUpdate(
      beforeTask.id,
      nextTask => Number(nextTask.progress || 0) > currentProgress || smb.isTaskReady(nextTask),
      {
        attempts: 12,
        delayMs: 550,
        initialTask: beforeTask
      }
    );

    if (Number(finalTask.progress || 0) <= currentProgress) {
      throw new Error('Покупка прошла, но сайт не засчитал задачу.');
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Забираю награду: ${finalTask.name}`);
      await smb.claimTask(finalTask.id);
      claimed = true;
      const claimedState = await loadState();
      finalTask = claimedState.tasks.find(item => item.id === beforeTask.id) || finalTask;
    }

    return {
      before: beforeTask,
      after: finalTask,
      claimed,
      purchased: plan.selected
    };
  }

  function getTicketBalanceFromUser(payload) {
    const user = normalizeCurrentUserPayload(payload) || {};
    return Number(user?.ticket_balance || user?.tickets || 0);
  }

  function normalizeTicketChapterCandidate(dir, titleName, branchId, chapter) {
    const chapterId = Number(chapter?.id || 0);
    if (!chapterId) return null;
    return {
      dir,
      titleName,
      branchId,
      chapterId,
      chapterIndex: Number(chapter.index || chapter.chapter || 0),
      price: Number.parseFloat(String(chapter.price ?? '').replace(',', '.')) || 0,
      url: `https://remanga.org/manga/${encodeURIComponent(dir)}/${chapterId}`
    };
  }

  function isTicketChapterCandidate(chapter) {
    if (!chapter || chapter.is_bought || chapter.is_free_today) return false;
    if (!isLockedChapter(chapter)) return false;
    return Number.parseFloat(String(chapter?.price ?? '').replace(',', '.')) > 0;
  }

  async function fetchPaidTicketChaptersFromTitle(dir, progressCb) {
    const details = await getTitleDetails(dir).catch(() => null);
    const branchId = Number(details?.active_branch?.id || details?.branches?.[0]?.id || 0);
    if (!branchId) return [];
    const titleName = getReadableTitleName(details, dir);
    const candidates = [];

    for (let page = 1; page <= TICKET_CHAPTER_PAGE_LIMIT; page += 1) {
      const payload = await smb.apiGet(`/api/v2/titles/chapters/?branch_id=${branchId}&chapter=&ordering=-index&count=30&page=${page}&user_data=1`).catch(() => null);
      const chapters = Array.isArray(payload?.results) ? payload.results : [];
      const paidChapters = chapters
        .filter(isTicketChapterCandidate)
        .map(chapter => normalizeTicketChapterCandidate(dir, titleName, branchId, chapter))
        .filter(Boolean);

      candidates.push(...paidChapters);
      if (candidates.length >= TICKET_CHAPTERS_PER_TITLE_LIMIT) {
        return shuffleArray(candidates).slice(0, TICKET_CHAPTERS_PER_TITLE_LIMIT);
      }

      progressCb?.(`Проверяю платные главы: ${titleName}, страница ${page}`);
      if (!payload?.next || !chapters.length) break;
    }

    return shuffleArray(candidates).slice(0, TICKET_CHAPTERS_PER_TITLE_LIMIT);
  }

  async function fetchPaidTicketChapterFromTitle(dir, progressCb) {
    const candidates = await fetchPaidTicketChaptersFromTitle(dir, progressCb);
    return candidates[0] || null;
  }

  async function fetchTicketChapterState(chapter) {
    if (!chapter?.chapterId) return null;
    const details = await smb.apiGet(`/api/v2/titles/chapters/${Number(chapter.chapterId)}/?user_data=1`).catch(() => null);
    if (details?.id) return details;
    if (!chapter?.branchId) return null;
    const payload = await smb.apiGet(`/api/v2/titles/chapters/?branch_id=${Number(chapter.branchId)}&chapter=&ordering=-index&count=30&page=1&user_data=1`).catch(() => null);
    const chapters = Array.isArray(payload?.results) ? payload.results : [];
    return chapters.find(item => Number(item?.id || 0) === Number(chapter.chapterId || 0)) || null;
  }

  function isTicketChapterOpened(chapterState) {
    if (!chapterState) return false;
    return Boolean(
      chapterState?.is_bought ||
      chapterState?.is_free_today ||
      chapterState?.is_opened ||
      chapterState?.user_data?.is_bought ||
      chapterState?.user?.is_bought ||
      (!isLockedChapter(chapterState) && isViewedChapter(chapterState))
    );
  }

  function isSkippableTicketChapterError(error) {
    const message = smb.normalizeText(error?.message || error || '');
    return Boolean(
      message.includes('http 404') ||
      message.includes('не существует') ||
      message.includes('уже бесплатно') ||
      message.includes('already free') ||
      message.includes('not found') ||
      message.includes('выбранная глава уже открыта') ||
      message.includes('стала бесплатной')
    );
  }

  async function getTicketSpendBalances() {
    const [user, lightning] = await Promise.all([
      getCurrentUserProfile().catch(() => null),
      getLightningBalance().catch(() => ({ free: 0, paid: 0 }))
    ]);
    return {
      tickets: getTicketBalanceFromUser(user),
      lightning: Number(lightning?.free || 0) + Number(lightning?.paid || 0)
    };
  }

  async function runTicketSpendViaApi(chapter, progressCb) {
    const chapterId = Number(chapter?.chapterId || 0);
    if (!chapterId) throw new Error('Не найден id платной главы для открытия за тикет.');

    const initialChapter = await fetchTicketChapterState(chapter);
    if (isTicketChapterOpened(initialChapter)) {
      throw new Error('Выбранная глава уже открыта или стала бесплатной.');
    }

    const beforeBalances = await getTicketSpendBalances();
    if (beforeBalances.tickets <= 0) {
      throw new Error('На аккаунте нет тикетов для открытия платной главы.');
    }

    progressCb?.('Открываю главу через /api/billing/buy-chapter/ за тикет...');
    const response = await smb.apiPost('/api/billing/buy-chapter/', {
      chapter: chapterId,
      chapter_id: chapterId,
      ticket: true,
      tickets: true,
      use_ticket: true,
      use_tickets: true,
      currency: 'tickets'
    });

    const freshChapter = await fetchTicketChapterState(chapter);
    const afterBalances = await getTicketSpendBalances();
    const spentTicket = beforeBalances.tickets > afterBalances.tickets;
    const spentLightning = beforeBalances.lightning > afterBalances.lightning;

    if (!isTicketChapterOpened(freshChapter) && !spentTicket) {
      throw new Error(smb.extractApiErrorMessage(response) || 'API не подтвердил открытие главы за тикет.');
    }

    if (!spentTicket && spentLightning) {
      throw new Error('Глава открылась, но баланс молний уменьшился вместо тикетов.');
    }

    return {
      purchased: true,
      method: 'buy-chapter',
      chapterId,
      beforeTickets: beforeBalances.tickets,
      afterTickets: afterBalances.tickets,
      chapter: freshChapter || null
    };
  }

  async function buildTicketSpendPlan(progressCb) {
    const currentUser = await getCurrentUserProfile();
    const ticketBalance = getTicketBalanceFromUser(currentUser);
    if (ticketBalance <= 0) {
      throw new Error('На аккаунте нет тикетов для покупки главы.');
    }

    const dirs = [];
    const seen = new Set();
    for (const dir of TICKET_CHAPTER_SOURCE_DIRS) {
      if (!dir || seen.has(dir)) continue;
      seen.add(dir);
      dirs.push(dir);
    }

    for (let page = 1; page <= 4 && dirs.length < TICKET_TITLE_POOL_LIMIT; page += 1) {
      const payload = await fetchCatalog({
        count: 30,
        ordering: '-score',
        page
      }).catch(() => null);
      for (const title of payload?.results || []) {
        const dir = String(title?.dir || '').trim();
        if (!dir || seen.has(dir)) continue;
        seen.add(dir);
        dirs.push(dir);
        if (dirs.length >= TICKET_TITLE_POOL_LIMIT) break;
      }
      if (!payload?.next) break;
    }

    const candidates = [];
    const shuffledDirs = shuffleArray(dirs);
    for (const dir of shuffledDirs) {
      const titleCandidates = await fetchPaidTicketChaptersFromTitle(dir, progressCb);
      candidates.push(...titleCandidates);
      if (titleCandidates.length) {
        progressCb?.(`Найдено вариантов за тикет: ${candidates.length}. Последний тайтл: ${titleCandidates[0].titleName}.`);
      }
      if (candidates.length >= TICKET_CANDIDATE_LIMIT) break;
    }

    const shuffledCandidates = shuffleArray(candidates);
    if (shuffledCandidates.length) {
      return {
        ticketBalance,
        chapter: shuffledCandidates[0],
        candidates: shuffledCandidates
      };
    }

    throw new Error('Не удалось найти платную некупленную главу, которую можно открыть за тикет.');
  }

  async function runTicketSpendInIframe(url, progressCb) {
    const frame = document.createElement('iframe');
    frame.style.cssText = [
      'position:fixed',
      'left:-10000px',
      'top:-10000px',
      'width:420px',
      'height:720px',
      'opacity:0',
      'pointer-events:none',
      'border:0'
    ].join(';');
    frame.src = url;
    document.documentElement.appendChild(frame);

    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const getFrameDocument = () => {
      try {
        return frame.contentDocument || frame.contentWindow?.document || null;
      } catch (_error) {
        return null;
      }
    };
    const waitUntil = async (predicate, attempts = 40, delayMs = 500) => {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const value = await predicate();
        if (value) return value;
        await smb.sleep(delayMs);
      }
      return null;
    };
    const allButtons = doc => Array.from(doc.querySelectorAll('button, [role="button"]'))
      .filter(node => !node.disabled && normalize(node.innerText || node.textContent));
    const findTicketButton = doc => {
      const buttons = allButtons(doc);
      return buttons.find(button => normalize(button.innerText || button.textContent).includes('открыть за 1')) ||
        buttons.find(button => {
          const text = normalize(button.innerText || button.textContent);
          return text.includes('тикет') && (text.includes('открыть') || text.includes('купить') || text.includes('получить'));
        });
    };
    const clickNode = async node => {
      node.scrollIntoView?.({ block: 'center', inline: 'center' });
      await smb.sleep(120);
      node.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: frame.contentWindow || window }));
      node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: frame.contentWindow || window }));
      node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: frame.contentWindow || window }));
      node.click();
    };

    try {
      const ticketButton = await waitUntil(() => {
        const doc = getFrameDocument();
        if (!doc?.body?.innerText) return null;
        return findTicketButton(doc);
      }, 45, 500);

      if (!ticketButton) {
        const doc = getFrameDocument();
        throw new Error(`Не найдена кнопка открытия за тикет. Текст страницы: ${(doc?.body?.innerText || '').slice(0, 300)}`);
      }

      progressCb?.('Нажимаю открытие главы за 1 тикет...');
      await clickNode(ticketButton);
      await smb.sleep(900);

      const docAfterClick = getFrameDocument();
      const confirmButton = docAfterClick ? allButtons(docAfterClick).find(button => {
        const text = normalize(button.innerText || button.textContent);
        if (!text || text.includes('отмена') || text.includes('закрыть')) return false;
        return (
          text.includes('подтверд') ||
          text.includes('купить') ||
          text.includes('открыть за 1') ||
          (text.includes('открыть') && text.includes('тикет'))
        );
      }) : null;

      if (confirmButton && confirmButton !== ticketButton) {
        progressCb?.('Подтверждаю покупку главы за тикет...');
        await clickNode(confirmButton);
      }

      const unlocked = await waitUntil(() => {
        const doc = getFrameDocument();
        if (!doc?.body) return null;
        const text = doc.body.innerText || '';
        const stillLocked = text.includes('Открыть за 1') && text.toLowerCase().includes('тикет');
        const hasReaderContent = Boolean(
          doc.querySelector('img[src*="/media/titles/"], img[src*="/media/chapters/"], canvas') ||
          Array.from(doc.images || []).some(image => /chapters|titles/i.test(image.src || ''))
        );
        return (!stillLocked || hasReaderContent) ? {
          purchased: true,
          href: frame.contentWindow?.location?.href || url,
          text: text.slice(0, 500)
        } : null;
      }, 18, 500);

      if (!unlocked) {
        const doc = getFrameDocument();
        throw new Error(`Сайт не показал, что глава открыта за тикет. Текст страницы: ${(doc?.body?.innerText || '').slice(0, 300)}`);
      }

      return unlocked;
    } finally {
      frame.remove();
    }
  }

  async function runTicketSpendTask(task, progressCb) {
    assertTaskAutomatable(task);

    if (!isTicketSpendTask(task)) {
      throw new Error('Эта задача не относится к трате тикетов.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    const currentProgress = Number(beforeTask.progress || 0);
    const goal = Number(beforeTask.goal || 0);

    if (currentProgress >= goal) {
      return {
        before: beforeTask,
        after: beforeTask,
        claimed: false
      };
    }

    progressCb?.('Подбираю платную главу для открытия за тикет...');
    const plan = await buildTicketSpendPlan(progressCb);
    const candidates = Array.isArray(plan.candidates) && plan.candidates.length
      ? plan.candidates
      : [plan.chapter].filter(Boolean);
    let response = null;
    let purchasedChapter = null;
    const errors = [];

    for (let index = 0; index < candidates.length && !response?.purchased; index += 1) {
      const chapter = candidates[index];
      progressCb?.(`Открываю за тикет: ${chapter.titleName}, глава ${chapter.chapterIndex || chapter.chapterId} (${index + 1}/${candidates.length}).`);

      let apiError = null;
      let iframeError = null;
      try {
        response = await runTicketSpendViaApi(chapter, progressCb);
      } catch (error) {
        apiError = error;
        if (isSkippableTicketChapterError(error)) {
          errors.push(`${chapter.titleName} #${chapter.chapterIndex || chapter.chapterId}: ${error?.message || error}`);
          progressCb?.(`Глава не подходит для тикета, беру следующую: ${chapter.titleName}.`);
          response = null;
          continue;
        }
        progressCb?.(`API-открытие не сработало, пробую iframe: ${error?.message || error}`);
      }

      try {
        if (!response?.purchased) {
          response = await runTicketSpendInIframe(chapter.url, progressCb);
        }
      } catch (error) {
        iframeError = error;
        progressCb?.(`Iframe-открытие не сработало, пробую background: ${error?.message || error}`);
      }

      if (!response?.purchased) {
        try {
          response = await sendRuntimeMessage({
            type: 'smbp_run_ticket_spend_task',
            url: chapter.url
          });
        } catch (error) {
          const parts = [];
          if (apiError) parts.push(`API: ${apiError.message || apiError}`);
          if (iframeError) parts.push(`Iframe: ${iframeError.message || iframeError}`);
          parts.push(`background: ${error?.message || error}`);
          errors.push(`${chapter.titleName} #${chapter.chapterIndex || chapter.chapterId}: ${parts.join('; ')}`);
          progressCb?.(`Пропускаю главу, пробую следующую: ${chapter.titleName}.`);
          response = null;
          continue;
        }
      }

      if (response?.purchased) {
        purchasedChapter = chapter;
        break;
      }

      errors.push(`${chapter.titleName} #${chapter.chapterIndex || chapter.chapterId}: ${response?.error || 'сайт не подтвердил покупку'}`);
      progressCb?.(`Пропускаю главу, пробую следующую: ${chapter.titleName}.`);
      response = null;
    }

    if (!response?.purchased || !purchasedChapter) {
      throw new Error(errors.slice(-3).join(' | ') || 'Сайт не подтвердил покупку главы за тикет.');
    }

    let finalTask = await waitForTaskUpdate(
      beforeTask.id,
      nextTask => Number(nextTask.progress || 0) > currentProgress || smb.isTaskReady(nextTask),
      {
        attempts: 12,
        delayMs: 550,
        initialTask: beforeTask
      }
    );

    if (Number(finalTask.progress || 0) <= currentProgress) {
      throw new Error('Глава открыта за тикет, но сайт не засчитал задачу.');
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Забираю награду: ${finalTask.name}`);
      await smb.claimTask(finalTask.id);
      claimed = true;
      const claimedState = await loadState();
      finalTask = claimedState.tasks.find(item => item.id === beforeTask.id) || finalTask;
    }

    return {
      before: beforeTask,
      after: finalTask,
      claimed,
      chapter: purchasedChapter
    };
  }

  async function getDeckMeta(deckId) {
    const payload = await deckApi(`/api/v2/shop/decks/?deck_id=${deckId}&page=1`);
    const items = Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload)
        ? payload
        : [];
    const item = items.find(entry => Number(entry?.deck?.id || entry?.id || entry?.deck_id || 0) === Number(deckId)) || items[0] || null;
    return item?.deck || item;
  }

  async function listUnopenedDecks(userId, deckId) {
    return deckApi(`/api/v2/inventory/decks/?is_opened=false&user_id=${encodeURIComponent(userId)}&deck_id=${encodeURIComponent(deckId)}&page=1`);
  }

  async function openInventoryDeck(deckInstanceId) {
    return deckApi(`/api/v2/inventory/decks/${deckInstanceId}/open/`, {
      method: 'POST'
    });
  }

  async function chooseInventoryDeckCard(deckInstanceId, cardId) {
    return deckApi(`/api/v2/inventory/decks/${deckInstanceId}/choose/`, {
      method: 'POST',
      body: { card_id: Number(cardId) }
    });
  }

  async function getInventoryCardDetails(cardId) {
    return deckApi(`/api/inventory/cards/${cardId}/`);
  }

  async function listCardUpgradeInventory(userId, progressCb) {
    const allItems = [];
    for (let page = 1; page <= 8; page += 1) {
      const payload = await smb.apiGet(`/api/v2/inventory/items/cards/${encodeURIComponent(userId)}/?count=100&ordering=rank&page=${page}`).catch(error => {
        throw new Error(`Не удалось загрузить карты для апгрейда: ${error?.message || error}`);
      });
      const results = Array.isArray(payload?.results) ? payload.results : [];
      allItems.push(...results);
      progressCb?.(`Загружено карт для апгрейда: ${allItems.length}`);
      if (!payload?.next || !results.length) break;
    }
    return allItems;
  }

  function normalizeCardUpgradeItem(item) {
    const card = item?.card || {};
    const title = card?.title || null;
    const character = card?.character || null;
    const rank = String(card?.rank || '').trim();
    const stackCount = Math.max(0, Number(item?.stack_count || 0) || 0);
    const titleName = String(title?.main_name || title?.name || '').trim();
    const characterName = String(character?.name || '').trim();
    return {
      inventoryItemId: Number(item?.id || 0),
      cardId: Number(card?.id || 0),
      rank,
      rankLabel: formatDeckRank(rank),
      stackCount,
      titleId: Number(title?.id || 0),
      titleName,
      characterName,
      label: characterName || titleName || `Карта #${card?.id || item?.id || '?'}`,
      subtitle: titleName || String(card?.description || '').trim(),
      imageUrl: toAbsoluteMediaUrl(card?.cover?.high || card?.cover?.mid || ''),
      isFavorite: Boolean(item?.is_favorite),
      isUpgradable: card?.is_upgradable !== false,
      raw: item
    };
  }

  function isCardUsableForUpgrade(card) {
    return Boolean(
      card?.inventoryItemId > 0
      && card?.cardId > 0
      && card?.rank
      && card?.stackCount > 0
      && card?.titleId > 0
      && !card?.isFavorite
      && card?.isUpgradable
      && !CARD_UPGRADE_BLOCKED_RANKS.has(card.rank)
    );
  }

  function expandUpgradeCards(cards) {
    const expanded = [];
    for (const card of cards || []) {
      const count = Math.max(1, Number(card?.stackCount || 1) || 1);
      for (let index = 0; index < count; index += 1) expanded.push(card);
    }
    return expanded;
  }

  function takeCardsByDistinctTitles(cards, count) {
    const selected = [];
    const usedTitles = new Set();
    for (const card of cards || []) {
      if (usedTitles.has(card.titleId)) continue;
      usedTitles.add(card.titleId);
      selected.push(card);
      if (selected.length >= count) break;
    }
    return selected;
  }

  function buildCardUpgradePlan(rawItems) {
    const cards = rawItems.map(normalizeCardUpgradeItem);
    const usableCards = cards.filter(isCardUsableForUpgrade);
    const rankTotals = {};
    for (const card of usableCards) {
      const label = card.rankLabel || formatDeckRank(card.rank);
      rankTotals[label] = (rankTotals[label] || 0) + card.stackCount;
    }

    const commonGroups = new Map();
    const rankGroups = new Map();
    for (const card of usableCards) {
      const commonKey = `${card.rank}|${card.titleId}`;
      if (!commonGroups.has(commonKey)) commonGroups.set(commonKey, []);
      commonGroups.get(commonKey).push(card);

      if (!rankGroups.has(card.rank)) rankGroups.set(card.rank, []);
      rankGroups.get(card.rank).push(card);
    }

    const commonCandidates = [];
    for (const [key, group] of commonGroups.entries()) {
      const expanded = expandUpgradeCards(group);
      if (expanded.length < CARD_UPGRADE_TYPES.common.required) continue;
      const selectedCards = expanded.slice(0, CARD_UPGRADE_TYPES.common.required);
      const first = selectedCards[0];
      commonCandidates.push({
        key: `common:${key}`,
        type: 'common',
        mergeType: CARD_UPGRADE_TYPES.common.id,
        label: `${first.titleName || 'Тайтл'} · ${first.rankLabel}`,
        meta: `${expanded.length} карт одного произведения и ранга`,
        cards: selectedCards,
        cardIds: selectedCards.map(card => card.cardId)
      });
    }

    const rankCandidates = [];
    for (const [rank, group] of rankGroups.entries()) {
      const shuffled = shuffleArray(group);
      const distinct = takeCardsByDistinctTitles(shuffled, CARD_UPGRADE_TYPES.exclusive.required);
      const total = group.reduce((sum, card) => sum + card.stackCount, 0);
      const rankLabel = formatDeckRank(rank);
      if (distinct.length < CARD_UPGRADE_TYPES.exclusive.required) {
        rankCandidates.push({
          key: `rank:${rank}`,
          type: 'rank',
          rank,
          rankLabel,
          label: `Ранг ${rankLabel}`,
          meta: `${total} карт. Нужно минимум 3 карты одного ранга из разных произведений.`,
          cards: [],
          cardIds: [],
          disabled: true
        });
        continue;
      }
      rankCandidates.push({
        key: `rank:${rank}`,
        type: 'rank',
        rank,
        rankLabel,
        label: `Ранг ${rankLabel}`,
        meta: `${total} карт. Будут выбраны 3 случайные карты разных произведений.`,
        cards: distinct,
        cardIds: distinct.map(card => card.cardId),
        disabled: false
      });
    }

    const rankOrder = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'RE', 'EV'];
    const rankWeight = label => {
      const index = rankOrder.indexOf(String(label || '').toUpperCase());
      return index === -1 ? 999 : index;
    };
    commonCandidates.sort((a, b) => rankWeight(a.cards[0]?.rankLabel) - rankWeight(b.cards[0]?.rankLabel) || String(a.label).localeCompare(String(b.label)));
    rankCandidates.sort((a, b) => rankWeight(a.rankLabel) - rankWeight(b.rankLabel));

    return {
      rankTotals,
      commonCandidates,
      exclusiveCandidates: rankCandidates.map(candidate => ({ ...candidate, type: 'exclusive', mergeType: CARD_UPGRADE_TYPES.exclusive.id, key: `exclusive:${candidate.rank}` })),
      randomCandidates: rankCandidates.map(candidate => ({ ...candidate, type: 'random', mergeType: CARD_UPGRADE_TYPES.random.id, key: `random:${candidate.rank}` })),
      totalCards: cards.length,
      usableCards: usableCards.length
    };
  }

  async function submitCardUpgrade(userId, selected) {
    return smb.api(`/api/inventory/${encodeURIComponent(userId)}/cards/merge/`, {
      method: 'POST',
      body: {
        cards: selected.cardIds.map(id => Number(id)),
        type: Number(selected.mergeType)
      }
    });
  }

  function normalizeUpgradeResultCard(payload) {
    const source = payload?.content || payload?.card || payload?.result || payload?.dropped_card || payload;
    const card = source?.card || source || {};
    return {
      id: Number(card?.id || source?.id || 0),
      rank: String(card?.rank || ''),
      rankLabel: formatDeckRank(card?.rank),
      imageUrl: toAbsoluteMediaUrl(card?.cover?.high || card?.cover?.mid || source?.cover?.high || source?.cover?.mid || ''),
      label: buildDeckCardLabel(card),
      subtitle: buildDeckCardSubtitle(card),
      raw: payload
    };
  }

  async function openConfiguredDeck(deckIdSource, progressCb) {
    const user = await getCurrentUserProfile();
    const currentUserId = Number(user?.id || 0);
    if (!currentUserId) {
      throw new Error('Не удалось определить текущий аккаунт для открытия пака.');
    }
    const deckCandidates = await getDeckIdCandidatesFromValue(deckIdSource);
    let deckId = null;
    let deckMeta = null;
    let deckInstanceId = null;

    progressCb?.(`Рщу неоткрытую колоду среди паков: ${deckCandidates.join(', ')}...`);

    for (const candidateId of deckCandidates) {
      const [candidateMeta, deckList] = await Promise.all([
        getDeckMeta(candidateId).catch(() => null),
        listUnopenedDecks(currentUserId, candidateId).catch(() => null)
      ]);
      const deckItems = Array.isArray(deckList?.results)
        ? deckList.results
        : Array.isArray(deckList)
          ? deckList
          : [];
      const candidateDeckInstanceId = deckItems[0]?.id || null;
      if (!candidateMeta || !candidateDeckInstanceId) continue;
      deckId = candidateId;
      deckMeta = candidateMeta;
      deckInstanceId = candidateDeckInstanceId;
      break;
    }

    if (!deckInstanceId) {
      throw new Error(`Не нашёл неоткрытую колоду среди настроенных паков: ${deckCandidates.join(', ')}.`);
    }

    progressCb?.(`Открываю колоду #${deckInstanceId} из пака #${deckId}...`);
    const rawCards = await openInventoryDeck(deckInstanceId);
    const detailCards = await Promise.all(rawCards.map(card => getInventoryCardDetails(card.id)));
    const cards = rawCards.map((card, index) => {
      const detail = detailCards[index] || {};
      return {
        id: Number(card.id || 0),
        rank: String(card.rank || ''),
        rankLabel: formatDeckRank(card.rank),
        score: Number(card.score || 0),
        premiumSlot: index === 3,
        imageUrl: toAbsoluteMediaUrl(card.cover?.high || card.cover?.mid),
        label: buildDeckCardLabel(detail),
        subtitle: buildDeckCardSubtitle(detail),
        titleName: String(detail?.title?.main_name || ''),
        characterName: String(detail?.character?.name || ''),
        canChoose: index < 3 || Boolean(user?.is_premium)
      };
    });

    if (typeof smb.showDeckChoiceModal !== 'function') {
      throw new Error('Модалка выбора карт не инициализирована.');
    }

    progressCb?.('Колода открыта. Выбери карту в окне SailorM...');
    const chosenCard = await smb.showDeckChoiceModal({
      deckName: deckMeta?.name || 'Колода',
      premiumAvailable: Boolean(user?.is_premium),
      cards
    });

    progressCb?.(`Забираю карту: ${chosenCard.label}`);
    await chooseInventoryDeckCard(deckInstanceId, chosenCard.id);

    return {
      deckId,
      deckInstanceId,
      deckName: deckMeta?.name || 'Колода',
      chosenCard,
      cards
    };
  }

  function buildDeckCardLabel(card) {
    const characterName = String(card?.character?.name || '').trim();
    const titleName = String(card?.title?.main_name || '').trim();
    return characterName || titleName || `Карта #${card?.id || '?'}`;
  }

  function buildDeckCardSubtitle(card) {
    const characterName = String(card?.character?.name || '').trim();
    const titleName = String(card?.title?.main_name || '').trim();
    if (characterName && titleName) return titleName;
    return String(card?.title?.secondary_name || '').trim();
  }

  function shuffleArray(items) {
    const next = Array.isArray(items) ? [...items] : [];
    for (let index = next.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
    }
    return next;
  }

  function normalizeExchangeInventoryItem(item) {
    const inventoryItemId = Number(item?.id || 0);
    const card = item?.card || {};
    return {
      inventoryItemId,
      cardId: Number(card?.id || 0),
      rank: String(card?.rank || ''),
      score: Number(card?.score || 0),
      imageUrl: toAbsoluteMediaUrl(card?.cover?.high || card?.cover?.mid || ''),
      label: buildDeckCardLabel(card),
      subtitle: buildDeckCardSubtitle(card),
      raw: item
    };
  }

  async function detectOwnedExchangeCardIds(cardIds) {
    const uniqueCardIds = [...new Set((Array.isArray(cardIds) ? cardIds : []).map(Number).filter(id => id > 0))];
    if (!uniqueCardIds.length) return new Set();

    const query = uniqueCardIds.map(cardId => `card_id=${cardId}`).join('&');
    const payload = await smb.apiGet(`/api/v2/inventory/cards/has_cards/?${query}`).catch(() => []);
    const rawItems = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.results)
        ? payload.results
        : [];
    const ownedIds = rawItems.map(item => Number(item?.card_id || item?.id || item)).filter(id => id > 0);
    return new Set(ownedIds);
  }

  async function getExchangeTargetCandidates(currentUserId) {
    const seeds = [...new Set(EXCHANGE_SEED_USER_IDS.map(Number).filter(id => id > 0 && id !== currentUserId))];
    const discovered = [];
    const exchangeTargetHistory = await loadExchangeTargetHistory(currentUserId);
    const recentTargets = new Set(exchangeTargetHistory.slice(0, Math.max(4, seeds.length)));

    for (const seedUserId of seeds) {
      const payload = await listUserExchanges(seedUserId, 1).catch(() => null);
      const exchanges = Array.isArray(payload?.results) ? payload.results : [];
      for (const exchange of exchanges) {
        const creatorId = Number(exchange?.creator?.id || 0);
        const partnerId = Number(exchange?.partner?.id || 0);
        if (creatorId > 0 && creatorId !== currentUserId) discovered.push(creatorId);
        if (partnerId > 0 && partnerId !== currentUserId) discovered.push(partnerId);
      }
    }

    const uniqueCandidates = [...new Set([...seeds, ...discovered].filter(id => id > 0 && id !== currentUserId))];
    const freshCandidates = [];
    const repeatedCandidates = [];

    for (const userId of shuffleArray(uniqueCandidates)) {
      if (recentTargets.has(userId)) repeatedCandidates.push(userId);
      else freshCandidates.push(userId);
    }

    return [...freshCandidates, ...repeatedCandidates];
  }

  async function buildExchangePlan(task) {
    const remaining = Math.max(0, Number(task?.goal || 0) - Number(task?.progress || 0));
    const currentUser = await fetchCurrentUser();
    const currentUserId = Number(currentUser?.id || 0);
    if (!currentUserId) throw new Error('Не удалось определить текущего пользователя для обмена.');

    const targetUserIds = await getExchangeTargetCandidates(currentUserId);
    if (!targetUserIds.length) {
      throw new Error('Не удалось собрать список пользователей для случайного обмена.');
    }

    const ownCardsPayload = await listExchangeableCards(currentUserId, 1, 20).catch(() => null);
    const ownCards = (Array.isArray(ownCardsPayload?.results) ? ownCardsPayload.results : [])
      .map(normalizeExchangeInventoryItem)
      .filter(item => item.inventoryItemId > 0 && item.cardId > 0);

    const sortedOwnCards = [...ownCards].sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score;
      return left.inventoryItemId - right.inventoryItemId;
    });

    for (const targetUserId of targetUserIds) {
      const partnerCardsPayload = await listExchangeableCards(targetUserId, 1, 20).catch(() => null);
      const partnerCards = (Array.isArray(partnerCardsPayload?.results) ? partnerCardsPayload.results : [])
        .map(normalizeExchangeInventoryItem)
        .filter(item => item.inventoryItemId > 0 && item.cardId > 0);

      const ownedPartnerCardIds = await detectOwnedExchangeCardIds(partnerCards.map(item => item.cardId));
      const preferredPartnerCard = partnerCards.find(item => item.cardId && !ownedPartnerCardIds.has(item.cardId)) || partnerCards[0];
      const creatorCard = sortedOwnCards[0];
      if (!creatorCard && !preferredPartnerCard) continue;

      return {
        remaining,
        currentUserId,
        targetUserId,
        creatorCard: creatorCard || null,
        partnerCard: preferredPartnerCard || null
      };
    }

    throw new Error('Не удалось подобрать обмен, в котором есть хотя бы одна доступная карточка.');
  }

  async function cancelExchangeOffer(currentUserId, targetUserId, exchangeId) {
    const candidateUserIds = [...new Set([targetUserId, currentUserId].map(Number).filter(id => id > 0))];
    const statusCandidates = ['canceled', 'cancelled'];
    let lastError = null;

    for (const userId of candidateUserIds) {
      const currentDetail = await getExchangeDetail(userId, exchangeId).catch(() => null);
      const currentStatus = String(currentDetail?.status || '').toLowerCase();
      if (currentStatus === 'canceled') return currentDetail;
      if (!currentDetail && userId !== currentUserId) continue;

      for (const status of statusCandidates) {
        try {
          const patched = await patchExchangeOffer(userId, exchangeId, { status });
          const nextStatus = String(patched?.status || '').toLowerCase();
          if (nextStatus === 'canceled') return patched;

          const refreshed = await getExchangeDetail(userId, exchangeId).catch(() => null);
          if (String(refreshed?.status || '').toLowerCase() === 'canceled') return refreshed;
          lastError = new Error('Сайт не подтвердил отмену обмена.');
        } catch (error) {
          lastError = error;
        }
      }
    }

    throw lastError || new Error('Не удалось отменить отправленный обмен.');
  }

  async function findRecentExchangeOffer(currentUserId, targetUserId, creatorCardIds = [], partnerCardIds = []) {
    const creatorSet = new Set((Array.isArray(creatorCardIds) ? creatorCardIds : []).map(Number).filter(id => id > 0));
    const partnerSet = new Set((Array.isArray(partnerCardIds) ? partnerCardIds : []).map(Number).filter(id => id > 0));
    const payload = await listUserExchanges(currentUserId, 1).catch(() => null);
    const exchanges = Array.isArray(payload?.results) ? payload.results : [];

    const matchesCards = (items, expectedSet) => {
      if (!expectedSet.size) return !Array.isArray(items?.cards) || items.cards.length === 0;
      const actualIds = Array.isArray(items?.cards) ? items.cards.map(item => Number(item?.id || item)).filter(id => id > 0) : [];
      if (actualIds.length !== expectedSet.size) return false;
      return actualIds.every(id => expectedSet.has(id));
    };

    return exchanges.find(exchange => {
      const creatorId = Number(exchange?.creator?.id || 0);
      const partnerId = Number(exchange?.partner?.id || 0);
      if (creatorId !== currentUserId || partnerId !== targetUserId) return false;
      return matchesCards(exchange?.items_creator, creatorSet) && matchesCards(exchange?.items_partner, partnerSet);
    }) || null;
  }

  async function findLatestPendingExchangeOffer(currentUserId, targetUserId) {
    const payload = await listUserExchanges(currentUserId, 1).catch(() => null);
    const exchanges = Array.isArray(payload?.results) ? payload.results : [];
    return exchanges.find(exchange => {
      const creatorId = Number(exchange?.creator?.id || 0);
      const partnerId = Number(exchange?.partner?.id || 0);
      const status = String(exchange?.status || '').toLowerCase();
      return creatorId === currentUserId && partnerId === targetUserId && status === 'wait';
    }) || null;
  }

  async function runExchangeTask(task, progressCb) {
    if (!isExchangeTask(task)) {
      throw new Error('Эта задача не относится к обменам карточками.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    const currentProgress = Number(beforeTask.progress || 0);
    const goal = Number(beforeTask.goal || 0);

    if (currentProgress >= goal) {
      return {
        before: beforeTask,
        after: beforeTask,
        claimed: false
      };
    }

    progressCb?.('Подбираю случайного пользователя для обмена...');
    const plan = await buildExchangePlan(beforeTask);
    let exchangeId = 0;
    let canceledExchange = null;
    let mainError = null;

    try {
      progressCb?.(`Отправляю обмен пользователю #${plan.targetUserId}...`);
      const creatorCards = plan.creatorCard?.inventoryItemId ? [plan.creatorCard.inventoryItemId] : [];
      const partnerCards = plan.partnerCard?.inventoryItemId ? [plan.partnerCard.inventoryItemId] : [];
      if (!creatorCards.length && !partnerCards.length) {
        throw new Error('Нельзя отправить обмен без единой карточки.');
      }

      const createdExchange = await createExchangeOffer(plan.currentUserId, {
        creator: plan.currentUserId,
        partner: plan.targetUserId,
        items_creator: { cards: creatorCards },
        items_partner: { cards: partnerCards },
        message_creator: ''
      });
      exchangeId = Number(createdExchange?.id || createdExchange?.content?.id || createdExchange?.result?.id || 0);
      if (!exchangeId) {
        const recentExchange = await findRecentExchangeOffer(
          plan.currentUserId,
          plan.targetUserId,
          plan.creatorCard?.cardId ? [plan.creatorCard.cardId] : [],
          plan.partnerCard?.cardId ? [plan.partnerCard.cardId] : []
        );
        exchangeId = Number(recentExchange?.id || 0);
      }
      if (!exchangeId) {
        progressCb?.('Сайт не вернул id обмена сразу, проверю историю после засчёта.');
      }

      progressCb?.('Обмен отправлен. Жду засчёт battlepass...');
      let finalTask = await waitForTaskUpdate(
        beforeTask.id,
        nextTask => Number(nextTask.progress || 0) > currentProgress || smb.isTaskReady(nextTask),
        {
          attempts: 14,
          delayMs: 500,
          initialTask: beforeTask
        }
      );

      if (Number(finalTask?.progress || 0) <= currentProgress) {
        throw new Error('Сайт не засчитал отправку обмена в battlepass.');
      }

      await rememberExchangeTarget(plan.currentUserId, plan.targetUserId);

      if (!exchangeId) {
        const pendingExchange = await findLatestPendingExchangeOffer(plan.currentUserId, plan.targetUserId);
        exchangeId = Number(pendingExchange?.id || 0);
      }

      if (exchangeId > 0) {
        progressCb?.(`Засчёт подтверждён. Отменяю обмен #${exchangeId}...`);
        canceledExchange = await cancelExchangeOffer(plan.currentUserId, plan.targetUserId, exchangeId);
      } else {
        progressCb?.('Засчёт подтверждён, но id обмена сайт не вернул.');
      }

      let claimed = false;
      if (smb.isTaskReady(finalTask)) {
        progressCb?.(`Забираю награду: ${finalTask.name}`);
        await smb.claimTask(finalTask.id);
        claimed = true;
        const claimedState = await loadState();
        finalTask = claimedState.tasks.find(item => item.id === beforeTask.id) || finalTask;
      }

      return {
        before: beforeTask,
        after: finalTask,
        claimed,
        exchangeId,
        targetUserId: plan.targetUserId,
        creatorCard: plan.creatorCard,
        partnerCard: plan.partnerCard,
        canceledExchange
      };
    } catch (error) {
      mainError = error;
      throw error;
    } finally {
      if (exchangeId > 0 && !canceledExchange) {
        try {
          progressCb?.(`Пробую убрать незавершённый обмен #${exchangeId}...`);
          canceledExchange = await cancelExchangeOffer(plan.currentUserId, plan.targetUserId, exchangeId);
        } catch (cancelError) {
          if (!mainError) {
            throw cancelError;
          }
          progressCb?.(`Не удалось отменить обмен #${exchangeId}: ${cancelError?.message || cancelError}`);
        }
      }
    }
  }

  async function runNewCardsTask(task, progressCb) {
    if (!isDeckCardTask(task)) {
      throw new Error('Эта задача не относится к открытию новых карточек.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    const currentProgress = Number(beforeTask.progress || 0);
    const goal = Number(beforeTask.goal || 0);

    if (currentProgress >= goal) {
      return {
        before: beforeTask,
        after: beforeTask,
        claimed: false
      };
    }

    progressCb?.('Подготавливаю колоду с новыми карточками...');

    const deckCandidates = await getDeckIdCandidatesForTask(beforeTask);
    const deckResult = await openConfiguredDeck(deckCandidates, progressCb);

    let finalTask = await waitForTaskUpdate(
      beforeTask.id,
      nextTask => Number(nextTask.progress || 0) > currentProgress || smb.isTaskReady(nextTask),
      {
        attempts: 12,
        delayMs: 350,
        initialTask: beforeTask
      }
    );

    if (Number(finalTask?.progress || 0) <= currentProgress) {
      throw new Error('Сайт не засчитал открытие новой карточки после выбора.');
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Забираю награду: ${finalTask.name}`);
      await smb.claimTask(finalTask.id);
      claimed = true;
      const claimedState = await loadState();
      finalTask = claimedState.tasks.find(item => item.id === beforeTask.id) || finalTask;
    }

    return {
      before: beforeTask,
      after: finalTask,
      claimed,
      deckId: deckResult.deckId,
      deckInstanceId: deckResult.deckInstanceId,
      chosenCard: deckResult.chosenCard
    };
  }

  async function runCardUpgradeTask(task, progressCb) {
    if (!isCardUpgradeTask(task)) {
      throw new Error('Эта задача не относится к апгрейду карточек.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    const currentProgress = Number(beforeTask.progress || 0);
    const goal = Number(beforeTask.goal || 0);

    if (currentProgress >= goal) {
      return {
        before: beforeTask,
        after: beforeTask,
        claimed: false
      };
    }

    const user = await getCurrentUserProfile();
    const currentUserId = Number(user?.id || 0);
    if (!currentUserId) {
      throw new Error('Не удалось определить текущий аккаунт для апгрейда карт.');
    }

    progressCb?.('Загружаю карты для апгрейда...');
    const rawItems = await listCardUpgradeInventory(currentUserId, progressCb);
    const plan = buildCardUpgradePlan(rawItems);

    if (!plan.commonCandidates.length && !plan.exclusiveCandidates.some(item => !item.disabled) && !plan.randomCandidates.some(item => !item.disabled)) {
      throw new Error('Не нашёл подходящие карты для апгрейда. Нужно 2 карты одного тайтла и ранга или 3 карты одного ранга из разных произведений.');
    }

    if (typeof smb.showCardUpgradeModal !== 'function') {
      throw new Error('Окно выбора апгрейда карт не инициализировано.');
    }

    progressCb?.('Открыл окно выбора апгрейда карт.');
    const selected = await smb.showCardUpgradeModal(plan);
    if (!selected?.cardIds?.length || !selected?.mergeType) {
      throw new Error('Не выбран вариант апгрейда карт.');
    }

    progressCb?.(`Запускаю ${selected.typeLabel || 'апгрейд'}: ${selected.label}`);
    const upgradePayload = await submitCardUpgrade(currentUserId, selected);
    const resultCard = normalizeUpgradeResultCard(upgradePayload);
    progressCb?.(`Получена карта: ${resultCard.label}${resultCard.rankLabel ? ` · ${resultCard.rankLabel}` : ''}`);

    if (typeof smb.showCardUpgradeResultModal === 'function') {
      await smb.showCardUpgradeResultModal({
        selected,
        resultCard
      }).catch(() => null);
    }

    let finalTask = await waitForTaskUpdate(
      beforeTask.id,
      nextTask => Number(nextTask.progress || 0) > currentProgress || smb.isTaskReady(nextTask),
      {
        attempts: 12,
        delayMs: 350,
        initialTask: beforeTask
      }
    );

    if (Number(finalTask?.progress || 0) <= currentProgress) {
      throw new Error('Сайт не засчитал апгрейд карточек после выполнения.');
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Забираю награду: ${finalTask.name}`);
      await smb.claimTask(finalTask.id);
      claimed = true;
      const claimedState = await loadState();
      finalTask = claimedState.tasks.find(item => item.id === beforeTask.id) || finalTask;
    }

    return {
      before: beforeTask,
      after: finalTask,
      claimed,
      selected,
      resultCard
    };
  }

  async function runSearchTask(task, progressCb) {
    assertTaskAutomatable(task);

    if (!isAutoSearchTask(task)) {
      throw new Error('Эта задача не относится к жанрам или категориям.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    let currentProgress = Number(beforeTask.progress || 0);
    const goal = Number(beforeTask.goal || 0);

    if (currentProgress >= goal) {
      return {
        visited: 0,
        before: beforeTask,
        after: beforeTask,
        titles: []
      };
    }

    progressCb?.('Подбираю тайтлы через каталог /manga...');
    const plan = await buildSearchTaskPlan(beforeTask);

    if (!plan.selectedTitles.length) {
      throw new Error('Не удалось найти подходящие главы для этой задачи.');
    }

    const remaining = Math.max(0, goal - currentProgress);
    const candidateCount = Math.min(
      plan.selectedTitles.length,
      Math.max(remaining + 2, remaining * 2, 4)
    );
    const selectedTitles = plan.selectedTitles.slice(0, candidateCount || plan.selectedTitles.length);
    const batchResult = await executeTaskBatches(selectedTitles, {
      taskId: beforeTask.id,
      initialTask: beforeTask,
      initialProgress: currentProgress,
      goal,
      batchSize: 1,
      delayBetweenBatches: 650,
      attempts: 10,
      delayMs: 450,
      progressCb,
      batchStartMessage: (currentBatch, totalBatches) => `Открываю главы пакетами: ${currentBatch}/${totalBatches}`,
      maxNoProgressItems: 3,
      runItem: async title => {
        progressCb?.(`Отмечаю главу: ${getReadableTitleName(title)}`);
        await submitChapterView(title.chapterId);
        await rememberViewedChapter(title.chapterId, 'reading');
        await rememberVisitedTitle(beforeTask.id, title.dir);
        return title;
      },
      onNoProgress: title => `Без прироста: ${getReadableTitleName(title)}`
    });

    const openedTitles = batchResult.processedItems;
    let finalTask = batchResult.finalTask || beforeTask;
    currentProgress = batchResult.currentProgress;

    for (const failure of batchResult.failures || []) {
      if (!failure?.item?.dir) continue;
      await rememberFailedSearchTitle(beforeTask.id, failure.item.dir);
      await rememberBlacklistedTitle(failure.item.dir, 'search_failure', `search:${getSearchField(beforeTask)}`);
    }

    for (const title of batchResult.noProgressItems || []) {
      if (!title?.dir) continue;
      await rememberFailedSearchTitle(beforeTask.id, title.dir);
      await rememberBlacklistedTitle(title.dir, 'no_progress', `search:${getSearchField(beforeTask)}`);
    }

    if (Number(finalTask?.progress || 0) <= Number(beforeTask.progress || 0)) {
      throw new Error('Сайт принял чтение найденных глав, но battlepass не увеличил прогресс задачи.');
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Забираю награду: ${finalTask.name}`);
      await smb.claimTask(finalTask.id);
      claimed = true;
      const refreshed = await loadState();
      finalTask = refreshed.tasks.find(item => item.id === beforeTask.id) || finalTask;
    }

    return {
      visited: openedTitles.length,
      before: beforeTask,
      after: finalTask,
      tagNames: plan.tagNames,
      resolvedTags: plan.resolvedTags,
      titles: openedTitles,
      claimed
    };
  }

  async function runWorldTravelTask(task, progressCb) {
    assertTaskAutomatable(task);

    if (!isWorldTravelTask(task)) {
      throw new Error('Эта задача не относится к путешествию по мирам.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    let currentProgress = Number(beforeTask.progress || 0);
    const goal = Number(beforeTask.goal || 0);

    if (currentProgress >= goal) {
      return {
        visited: 0,
        before: beforeTask,
        after: beforeTask,
        titles: []
      };
    }

    const openedTitles = [];
    let finalTask = beforeTask;
    let hadAnyCandidates = false;

    for (let round = 1; round <= 3 && currentProgress < goal; round += 1) {
      const progressBeforeRound = currentProgress;
      progressCb?.(round === 1
        ? 'Подбираю новые тайтлы через каталог /manga...'
        : `Добираю оставшиеся новые тайтлы: раунд ${round}/3...`);

      const plan = await buildWorldTravelPlan(finalTask);
      if (!plan.selectedTitles.length) {
        if (!hadAnyCandidates) {
          throw new Error('Не удалось найти новые тайтлы с бесплатными главами.');
        }
        break;
      }

      hadAnyCandidates = true;
      const remaining = Math.max(0, goal - currentProgress);
      const candidateCount = Math.min(
        plan.selectedTitles.length,
        Math.max(remaining + 2, remaining * 2, 4)
      );
      const selectedTitles = plan.selectedTitles.slice(0, candidateCount || plan.selectedTitles.length);
      const batchResult = await executeTaskBatches(selectedTitles, {
        taskId: beforeTask.id,
        initialTask: finalTask,
        initialProgress: currentProgress,
        goal,
        batchSize: 1,
        delayBetweenBatches: 950,
        attempts: 12,
        delayMs: 550,
        progressCb,
        batchStartMessage: (currentBatch, totalBatches) => `Открываю новые тайтлы по одному: ${currentBatch}/${totalBatches}`,
        maxNoProgressItems: 3,
        runItem: async title => {
          progressCb?.(`Отмечаю новый тайтл: ${getReadableTitleName(title)}`);
          await submitChapterView(title.chapterId);
          await rememberVisitedTitle(beforeTask.id, title.dir);
          await rememberViewedChapter(title.chapterId, 'reading');
          return title;
        },
        onNoProgress: title => `Без прироста: ${getReadableTitleName(title)}`
      });

      openedTitles.push(...batchResult.processedItems);
      finalTask = batchResult.finalTask || finalTask;
      currentProgress = batchResult.currentProgress;

      for (const failure of batchResult.failures || []) {
        if (!failure?.item?.dir) continue;
        await rememberFailedSearchTitle(beforeTask.id, failure.item.dir);
        await rememberBlacklistedTitle(failure.item.dir, 'world_failure', 'reading');
      }

      for (const title of batchResult.noProgressItems || []) {
        if (!title?.dir) continue;
        await rememberFailedSearchTitle(beforeTask.id, title.dir);
        await rememberBlacklistedTitle(title.dir, 'no_progress', 'reading');
      }

      if (currentProgress <= progressBeforeRound) {
        throw new Error('Сайт принял чтение новых тайтлов, но battlepass не увеличил прогресс задачи.');
      }
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Забираю награду: ${finalTask.name}`);
      await smb.claimTask(finalTask.id);
      claimed = true;
      const refreshed = await loadState();
      finalTask = refreshed.tasks.find(item => item.id === beforeTask.id) || finalTask;
    }

    return {
      visited: openedTitles.length,
      before: beforeTask,
      after: finalTask,
      titles: openedTitles,
      claimed
    };
  }

  async function runFastChapterReadChunks(chapters, options) {
    const {
      taskId,
      initialTask,
      initialProgress,
      goal,
      progressCb
    } = options;

    let currentProgress = Number(initialProgress || 0);
    let finalTask = initialTask || null;
    const processedItems = [];
    const failures = [];
    const noProgressItems = [];
    const chunks = [];
    let noProgressStreak = 0;

    for (let index = 0; index < chapters.length; index += READING_FAST_CHUNK_SIZE) {
      chunks.push(chapters.slice(index, index + READING_FAST_CHUNK_SIZE));
    }

    for (let chunkIndex = 0; chunkIndex < chunks.length && currentProgress < goal; chunkIndex += 1) {
      const chunk = chunks[chunkIndex];
      const progressBeforeChunk = currentProgress;
      progressCb?.(`Читаю главы быстрыми сериями: ${chunkIndex + 1}/${chunks.length}`);

      for (const chapter of chunk) {
        try {
          progressCb?.(`Отмечаю главу: ${getReadableChapterLabel(chapter)}`);
          await submitChapterView(chapter.chapterId);
          await rememberViewedChapter(chapter.chapterId, 'reading');
          processedItems.push(chapter);
        } catch (error) {
          failures.push({ item: chapter, error });
        }

        if (chapter !== chunk[chunk.length - 1]) {
          await smb.sleep(READING_FAST_ITEM_DELAY_MS);
        }
      }

      const expectedProgress = Math.min(goal, progressBeforeChunk + chunk.length);
      finalTask = await waitForTaskUpdate(
        taskId,
        nextTask => Number(nextTask.progress || 0) >= expectedProgress || smb.isTaskReady(nextTask),
        {
          attempts: READING_FAST_SETTLE_ATTEMPTS,
          delayMs: READING_FAST_SETTLE_DELAY_MS,
          initialTask: finalTask
        }
      );

      if (Number(finalTask?.progress || 0) > currentProgress) {
        currentProgress = Number(finalTask.progress || 0);
        noProgressStreak = 0;
        progressCb?.(`Прогресс вырос: ${currentProgress} / ${goal}`);
      } else {
        noProgressItems.push(...chunk);
        noProgressStreak += 1;
        progressCb?.('Быстрая серия выполнена без прироста прогресса.');
      }

      if (Number(finalTask?.progress || 0) >= goal || smb.isTaskReady(finalTask)) {
        break;
      }

      if (noProgressStreak >= 2) {
        progressCb?.('Останавливаю чтение: сайт принял действия, но battlepass не увеличил прогресс.');
        break;
      }
    }

    return { processedItems, failures, noProgressItems, finalTask, currentProgress };
  }

  async function runFastChapterLikeChunks(chapters, options) {
    const {
      taskId,
      initialTask,
      initialProgress,
      goal,
      progressCb
    } = options;

    let currentProgress = Number(initialProgress || 0);
    let finalTask = initialTask || null;
    const processedItems = [];
    const failures = [];
    const noProgressItems = [];
    const chunks = [];
    let noProgressStreak = 0;

    for (let index = 0; index < chapters.length; index += LIKE_FAST_CHUNK_SIZE) {
      chunks.push(chapters.slice(index, index + LIKE_FAST_CHUNK_SIZE));
    }

    for (let chunkIndex = 0; chunkIndex < chunks.length && currentProgress < goal; chunkIndex += 1) {
      const chunk = chunks[chunkIndex];
      const progressBeforeChunk = currentProgress;
      progressCb?.(`Ставлю лайки быстрыми сериями: ${chunkIndex + 1}/${chunks.length}`);

      for (const chapter of chunk) {
        try {
          progressCb?.(`Ставлю лайк: ${getReadableChapterLabel(chapter)}`);
          await submitChapterLike(chapter.chapterId);
          processedItems.push(chapter);
        } catch (error) {
          failures.push({ item: chapter, error });
        }

        if (chapter !== chunk[chunk.length - 1]) {
          await smb.sleep(LIKE_FAST_ITEM_DELAY_MS);
        }
      }

      const expectedProgress = Math.min(goal, progressBeforeChunk + chunk.length);
      finalTask = await waitForTaskUpdate(
        taskId,
        nextTask => Number(nextTask.progress || 0) >= expectedProgress || smb.isTaskReady(nextTask),
        {
          attempts: LIKE_FAST_SETTLE_ATTEMPTS,
          delayMs: LIKE_FAST_SETTLE_DELAY_MS,
          initialTask: finalTask
        }
      );

      if (Number(finalTask?.progress || 0) > currentProgress) {
        currentProgress = Number(finalTask.progress || 0);
        noProgressStreak = 0;
        progressCb?.(`Прогресс вырос: ${currentProgress} / ${goal}`);
      } else {
        noProgressItems.push(...chunk);
        noProgressStreak += 1;
        progressCb?.('Быстрая серия лайков выполнена без прироста прогресса.');
      }

      if (Number(finalTask?.progress || 0) >= goal || smb.isTaskReady(finalTask)) {
        break;
      }

      if (noProgressStreak >= 2) {
        progressCb?.('Останавливаю лайки: сайт принял действия, но battlepass не увеличил прогресс.');
        break;
      }
    }

    return { processedItems, failures, noProgressItems, finalTask, currentProgress };
  }

  async function runChapterReadTask(task, progressCb) {
    assertTaskAutomatable(task);

    if (!isChapterReadTask(task)) {
      throw new Error('Эта задача не относится к чтению глав.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    let currentProgress = Number(beforeTask.progress || 0);
    const goal = Number(beforeTask.goal || 0);

    if (currentProgress >= goal) {
      return {
        visited: 0,
        before: beforeTask,
        after: beforeTask,
        chapters: []
      };
    }

    let finalTask = beforeTask;
    const visitedChapters = [];
    let hadAnyCandidates = false;

    for (let round = 1; round <= 4 && currentProgress < goal; round += 1) {
      const progressBeforeRound = currentProgress;
      progressCb?.(round === 1
        ? 'Подбираю новые главы через API...'
        : `Добираю оставшийся прогресс по главам: раунд ${round}/4...`);

      const plan = await buildReadingPlan(finalTask);
      if (!plan.selectedChapters.length) {
        if (!hadAnyCandidates) {
          throw new Error('Не удалось найти новые бесплатные главы.');
        }
        break;
      }

      hadAnyCandidates = true;
      const batchResult = await runFastChapterReadChunks(plan.selectedChapters, {
        taskId: beforeTask.id,
        initialTask: finalTask,
        initialProgress: currentProgress,
        goal,
        progressCb
      });

      visitedChapters.push(...batchResult.processedItems);
      finalTask = batchResult.finalTask || finalTask;
      const progressBeforeWait = currentProgress;
      currentProgress = batchResult.currentProgress;

      if (Number(finalTask?.progress || 0) < goal && Number(finalTask?.progress || 0) > progressBeforeWait) {
        finalTask = await waitForTaskUpdate(
          beforeTask.id,
          nextTask => Number(nextTask.progress || 0) > currentProgress || smb.isTaskReady(nextTask),
          {
            attempts: 8,
            delayMs: 700,
            initialTask: finalTask
          }
        ) || finalTask;
        currentProgress = Number(finalTask?.progress || 0);
      }

      if (currentProgress >= goal || smb.isTaskReady(finalTask)) {
        break;
      }

      if (!batchResult.processedItems.length && !batchResult.noProgressItems.length) {
        break;
      }

      for (const failure of batchResult.failures || []) {
        if (failure?.item?.dir) await rememberBlacklistedTitle(failure.item.dir, 'reading_failure', 'reading');
      }
      for (const chapter of batchResult.noProgressItems || []) {
        if (chapter?.dir) await rememberBlacklistedTitle(chapter.dir, 'no_progress', 'reading');
      }

      if (currentProgress <= progressBeforeRound) {
        throw new Error('Сайт принял чтение глав, но battlepass не увеличил прогресс задачи.');
      }
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Забираю награду: ${finalTask.name}`);
      await smb.claimTask(finalTask.id);
      claimed = true;
      const refreshed = await loadState();
      finalTask = refreshed.tasks.find(item => item.id === beforeTask.id) || finalTask;
    }

    return {
      visited: visitedChapters.length,
      before: beforeTask,
      after: finalTask,
      chapters: visitedChapters,
      claimed
    };
  }

  async function runLikeTask(task, progressCb) {
    assertTaskAutomatable(task);

    if (!isLikeTask(task)) {
      throw new Error('Эта задача не относится к лайкам.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    const beforeLikeFamily = collectTaskFamily(before.tasks, isLikeTask);
    let currentProgress = Number(beforeTask.progress || 0);
    const goal = Number(beforeTask.goal || 0);

    if (currentProgress >= goal) {
      return {
        visited: 0,
        before: beforeTask,
        after: beforeTask,
        chapters: []
      };
    }

    progressCb?.('Подбираю нелайкнутые главы через API...');
    const plan = await buildLikePlan(beforeTask);

    if (!plan.selectedChapters.length) {
      throw new Error('Не удалось найти доступные нелайкнутые главы.');
    }

    const batchResult = await runFastChapterLikeChunks(plan.selectedChapters, {
      taskId: beforeTask.id,
      initialTask: beforeTask,
      initialProgress: currentProgress,
      goal,
      progressCb
    });

    const likedChapters = batchResult.processedItems;
    let finalTask = batchResult.finalTask || beforeTask;
    currentProgress = batchResult.currentProgress;

    for (const failure of batchResult.failures || []) {
      if (failure?.item?.dir) await rememberBlacklistedTitle(failure.item.dir, 'like_failure', 'like');
    }
    for (const chapter of batchResult.noProgressItems || []) {
      if (chapter?.dir) await rememberBlacklistedTitle(chapter.dir, 'no_progress', 'like');
    }

    if (Number(finalTask?.progress || 0) < goal && Number(finalTask?.progress || 0) > Number(beforeTask.progress || 0)) {
      finalTask = await waitForTaskUpdate(
        beforeTask.id,
        nextTask => Number(nextTask.progress || 0) > currentProgress || smb.isTaskReady(nextTask),
        {
          attempts: 8,
          delayMs: 700,
          initialTask: finalTask
        }
      ) || finalTask;
      currentProgress = Number(finalTask?.progress || 0);
    }

    if (Number(finalTask?.progress || 0) <= Number(beforeTask.progress || 0)) {
      throw new Error('Сайт принял лайки глав, но battlepass не увеличил прогресс задачи.');
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Забираю награду: ${finalTask.name}`);
      await smb.claimTask(finalTask.id);
      claimed = true;
      const refreshed = await loadState();
      finalTask = refreshed.tasks.find(item => item.id === beforeTask.id) || finalTask;
    }

    const afterState = await loadState();
    const afterLikeFamily = describeFamilyProgress(
      beforeLikeFamily,
      collectTaskFamily(afterState.tasks, isLikeTask),
      beforeTask.id
    );
    finalTask = afterState.tasks.find(item => item.id === beforeTask.id) || finalTask;

    return {
      visited: likedChapters.length,
      before: beforeTask,
      after: finalTask,
      chapters: likedChapters,
      claimed,
      relatedTasks: afterLikeFamily
    };
  }

  async function runExpertRatingTask(task, progressCb) {
    assertTaskAutomatable(task);

    if (!isExpertRatingTask(task)) {
      throw new Error('\u042d\u0442\u0430 \u0437\u0430\u0434\u0430\u0447\u0430 \u043d\u0435 \u043e\u0442\u043d\u043e\u0441\u0438\u0442\u0441\u044f \u043a \u043e\u0446\u0435\u043d\u043a\u0435 \u0442\u0430\u0439\u0442\u043b\u043e\u0432.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    const currentProgress = Number(beforeTask.progress || 0);
    const goal = Number(beforeTask.goal || 0);

    if (currentProgress >= goal) {
      return {
        before: beforeTask,
        after: beforeTask,
        title: null,
        chapters: [],
        claimed: false
      };
    }

    progressCb?.('\u041f\u043e\u0434\u0431\u0438\u0440\u0430\u044e \u0442\u0430\u0439\u0442\u043b \u0434\u043b\u044f \u043e\u0446\u0435\u043d\u043a\u0438...');
    const plan = await buildExpertRatingPlan(beforeTask);
    if (!plan.selectedTitle || plan.selectedChapters.length < 5) {
      throw new Error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043d\u0430\u0439\u0442\u0438 \u0442\u0430\u0439\u0442\u043b \u0441 5 \u0431\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u044b\u043c\u0438 \u0433\u043b\u0430\u0432\u0430\u043c\u0438 \u0434\u043b\u044f \u043e\u0446\u0435\u043d\u043a\u0438.');
    }

    const viewedChapters = [];
    for (const chapter of plan.selectedChapters) {
      const chapterId = chapter.chapterId || chapter.id;
      progressCb?.(`\u0427\u0438\u0442\u0430\u044e \u0433\u043b\u0430\u0432\u0443 \u043f\u0435\u0440\u0435\u0434 \u043e\u0446\u0435\u043d\u043a\u043e\u0439: ${plan.selectedTitle.rus_name} #${chapterId}`);
      await submitChapterView(chapterId);
      await rememberViewedChapter(chapterId, 'reading');
      viewedChapters.push(chapter);
      await smb.sleep(350);
    }

    progressCb?.(`\u0421\u0442\u0430\u0432\u043b\u044e \u043e\u0446\u0435\u043d\u043a\u0443 10/10: ${plan.selectedTitle.rus_name}`);
    await submitTitleRating(plan.selectedTitle.id, 10);
    let finalTask = await waitForTaskUpdate(
      beforeTask.id,
      nextTask => Number(nextTask.progress || 0) > currentProgress,
      {
        attempts: 8,
        delayMs: 180,
        initialTask: beforeTask
      }
    );
    let claimed = false;

    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`\u0417\u0430\u0431\u0438\u0440\u0430\u044e \u043d\u0430\u0433\u0440\u0430\u0434\u0443: ${finalTask.name}`);
      await smb.claimTask(finalTask.id);
      claimed = true;
      const claimedState = await loadState();
      finalTask = claimedState.tasks.find(item => item.id === beforeTask.id) || finalTask;
    }

    if (Number(finalTask.progress || 0) <= currentProgress) {
      throw new Error('\u0421\u0430\u0439\u0442 \u043d\u0435 \u0437\u0430\u0441\u0447\u0438\u0442\u0430\u043b \u043e\u0446\u0435\u043d\u043a\u0443 \u0442\u0430\u0439\u0442\u043b\u0430.');
    }

    return {
      before: beforeTask,
      after: finalTask,
      title: plan.selectedTitle,
      chapters: viewedChapters,
      claimed
    };
  }

  async function runDirectGameTask(task, progressCb) {
    assertTaskAutomatable(task);

    if (!isDirectGameTask(task)) {
      throw new Error('Эта задача не поддерживает прямое выполнение через API.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    const gameKey = smb.gameFromTask(beforeTask);

    if (!gameKey) {
      throw new Error('Не удалось определить мини-игру для этой задачи.');
    }

    if (Number(beforeTask.progress || 0) >= Number(beforeTask.goal || 0)) {
      return {
        before: beforeTask,
        after: beforeTask,
        claimed: false
      };
    }

    progressCb?.(`Отправляю прогресс ${beforeTask.name} через API...`);
    await smb.manageMinigame(smb.GAME_IDS[gameKey]);
    let finalTask = await waitForTaskUpdate(
      beforeTask.id,
      nextTask => Number(nextTask.progress || 0) > Number(beforeTask.progress || 0) || smb.isTaskReady(nextTask),
      {
        attempts: 7,
        delayMs: 160,
        initialTask: beforeTask
      }
    );
    let claimed = false;

    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Забираю награду: ${finalTask.name}`);
      await smb.claimTask(finalTask.id);
      claimed = true;
      const claimedState = await loadState();
      finalTask = claimedState.tasks.find(item => item.id === beforeTask.id) || finalTask;
    }

    return {
      before: beforeTask,
      after: finalTask,
      claimed
    };
  }

  async function runCommentTask(task, progressCb) {
    assertTaskAutomatable(task);

    if (!isCommentTask(task)) {
      throw new Error('Эта задача не относится к комментариям.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    const goal = Number(beforeTask.goal || 0);
    const currentProgress = Number(beforeTask.progress || 0);

    if (currentProgress >= goal) {
      return {
        before: beforeTask,
        after: beforeTask,
        commentId: null,
        deleted: false,
        claimed: false
      };
    }

    const { commentText } = await getAutomationCopySettings();
    progressCb?.('Публикую комментарий...');
    let created;
    try {
      created = await submitComment(commentText);
    } catch (error) {
      if (isCommentingUnavailableError(error)) {
        throw new Error('Для этого аккаунта комментарии сейчас недоступны.');
      }
      throw error;
    }
    const commentId = Number(created?.content?.id || 0) || null;
    if (!commentId) {
      throw new Error('Сайт не вернул id комментария.');
    }

    await rememberCommentId(commentId);

    let finalTask = beforeTask;
    let deleted = false;
    let claimed = false;

    try {
      await smb.sleep(900);
      const refreshed = await loadState();
      finalTask = refreshed.tasks.find(item => item.id === beforeTask.id) || finalTask;

      if (smb.isTaskReady(finalTask)) {
        progressCb?.(`Забираю награду: ${finalTask.name}`);
        await smb.claimTask(finalTask.id);
        claimed = true;
        const claimedState = await loadState();
        finalTask = claimedState.tasks.find(item => item.id === beforeTask.id) || finalTask;
      }
    } finally {
      progressCb?.('Удаляю комментарий...');
      try {
        await deleteComment(commentId);
        deleted = true;
      } catch (_error) {
        deleted = false;
      }
    }

    if (Number(finalTask.progress || 0) <= currentProgress) {
      throw new Error('Сайт не засчитал комментарий.');
    }

    return {
      before: beforeTask,
      after: finalTask,
      commentId,
      deleted,
      claimed
    };
  }

  async function runCommentReplyTask(task, progressCb) {
    assertTaskAutomatable(task);

    if (!isCommentReplyTask(task)) {
      throw new Error('\u042d\u0442\u0430 \u0437\u0430\u0434\u0430\u0447\u0430 \u043d\u0435 \u043e\u0442\u043d\u043e\u0441\u0438\u0442\u0441\u044f \u043a \u043e\u0442\u0432\u0435\u0442\u0430\u043c \u043d\u0430 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    const goal = Number(beforeTask.goal || 0);
    const currentProgress = Number(beforeTask.progress || 0);

    if (currentProgress >= goal) {
      return {
        before: beforeTask,
        after: beforeTask,
        replyId: null,
        targetCommentId: null,
        deleted: false,
        claimed: false
      };
    }

    progressCb?.('\u041f\u043e\u0434\u0431\u0438\u0440\u0430\u044e \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u0434\u043b\u044f \u0430\u043a\u043a\u0443\u0440\u0430\u0442\u043d\u043e\u0433\u043e \u043e\u0442\u0432\u0435\u0442\u0430...');
    const plan = await buildCommentReplyPlan(beforeTask);
    const selectedReply = plan.selectedReplies[0];
    if (!selectedReply) {
      throw new Error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043d\u0430\u0439\u0442\u0438 \u043f\u043e\u0434\u0445\u043e\u0434\u044f\u0449\u0438\u0439 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u0434\u043b\u044f \u043e\u0442\u0432\u0435\u0442\u0430.');
    }

    const { replyText } = await getAutomationCopySettings();
    progressCb?.(`\u041e\u0442\u0432\u0435\u0447\u0430\u044e \u043d\u0430 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439: ${selectedReply.titleName}`);
    let created;
    try {
      created = await submitCommentReply(selectedReply.commentId, replyText);
    } catch (error) {
      if (isCommentingUnavailableError(error)) {
        throw new Error('Для этого аккаунта комментарии сейчас недоступны.');
      }
      throw error;
    }
    const replyId = Number(created?.content?.id || 0) || null;
    if (!replyId) {
      throw new Error('\u0421\u0430\u0439\u0442 \u043d\u0435 \u0432\u0435\u0440\u043d\u0443\u043b id \u043e\u0442\u0432\u0435\u0442\u0430.');
    }

    await rememberCommentId(replyId);
    await rememberCommentReply(selectedReply.commentId);

    let finalTask = beforeTask;
    let deleted = false;
    let claimed = false;

    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await smb.sleep(700);
        const refreshed = await loadState();
        finalTask = refreshed.tasks.find(item => item.id === beforeTask.id) || finalTask;
        if (Number(finalTask.progress || 0) > currentProgress) break;
      }

      if (smb.isTaskReady(finalTask)) {
        progressCb?.(`\u0417\u0430\u0431\u0438\u0440\u0430\u044e \u043d\u0430\u0433\u0440\u0430\u0434\u0443: ${finalTask.name}`);
        await smb.claimTask(finalTask.id);
        claimed = true;
        const claimedState = await loadState();
        finalTask = claimedState.tasks.find(item => item.id === beforeTask.id) || finalTask;
      }
    } finally {
      progressCb?.('\u0423\u0434\u0430\u043b\u044f\u044e \u043e\u0442\u0432\u0435\u0442...');
      try {
        await deleteComment(replyId);
        deleted = true;
      } catch (_error) {
        deleted = false;
      }
    }

    if (Number(finalTask.progress || 0) <= currentProgress) {
      throw new Error('\u0421\u0430\u0439\u0442 \u043d\u0435 \u0437\u0430\u0441\u0447\u0438\u0442\u0430\u043b \u043e\u0442\u0432\u0435\u0442 \u043d\u0430 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439.');
    }

    return {
      before: beforeTask,
      after: finalTask,
      replyId,
      targetCommentId: selectedReply.commentId,
      deleted,
      claimed
    };
  }

  async function runOpinionRatingTask(task, progressCb) {
    assertTaskAutomatable(task);

    if (!isOpinionRatingTask(task)) {
      throw new Error('\u042d\u0442\u0430 \u0437\u0430\u0434\u0430\u0447\u0430 \u043d\u0435 \u043e\u0442\u043d\u043e\u0441\u0438\u0442\u0441\u044f \u043a \u043e\u0446\u0435\u043d\u043a\u0435 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0435\u0432.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    let currentProgress = Number(beforeTask.progress || 0);
    const goal = Number(beforeTask.goal || 0);

    if (currentProgress >= goal) {
      return {
        before: beforeTask,
        after: beforeTask,
        votes: [],
        claimed: false
      };
    }

    progressCb?.('\u041f\u043e\u0434\u0431\u0438\u0440\u0430\u044e \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438 \u0434\u043b\u044f \u043e\u0446\u0435\u043d\u043a\u0438...');
    const plan = await buildOpinionRatingPlan(beforeTask);
    if (!plan.selectedVotes.length) {
      throw new Error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043d\u0430\u0439\u0442\u0438 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438 \u0434\u043b\u044f \u043e\u0446\u0435\u043d\u043a\u0438.');
    }

    const votes = [];
    let finalTask = beforeTask;

    for (const entry of plan.selectedVotes) {
      if (currentProgress >= goal) break;

      progressCb?.(`\u041e\u0446\u0435\u043d\u0438\u0432\u0430\u044e \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439: ${entry.titleName} #${entry.commentId}`);
      await submitCommentVote(entry.commentId, 0);
      await rememberCommentVote(entry.commentId);
      votes.push(entry);

      finalTask = await waitForTaskUpdate(
        beforeTask.id,
        nextTask => Number(nextTask.progress || 0) > currentProgress || smb.isTaskReady(nextTask),
        {
          attempts: 10,
          delayMs: 700,
          initialTask: finalTask
        }
      );

      if (Number(finalTask.progress || 0) > currentProgress) {
        currentProgress = Number(finalTask.progress || 0);
        progressCb?.(`\u041f\u0440\u043e\u0433\u0440\u0435\u0441\u0441 \u0432\u044b\u0440\u043e\u0441: ${currentProgress} / ${goal}`);
      }
    }

    if (Number(finalTask.progress || 0) <= Number(beforeTask.progress || 0)) {
      throw new Error('Сайт не засчитал оценку комментариев.');
    }

    if (Number(finalTask.progress || 0) >= goal && !smb.isTaskReady(finalTask)) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await smb.sleep(700);
        const refreshed = await loadState();
        finalTask = refreshed.tasks.find(item => item.id === beforeTask.id) || finalTask;
        currentProgress = Number(finalTask.progress || 0);
        if (smb.isTaskReady(finalTask)) break;
      }
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`\u0417\u0430\u0431\u0438\u0440\u0430\u044e \u043d\u0430\u0433\u0440\u0430\u0434\u0443: ${finalTask.name}`);
      await smb.claimTask(finalTask.id);
      claimed = true;
      const claimedState = await loadState();
      finalTask = claimedState.tasks.find(item => item.id === beforeTask.id) || finalTask;
    }

    if (Number(finalTask.progress || 0) <= Number(beforeTask.progress || 0)) {
      throw new Error('\u0421\u0430\u0439\u0442 \u043d\u0435 \u0437\u0430\u0441\u0447\u0438\u0442\u0430\u043b \u043e\u0446\u0435\u043d\u043a\u0443 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0435\u0432.');
    }

    return {
      before: beforeTask,
      after: finalTask,
      votes,
      claimed
    };
  }

  async function runSimilarTask(task, progressCb) {
    assertTaskAutomatable(task);

    if (!isSimilarTask(task)) {
      throw new Error('Эта задача не относится к похожим тайтлам.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    let currentProgress = Number(beforeTask.progress || 0);
    const goal = Number(beforeTask.goal || 0);

    if (currentProgress >= goal) {
      return {
        before: beforeTask,
        after: beforeTask,
        votes: [],
        claimed: false
      };
    }

    progressCb?.('Подбираю пары похожих тайтлов...');
    const plan = await buildSimilarPlan(beforeTask);
    if (!plan.selectedVotes.length) {
      throw new Error('Не удалось найти пары для голосования в похожем.');
    }

    const maxVotes = Math.max(0, goal - currentProgress);
    const selectedVotes = plan.selectedVotes.slice(0, maxVotes || plan.selectedVotes.length);
    const batchResult = await executeTaskBatches(selectedVotes, {
      taskId: beforeTask.id,
      initialTask: beforeTask,
      initialProgress: currentProgress,
      goal,
      batchSize: 2,
      delayBetweenBatches: 180,
      attempts: 4,
      delayMs: 140,
      progressCb,
      batchStartMessage: (currentBatch, totalBatches) => `Голосую за похожее пакетами: ${currentBatch}/${totalBatches}`,
      runItem: async entry => {
        progressCb?.(`Голосую за похожее: ${entry.baseTitle} -> ${entry.similarTitle}`);
        await submitSimilarVote(entry.title1Dir, entry.title2Dir, entry.voteType);
        await rememberSimilarVote(beforeTask.id, entry.pairKey);
        return entry;
      }
    });

    const votes = batchResult.processedItems;
    let finalTask = batchResult.finalTask || beforeTask;
    currentProgress = batchResult.currentProgress;

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Забираю награду: ${finalTask.name}`);
      await smb.claimTask(finalTask.id);
      claimed = true;
      const claimedState = await loadState();
      finalTask = claimedState.tasks.find(item => item.id === beforeTask.id) || finalTask;
    }

    return {
      before: beforeTask,
      after: finalTask,
      votes,
      claimed
    };
  }

  async function runProfileTask(task, progressCb) {
    assertTaskAutomatable(task);

    if (!isProfileTask(task)) {
      throw new Error('Эта задача не относится к посещению профилей.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    let currentProgress = Number(beforeTask.progress || 0);
    const goal = Number(beforeTask.goal || 0);

    if (currentProgress >= goal) {
      return {
        before: beforeTask,
        after: beforeTask,
        profiles: [],
        claimed: false
      };
    }

    progressCb?.('Подбираю чужие профили...');
    const plan = await buildProfilePlan(beforeTask);
    if (!plan.selectedUserIds.length) {
      throw new Error('Не удалось найти подходящие чужие профили.');
    }

    const maxProfiles = Math.max(0, goal - currentProgress);
    const selectedUserIds = plan.selectedUserIds.slice(0, maxProfiles || plan.selectedUserIds.length);
    const batchResult = await executeTaskBatches(selectedUserIds, {
      taskId: beforeTask.id,
      initialTask: beforeTask,
      initialProgress: currentProgress,
      goal,
      batchSize: 1,
      delayBetweenBatches: 450,
      attempts: 10,
      delayMs: 700,
      progressCb,
      batchStartMessage: (currentBatch, totalBatches) => `Открываю профили: ${currentBatch}/${totalBatches}`,
      onNoProgress: userId => `Визит в профиль #${userId} не дал прогресса, пробую следующий профиль.`,
      runItem: async userId => {
        progressCb?.(`Проверяю профиль пользователя #${userId} через API...`);
        const directResult = await submitProfileVisitDirect(userId);
        await rememberProfileVisit(userId);
        return directResult;
      }
    });

    const visitedProfiles = batchResult.processedItems;
    let finalTask = batchResult.finalTask || beforeTask;
    currentProgress = batchResult.currentProgress;

    if (Number(finalTask.progress || 0) <= Number(beforeTask.progress || 0)) {
      throw new Error('Сайт не засчитал посещение чужого профиля через запрос с текущей страницы.');
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Забираю награду: ${finalTask.name}`);
      await smb.claimTask(finalTask.id);
      claimed = true;
      const claimedState = await loadState();
      finalTask = claimedState.tasks.find(item => item.id === beforeTask.id) || finalTask;
    }

    return {
      before: beforeTask,
      after: finalTask,
      profiles: visitedProfiles,
      claimed
    };
  }

  async function runFriendRequestTask(task, progressCb) {
    assertTaskAutomatable(task);

    if (!isFriendRequestTask(task)) {
      throw new Error('\u042d\u0442\u0430 \u0437\u0430\u0434\u0430\u0447\u0430 \u043d\u0435 \u043e\u0442\u043d\u043e\u0441\u0438\u0442\u0441\u044f \u043a \u0437\u0430\u044f\u0432\u043a\u0430\u043c \u0432 \u0434\u0440\u0443\u0437\u044c\u044f.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    let currentProgress = Number(beforeTask.progress || 0);
    const goal = Number(beforeTask.goal || 0);

    if (currentProgress >= goal) {
      return {
        before: beforeTask,
        after: beforeTask,
        targetUser: null,
        claimed: false
      };
    }

    progressCb?.('\u041f\u043e\u0434\u0431\u0438\u0440\u0430\u044e \u043f\u043e\u0434\u0445\u043e\u0434\u044f\u0449\u0438\u0439 \u043f\u0440\u043e\u0444\u0438\u043b\u044c \u0434\u043b\u044f \u0437\u0430\u044f\u0432\u043a\u0438...');
    const plan = await buildFriendRequestPlan(beforeTask);
    if (!plan.currentUserId || !plan.selectedUserIds.length) {
      throw new Error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043d\u0430\u0439\u0442\u0438 \u043f\u043e\u0434\u0445\u043e\u0434\u044f\u0449\u0438\u0439 \u043f\u0440\u043e\u0444\u0438\u043b\u044c \u0434\u043b\u044f \u0437\u0430\u044f\u0432\u043a\u0438 \u0432 \u0434\u0440\u0443\u0437\u044c\u044f.');
    }

    let finalTask = beforeTask;
    let claimed = false;
    let targetUser = null;

    for (const entry of plan.selectedUserIds) {
      if (currentProgress >= goal) break;

      progressCb?.(`\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u044e \u0437\u0430\u044f\u0432\u043a\u0443 \u0432 \u0434\u0440\u0443\u0437\u044c\u044f: ${entry.username}`);
      await submitFriendRequest(plan.currentUserId, entry.userId);

      targetUser = entry;

      let progressed = false;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await smb.sleep(700);
        const refreshed = await loadState();
        finalTask = refreshed.tasks.find(item => item.id === beforeTask.id) || finalTask;
        if (Number(finalTask.progress || 0) > currentProgress) {
          currentProgress = Number(finalTask.progress || 0);
          progressed = true;
          await rememberFriendRequest(entry.userId);
          break;
        }
      }

      await rememberFriendRequest(entry.userId);
    }

    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`\u0417\u0430\u0431\u0438\u0440\u0430\u044e \u043d\u0430\u0433\u0440\u0430\u0434\u0443: ${finalTask.name}`);
      await smb.claimTask(finalTask.id);
      claimed = true;
      const claimedState = await loadState();
      finalTask = claimedState.tasks.find(item => item.id === beforeTask.id) || finalTask;
    }

    if (Number(finalTask.progress || 0) <= Number(beforeTask.progress || 0)) {
      throw new Error('\u0421\u0430\u0439\u0442 \u043d\u0435 \u0437\u0430\u0441\u0447\u0438\u0442\u0430\u043b \u0437\u0430\u044f\u0432\u043a\u0443 \u0432 \u0434\u0440\u0443\u0437\u044c\u044f.');
    }

    return {
      before: beforeTask,
      after: finalTask,
      targetUser,
      claimed
    };
  }

  async function runGuildJoinTask(task, progressCb) {
    assertTaskAutomatable(task);

    if (!isGuildJoinTask(task)) {
      throw new Error('\u042d\u0442\u0430 \u0437\u0430\u0434\u0430\u0447\u0430 \u043d\u0435 \u043e\u0442\u043d\u043e\u0441\u0438\u0442\u0441\u044f \u043a \u0437\u0430\u044f\u0432\u043a\u0430\u043c \u0432 \u0433\u0438\u043b\u044c\u0434\u0438\u0438.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    let currentProgress = Number(beforeTask.progress || 0);
    const goal = Number(beforeTask.goal || 0);

    if (currentProgress >= goal) {
      return {
        before: beforeTask,
        after: beforeTask,
        guilds: [],
        claimed: false
      };
    }

    progressCb?.('\u041f\u043e\u0434\u0431\u0438\u0440\u0430\u044e \u0433\u0438\u043b\u044c\u0434\u0438\u0438 \u0434\u043b\u044f \u0437\u0430\u044f\u0432\u043e\u043a...');
    const plan = await buildGuildJoinPlan(beforeTask);
    if (!plan.selectedGuilds.length) {
      throw new Error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043d\u0430\u0439\u0442\u0438 \u0433\u0438\u043b\u044c\u0434\u0438\u0438 \u0434\u043b\u044f \u043d\u043e\u0432\u044b\u0445 \u0437\u0430\u044f\u0432\u043e\u043a.');
    }

    let finalTask = beforeTask;
    let claimed = false;
    const guilds = [];

    for (const entry of plan.selectedGuilds) {
      if (currentProgress >= goal) break;

      progressCb?.(`\u041f\u043e\u0434\u0430\u044e \u0437\u0430\u044f\u0432\u043a\u0443 \u0432 \u0433\u0438\u043b\u044c\u0434\u0438\u044e: ${entry.dir}`);
      let result = null;
      try {
        result = await sendRuntimeMessage({
          type: 'smbp_run_guild_join_task',
          url: entry.url
        });
      } catch (error) {
        result = {
          status: 'error',
          applied: false,
          error: error?.message || String(error)
        };
        progressCb?.(`Гильдия ${entry.dir} не открылась: ${result.error}`);
      }

      guilds.push({
        ...entry,
        status: result?.status || 'unknown',
        applied: Boolean(result?.applied),
        error: result?.error || ''
      });

      let progressed = false;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await smb.sleep(700);
        const refreshed = await loadState();
        finalTask = refreshed.tasks.find(item => item.id === beforeTask.id) || finalTask;
        if (Number(finalTask.progress || 0) > currentProgress) {
          currentProgress = Number(finalTask.progress || 0);
          progressed = true;
          await rememberGuildRequest(entry.dir);
          progressCb?.(`\u041f\u0440\u043e\u0433\u0440\u0435\u0441\u0441 \u0432\u044b\u0440\u043e\u0441: ${currentProgress} / ${goal}`);
          break;
        }
      }

      if (!progressed && result?.applied) {
        progressCb?.(`Заявка в ${entry.dir} ушла, но battlepass пока не обновил прогресс.`);
      }

      if (result?.applied || result?.status === 'already_requested' || result?.status === 'error') {
        await rememberGuildRequest(entry.dir);
      }
    }

    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`\u0417\u0430\u0431\u0438\u0440\u0430\u044e \u043d\u0430\u0433\u0440\u0430\u0434\u0443: ${finalTask.name}`);
      await smb.claimTask(finalTask.id);
      claimed = true;
      const claimedState = await loadState();
      finalTask = claimedState.tasks.find(item => item.id === beforeTask.id) || finalTask;
    }

    if (Number(finalTask.progress || 0) <= Number(beforeTask.progress || 0)) {
      throw new Error('\u0421\u0430\u0439\u0442 \u043d\u0435 \u0437\u0430\u0441\u0447\u0438\u0442\u0430\u043b \u043d\u0438 \u043e\u0434\u043d\u0443 \u0437\u0430\u044f\u0432\u043a\u0443 \u0432 \u0433\u0438\u043b\u044c\u0434\u0438\u044e.');
    }

    return {
      before: beforeTask,
      after: finalTask,
      guilds,
      claimed
    };
  }

  window.SMBP.tasks = {
    loadState,
    buildStateFromPayloads,
    loadRewardsState,
    buildRewardsStateFromPayload,
    claimReward,
    claimReadyRewards,
    claimReadyTasks,
    getTaskRoute,
    summarizeBySection,
    isAutoSearchTask,
    isIgnoredManualTask,
    getAutomationBlockReason,
    isChapterReadTask,
    isLikeTask,
    isExpertRatingTask,
    isAutonomousMemoryTask,
    isDirectGameTask,
    isCommentTask,
    isCommentReplyTask,
    isOpinionRatingTask,
    isSimilarTask,
    isPersonalProfileTask,
    isProfileTask,
    isFriendRequestTask,
    isGuildJoinTask,
    isExchangeTask,
    isInventoryTask,
    isShopPurchaseTask,
    isTicketSpendTask,
    isDeckCardTask,
    isCardUpgradeTask,
    isWorldTravelTask,
    getTaskVisualKind,
    getManualTaskReason,
    extractTagNames,
    getFreeChapters,
    getLikableChapters,
    loadTitleBlacklist,
    getBlacklistedTitleDirs,
    rememberBlacklistedTitle,
    buildSearchTaskPlan,
    buildTaskDryRunPlan,
    buildWorldTravelPlan,
    buildReadingPlan,
    buildLikePlan,
    buildExpertRatingPlan,
    buildCommentReplyPlan,
    buildOpinionRatingPlan,
    buildSimilarPlan,
    buildProfilePlan,
    buildFriendRequestPlan,
    buildGuildJoinPlan,
    runSearchTask,
    runWorldTravelTask,
    runChapterReadTask,
    runLikeTask,
    runExpertRatingTask,
    runAutonomousMemoryTask,
    runDirectGameTask,
    runCommentTask,
    runCommentReplyTask,
    runOpinionRatingTask,
    runSimilarTask,
    runPersonalProfileTask,
    runProfileTask,
    runFriendRequestTask,
    runGuildJoinTask,
    runExchangeTask,
    runInventoryTask,
    runShopPurchaseTask,
    runTicketSpendTask,
    runCardUpgradeTask,
    openConfiguredDeck,
    runNewCardsTask
  };
})();






// ===== ui.js =====

(() => {
  const smb = window.SMBP;
  if (!smb?.tasks) return;
  let currentRouteKey = '';
  let activeShellView = '';
  let initScheduled = false;
  let activeTasksPageCleanup = null;
  const activeRunnerLocks = new Set();
  const TASKS_BACKGROUND_REFRESH_MS = 12000;
  const DAILY_TASK_EXP_STORE_KEY = 'smbp-daily-task-exp';

  const t = {
    close: '\u00d7',
    ready: '\u0413\u043e\u0442\u043e\u0432\u043e',
    doneChip: '\u0412\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e',
    readyChip: '\u041c\u043e\u0436\u043d\u043e \u0437\u0430\u0431\u0440\u0430\u0442\u044c',
    dailyExpTitle: 'EXP за день',
    dailyExpReset: 'Сброс в 00:00 МСК',
    taskExp: exp => `+${exp} EXP`,
    tasks: '\u0417\u0430\u0434\u0430\u0447\u0438',
    progress: '\u041f\u0440\u043e\u0433\u0440\u0435\u0441\u0441',
    loadingBattlepass: '\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044e battlepass...',
    loadingOverview: '\u0421\u043e\u0431\u0438\u0440\u0430\u044e \u0441\u0432\u043e\u0434\u043a\u0443 battlepass...',
    loadingRewards: '\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044e \u043d\u0430\u0433\u0440\u0430\u0434\u044b battlepass...',
    refresh: '\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c',
    runAvailable: '\u0412\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e\u0435',
    claimReady: '\u0417\u0430\u0431\u0440\u0430\u0442\u044c \u0433\u043e\u0442\u043e\u0432\u044b\u0435',
    claimRewards: '\u0417\u0430\u0431\u0440\u0430\u0442\u044c \u043d\u0430\u0433\u0440\u0430\u0434\u044b',
    hidePaidRewards: '\u0421\u043a\u0440\u044b\u0442\u044c Paid',
    showPaidRewards: '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c Paid',
    loadingTasks: '\u0427\u0438\u0442\u0430\u044e \u0437\u0430\u0434\u0430\u0447\u0438 battlepass \u0447\u0435\u0440\u0435\u0437 API...',
    loadingRewardsState: '\u0427\u0438\u0442\u0430\u044e \u043d\u0430\u0433\u0440\u0430\u0434\u044b battlepass \u0447\u0435\u0440\u0435\u0437 API...',
    noTasks: '\u0417\u0430\u0434\u0430\u0447\u0438 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b.',
    noAutoTasks: '\u041d\u0435\u0442 \u0430\u0432\u0442\u043e-\u0437\u0430\u0434\u0430\u0447 \u0434\u043b\u044f \u0437\u0430\u043f\u0443\u0441\u043a\u0430.',
    noRewards: '\u041d\u0430\u0433\u0440\u0430\u0434\u044b \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b.',
    done: '\u0412\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e',
    gameTasks: '\u0410\u0432\u0442\u043e-\u0437\u0430\u0434\u0430\u0447\u0438',
    gameTasksDesc: '\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044e\u0442\u0441\u044f \u043c\u0438\u043d\u0438-\u0438\u0433\u0440\u044b, \u0436\u0430\u043d\u0440\u044b \u0438 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438.',
    openGame: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0438\u0433\u0440\u0443',
    runNewTitles: '\u0412\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u043d\u043e\u0432\u044b\u043c\u0438 \u0442\u0430\u0439\u0442\u043b\u0430\u043c\u0438',
    readViaApi: '\u0427\u0438\u0442\u0430\u0442\u044c \u0447\u0435\u0440\u0435\u0437 API',
    likeViaApi: '\u041b\u0430\u0439\u043a\u0430\u0442\u044c \u0447\u0435\u0440\u0435\u0437 API',
    rateViaApi: '\u041e\u0446\u0435\u043d\u0438\u0442\u044c \u0447\u0435\u0440\u0435\u0437 API',
    replyAndDelete: '\u041e\u0442\u0432\u0435\u0442\u0438\u0442\u044c \u0438 \u0443\u0434\u0430\u043b\u0438\u0442\u044c',
    rateOpinion: '\u041e\u0446\u0435\u043d\u0438\u0442\u044c \u043c\u043d\u0435\u043d\u0438\u0435',
    runHidden: '\u0412\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u0441\u043a\u0440\u044b\u0442\u043e',
    runViaApi: '\u0412\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u0447\u0435\u0440\u0435\u0437 API',
    writeAndDelete: '\u041d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u0438 \u0443\u0434\u0430\u043b\u0438\u0442\u044c',
    voteSimilar: '\u041e\u0446\u0435\u043d\u0438\u0442\u044c \u043f\u043e\u0445\u043e\u0436\u0435\u0435',
    visitProfile: '\u041f\u043e\u0441\u0435\u0442\u0438\u0442\u044c \u043f\u0440\u043e\u0444\u0438\u043b\u044c',
    sendFriendRequest: '\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443',
    sendGuildRequests: '\u041f\u043e\u0434\u0430\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0438',
    sendExchange: '\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u043e\u0431\u043c\u0435\u043d',
    useInventory: '\u0427\u0435\u0440\u0435\u0437 \u0438\u043d\u0432\u0435\u043d\u0442\u0430\u0440\u044c',
    spendTicket: 'Открыть за тикет',
    openDeck: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043a\u043e\u043b\u043e\u0434\u0443',
    runViaCatalog: '\u0412\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u0447\u0435\u0440\u0435\u0437 \u043a\u0430\u0442\u0430\u043b\u043e\u0433',
    previewPlan: 'План',
    dryRunTitle: name => `DRY-RUN: ${name}`,
    dryRunExpected: progress => `Ожидаемый прогресс: ${progress}`,
    dryRunSelected: count => `Выбрано: ${count}`,
    dryRunRequests: count => `Запросов в плане: ${count}`,
    duplicateRun: 'Эта задача уже выполняется.',
    alreadyRunning: label => `\u0423\u0436\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u044f\u0435\u0442\u0441\u044f \u0437\u0430\u0434\u0430\u0447\u0430: ${label}`,
    claimedTasks: count => `\u0417\u0430\u0431\u0440\u0430\u043d\u043e \u0437\u0430\u0434\u0430\u0447: ${count}`,
    claimedRewards: count => `\u0417\u0430\u0431\u0440\u0430\u043d\u043e \u043d\u0430\u0433\u0440\u0430\u0434: ${count}`,
    progressToast: (name, progress, goal) => `\u041f\u0440\u043e\u0433\u0440\u0435\u0441\u0441 ${name}: ${progress}/${goal}`,
    runningTask: name => `\u0417\u0430\u043f\u0443\u0441\u043a\u0430\u044e: ${name}`,
    taskFailed: error => `\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u0437\u0430\u0434\u0430\u0447\u0443: ${error}`,
    loaded: (name, progress, goal) => `${name}: ${progress} / ${goal}`,
    failedLoad: error => `\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c battlepass: ${error}`,
    waitCurrent: '\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0434\u043e\u0436\u0434\u0438\u0441\u044c \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0438\u044f \u0442\u0435\u043a\u0443\u0449\u0435\u0439 \u0437\u0430\u0434\u0430\u0447\u0438.',
    checkingReady: '\u041f\u0440\u043e\u0432\u0435\u0440\u044f\u044e \u0433\u043e\u0442\u043e\u0432\u044b\u0435 \u0437\u0430\u0434\u0430\u043d\u0438\u044f...',
    runAvailableStart: '\u0421\u043e\u0431\u0438\u0440\u0430\u044e \u043e\u0447\u0435\u0440\u0435\u0434\u044c \u0430\u0432\u0442\u043e-\u0437\u0430\u0434\u0430\u0447...',
    noReady: '\u0413\u043e\u0442\u043e\u0432\u044b\u0445 \u0437\u0430\u0434\u0430\u0447 \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0435\u0442.',
    noReadyRewards: '\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0445 \u043d\u0430\u0433\u0440\u0430\u0434 \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0435\u0442.',
    checkingRewards: '\u041f\u0440\u043e\u0432\u0435\u0440\u044f\u044e \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0435 \u043d\u0430\u0433\u0440\u0430\u0434\u044b...',
    failedClaim: error => `\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0431\u0440\u0430\u0442\u044c \u043d\u0430\u0433\u0440\u0430\u0434\u044b: ${error}`,
    deckModalTitle: '\u0412\u044b\u0431\u043e\u0440 \u043a\u0430\u0440\u0442\u044b',
    deckModalDesc: '\u041a\u043e\u043b\u043e\u0434\u0430 \u0443\u0436\u0435 \u043e\u0442\u043a\u0440\u044b\u0442\u0430. \u0412\u044b\u0431\u0435\u0440\u0438 \u043a\u0430\u0440\u0442\u0443, \u043a\u043e\u0442\u043e\u0440\u0443\u044e \u0445\u043e\u0447\u0435\u0448\u044c \u0437\u0430\u0431\u0440\u0430\u0442\u044c \u0432 \u0438\u043d\u0432\u0435\u043d\u0442\u0430\u0440\u044c.',
    deckPremiumAvailable: '\u041f\u0440\u0435\u043c\u0438\u0443\u043c \u0441\u043b\u043e\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d',
    deckPremiumLocked: '\u041f\u0440\u0435\u043c\u0438\u0443\u043c \u0441\u043b\u043e\u0442 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d',
    deckPremiumOnly: '\u0422\u043e\u043b\u044c\u043a\u043e \u0434\u043b\u044f \u043f\u0440\u0435\u043c\u0438\u0443\u043c\u0430',
    deckPickCard: '\u0417\u0430\u0431\u0440\u0430\u0442\u044c \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u0443\u044e',
    deckCancel: '\u041e\u0442\u043c\u0435\u043d\u0430',
    deckChoiceCancelled: '\u0412\u044b\u0431\u043e\u0440 \u043a\u0430\u0440\u0442\u044b \u043e\u0442\u043c\u0435\u043d\u0451\u043d.',
    cards: '\u041a\u0430\u0440\u0442\u044b',
    solved: '\u0420\u0435\u0448\u0435\u043d\u043e',
    solve: '\u0420\u0435\u0448\u0438\u0442\u044c',
    stop: '\u0421\u0442\u043e\u043f',
    mode: '\u0420\u0435\u0436\u0438\u043c',
    answers: '\u041e\u0442\u0432\u0435\u0442\u043e\u0432',
    autoPlay: '\u0410\u0432\u0442\u043e-\u0438\u0433\u0440\u0430',
    start: '\u0421\u0442\u0430\u0440\u0442',
    autoPlayOn: '\u0410\u0432\u0442\u043e-\u0438\u0433\u0440\u0430 \u0432\u043a\u043b\u044e\u0447\u0435\u043d\u0430.',
    autoPlayOff: '\u0410\u0432\u0442\u043e-\u0438\u0433\u0440\u0430 \u0432\u044b\u043a\u043b\u044e\u0447\u0435\u043d\u0430.',
    points: '\u0422\u043e\u0447\u0435\u043a',
    found: '\u041d\u0430\u0439\u0434\u0435\u043d\u043e',
    scan: '\u0421\u043a\u0430\u043d',
    autoClick: '\u0410\u0432\u0442\u043e-\u043a\u043b\u0438\u043a',
    openSettings: 'Настройки',
    openSettingsHint: 'SailorM Battlepass',
    settingsCardTitle: 'SailorM Battlepass',
    settingsCardDesc: 'Настройки автоматизации',
    settingsDialogTitle: 'Настройки SailorM',
    relatedLikeTasks: 'Связанные лайк-задачи',
    overviewDone: 'Закрыто',
    overviewAuto: 'Авто',
    overviewReadyRewards: 'Награды',
    overviewAccount: 'Аккаунт',
    overviewNickname: 'Ник',
    overviewUserId: 'ID',
    overviewBlacklist: 'Blacklist',
    queueTitle: 'Очередь выполнения',
    queueEmpty: 'Очередь пока пустая.',
    queuePending: 'Ожидает',
    queueRunning: 'Выполняется',
    queueDone: 'Готово',
    queueError: 'Ошибка',
    queueSkipped: 'Пропущено',
    autoRunDone: (done, failed) => `Автозапуск завершён: ${done} готово, ${failed} ошибок.`,
    settingsDialogDesc: 'Настройки автоматизации задач SailorM.',
    settingsDeckIds: 'Паки для карточек',
    settingsDeckIdsDesc: 'Укажи id паков через запятую. Расширение возьмёт первый доступный с неоткрытой колодой.',
    settingsDeckTest: 'Открыть указанный пак',
    settingsDeckTestRunning: 'Проверяю открытие пака...',
    settingsDeckTestDone: result => `Пак #${result.deckId} открыт, выбрана карта: ${result.chosenCard?.label || 'карта'}.`,
    settingsCommentText: 'Текст комментария',
    settingsCommentTextDesc: 'Сообщение для задач, где расширение пишет новый комментарий.',
    settingsReplyText: 'Текст ответа',
    settingsReplyTextDesc: 'Сообщение для задач, где расширение отвечает на чужой комментарий.',
    settingsBlacklist: 'Черный список тайтлов',
    settingsBlacklistDesc: 'Один тайтл на строку. Формат: scope:dir:reason. Можно оставить только dir.',
    settingsBlacklistAdd: 'Добавить тайтл',
    settingsBlacklistPlaceholder: 'solo-leveling_ или reading:solo-leveling_:licensed',
    settingsSave: 'Сохранить',
    settingsReset: 'Сбросить',
    settingsClose: 'Закрыть',
    settingsSaved: 'Настройки сохранены.',
    settingsResetDone: 'Настройки сброшены к значениям по умолчанию.',
    statusIdle: 'Ожидание',
    statusRunning: 'Выполняется',
    statusDone: 'Готово',
    statusError: 'Ошибка',
    currentTask: 'Текущая задача',
    noCurrentTask: 'Сейчас ничего не выполняется.',
    lastActions: 'Последние действия',
    noActions: 'Журнал пока пуст.',
    autoSection: 'API-задачи',
    autoSectionDesc: 'Все безопасные автоматические действия собраны здесь.',
    readyTasksSection: 'Задания в ожидании сбора',
    readyTasksSectionDesc: 'Эти задания уже выполнены и ждут получения награды.',
    manualSection: 'Ручные ограничения',
    manualSectionDesc: 'Эти задания пока оставлены без автозапуска, чтобы не задеть чувствительные действия.',
    manualOnly: 'Только вручную',
    rewardsAvailable: 'Доступно',
    rewardsClaimed: 'Забрано',
    rewardsLevel: level => `Уровень ${level}`,
    rewardsVersion: version => version === 'paid' ? 'Paid' : 'Free',
    rewardsLocked: 'Недоступно',
    rewardsNeedExp: 'Не хватает опыта',
    rewardsReady: 'Можно забрать',
    rewardsAlreadyClaimed: 'Уже забрано',
    rewardsPendingSection: 'Не собраны',
    rewardsPendingSectionDesc: 'Доступные и будущие награды.',
    rewardsClaimedSection: 'Уже собраны',
    rewardsClaimedSectionDesc: 'Награды, которые уже отмечены сайтом как полученные.',
    claimReward: 'Забрать',
    taskType: {
      world: 'Новые тайтлы',
      reading: 'Чтение',
      like: 'Лайки',
      expert: 'Оценка',
      reply: 'Ответ',
      opinion: 'Мнение',
      memory: 'Memory',
      game: 'Мини-игра',
      comment: 'Комментарий',
      similar: 'Похожее',
      profile: 'Профиль',
      friend: 'Друзья',
      guild: 'Гильдия',
      exchange: 'Обмен',
      inventory: 'Инвентарь',
      shop: 'Магазин',
      ticket: 'Тикеты',
      cards: 'Карты',
      catalog: 'Каталог',
      minigame: 'Игра',
      task: 'Задача'
    }
  };

  const TASKS_ROUTE = '/user/battlepass/tasks';
  const REWARDS_ROUTE = '/user/battlepass/rewards';
  const OVERVIEW_HASH = '#smbp-overview';
  const SHELL_SETTINGS_HASH = '#smbp-settings';
  const SETTINGS_ROUTE = '/user/settings/main';
  const SETTINGS_HASH = '#smbp';
  const isTasksPage = () => location.pathname === TASKS_ROUTE || /\/user\/battlepass\/tasks\/?$/.test(location.pathname);
  const isRewardsPage = () => location.pathname === REWARDS_ROUTE || /\/user\/battlepass\/rewards\/?$/.test(location.pathname);
  const isOverviewPage = () => isTasksPage() && location.hash === OVERVIEW_HASH;
  const isUserSettingsPage = () => location.pathname === SETTINGS_ROUTE;
  const isSmbpSettingsView = () => isUserSettingsPage() && location.hash === SETTINGS_HASH;
  const isShellSettingsView = () => location.hash === SHELL_SETTINGS_HASH && (isTasksPage() || isRewardsPage() || isUserSettingsPage());

  function injectStyles() {
    if (document.getElementById('smbp-style')) return;
    const style = document.createElement('style');
    style.id = 'smbp-style';
    style.textContent = `
      #smbp-fab {
        position: fixed;
        right: max(14px, env(safe-area-inset-right));
        bottom: max(14px, env(safe-area-inset-bottom));
        z-index: 2147483646;
        width: 46px;
        height: 46px;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 999px;
        background: linear-gradient(180deg, rgba(22,22,26,.96), rgba(10,10,12,.96));
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font: 800 17px/1 "Segoe UI", system-ui, sans-serif;
        letter-spacing: .02em;
        box-shadow: 0 12px 30px rgba(0,0,0,.28);
        cursor: pointer;
        user-select: none;
        backdrop-filter: blur(18px);
      }

      #smbp-panel {
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        z-index: 2147483646;
        width: min(1040px, calc(100vw - 24px));
        height: min(820px, calc(100vh - 24px));
        border-radius: 12px;
        overflow: hidden;
        background: #13141a;
        border: 1px solid #22253a;
        box-shadow: 0 16px 40px rgba(0,0,0,.6);
        color: #d8dae8;
        font: 13px/1.4 "Inter", "Segoe UI", system-ui, sans-serif;
        overscroll-behavior: contain;
      }

      #smbp-panel.smbp-hidden { display: none; }
      @media (max-width: 860px) {
        #smbp-panel {
          width: calc(100vw - 20px);
          height: calc(100vh - 20px);
        }
      }
      @media (max-width: 560px) {
        #smbp-fab {
          right: max(10px, env(safe-area-inset-right));
          bottom: max(10px, env(safe-area-inset-bottom));
        }
        #smbp-panel {
          width: calc(100vw - 12px);
          height: calc(100vh - 12px);
          border-radius: 10px;
        }
      }
      .smbp-shell {
        display: grid;
        grid-template-columns: 250px minmax(0, 1fr);
        width: 100%;
        height: 100%;
      }
      .smbp-sidebar {
        display: flex;
        flex-direction: column;
        min-width: 0;
        background: #101116;
        border-right: 1px solid #22253a;
      }
      .smbp-head {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 64px;
        padding: 16px 18px;
        border-bottom: 1px solid #22253a;
        background: #0e0f16;
      }
      .smbp-head[data-drag-handle],
      .smbp-main-head[data-drag-handle] {
        cursor: move;
        touch-action: none;
      }
      #smbp-panel.smbp-dragging,
      #smbp-panel.smbp-dragging * {
        user-select: none;
      }
      .smbp-logo {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #191b25;
        color: #f5f7fb;
        font: 800 17px/1 "Inter", "Segoe UI", system-ui, sans-serif;
        letter-spacing: .02em;
        flex: 0 0 auto;
      }
      .smbp-title {
        min-width: 0;
        flex: 1;
      }
      .smbp-title strong {
        display: block;
        color: #f7f8fc;
        font-size: 14px;
        line-height: 1.15;
      }
      .smbp-title span {
        display: block;
        margin-top: 3px;
        color: #8f97a8;
        font-size: 11px;
        line-height: 1.2;
      }
      .smbp-close {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        border: 0;
        background: transparent;
        color: #9aa2b3;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        transition: background .16s ease, color .16s ease;
      }
      .smbp-close:hover {
        background: rgba(255,255,255,.06);
        color: #f5f7fb;
      }
      .smbp-nav {
        flex: 1;
        min-height: 0;
        overflow: auto;
        overscroll-behavior: contain;
        padding: 14px 10px 12px;
      }
      .smbp-nav-group {
        margin-bottom: 14px;
      }
      .smbp-nav-group:last-child {
        margin-bottom: 0;
      }
      .smbp-nav-label {
        display: block;
        padding: 0 10px 7px;
        color: #778095;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.2;
        text-transform: uppercase;
        letter-spacing: .05em;
      }
      .smbp-nav-link {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-width: 0;
        margin-bottom: 2px;
        padding: 10px 12px;
        border: 0;
        border-radius: 10px;
        background: transparent;
        color: #cfd5e4;
        text-align: left;
        cursor: pointer;
        transition: background .16s ease, color .16s ease;
      }
      .smbp-nav-link:hover {
        background: rgba(255,255,255,.05);
        color: #fff;
      }
      .smbp-nav-link.is-active {
        background: #1b1e2d;
        color: #fff;
      }
      .smbp-nav-icon {
        width: 24px;
        height: 24px;
        border-radius: 7px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #191b28;
        color: #9ddab4;
        font: 800 10px/1 "Inter", "Segoe UI", system-ui, sans-serif;
        letter-spacing: .03em;
        flex: 0 0 auto;
      }
      .smbp-nav-copy {
        min-width: 0;
        flex: 1;
      }
      .smbp-nav-copy strong {
        display: block;
        color: inherit;
        font-size: 13px;
        line-height: 1.2;
      }
      .smbp-nav-copy span {
        display: block;
        margin-top: 2px;
        color: #8690a4;
        font-size: 11px;
        line-height: 1.2;
      }
      .smbp-main {
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
      }
      .smbp-main-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 64px;
        padding: 16px 20px;
        border-bottom: 1px solid #22253a;
        background: #0e0f16;
      }
      .smbp-main-head strong {
        display: block;
        color: #f7f8fc;
        font-size: 18px;
        line-height: 1.1;
      }
      .smbp-main-head span {
        display: block;
        margin-top: 4px;
        color: #8f97a8;
        font-size: 13px;
        line-height: 1.2;
      }
      .smbp-badge-head {
        padding: 6px 10px;
        border-radius: 999px;
        background: #171925;
        border: 1px solid #26293d;
        color: #c5ccda;
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
      }
      .smbp-body {
        min-width: 0;
        min-height: 0;
        overflow: auto;
        overscroll-behavior: contain;
        scrollbar-gutter: stable;
        padding: 22px 24px 24px;
      }
      .smbp-body[data-page="tasks"],
      .smbp-body[data-page="rewards"],
      .smbp-body[data-page="overview"] {
        display: flex;
        flex-direction: column;
        gap: 10px;
        overflow: hidden;
      }
      .smbp-body[data-page="rewards"] {
        gap: 4px;
      }
      .smbp-body[data-page="tasks"] .smbp-overview,
      .smbp-body[data-page="tasks"] .smbp-buttons,
      .smbp-body[data-page="overview"] .smbp-overview,
      .smbp-body[data-page="overview"] .smbp-buttons,
      .smbp-body[data-page="rewards"] .smbp-overview,
      .smbp-body[data-page="rewards"] .smbp-buttons {
        margin-bottom: 0;
        flex: 0 0 auto;
      }
      .smbp-body[data-page="tasks"] .smbp-list,
      .smbp-body[data-page="overview"] .smbp-list,
      .smbp-body[data-page="rewards"] .smbp-list {
        flex: 1 1 auto;
        min-height: 0;
        max-height: none;
        padding-right: 6px;
      }
      @media (max-width: 700px) {
        .smbp-shell {
          grid-template-columns: 1fr;
        }
        .smbp-sidebar {
          border-right: none;
          border-bottom: 1px solid #22253a;
        }
        .smbp-nav {
          padding-top: 10px;
          max-height: 220px;
        }
        .smbp-main-head {
          min-height: 56px;
          padding: 14px 16px;
        }
        .smbp-body {
          padding: 14px 16px 16px;
        }
        .smbp-body[data-page="tasks"],
        .smbp-body[data-page="rewards"] {
          gap: 8px;
        }
      }
      .smbp-overview-dashboard {
        display: grid;
        grid-template-columns: minmax(280px, .9fr) minmax(360px, 1.4fr);
        grid-template-rows: minmax(360px, 1fr) minmax(170px, .45fr);
        gap: 14px;
        width: 100%;
        min-height: 100%;
        flex: 1 1 auto;
      }
      .smbp-body[data-page="overview"] {
        overflow: auto;
      }
      .smbp-overview-panel {
        position: relative;
        overflow: hidden;
        border-radius: 18px;
        border: 1px solid rgba(130,151,185,.26);
        background:
          radial-gradient(circle at 90% 10%, rgba(99,214,151,.13), transparent 30%),
          linear-gradient(180deg, rgba(25,29,40,.96), rgba(13,16,24,.96));
        box-shadow: 0 18px 46px rgba(0,0,0,.24), inset 0 0 0 1px rgba(255,255,255,.025);
      }
      .smbp-overview-panel::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(135deg, rgba(121,190,255,.08), transparent 42%);
      }
      .smbp-overview-account {
        min-height: 0;
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .smbp-overview-account-main {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .smbp-overview-avatar {
        width: 72px;
        height: 72px;
        border-radius: 20px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(145deg, rgba(121,190,255,.2), rgba(99,214,151,.14));
        border: 1px solid rgba(255,255,255,.12);
        color: #f7f9ff;
        font-weight: 900;
        font-size: 24px;
        flex: 0 0 auto;
      }
      .smbp-overview-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .smbp-overview-name {
        min-width: 0;
      }
      .smbp-overview-name span,
      .smbp-overview-panel-title,
      .smbp-overview-metric span,
      .smbp-bp-line span,
      .smbp-badge-state span {
        display: block;
        color: #9aa3b4;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .02em;
        text-transform: uppercase;
        line-height: 1.15;
        overflow-wrap: anywhere;
      }
      .smbp-overview-name strong {
        display: block;
        margin-top: 5px;
        color: #f6f8ff;
        font-size: 24px;
        line-height: 1.08;
        word-break: break-word;
      }
      .smbp-overview-name small {
        display: block;
        margin-top: 6px;
        color: #b7becd;
        font-size: 13px;
      }
      .smbp-overview-account-grid {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-auto-rows: minmax(92px, 1fr);
        gap: 10px;
        margin-top: auto;
      }
      .smbp-overview-metric {
        min-width: 0;
        min-height: 92px;
        padding: 13px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.035);
      }
      .smbp-overview-metric--wide {
        grid-column: span 2;
      }
      .smbp-overview-metric strong {
        display: block;
        margin-top: 9px;
        color: #f7f9ff;
        font-size: 22px;
        line-height: 1;
      }
      .smbp-overview-metric small {
        display: block;
        margin-top: 8px;
        color: #aab2c1;
        font-size: 12px;
        line-height: 1.3;
      }
      .smbp-overview-battlepass {
        min-height: 0;
        padding: 18px;
      }
      .smbp-overview-panel-title {
        position: relative;
        z-index: 1;
        margin-bottom: 10px;
      }
      .smbp-bp-head {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
      }
      .smbp-bp-head strong {
        color: #f7f9ff;
        font-size: 25px;
        line-height: 1.1;
      }
      .smbp-bp-head small {
        display: block;
        margin-top: 7px;
        color: #aab2c1;
        font-size: 13px;
      }
      .smbp-bp-level {
        flex: 0 0 auto;
        padding: 9px 12px;
        border-radius: 999px;
        border: 1px solid rgba(99,214,151,.28);
        background: rgba(99,214,151,.12);
        color: #c9ffd8;
        font-weight: 900;
        font-size: 13px;
      }
      .smbp-bp-progress-wrap {
        position: relative;
        z-index: 1;
        margin-top: 20px;
      }
      .smbp-bp-progress-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        color: #c6cedc;
        font-size: 13px;
        font-weight: 800;
      }
      .smbp-bp-track {
        height: 13px;
        margin-top: 10px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255,255,255,.075);
        border: 1px solid rgba(255,255,255,.08);
      }
      .smbp-bp-fill {
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #79beff, #63d697, #ffd66e);
        box-shadow: 0 0 22px rgba(99,214,151,.22);
      }
      .smbp-bp-grid {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 16px;
      }
      .smbp-bp-line {
        min-width: 0;
        padding: 13px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.035);
      }
      .smbp-bp-line strong {
        display: block;
        margin-top: 8px;
        color: #f7f9ff;
        font-size: 18px;
        line-height: 1.05;
      }
      .smbp-overview-badge {
        grid-column: 1 / -1;
        min-height: 0;
        padding: 18px;
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .smbp-badge-icon {
        position: relative;
        z-index: 1;
        width: 78px;
        height: 78px;
        border-radius: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.05);
        color: #f7f9ff;
        font-weight: 900;
        flex: 0 0 auto;
        overflow: hidden;
      }
      .smbp-badge-icon img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .smbp-badge-state {
        position: relative;
        z-index: 1;
        min-width: 0;
        flex: 1 1 auto;
      }
      .smbp-badge-state strong {
        display: block;
        margin-top: 6px;
        color: #f7f9ff;
        font-size: 22px;
        line-height: 1.12;
      }
      .smbp-badge-state small {
        display: block;
        margin-top: 8px;
        color: #aab2c1;
        font-size: 13px;
        line-height: 1.35;
      }
      .smbp-badge-mark {
        position: relative;
        z-index: 1;
        flex: 0 0 auto;
        padding: 9px 12px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 900;
        border: 1px solid rgba(255,255,255,.1);
        background: rgba(255,255,255,.06);
        color: #c9cedb;
      }
      .smbp-overview-badge.is-collected .smbp-badge-mark {
        border-color: rgba(99,214,151,.36);
        background: rgba(99,214,151,.14);
        color: #c9ffd8;
      }
      .smbp-overview-badge.is-missing .smbp-badge-mark {
        border-color: rgba(255,214,110,.32);
        background: rgba(255,214,110,.12);
        color: #ffe7a0;
      }
      .smbp-overview-loading,
      .smbp-overview-error {
        padding: 18px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.035);
        color: #cdd4e2;
      }
      .smbp-overview-error {
        border-color: rgba(255,115,115,.35);
        background: rgba(255,80,80,.08);
        color: #ffd6d6;
      }
      @media (max-width: 900px) {
        .smbp-overview-dashboard {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 620px) {
        .smbp-overview-account-grid,
        .smbp-bp-grid {
          grid-template-columns: 1fr;
        }
        .smbp-overview-metric--wide {
          grid-column: span 1;
        }
        .smbp-overview-badge {
          align-items: flex-start;
          flex-direction: column;
        }
      }
      .smbp-settings-entry {
        position: relative;
        display: flex;
        align-items: center;
        gap: 14px;
        width: 100%;
        margin-top: 12px;
        padding: 14px 16px;
        border-radius: 24px;
        border: 1px solid rgba(152,159,189,.34);
        background: linear-gradient(180deg, rgba(28,29,36,.96), rgba(22,23,29,.96));
        color: #f5f7fb;
        text-align: left;
        cursor: pointer;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.03);
      }
      .smbp-settings-entry:hover {
        border-color: rgba(99,214,151,.34);
      }
      .smbp-settings-entry-icon {
        width: 48px;
        height: 48px;
        border-radius: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(12,12,16,.82);
        color: #f3f7ff;
        font: 800 18px/1 "Segoe UI", system-ui, sans-serif;
        flex: 0 0 auto;
      }
      .smbp-settings-entry-copy strong {
        display: block;
        font-size: 14px;
        line-height: 1.15;
      }
      .smbp-settings-entry-copy span {
        display: block;
        margin-top: 4px;
        color: #d7deea;
        font-size: 12px;
        line-height: 1.25;
      }
      .smbp-settings-entry [data-state="active"] {
        background: rgba(255,255,255,.08) !important;
        outline: 1px solid rgba(99,214,151,.32) !important;
      }
      .smbp-settings-page {
        display: flex;
        flex-direction: column;
        gap: 14px;
        width: 100%;
        min-width: 0;
      }
      .smbp-settings-page,
      .smbp-settings-page * {
        box-sizing: border-box;
      }
      .smbp-settings-page-head {
        padding: 18px 18px 16px;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,.08);
        background:
          radial-gradient(circle at top right, rgba(99,214,151,.12), transparent 34%),
          linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.018));
      }
      .smbp-settings-page-head strong {
        display: block;
        font-size: 18px;
      }
      .smbp-settings-page-head span {
        display: block;
        margin-top: 6px;
        color: #99a1af;
        font-size: 13px;
        line-height: 1.4;
      }
      .smbp-settings-grid {
        display: grid;
        gap: 12px;
        width: 100%;
        min-width: 0;
      }
      .smbp-settings-card {
        padding: 14px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,.07);
        background: rgba(255,255,255,.03);
        width: 100%;
        min-width: 0;
      }
      .smbp-settings-card label,
      .smbp-settings-card strong {
        display: block;
        margin-bottom: 8px;
        font-size: 13px;
        font-weight: 700;
      }
      .smbp-settings-card small {
        display: block;
        margin-top: 4px;
        color: #99a1af;
        font-size: 12px;
        line-height: 1.35;
      }
      .smbp-settings-page input[type="text"] {
        width: 100%;
        min-width: 0;
        max-width: 100%;
        padding: 11px 12px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.035);
        color: #f5f7fb;
        font: 13px/1.2 "Segoe UI", system-ui, sans-serif;
      }
      .smbp-settings-page textarea {
        width: 100%;
        min-width: 0;
        max-width: 100%;
        min-height: 82px;
        padding: 11px 12px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.035);
        color: #f5f7fb;
        font: 13px/1.4 "Segoe UI", system-ui, sans-serif;
        resize: vertical;
      }
      .smbp-settings-switch {
        align-items: flex-start;
      }
      .smbp-settings-switch-actions {
        display: inline-flex;
        gap: 8px;
        flex: 0 0 auto;
      }
      .smbp-settings-choice {
        min-width: 104px;
        padding: 9px 12px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.05);
        color: #f5f7fb;
        font: 700 12px/1 "Segoe UI", system-ui, sans-serif;
        cursor: pointer;
        transition: background .16s ease, border-color .16s ease, color .16s ease, transform .16s ease;
      }
      .smbp-settings-choice:hover {
        transform: translateY(-1px);
      }
      .smbp-settings-choice.is-selected {
        background: rgba(89,196,140,.26);
        border-color: rgba(89,196,140,.42);
        color: #effff4;
      }
      .smbp-settings-state {
        margin-top: 8px;
        color: #99a1af;
        font-size: 12px;
      }
      .smbp-settings-page input[type="color"] {
        width: 48px;
        height: 44px;
        padding: 4px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,.08);
        background: transparent;
        flex: 0 0 auto;
      }
      .smbp-settings-page .smbp-settings-switch {
        padding: 14px;
      }
      .smbp-settings-page .smbp-settings-preview {
        padding: 14px;
      }
      .smbp-settings-page .smbp-settings-status {
        margin-top: 2px;
      }
      .smbp-settings-color-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 48px;
        gap: 8px;
        width: 100%;
        min-width: 0;
      }
      .smbp-settings-actions {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 8px;
        width: 100%;
        min-width: 0;
      }
      .smbp-settings-actions .smbp-btn {
        width: 100%;
        min-width: 0;
      }
      .smbp-settings-switch,
      .smbp-settings-field,
      .smbp-settings-preview {
        padding: 12px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,.06);
        background: rgba(255,255,255,.028);
      }
      .smbp-settings-switch {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .smbp-settings-switch-copy strong {
        display: block;
        font-size: 12px;
      }
      .smbp-settings-switch-copy span {
        display: block;
        margin-top: 4px;
        color: #99a1af;
        font-size: 11px;
        line-height: 1.35;
      }
      .smbp-settings-field label,
      .smbp-settings-preview strong {
        display: block;
        margin-bottom: 7px;
        font-size: 12px;
        font-weight: 700;
      }
      .smbp-settings-field input[type="text"] {
        width: 100%;
        padding: 10px 11px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.035);
        color: #f5f7fb;
        font: 12px/1.2 "Segoe UI", system-ui, sans-serif;
      }
      .smbp-settings-field textarea {
        width: 100%;
        min-height: 78px;
        padding: 10px 11px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.035);
        color: #f5f7fb;
        font: 12px/1.4 "Segoe UI", system-ui, sans-serif;
        resize: vertical;
      }
      .smbp-settings-field input[type="color"] {
        width: 46px;
        height: 40px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,.08);
        background: transparent;
        padding: 3px;
      }
      .smbp-settings-preview-button {
        min-width: 102px;
        height: 40px;
        padding: 0 14px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #ecfff2;
        font: 700 14px/1 "Segoe UI", system-ui, sans-serif;
        border: 1px solid rgba(99,214,151,.28);
        background: linear-gradient(180deg, rgba(25,96,60,.95), rgba(18,76,48,.95));
      }
      .smbp-settings-status {
        min-height: 16px;
        color: #99a1af;
        font-size: 12px;
      }
      .smbp-overview {
        margin-bottom: 8px;
        padding: 9px 10px 10px;
        border-radius: 12px;
        background:
          radial-gradient(circle at top right, rgba(99,214,151,.09), transparent 42%),
          linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));
        border: 1px solid rgba(255,255,255,.06);
      }
      .smbp-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 7px;
        flex-wrap: wrap;
      }
      .smbp-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(255,255,255,.045);
        border: 1px solid rgba(255,255,255,.06);
        color: #d9dfeb;
        font-size: 10px;
        line-height: 1;
      }
      .smbp-chip strong {
        font-size: 11px;
        font-weight: 800;
        color: #ffffff;
      }
      .smbp-status {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      .smbp-statusbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,.06);
        background: rgba(255,255,255,.03);
      }
      .smbp-statusbar strong {
        font-size: 11px;
        line-height: 1;
      }
      .smbp-statusbar span {
        color: #eef2fa;
        font-size: 12px;
        line-height: 1.35;
      }
      .smbp-statusbar--idle { border-color: rgba(255,255,255,.06); background: rgba(255,255,255,.03); }
      .smbp-statusbar--running { border-color: rgba(99,214,151,.24); background: rgba(99,214,151,.09); }
      .smbp-statusbar--done { border-color: rgba(121,190,255,.24); background: rgba(121,190,255,.09); }
      .smbp-statusbar--error { border-color: rgba(255,120,140,.24); background: rgba(255,120,140,.09); }
      .smbp-current {
        padding: 7px 9px;
        border-radius: 9px;
        background: rgba(255,255,255,.02);
        border: 1px solid rgba(255,255,255,.04);
      }
      .smbp-current strong,
      .smbp-log strong {
        display: block;
        margin-bottom: 4px;
        color: #f4f7fc;
        font-size: 10px;
        letter-spacing: .03em;
        text-transform: uppercase;
      }
      .smbp-current span {
        display: block;
        color: #dfe6f2;
        font-size: 11px;
        line-height: 1.35;
      }
      .smbp-current span.smbp-muted,
      .smbp-log-empty {
        color: #969daa;
      }
      .smbp-log {
        padding: 7px 9px 8px;
        border-radius: 9px;
        background: rgba(255,255,255,.02);
        border: 1px solid rgba(255,255,255,.04);
      }
      .smbp-log-list {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .smbp-log-entry {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        color: #dce3ef;
        font-size: 11px;
        line-height: 1.3;
      }
      .smbp-log-entry::before {
        content: '';
        width: 6px;
        height: 6px;
        margin-top: 4px;
        border-radius: 999px;
        background: rgba(255,255,255,.24);
        flex: 0 0 auto;
      }
      .smbp-log-entry--running::before { background: #63d697; }
      .smbp-log-entry--done::before { background: #79beff; }
      .smbp-log-entry--error::before { background: #ff7c8c; }
      .smbp-log-entry--plan::before { background: #ffd66e; }
      .smbp-log-entry--plan {
        color: #f2dfaa;
      }
      .smbp-body[data-page="overview"] .smbp-overview,
      .smbp-body[data-page="rewards"] .smbp-overview {
        padding: 10px;
        border-radius: 11px;
        border-color: rgba(121,190,255,.12);
        background:
          linear-gradient(90deg, rgba(121,190,255,.055), rgba(99,214,151,.04)),
          rgba(255,255,255,.018);
      }
      .smbp-body[data-page="overview"] .smbp-overview {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        gap: 10px;
      }
      .smbp-body[data-page="overview"] .smbp-meta {
        margin-bottom: 0;
      }
      .smbp-body[data-page="overview"] .smbp-status {
        min-width: 0;
      }
      .smbp-body[data-page="overview"] .smbp-current,
      .smbp-body[data-page="overview"] .smbp-log {
        display: none;
      }
      .smbp-body[data-page="overview"] .smbp-statusbar {
        min-height: 34px;
        padding: 8px 10px;
        border-color: rgba(121,190,255,.18);
        background: rgba(121,190,255,.055);
      }
      .smbp-body[data-page="rewards"] .smbp-overview {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 10px;
        align-items: start;
      }
      .smbp-body[data-page="rewards"] .smbp-meta {
        margin-bottom: 0;
        align-self: center;
      }
      .smbp-body[data-page="rewards"] .smbp-current {
        display: none;
      }
      .smbp-body[data-page="rewards"] .smbp-status {
        gap: 6px;
        min-width: 0;
      }
      .smbp-body[data-page="rewards"] .smbp-statusbar {
        padding: 7px 9px;
      }
      .smbp-body[data-page="rewards"] .smbp-log {
        padding: 6px 9px;
      }
      .smbp-body[data-page="rewards"] .smbp-log strong {
        margin-bottom: 3px;
      }
      .smbp-body[data-page="rewards"] .smbp-log-list {
        max-height: 44px;
        overflow: auto;
      }
      .smbp-body[data-page="rewards"] .smbp-item:hover {
        transform: none;
      }
      @media (max-width: 760px) {
        .smbp-body[data-page="overview"] .smbp-overview,
        .smbp-body[data-page="rewards"] .smbp-overview {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .smbp-action-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 7px;
      }
      .smbp-action-row .smbp-link {
        margin-top: 0;
      }
      .smbp-queue {
        padding: 10px;
        border-radius: 11px;
        background: rgba(255,255,255,.02);
        border: 1px solid rgba(255,255,255,.05);
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      .smbp-queue-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        color: #f4f7fc;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
      }
      .smbp-queue-list {
        display: flex;
        flex-direction: column;
        gap: 5px;
        max-height: 170px;
        overflow: auto;
        padding-right: 2px;
      }
      .smbp-queue-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 7px 8px;
        border-radius: 9px;
        background: rgba(255,255,255,.025);
        border: 1px solid rgba(255,255,255,.045);
        color: #dce3ef;
        font-size: 11px;
      }
      .smbp-queue-item strong {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .smbp-queue-state {
        flex: 0 0 auto;
        padding: 3px 7px;
        border-radius: 999px;
        background: rgba(255,255,255,.05);
        color: #cfd6e5;
        font-weight: 800;
        font-size: 10px;
      }
      .smbp-queue-item--running .smbp-queue-state { background: rgba(99,214,151,.15); color: #9ce9bb; }
      .smbp-queue-item--done .smbp-queue-state { background: rgba(121,190,255,.15); color: #b8dfff; }
      .smbp-queue-item--error .smbp-queue-state { background: rgba(255,120,140,.15); color: #ffc1ca; }
      .smbp-buttons { display: flex; gap: 6px; margin-bottom: 8px; }
      .smbp-btn {
        flex: 1;
        border: 0;
        border-radius: 10px;
        padding: 8px 10px;
        cursor: pointer;
        font: 700 11px/1.15 "Segoe UI", system-ui, sans-serif;
        transition: opacity .14s ease, background .14s ease, border-color .14s ease;
      }
      .smbp-btn:hover { transform: none; }
      .smbp-btn-primary { background: linear-gradient(180deg, #ffffff, #e9edf5); color: #0b0b0d; }
      .smbp-btn-secondary { background: rgba(255,255,255,.04); color: #f5f7fb; border: 1px solid rgba(255,255,255,.07); }
      .smbp-btn-danger { background: rgba(99,24,33,.26); color: #ffd0d6; border: 1px solid rgba(255,120,140,.15); }
      .smbp-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
        padding: 8px 10px;
        border-radius: 11px;
        background: rgba(255,255,255,.025);
        border: 1px solid rgba(255,255,255,.05);
      }
      .smbp-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 280px;
        overflow: auto;
        scrollbar-gutter: stable;
        padding-right: 2px;
      }
      .smbp-list::-webkit-scrollbar { width: 6px; }
      .smbp-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,.09); border-radius: 999px; }
      .smbp-item {
        padding: 14px 15px;
        border-radius: 11px;
        background: linear-gradient(180deg, rgba(255,255,255,.028), rgba(255,255,255,.015));
        border: 1px solid rgba(255,255,255,.05);
        transition: border-color .16s ease, background .16s ease, transform .16s ease;
      }
      .smbp-item:hover {
        border-color: rgba(99,214,151,.22);
        background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));
        transform: translateY(-1px);
      }
      .smbp-item-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 4px;
      }
      .smbp-item-head strong {
        flex: 1;
        min-width: 0;
        display: block;
        color: #f6f8fc;
        font-size: 15px;
        line-height: 1.32;
      }
      .smbp-item-head span {
        color: #d7deea;
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
        opacity: .88;
      }
      .smbp-item-head span.smbp-progress {
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(255,255,255,.045);
        border: 1px solid rgba(255,255,255,.06);
      }
      .smbp-item-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-bottom: 5px;
      }
      .smbp-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(255,255,255,.05);
        border: 1px solid rgba(255,255,255,.06);
        color: #eef3fb;
        font-size: 11px;
        line-height: 1;
        font-weight: 700;
      }
      .smbp-badge-exp {
        border-color: rgba(255,214,110,.22);
        background: rgba(255,214,110,.09);
        color: #ffe39c;
      }
      .smbp-daily-exp {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 16px;
        border: 1px solid rgba(255,214,110,.18);
        background:
          radial-gradient(circle at 96% 0%, rgba(255,214,110,.13), transparent 32%),
          linear-gradient(180deg, rgba(28,31,41,.92), rgba(17,20,29,.94));
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.02);
      }
      .smbp-daily-exp strong {
        display: block;
        color: #f6f8fc;
        font-size: 13px;
        line-height: 1.2;
      }
      .smbp-daily-exp span {
        display: block;
        margin-top: 3px;
        color: #9fa8b8;
        font-size: 11px;
        line-height: 1.25;
      }
      .smbp-daily-exp-value {
        flex: 0 0 auto;
        padding: 7px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,214,110,.25);
        background: rgba(255,214,110,.1);
        color: #ffe39c;
        font-size: 13px;
        line-height: 1;
        font-weight: 900;
      }
      .smbp-item small {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        color: #9599a4;
        font-size: 13px;
        line-height: 1.45;
      }
      .smbp-item-note {
        margin-top: 8px;
        color: #b8bfcc;
        font-size: 13px;
        line-height: 1.45;
      }
      .smbp-body[data-page="tasks"] {
        gap: 12px;
      }
      .smbp-body[data-page="tasks"] .smbp-overview {
        position: relative;
        overflow: hidden;
        margin-bottom: 0;
        padding: 14px;
        border-radius: 18px;
        border: 1px solid rgba(130,151,185,.22);
        background:
          radial-gradient(circle at 92% 8%, rgba(99,214,151,.13), transparent 32%),
          linear-gradient(180deg, rgba(25,29,40,.96), rgba(13,16,24,.96));
        box-shadow: 0 14px 34px rgba(0,0,0,.2), inset 0 0 0 1px rgba(255,255,255,.025);
      }
      .smbp-body[data-page="tasks"] .smbp-overview::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(135deg, rgba(121,190,255,.07), transparent 46%);
      }
      .smbp-body[data-page="tasks"] .smbp-meta,
      .smbp-body[data-page="tasks"] .smbp-status {
        position: relative;
        z-index: 1;
      }
      .smbp-body[data-page="tasks"] .smbp-meta {
        margin-bottom: 10px;
        gap: 8px;
      }
      .smbp-body[data-page="tasks"] .smbp-chip {
        padding: 6px 10px;
        border-color: rgba(255,255,255,.08);
        background: rgba(255,255,255,.055);
        color: #cfd7e6;
        font-size: 11px;
      }
      .smbp-body[data-page="tasks"] .smbp-chip strong {
        font-size: 12px;
      }
      .smbp-body[data-page="tasks"] .smbp-status {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 9px;
      }
      .smbp-body[data-page="tasks"] .smbp-statusbar {
        grid-column: 1 / -1;
        min-height: 38px;
        padding: 9px 11px;
        border-radius: 12px;
        border-color: rgba(121,190,255,.18);
        background: rgba(121,190,255,.055);
      }
      .smbp-body[data-page="tasks"] .smbp-statusbar strong,
      .smbp-body[data-page="tasks"] .smbp-current strong,
      .smbp-body[data-page="tasks"] .smbp-log strong {
        color: #aab3c5;
        font-size: 10px;
        letter-spacing: .03em;
      }
      .smbp-body[data-page="tasks"] .smbp-statusbar span {
        color: #f5f8ff;
        font-size: 12px;
        font-weight: 700;
      }
      .smbp-body[data-page="tasks"] .smbp-current,
      .smbp-body[data-page="tasks"] .smbp-log {
        min-height: 64px;
        padding: 10px 11px;
        border-radius: 13px;
        border-color: rgba(255,255,255,.07);
        background: rgba(255,255,255,.035);
      }
      .smbp-body[data-page="tasks"] .smbp-current span {
        color: #cdd5e3;
        font-size: 12px;
      }
      .smbp-body[data-page="tasks"] .smbp-log-list {
        max-height: 64px;
        overflow: auto;
      }
      .smbp-body[data-page="tasks"] .smbp-buttons {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 0;
      }
      .smbp-body[data-page="tasks"] .smbp-btn {
        min-height: 38px;
        border-radius: 13px;
        font-size: 12px;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.025);
      }
      .smbp-body[data-page="tasks"] .smbp-btn-primary {
        background: linear-gradient(180deg, #ffffff, #e9edf5);
      }
      .smbp-body[data-page="tasks"] .smbp-btn-secondary {
        background: rgba(255,255,255,.035);
        border-color: rgba(255,255,255,.09);
      }
      .smbp-body[data-page="tasks"] .smbp-list {
        gap: 10px;
        padding-right: 6px;
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
      }
      .smbp-body[data-page="tasks"] .smbp-item,
      .smbp-body[data-page="tasks"] .smbp-section {
        flex: 0 0 auto;
      }
      .smbp-body[data-page="tasks"] .smbp-item {
        position: relative;
        overflow: visible;
        padding: 15px 16px;
        min-height: 116px;
        border-radius: 16px;
        border: 1px solid rgba(130,151,185,.18);
        background:
          radial-gradient(circle at 96% 0%, rgba(99,214,151,.08), transparent 28%),
          linear-gradient(180deg, rgba(25,29,40,.9), rgba(16,19,29,.92));
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.018);
      }
      .smbp-body[data-page="tasks"] .smbp-item:hover {
        transform: none;
        border-color: rgba(121,190,255,.22);
        background:
          radial-gradient(circle at 96% 0%, rgba(99,214,151,.12), transparent 28%),
          linear-gradient(180deg, rgba(28,33,46,.94), rgba(17,21,31,.94));
      }
      .smbp-body[data-page="tasks"] .smbp-item::before {
        content: "";
        position: absolute;
        left: 0;
        top: 14px;
        bottom: 14px;
        width: 3px;
        border-radius: 0 999px 999px 0;
        background: rgba(121,190,255,.45);
      }
      .smbp-body[data-page="tasks"] .smbp-item-summary {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 8px;
        min-height: 74px;
        cursor: pointer;
        background:
          radial-gradient(circle at 96% 0%, rgba(255,214,110,.1), transparent 30%),
          linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.025));
      }
      .smbp-body[data-page="tasks"] .smbp-item-summary::before {
        display: none;
      }
      .smbp-body[data-page="tasks"] .smbp-item-summary .smbp-item-head {
        display: contents;
      }
      .smbp-body[data-page="tasks"] .smbp-item-summary .smbp-summary-meta {
        grid-column: 1 / -1;
      }
      .smbp-body[data-page="tasks"] .smbp-section-accordion {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .smbp-body[data-page="tasks"] .smbp-section-accordion .smbp-item-summary {
        margin: 0;
      }
      .smbp-body[data-page="tasks"] .smbp-section-accordion:not(.smbp-section-accordion--open) .smbp-section-content {
        display: none;
      }
      .smbp-body[data-page="tasks"] .smbp-section-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-left: 14px;
        border-left: 1px solid rgba(121,190,255,.16);
      }
      .smbp-body[data-page="tasks"] .smbp-section-chevron {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        margin-left: 8px;
        color: #aab4c6;
        font-size: 13px;
        transform: rotate(0deg);
        transition: transform .16s ease;
      }
      .smbp-body[data-page="tasks"] .smbp-section-accordion--open .smbp-section-chevron {
        transform: rotate(90deg);
      }
      .smbp-body[data-page="tasks"] .smbp-item-head {
        margin-bottom: 7px;
        align-items: center;
      }
      .smbp-body[data-page="tasks"] .smbp-item-head strong {
        font-size: 16px;
        line-height: 1.25;
      }
      .smbp-body[data-page="tasks"] .smbp-item-head span.smbp-progress {
        padding: 6px 10px;
        border-color: rgba(255,255,255,.09);
        background: rgba(255,255,255,.065);
        color: #f2f6ff;
      }
      .smbp-body[data-page="tasks"] .smbp-item-meta {
        gap: 7px;
        margin-bottom: 7px;
      }
      .smbp-body[data-page="tasks"] .smbp-badge {
        padding: 5px 9px;
        border-color: rgba(255,255,255,.08);
        background: rgba(255,255,255,.055);
        color: #e9effa;
        font-size: 11px;
      }
      .smbp-body[data-page="tasks"] .smbp-item small {
        display: block;
        -webkit-line-clamp: unset;
        -webkit-box-orient: initial;
        overflow: visible;
        color: #aeb6c5;
        font-size: 13px;
      }
      .smbp-body[data-page="tasks"] .smbp-action-row {
        margin-top: 11px;
      }
      .smbp-body[data-page="tasks"] .smbp-link {
        padding: 6px 10px;
        border: 1px solid rgba(99,214,151,.18);
      }
      .smbp-body[data-page="tasks"] .smbp-section {
        margin: 3px 0 0;
        padding: 11px 13px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,.07);
        background:
          linear-gradient(90deg, rgba(121,190,255,.07), rgba(99,214,151,.035)),
          rgba(255,255,255,.02);
      }
      .smbp-body[data-page="tasks"] .smbp-section strong {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: .03em;
      }
      .smbp-body[data-page="tasks"] .smbp-section span {
        margin-top: 4px;
        color: #aab2c1;
      }
      .smbp-body[data-page="tasks"] .smbp-item--ready {
        border-color: rgba(121,190,255,.3);
        background:
          radial-gradient(circle at 96% 0%, rgba(121,190,255,.14), transparent 30%),
          linear-gradient(180deg, rgba(24,35,51,.94), rgba(17,22,34,.94));
      }
      .smbp-body[data-page="tasks"] .smbp-item--ready::before {
        background: #79beff;
      }
      .smbp-body[data-page="tasks"] .smbp-item--running {
        border-color: rgba(99,214,151,.34);
        background:
          radial-gradient(circle at 96% 0%, rgba(99,214,151,.16), transparent 30%),
          linear-gradient(180deg, rgba(22,39,34,.94), rgba(15,25,24,.94));
      }
      .smbp-body[data-page="tasks"] .smbp-item--running::before {
        background: #63d697;
      }
      .smbp-body[data-page="tasks"] .smbp-item--error::before {
        background: #ff7c8c;
      }
      .smbp-body[data-page="tasks"] .smbp-item--manual::before {
        background: #ffd66e;
      }
      @media (max-width: 760px) {
        .smbp-body[data-page="tasks"] .smbp-status,
        .smbp-body[data-page="tasks"] .smbp-buttons {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .smbp-deck-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(6,8,12,.62);
        backdrop-filter: blur(12px);
      }
      .smbp-deck-modal {
        width: min(980px, calc(100vw - 24px));
        max-height: calc(100vh - 24px);
        overflow: auto;
        border-radius: 24px;
        border: 1px solid rgba(255,255,255,.08);
        background:
          radial-gradient(circle at top right, rgba(99,214,151,.12), transparent 30%),
          radial-gradient(circle at top left, rgba(121,190,255,.12), transparent 32%),
          linear-gradient(180deg, rgba(16,17,22,.98), rgba(9,10,14,.98));
        box-shadow: 0 28px 90px rgba(0,0,0,.48);
        color: #f5f7fb;
      }
      .smbp-deck-modal-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 20px 14px;
        border-bottom: 1px solid rgba(255,255,255,.06);
      }
      .smbp-deck-modal-head strong {
        display: block;
        font-size: 20px;
        line-height: 1.15;
      }
      .smbp-deck-modal-head span {
        display: block;
        margin-top: 6px;
        color: #9ca5b3;
        font-size: 13px;
        line-height: 1.4;
      }
      .smbp-deck-modal-body {
        padding: 18px 20px 20px;
      }
      .smbp-deck-status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
        padding: 7px 11px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04);
        color: #e4ebf7;
        font-size: 12px;
        font-weight: 700;
      }
      .smbp-deck-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
      }
      .smbp-deck-card {
        position: relative;
        border-radius: 20px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,.08);
        background: linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01));
        cursor: pointer;
        transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease, opacity .16s ease;
      }
      .smbp-deck-card:hover {
        transform: translateY(-2px);
        border-color: rgba(99,214,151,.24);
      }
      .smbp-deck-card.is-selected {
        border-color: rgba(99,214,151,.52);
        box-shadow: 0 0 0 2px rgba(99,214,151,.18);
      }
      .smbp-deck-card.is-disabled {
        cursor: not-allowed;
        opacity: .56;
      }
      .smbp-deck-card img {
        display: block;
        width: 100%;
        aspect-ratio: 2 / 3;
        object-fit: cover;
        background: rgba(255,255,255,.02);
      }
      .smbp-deck-rank,
      .smbp-deck-premium {
        position: absolute;
        top: 10px;
        min-width: 36px;
        height: 28px;
        padding: 0 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .04em;
      }
      .smbp-deck-rank {
        left: 10px;
        background: rgba(7,10,15,.72);
        border: 1px solid rgba(255,255,255,.08);
        color: #fff1be;
      }
      .smbp-deck-premium {
        right: 10px;
        background: rgba(121,190,255,.92);
        color: #0b1730;
      }
      .smbp-deck-copy {
        padding: 11px 12px 13px;
      }
      .smbp-deck-copy strong {
        display: block;
        font-size: 13px;
        line-height: 1.2;
      }
      .smbp-deck-copy span {
        display: block;
        margin-top: 5px;
        color: #9ca5b3;
        font-size: 12px;
        line-height: 1.35;
        min-height: 32px;
      }
      .smbp-deck-copy small {
        display: block;
        margin-top: 8px;
        color: #d8dfeb;
        font-size: 11px;
        line-height: 1.3;
      }
      .smbp-deck-actions {
        display: flex;
        gap: 10px;
        margin-top: 18px;
      }
      .smbp-deck-actions .smbp-btn {
        min-height: 42px;
      }
      .smbp-upgrade-tabs {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 14px;
      }
      .smbp-upgrade-tab {
        min-height: 42px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.035);
        color: #dfe6f2;
        font: 800 12px/1 "Segoe UI", system-ui, sans-serif;
        cursor: pointer;
      }
      .smbp-upgrade-tab.is-active {
        border-color: rgba(99,214,151,.42);
        background: rgba(99,214,151,.12);
        color: #ecfff2;
      }
      .smbp-upgrade-ranks {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-bottom: 14px;
      }
      .smbp-upgrade-rank-pill {
        padding: 6px 9px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.035);
        color: #dce4f2;
        font-size: 12px;
        font-weight: 800;
      }
      .smbp-upgrade-helper {
        margin: 0 0 12px;
        color: #aeb7c5;
        font-size: 12px;
        line-height: 1.4;
      }
      .smbp-upgrade-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .smbp-upgrade-option {
        min-width: 0;
        min-height: 96px;
        padding: 12px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,.08);
        background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.018));
        color: #f4f7fc;
        text-align: left;
        cursor: pointer;
      }
      .smbp-upgrade-option:hover {
        border-color: rgba(99,214,151,.25);
      }
      .smbp-upgrade-option.is-selected {
        border-color: rgba(99,214,151,.52);
        box-shadow: 0 0 0 2px rgba(99,214,151,.16);
      }
      .smbp-upgrade-option.is-disabled {
        opacity: .55;
        cursor: not-allowed;
      }
      .smbp-upgrade-option strong,
      .smbp-upgrade-result strong {
        display: block;
        font-size: 13px;
        line-height: 1.25;
      }
      .smbp-upgrade-option span,
      .smbp-upgrade-result span {
        display: block;
        margin-top: 6px;
        color: #aab3c1;
        font-size: 12px;
        line-height: 1.35;
      }
      .smbp-upgrade-cards {
        display: flex;
        gap: 6px;
        margin-top: 10px;
      }
      .smbp-upgrade-cards img,
      .smbp-upgrade-result img {
        width: 42px;
        aspect-ratio: 2 / 3;
        border-radius: 6px;
        object-fit: cover;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.03);
      }
      .smbp-upgrade-result {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 18px 14px;
        border-radius: 16px;
        border: 1px solid rgba(99,214,151,.18);
        background: rgba(99,214,151,.06);
        text-align: center;
      }
      .smbp-upgrade-result img {
        width: 150px;
        max-width: min(48vw, 170px);
        border-radius: 10px;
      }
      .smbp-upgrade-result-info {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        max-width: 360px;
      }
      @media (max-width: 860px) {
        .smbp-deck-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .smbp-upgrade-list {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      @media (max-width: 560px) {
        .smbp-deck-overlay {
          padding: 10px;
        }
        .smbp-deck-modal {
          width: calc(100vw - 20px);
          max-height: calc(100vh - 20px);
        }
        .smbp-deck-grid {
          grid-template-columns: minmax(0, 1fr);
        }
        .smbp-upgrade-tabs {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .smbp-item-summary {
        background: linear-gradient(180deg, rgba(255,255,255,.022), rgba(255,255,255,.012));
      }
      .smbp-snapshot {
        position: relative;
        display: block;
        width: 100%;
        padding: 38px 12px 12px;
        border-radius: 14px;
        border-color: rgba(121,190,255,.34);
        background:
          radial-gradient(circle at 10% 0%, rgba(121,190,255,.18), transparent 30%),
          radial-gradient(circle at 58% -10%, rgba(255,214,110,.12), transparent 26%),
          radial-gradient(circle at 96% 0%, rgba(99,214,151,.14), transparent 30%),
          linear-gradient(180deg, rgba(20,27,40,.94), rgba(17,21,31,.92));
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.045),
          0 12px 34px rgba(0,0,0,.18);
      }
      .smbp-snapshot::before {
        content: 'Аккаунт и прогресс';
        position: absolute;
        left: 13px;
        top: 11px;
        color: #f5f8ff;
        font-size: 13px;
        font-weight: 900;
        line-height: 1;
      }
      .smbp-snapshot::after {
        content: 'Live';
        position: absolute;
        right: 12px;
        top: 8px;
        padding: 5px 8px;
        border-radius: 999px;
        border: 1px solid rgba(99,214,151,.24);
        background: rgba(99,214,151,.1);
        color: #aaf0c3;
        font-size: 10px;
        font-weight: 900;
        line-height: 1;
        text-transform: uppercase;
      }
      .smbp-item-summary,
      .smbp-snapshot {
        transition: none;
      }
      .smbp-item-summary:hover {
        border-color: rgba(255,255,255,.05);
        background: linear-gradient(180deg, rgba(255,255,255,.022), rgba(255,255,255,.012));
        transform: none;
      }
      .smbp-snapshot:hover {
        border-color: rgba(121,190,255,.34);
        background:
          radial-gradient(circle at 10% 0%, rgba(121,190,255,.18), transparent 30%),
          radial-gradient(circle at 58% -10%, rgba(255,214,110,.12), transparent 26%),
          radial-gradient(circle at 96% 0%, rgba(99,214,151,.14), transparent 30%),
          linear-gradient(180deg, rgba(20,27,40,.94), rgba(17,21,31,.92));
        transform: none;
      }
      .smbp-snapshot-grid {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 9px;
      }
      .smbp-snapshot-cell {
        position: relative;
        grid-column: span 1;
        min-width: 0;
        min-height: 86px;
        padding: 11px 12px 10px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,.065);
        background: rgba(255,255,255,.035);
        overflow: hidden;
      }
      .smbp-snapshot-cell--primary,
      .smbp-snapshot-cell--pass {
        grid-column: span 2;
        min-height: 92px;
        background:
          linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.032));
        border-color: rgba(255,255,255,.09);
      }
      .smbp-snapshot-cell--pass {
        border-color: rgba(255,214,110,.18);
      }
      .smbp-snapshot-cell::before {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 3px;
        background: var(--smbp-accent, #79beff);
        opacity: .95;
      }
      .smbp-snapshot-cell:nth-child(1) { --smbp-accent: #79beff; }
      .smbp-snapshot-cell:nth-child(2) { --smbp-accent: #a6d67b; }
      .smbp-snapshot-cell:nth-child(3) { --smbp-accent: #ffd66e; }
      .smbp-snapshot-cell:nth-child(4) { --smbp-accent: #63d697; }
      .smbp-snapshot-cell:nth-child(5) { --smbp-accent: #c9a7ff; }
      .smbp-snapshot-cell::after {
        content: '';
        position: absolute;
        right: -22px;
        top: -26px;
        width: 66px;
        height: 66px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--smbp-accent, #79beff) 18%, transparent);
        opacity: .55;
        pointer-events: none;
      }
      .smbp-snapshot-cell--primary::after,
      .smbp-snapshot-cell--pass::after {
        width: 92px;
        height: 92px;
        right: -34px;
        top: -42px;
        opacity: .7;
      }
      .smbp-snapshot-cell span {
        position: relative;
        z-index: 1;
        display: block;
        color: #aab2c2;
        font-size: 10px;
        line-height: 1.2;
        text-transform: uppercase;
        font-weight: 800;
      }
      .smbp-snapshot-cell strong {
        position: relative;
        z-index: 1;
        display: block;
        margin-top: 4px;
        color: #f6f8fc;
        font-size: 13px;
        line-height: 1.25;
        overflow-wrap: anywhere;
      }
      .smbp-snapshot-cell--primary strong,
      .smbp-snapshot-cell--pass strong {
        margin-top: 5px;
        font-size: 17px;
        letter-spacing: .01em;
      }
      .smbp-snapshot-cell small {
        position: relative;
        z-index: 1;
        display: block;
        margin-top: 4px;
        color: #a5adbb;
        font-size: 11px;
        line-height: 1.25;
        overflow-wrap: anywhere;
      }
      @media (max-width: 760px) {
        .smbp-snapshot-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .smbp-snapshot {
          width: 100%;
          padding-top: 42px;
        }
        .smbp-snapshot-cell--primary,
        .smbp-snapshot-cell--pass {
          grid-column: span 2;
        }
      }
      .smbp-item--ready {
        border-color: rgba(121,190,255,.2);
        background: linear-gradient(180deg, rgba(121,190,255,.08), rgba(255,255,255,.02));
      }
      .smbp-item--running {
        border-color: rgba(99,214,151,.26);
        background: linear-gradient(180deg, rgba(99,214,151,.1), rgba(255,255,255,.025));
      }
      .smbp-item--error {
        border-color: rgba(255,120,140,.26);
        background: linear-gradient(180deg, rgba(255,120,140,.08), rgba(255,255,255,.02));
      }
      .smbp-item--manual {
        border-color: rgba(255,210,113,.18);
        background: linear-gradient(180deg, rgba(255,210,113,.07), rgba(255,255,255,.018));
      }
      .smbp-section {
        margin: 10px 0 6px;
        padding: 0 2px;
      }
      .smbp-section strong {
        display: block;
        color: #f6f8fc;
        font-size: 12px;
      }
      .smbp-section span {
        display: block;
        margin-top: 2px;
        color: #99a1af;
        font-size: 11px;
        line-height: 1.3;
      }
      .smbp-summary-meta {
        color: #a8aebb;
        font-size: 11px;
        line-height: 1.3;
      }
      .smbp-link {
        display: inline-flex;
        align-items: center;
        margin-top: 7px;
        padding: 4px 9px;
        border-radius: 999px;
        background: rgba(99,214,151,.1);
        border: 1px solid rgba(99,214,151,.16);
        color: #72df9f;
        text-decoration: none;
        cursor: pointer;
        font-size: 11px;
        font-weight: 700;
        transition: background .16s ease, border-color .16s ease, color .16s ease;
      }
      .smbp-link:hover {
        background: rgba(99,214,151,.16);
        border-color: rgba(99,214,151,.26);
        color: #94ebba;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function getShellNavigationItems() {
    return [
      {
        section: 'Battlepass',
        items: [
          { key: 'overview', label: 'Overview', description: 'Аккаунт и прогресс', icon: 'OV' },
          { key: 'tasks', label: 'Tasks', description: 'Задачи и прогресс', icon: 'BP' },
          { key: 'rewards', label: 'Rewards', description: 'Награды и уровни', icon: 'RW' }
        ]
      },
      {
        section: 'Service',
        items: [
          { key: 'settings', label: 'Settings', description: 'Настройки SailorM', icon: 'ST' }
        ]
      }
    ];
  }

  function getDefaultShellView() {
    if (isUserSettingsPage() || isShellSettingsView()) return 'settings';
    if (isOverviewPage()) return 'overview';
    if (isTasksPage()) return 'tasks';
    if (isRewardsPage()) return 'rewards';
    return '';
  }

  function getActiveShellView() {
    return activeShellView || getDefaultShellView();
  }

  function getShellViewLabel(view) {
    if (view === 'overview') return 'Overview';
    if (view === 'tasks') return 'Tasks';
    if (view === 'rewards') return 'Rewards';
    if (view === 'settings') return 'Settings';
    if (view) return view[0].toUpperCase() + view.slice(1);
    return 'SailorM';
  }

  function getShellViewSubtitle(view) {
    if (view === 'overview') return 'Аккаунт, опыт и награды';
    if (view === 'tasks') return 'Автоматизация задач Battlepass';
    if (view === 'rewards') return 'Награды и уровни Battlepass';
    if (view === 'settings') return 'Настройки SailorM';
    return 'Автоматизация задач и мини-игр ReManga';
  }

  function syncShellNavigation(panel) {
    const nav = panel?.querySelector('[data-role="shell-nav"]');
    if (!nav) return;
    const activeKey = getActiveShellView();
    const groups = getShellNavigationItems();
    nav.innerHTML = groups.map(group => `
      <div class="smbp-nav-group">
        <span class="smbp-nav-label">${group.section}</span>
        ${group.items.map(item => `
          <button
            class="smbp-nav-link${item.key === activeKey ? ' is-active' : ''}"
            type="button"
            data-shell-view="${item.key}"
          >
            <span class="smbp-nav-icon">${item.icon}</span>
            <span class="smbp-nav-copy">
              <strong>${item.label}</strong>
              <span>${item.description}</span>
            </span>
          </button>
        `).join('')}
      </div>
    `).join('');
  }

  function navigateShellView(view) {
    if (!view || getActiveShellView() === view) return;
    activeShellView = view;
    currentRouteKey = '';
    scheduleInit();
  }

  function createShell(pageLabel) {
    injectStyles();

    const clampPanelPosition = (nextLeft, nextTop, targetPanel) => {
      const panelNode = targetPanel || document.getElementById('smbp-panel');
      if (!panelNode) return { left: nextLeft, top: nextTop };
      const margin = 8;
      const rect = panelNode.getBoundingClientRect();
      const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
      const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
      return {
        left: Math.min(Math.max(margin, nextLeft), maxLeft),
        top: Math.min(Math.max(margin, nextTop), maxTop)
      };
    };

    const installShellDragging = targetPanel => {
      if (!targetPanel || targetPanel.dataset.dragInstalled === '1') return;
      targetPanel.dataset.dragInstalled = '1';

      let dragState = null;

      const stopDragging = () => {
        if (!dragState) return;
        targetPanel.classList.remove('smbp-dragging');
        dragState = null;
      };

      const onPointerMove = event => {
        if (!dragState) return;
        const nextLeft = dragState.startLeft + (event.clientX - dragState.startX);
        const nextTop = dragState.startTop + (event.clientY - dragState.startY);
        const position = clampPanelPosition(nextLeft, nextTop, targetPanel);
        targetPanel.style.left = `${position.left}px`;
        targetPanel.style.top = `${position.top}px`;
        targetPanel.style.transform = 'none';
      };

      const onPointerUp = () => stopDragging();

      const onPointerDown = event => {
        const handle = event.target.closest('[data-drag-handle]');
        if (!handle || !targetPanel.contains(handle)) return;
        if (event.button !== 0) return;
        if (event.target.closest('button, a, input, textarea, select, label')) return;

        const rect = targetPanel.getBoundingClientRect();
        const position = clampPanelPosition(rect.left, rect.top, targetPanel);
        targetPanel.style.left = `${position.left}px`;
        targetPanel.style.top = `${position.top}px`;
        targetPanel.style.transform = 'none';
        targetPanel.classList.add('smbp-dragging');
        dragState = {
          startX: event.clientX,
          startY: event.clientY,
          startLeft: position.left,
          startTop: position.top
        };
        event.preventDefault();
      };

      targetPanel.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove, true);
      window.addEventListener('pointerup', onPointerUp, true);
      window.addEventListener('pointercancel', onPointerUp, true);
      window.addEventListener('blur', onPointerUp, true);
      window.addEventListener('resize', () => {
        if (targetPanel.classList.contains('smbp-hidden')) return;
        if (targetPanel.style.transform === 'none' && targetPanel.style.left && targetPanel.style.top) {
          const currentLeft = Number.parseFloat(targetPanel.style.left) || 0;
          const currentTop = Number.parseFloat(targetPanel.style.top) || 0;
          const position = clampPanelPosition(currentLeft, currentTop, targetPanel);
          targetPanel.style.left = `${position.left}px`;
          targetPanel.style.top = `${position.top}px`;
        }
      });
    };

    const installShellScrollIsolation = targetPanel => {
      if (!targetPanel || targetPanel.dataset.scrollIsolationInstalled === '1') return;
      targetPanel.dataset.scrollIsolationInstalled = '1';

      const findScrollableAncestor = startNode => {
        let node = startNode?.nodeType === Node.ELEMENT_NODE ? startNode : startNode?.parentElement;
        while (node && node !== targetPanel) {
          const style = window.getComputedStyle(node);
          const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY)
            && node.scrollHeight > node.clientHeight + 1;
          if (canScrollY) return node;
          node = node.parentElement;
        }

        const panelStyle = window.getComputedStyle(targetPanel);
        return /(auto|scroll|overlay)/.test(panelStyle.overflowY)
          && targetPanel.scrollHeight > targetPanel.clientHeight + 1
          ? targetPanel
          : null;
      };

      const onWheel = event => {
        if (targetPanel.classList.contains('smbp-hidden')) return;
        if (!targetPanel.contains(event.target)) return;

        const scroller = findScrollableAncestor(event.target);
        event.stopPropagation();

        if (!scroller) {
          event.preventDefault();
          return;
        }

        const deltaY = event.deltaY || 0;
        const atTop = scroller.scrollTop <= 0;
        const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
        if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
          event.preventDefault();
        }
      };

      targetPanel.addEventListener('wheel', onWheel, { passive: false, capture: true });
    };

    let fab = document.getElementById('smbp-fab');
    let panel = document.getElementById('smbp-panel');
    if (fab && panel) {
      panel.querySelector('.smbp-title span').textContent = pageLabel;
      panel.querySelector('[data-role="page-title"]').textContent = pageLabel;
      panel.querySelector('[data-role="page-subtitle"]').textContent = getShellViewSubtitle(getActiveShellView());
      syncShellNavigation(panel);
      installShellDragging(panel);
      installShellScrollIsolation(panel);
      return { fab, panel };
    }

    fab = document.createElement('button');
    fab.id = 'smbp-fab';
    fab.type = 'button';
    fab.textContent = 'SM';

    panel = document.createElement('section');
    panel.id = 'smbp-panel';
    panel.className = 'smbp-hidden';
    panel.innerHTML = `
      <div class="smbp-shell">
        <aside class="smbp-sidebar">
          <div class="smbp-head" data-drag-handle="1">
            <div class="smbp-logo">SM</div>
            <div class="smbp-title">
              <strong>SailorM Battlepass</strong>
              <span>${pageLabel}</span>
            </div>
            <button class="smbp-close" type="button">${t.close}</button>
          </div>
          <nav class="smbp-nav" data-role="shell-nav"></nav>
        </aside>
        <main class="smbp-main">
          <div class="smbp-main-head" data-drag-handle="1">
            <div>
              <strong data-role="page-title">${pageLabel}</strong>
              <span data-role="page-subtitle">${getShellViewSubtitle(getActiveShellView())}</span>
            </div>
            <div class="smbp-badge-head">SMBP</div>
          </div>
          <div class="smbp-body"></div>
        </main>
      </div>
    `;

    fab.addEventListener('click', () => panel.classList.toggle('smbp-hidden'));
    panel.querySelector('.smbp-close').addEventListener('click', () => panel.classList.add('smbp-hidden'));
    panel.addEventListener('click', event => {
      const trigger = event.target.closest('[data-shell-view]');
      if (!trigger) return;
      event.preventDefault();
      const view = String(trigger.dataset.shellView || '');
      if (!view) return;
      navigateShellView(view);
    });
    syncShellNavigation(panel);
    installShellDragging(panel);
    installShellScrollIsolation(panel);
    document.documentElement.appendChild(fab);
    document.documentElement.appendChild(panel);
    return { fab, panel };
  }

  function removeShell() {
    activeTasksPageCleanup?.();
    activeTasksPageCleanup = null;
    document.getElementById('smbp-fab')?.remove();
    document.getElementById('smbp-panel')?.remove();
  }

  function removeLegacyInlineButtons() {
    document.querySelectorAll('.smbp-inline-run-btn, [data-smbp-inline-run]').forEach(node => {
      const host = node.closest('[data-smbp-inline-run-host]');
      if (host) {
        host.remove();
        return;
      }
      node.remove();
    });
  }

  function getInlineButtonDefaults() {
    return {
      inlineTaskButtonsEnabled: true,
      inlineTaskButtonText: 'Выполнить',
      inlineTaskButtonRunningText: 'Выполняется...',
      inlineTaskButtonDoneText: 'Готово',
      inlineTaskButtonErrorText: 'Ошибка',
      inlineTaskButtonColor: '#166c46'
    };
  }

  function getAutomationDefaults() {
    return {
      deckTaskPreferredDeckIds: '10',
      commentTaskText: 'Спасибо за главу!',
      commentReplyTaskText: 'Спасибо за ответ!'
    };
  }

  function normalizeInlineSettings(settings = {}) {
    const defaults = getInlineButtonDefaults();
    const normalizeHex = value => /^#[0-9a-fA-F]{6}$/.test(String(value || '').trim()) ? String(value).trim() : defaults.inlineTaskButtonColor;
    return {
      inlineTaskButtonsEnabled: settings.inlineTaskButtonsEnabled !== false,
      inlineTaskButtonText: String(settings.inlineTaskButtonText || defaults.inlineTaskButtonText).trim() || defaults.inlineTaskButtonText,
      inlineTaskButtonRunningText: String(settings.inlineTaskButtonRunningText || defaults.inlineTaskButtonRunningText).trim() || defaults.inlineTaskButtonRunningText,
      inlineTaskButtonDoneText: String(settings.inlineTaskButtonDoneText || defaults.inlineTaskButtonDoneText).trim() || defaults.inlineTaskButtonDoneText,
      inlineTaskButtonErrorText: String(settings.inlineTaskButtonErrorText || defaults.inlineTaskButtonErrorText).trim() || defaults.inlineTaskButtonErrorText,
      inlineTaskButtonColor: normalizeHex(settings.inlineTaskButtonColor)
    };
  }

  function normalizeAutomationSettings(settings = {}) {
    const defaults = getAutomationDefaults();
    const normalizeDeckIds = value => {
      const source = String(value || defaults.deckTaskPreferredDeckIds);
      const deckUrlIds = [...source.matchAll(/(?:^|\/)deck\/(\d+)(?:\/open)?(?:[/?#]|$)/gi)]
        .map(match => match[1])
        .filter(Boolean);
      const rawIds = [
        ...deckUrlIds,
        ...source.split(/[,\s;]+/)
      ];
      return rawIds
        .map(value => value.trim())
        .filter(Boolean)
        .filter(value => Number.isInteger(Number(value)) && Number(value) > 0)
        .filter((value, index, list) => list.indexOf(value) === index)
        .join(', ') || defaults.deckTaskPreferredDeckIds;
    };
    return {
      deckTaskPreferredDeckIds: normalizeDeckIds(settings.deckTaskPreferredDeckIds),
      commentTaskText: String(settings.commentTaskText || defaults.commentTaskText).trim() || defaults.commentTaskText,
      commentReplyTaskText: String(settings.commentReplyTaskText || defaults.commentReplyTaskText).trim() || defaults.commentReplyTaskText
    };
  }

  function normalizeTitleBlacklist(rawBlacklist = {}) {
    const source = rawBlacklist && typeof rawBlacklist === 'object' ? rawBlacklist : {};
    const next = {};
    for (const [scope, list] of Object.entries(source)) {
      if (!Array.isArray(list)) continue;
      const normalizedScope = String(scope || 'global').trim() || 'global';
      const entries = [];
      for (const item of list) {
        const dir = String(item?.dir || item || '').trim();
        if (!dir) continue;
        entries.push({
          dir,
          reason: String(item?.reason || 'manual').trim() || 'manual',
          at: item?.at || new Date().toISOString()
        });
      }
      if (entries.length) next[normalizedScope] = entries;
    }
    return next;
  }

  function formatTitleBlacklist(rawBlacklist = {}) {
    const blacklist = normalizeTitleBlacklist(rawBlacklist);
    const lines = [];
    for (const [scope, list] of Object.entries(blacklist)) {
      for (const item of list) {
        lines.push(`${scope}:${item.dir}:${item.reason || 'manual'}`);
      }
    }
    return lines.join('\n');
  }

  function parseTitleBlacklist(value) {
    const blacklist = {};
    const seen = new Set();
    for (const line of String(value || '').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(':').map(part => part.trim()).filter(Boolean);
      const hasScope = parts.length >= 2;
      const scope = hasScope ? parts[0] : 'global';
      const dir = hasScope ? parts[1] : parts[0];
      const reason = parts.slice(hasScope ? 2 : 1).join(':') || 'manual';
      if (!dir) continue;
      const key = `${scope}:${dir}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!blacklist[scope]) blacklist[scope] = [];
      blacklist[scope].push({ dir, reason, at: new Date().toISOString() });
    }
    return blacklist;
  }

  function normalizeSmbpSettings(settings = {}) {
    return {
      ...normalizeInlineSettings(settings),
      ...normalizeAutomationSettings(settings),
      titleBlacklist: normalizeTitleBlacklist(settings.titleBlacklist)
    };
  }

  function removeSettingsEntry() {
    document.getElementById('smbp-settings-entry')?.remove();
    document.getElementById('smbp-settings-page')?.remove();
  }

  function textOf(node) {
    return String(node?.textContent || node?.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function findSettingsAnchorCard() {
    const links = [...document.querySelectorAll('a')];
    const blockLink = links.find(node => textOf(node).includes('Блокировки'));
    if (!blockLink) return null;
    const parent = blockLink.parentElement;
    if (!parent) return null;

    return {
      anchor: blockLink,
      parent,
      before: blockLink.nextElementSibling
    };
  }

  function findSettingsLayout() {
    const profileLink = [...document.querySelectorAll('a')]
      .find(node => textOf(node).includes('Профиль'));
    if (!profileLink) return null;
    const leftList = profileLink.parentElement;
    const leftColumn = leftList?.parentElement?.parentElement || null;
    const grid = leftColumn?.parentElement || null;
    if (!leftList || !leftColumn || !grid) return null;
    const rightPane = [...grid.children].find(node => node !== leftColumn) || null;
    if (!rightPane) return null;
    return { leftList, leftColumn, grid, rightPane };
  }

  function restoreSettingsContent(rightPane) {
    [...rightPane.children].forEach(child => {
      if (child.id === 'smbp-settings-page') return;
      child.style.display = '';
    });
    rightPane.querySelector('#smbp-settings-page')?.remove();
  }

  function buildSettingsPage(settings) {
    const page = document.createElement('section');
    page.id = 'smbp-settings-page';
    page.className = 'smbp-settings-page';
    page.innerHTML = `
      <div class="smbp-settings-page-head">
        <strong>${t.settingsDialogTitle}</strong>
        <span>${t.settingsDialogDesc}</span>
      </div>
      <div class="smbp-settings-grid">
        <div class="smbp-settings-card">
          <label>${t.settingsDeckIds}</label>
          <input data-role="deckIds" type="text" maxlength="80" value="${escapeHtml(settings.deckTaskPreferredDeckIds)}">
          <small>${t.settingsDeckIdsDesc}</small>
          <button class="smbp-btn smbp-btn-secondary" data-action="testDeck" type="button">${t.settingsDeckTest}</button>
        </div>
        <div class="smbp-settings-card">
          <label>${t.settingsCommentText}</label>
          <textarea data-role="commentText" maxlength="240">${escapeHtml(settings.commentTaskText)}</textarea>
          <small>${t.settingsCommentTextDesc}</small>
        </div>
        <div class="smbp-settings-card">
          <label>${t.settingsReplyText}</label>
          <textarea data-role="replyText" maxlength="240">${escapeHtml(settings.commentReplyTaskText)}</textarea>
          <small>${t.settingsReplyTextDesc}</small>
        </div>
        <div class="smbp-settings-card">
          <label>${t.settingsBlacklist}</label>
          <textarea data-role="titleBlacklist" spellcheck="false">${escapeHtml(formatTitleBlacklist(settings.titleBlacklist))}</textarea>
          <small>${t.settingsBlacklistDesc}</small>
          <input data-role="blacklistAdd" type="text" maxlength="120" placeholder="${escapeHtml(t.settingsBlacklistPlaceholder)}">
          <button class="smbp-btn smbp-btn-secondary" data-action="addBlacklist" type="button">${t.settingsBlacklistAdd}</button>
        </div>
        <div class="smbp-settings-actions">
          <button class="smbp-btn smbp-btn-primary" data-action="save" type="button">${t.settingsSave}</button>
          <button class="smbp-btn smbp-btn-secondary" data-action="reset" type="button">${t.settingsReset}</button>
        </div>
        <div class="smbp-settings-status" data-role="status"></div>
      </div>
    `;
    return page;
  }

  function attachSettingsPageBehavior(page, initialSettings, rerender) {
    const getValue = role => page.querySelector(`[data-role="${role}"]`);
    const status = getValue('status');
    const readSettings = () => normalizeSmbpSettings({
      deckTaskPreferredDeckIds: getValue('deckIds').value,
      commentTaskText: getValue('commentText').value,
      commentReplyTaskText: getValue('replyText').value,
      titleBlacklist: parseTitleBlacklist(getValue('titleBlacklist')?.value || '')
    });

    page.addEventListener('click', async event => {
      const action = event.target.closest('[data-action]')?.getAttribute('data-action');
      if (!action) return;

      event.preventDefault();
      event.stopPropagation();

      if (action === 'save') {
        const nextSettings = readSettings();
        await smb.saveSettings(nextSettings);
        status.textContent = t.settingsSaved;
        return;
      }
      if (action === 'addBlacklist') {
        const input = getValue('blacklistAdd');
        const list = getValue('titleBlacklist');
        const value = String(input?.value || '').trim();
        if (!value || !list) return;
        list.value = [list.value.trim(), value].filter(Boolean).join('\n');
        input.value = '';
        status.textContent = '';
        return;
      }
      if (action === 'testDeck') {
        const button = event.target.closest('button');
        button.disabled = true;
        button.style.opacity = '0.65';
        status.textContent = t.settingsDeckTestRunning;
        try {
          const result = await smb.tasks.openConfiguredDeck(getValue('deckIds').value, message => {
            status.textContent = message;
          });
          status.textContent = t.settingsDeckTestDone(result);
        } catch (error) {
          status.textContent = t.taskFailed(error.message || error);
        } finally {
          button.disabled = false;
          button.style.opacity = '';
        }
        return;
      }
      if (action === 'reset') {
        await smb.saveSettings({
          ...getAutomationDefaults(),
          titleBlacklist: {}
        });
        if (typeof rerender === 'function') await rerender();
      }
    }, true);

    for (const role of ['deckIds', 'commentText', 'replyText', 'titleBlacklist', 'blacklistAdd']) {
      const field = getValue(role);
      if (!field) continue;
      field.addEventListener('input', () => {
        status.textContent = '';
      });
      field.addEventListener('change', () => {
        status.textContent = '';
      });
    }
  }

  async function renderSettingsPage() {
    const layout = findSettingsLayout();
    if (!layout?.rightPane) return;
    const initialSettings = normalizeSmbpSettings(await smb.loadSettings());
    restoreSettingsContent(layout.rightPane);
    [...layout.rightPane.children].forEach(child => {
      if (child.id !== 'smbp-settings-page') child.style.display = 'none';
    });

    const page = buildSettingsPage(initialSettings);
    layout.rightPane.appendChild(page);
    attachSettingsPageBehavior(page, initialSettings, () => renderSettingsPage());
  }

  async function renderShellSettingsPage(container) {
    if (!container) return;
    const initialSettings = normalizeSmbpSettings(await smb.loadSettings());
    container.innerHTML = '';
    const page = buildSettingsPage(initialSettings);
    container.appendChild(page);
    attachSettingsPageBehavior(page, initialSettings, () => renderShellSettingsPage(container));
  }

  function injectSettingsEntry() {
    injectStyles();
    const placement = findSettingsAnchorCard();
    const layout = findSettingsLayout();
    if (!placement?.parent || !placement.anchor || !layout?.leftList) return;

    const settingButtons = [...layout.leftList.querySelectorAll('a button, button')];
    for (const button of settingButtons) {
      if (button.closest('#smbp-settings-entry')) continue;
      button.dataset.state = isSmbpSettingsView() ? 'inactive' : (button.dataset.state || 'inactive');
    }

    let entry = document.getElementById('smbp-settings-entry');
    if (!entry) {
      entry = placement.anchor.cloneNode(true);
      entry.id = 'smbp-settings-entry';
    }
    entry.setAttribute('href', `${SETTINGS_ROUTE}${SETTINGS_HASH}`);

    const innerButton = entry.querySelector('button') || entry;
    innerButton.setAttribute('type', 'button');
    innerButton.dataset.state = isSmbpSettingsView() ? 'active' : 'inactive';

    const textNodes = [...innerButton.querySelectorAll('p, span, div')]
      .filter(node => textOf(node) && !node.querySelector('p, span, div'));
    if (textNodes[0]) textNodes[0].textContent = t.settingsCardTitle;
    if (textNodes[1]) textNodes[1].textContent = t.settingsCardDesc;

    const firstBox = innerButton.querySelector('div');
    if (firstBox) {
      firstBox.innerHTML = '<div style="width:48px;height:48px;border-radius:14px;background:#121318;display:flex;align-items:center;justify-content:center;color:#f5f7fb;font:800 18px/1 Segoe UI,system-ui,sans-serif">SM</div>';
    }

    entry.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      history.pushState({}, '', `${SETTINGS_ROUTE}${SETTINGS_HASH}`);
      injectSettingsEntry();
      renderSettingsPage().catch(error => console.error('[SMBP] settings page failed', error));
    };

    if (!layout.leftList.contains(entry)) {
      if (placement.before && placement.before.parentElement === layout.leftList) {
        layout.leftList.insertBefore(entry, placement.before);
        return;
      }
      layout.leftList.appendChild(entry);
      return;
    }
  }

  function getTaskTypeLabel(task) {
    const kind = smb.tasks.getTaskVisualKind?.(task) || 'task';
    return t.taskType[kind] || t.taskType.task;
  }

  function getTaskRewardExp(task) {
    return Math.max(0, Number(task?.reward || task?.reward_exp || task?.exp || 0) || 0);
  }

  function getMoscowDayKey(timestamp = Date.now()) {
    return new Date(Number(timestamp || Date.now()) + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  function normalizeDailyExpState(value) {
    const currentKey = getMoscowDayKey();
    if (!value || value.dateKey !== currentKey) {
      return {
        dateKey: currentKey,
        exp: 0,
        claimedTaskIds: []
      };
    }
    return {
      dateKey: currentKey,
      exp: Math.max(0, Number(value.exp || 0) || 0),
      claimedTaskIds: Array.isArray(value.claimedTaskIds) ? value.claimedTaskIds.map(String) : []
    };
  }

  async function loadDailyTaskExpState() {
    const storage = globalThis.chrome?.storage?.local;
    if (!storage) return normalizeDailyExpState(null);
    return new Promise(resolve => {
      storage.get([DAILY_TASK_EXP_STORE_KEY], data => {
        resolve(normalizeDailyExpState(data?.[DAILY_TASK_EXP_STORE_KEY]));
      });
    });
  }

  async function saveDailyTaskExpState(state) {
    const normalized = normalizeDailyExpState(state);
    const storage = globalThis.chrome?.storage?.local;
    if (!storage) return normalized;
    return new Promise(resolve => {
      storage.set({ [DAILY_TASK_EXP_STORE_KEY]: normalized }, () => resolve(normalized));
    });
  }

  async function recordDailyTaskExp(tasks = []) {
    const entries = (Array.isArray(tasks) ? tasks : [tasks]).filter(Boolean);
    if (!entries.length) return loadDailyTaskExpState();
    const state = await loadDailyTaskExpState();
    const seen = new Set(state.claimedTaskIds.map(String));
    let exp = Number(state.exp || 0) || 0;

    for (const task of entries) {
      const id = String(task?.id || '');
      const reward = getTaskRewardExp(task);
      if (!id || seen.has(id) || reward <= 0) continue;
      seen.add(id);
      exp += reward;
    }

    return saveDailyTaskExpState({
      dateKey: state.dateKey,
      exp,
      claimedTaskIds: Array.from(seen)
    });
  }

  function getTaskActionLabel(task) {
    return smb.tasks.isWorldTravelTask(task)
      ? t.runNewTitles
      : smb.tasks.isChapterReadTask(task)
        ? t.readViaApi
        : smb.tasks.isLikeTask(task)
          ? t.likeViaApi
          : smb.tasks.isExpertRatingTask(task)
            ? t.rateViaApi
            : smb.tasks.isCommentReplyTask(task)
              ? t.replyAndDelete
              : smb.tasks.isOpinionRatingTask(task)
                ? t.rateOpinion
                : smb.tasks.isAutonomousMemoryTask(task)
                  ? t.runHidden
                  : smb.tasks.isDirectGameTask(task)
                    ? t.runViaApi
                    : smb.tasks.isCommentTask(task)
                      ? t.writeAndDelete
                      : smb.tasks.isSimilarTask(task)
                        ? t.voteSimilar
                        : smb.tasks.isPersonalProfileTask(task) || smb.tasks.isProfileTask(task)
                          ? t.visitProfile
                          : smb.tasks.isFriendRequestTask(task)
                            ? t.sendFriendRequest
                            : smb.tasks.isGuildJoinTask(task)
                              ? t.sendGuildRequests
                              : smb.tasks.isExchangeTask(task)
                                ? t.sendExchange
                                : smb.tasks.isCardUpgradeTask(task)
                                  ? 'Апгрейд карт'
                                  : smb.tasks.isDeckCardTask(task)
                                    ? t.openDeck
                                    : smb.tasks.isInventoryTask(task)
                                      ? t.useInventory
                                      : smb.tasks.isShopPurchaseTask(task)
                                        ? 'Купить предмет'
                                        : smb.tasks.isTicketSpendTask(task)
                                          ? t.spendTicket
                                          : t.runViaCatalog;
  }

  function setTaskState(node, state) {
    node.classList.remove('smbp-item--ready', 'smbp-item--running', 'smbp-item--error', 'smbp-item--manual');
    if (state === 'ready') node.classList.add('smbp-item--ready');
    if (state === 'running') node.classList.add('smbp-item--running');
    if (state === 'error') node.classList.add('smbp-item--error');
    if (state === 'manual') node.classList.add('smbp-item--manual');
  }

  function createSectionHeader(title, description) {
    const header = document.createElement('div');
    header.className = 'smbp-section';
    header.innerHTML = `<strong>${title}</strong><span>${description}</span>`;
    return header;
  }

  function formatRelatedTaskSummary(tasks = []) {
    const changedTasks = tasks.filter(task => task && task.changed);
    const source = changedTasks.length ? changedTasks : tasks;
    return source
      .map(task => `${task.current ? '[выбрана] ' : ''}${task.name}: ${task.progress}/${task.goal}`)
      .join(' | ');
  }

  function isInlineRunnableTask(task) {
    return (
      smb.tasks.isAutoSearchTask(task) ||
      smb.tasks.isWorldTravelTask(task) ||
      smb.tasks.isChapterReadTask(task) ||
      smb.tasks.isLikeTask(task) ||
      smb.tasks.isExpertRatingTask(task) ||
      smb.tasks.isCommentReplyTask(task) ||
      smb.tasks.isOpinionRatingTask(task) ||
      smb.tasks.isAutonomousMemoryTask(task) ||
      smb.tasks.isDirectGameTask(task) ||
      smb.tasks.isCommentTask(task) ||
      smb.tasks.isSimilarTask(task) ||
      smb.tasks.isPersonalProfileTask(task) ||
      smb.tasks.isProfileTask(task) ||
      smb.tasks.isFriendRequestTask(task) ||
      smb.tasks.isExchangeTask(task) ||
      smb.tasks.isCardUpgradeTask(task) ||
      smb.tasks.isDeckCardTask(task) ||
      smb.tasks.isInventoryTask(task) ||
      smb.tasks.isShopPurchaseTask(task) ||
      smb.tasks.isTicketSpendTask(task)
    );
  }

  function getAutomationTaskPriority(task) {
    if (smb.tasks.isWorldTravelTask(task)) return 10;
    if (smb.tasks.isAutoSearchTask(task)) return 20;
    if (smb.tasks.isChapterReadTask(task)) return 30;
    if (smb.tasks.isExpertRatingTask(task)) return 40;
    if (smb.tasks.isLikeTask(task)) return 50;
    if (smb.tasks.isCardUpgradeTask(task)) return 80;
    if (smb.tasks.isShopPurchaseTask(task)) return 90;
    if (smb.tasks.isTicketSpendTask(task)) return 95;
    return 100;
  }

  function isRunnableAutomationTask(task) {
    return Boolean(task) &&
      !task.claimed &&
      !smb.isTaskDone(task) &&
      (!smb.tasks.getTaskRoute(task) || smb.tasks.isDirectGameTask(task) || smb.tasks.isAutonomousMemoryTask(task)) &&
      !smb.tasks.isGuildJoinTask(task) &&
      isInlineRunnableTask(task);
  }

  function renderSummaryNodeContent(node, item) {
    const total = Math.max(0, Number(item?.total || 0));
    const done = Math.max(0, Number(item?.done || 0));
    const sectionLabels = {
      'Daily refresh': 'Ежедневные задания',
      Daily: 'Ежедневные задания',
      'Weekly refresh': 'Еженедельные задания',
      Weekly: 'Еженедельные задания',
      Permanent: 'Постоянные задания'
    };
    const label = sectionLabels[item?.label] || item?.label || 'Задания';
    node.innerHTML = `
      <div class="smbp-item-head">
        <strong>${escapeHtml(label)}</strong>
        <span class="smbp-progress">${done}/${total}<span class="smbp-section-chevron">›</span></span>
      </div>
    `;
  }

  function createSectionAccordion(key, item, openSectionKeys) {
    const root = document.createElement('div');
    root.className = 'smbp-section-accordion';
    root.dataset.sectionRoot = key;
    if (openSectionKeys.has(key)) root.classList.add('smbp-section-accordion--open');

    const header = document.createElement('div');
    header.className = 'smbp-item smbp-item-summary';
    header.dataset.section = key;
    header.setAttribute('role', 'button');
    header.tabIndex = 0;
    renderSummaryNodeContent(header, item);

    const content = document.createElement('div');
    content.className = 'smbp-section-content';
    content.dataset.sectionContent = key;

    const toggle = () => {
      const open = !root.classList.contains('smbp-section-accordion--open');
      root.classList.toggle('smbp-section-accordion--open', open);
      if (open) openSectionKeys.add(key);
      else openSectionKeys.delete(key);
    };

    header.addEventListener('click', toggle);
    header.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      toggle();
    });

    root.appendChild(header);
    root.appendChild(content);
    return { root, content };
  }

  function getRunnableAutomationTasks(state) {
    return (state?.automatableTasks || [])
      .filter(isRunnableAutomationTask)
      .map((task, index) => ({ task, index }))
      .sort((left, right) => {
        const priorityDelta = getAutomationTaskPriority(left.task) - getAutomationTaskPriority(right.task);
        return priorityDelta || left.index - right.index;
      })
      .map(item => item.task);
  }

  function findFreshRunnableTask(state, queuedTask) {
    const freshTask = (state?.automatableTasks || []).find(task => Number(task?.id || 0) === Number(queuedTask?.id || 0)) || queuedTask;
    return isRunnableAutomationTask(freshTask) ? freshTask : null;
  }

  async function runTaskAutomation(task, progressCb) {
    const lockKey = String(task?.id || task?.event || task?.name || 'task');
    if (activeRunnerLocks.has(lockKey)) {
      throw new Error(t.duplicateRun);
    }
    activeRunnerLocks.add(lockKey);
    try {
      return smb.tasks.isWorldTravelTask(task)
        ? await smb.tasks.runWorldTravelTask(task, progressCb)
        : smb.tasks.isChapterReadTask(task)
          ? await smb.tasks.runChapterReadTask(task, progressCb)
          : smb.tasks.isLikeTask(task)
            ? await smb.tasks.runLikeTask(task, progressCb)
            : smb.tasks.isExpertRatingTask(task)
              ? await smb.tasks.runExpertRatingTask(task, progressCb)
              : smb.tasks.isCommentReplyTask(task)
                ? await smb.tasks.runCommentReplyTask(task, progressCb)
                : smb.tasks.isOpinionRatingTask(task)
                  ? await smb.tasks.runOpinionRatingTask(task, progressCb)
                  : smb.tasks.isAutonomousMemoryTask(task)
                    ? await smb.tasks.runAutonomousMemoryTask(task, progressCb)
                    : smb.tasks.isDirectGameTask(task)
                      ? await smb.tasks.runDirectGameTask(task, progressCb)
                      : smb.tasks.isCommentTask(task)
                        ? await smb.tasks.runCommentTask(task, progressCb)
                        : smb.tasks.isSimilarTask(task)
                          ? await smb.tasks.runSimilarTask(task, progressCb)
                          : smb.tasks.isPersonalProfileTask(task)
                            ? await smb.tasks.runPersonalProfileTask(task, progressCb)
                            : smb.tasks.isProfileTask(task)
                              ? await smb.tasks.runProfileTask(task, progressCb)
                              : smb.tasks.isFriendRequestTask(task)
                                ? await smb.tasks.runFriendRequestTask(task, progressCb)
                                : smb.tasks.isExchangeTask(task)
                                  ? await smb.tasks.runExchangeTask(task, progressCb)
                                  : smb.tasks.isCardUpgradeTask(task)
                                    ? await smb.tasks.runCardUpgradeTask(task, progressCb)
                                    : smb.tasks.isDeckCardTask(task)
                                      ? await smb.tasks.runNewCardsTask(task, progressCb)
                                      : smb.tasks.isInventoryTask(task)
                                        ? await smb.tasks.runInventoryTask(task, progressCb)
                                        : smb.tasks.isShopPurchaseTask(task)
                                          ? await smb.tasks.runShopPurchaseTask(task, progressCb)
                                          : smb.tasks.isTicketSpendTask(task)
                                            ? await smb.tasks.runTicketSpendTask(task, progressCb)
                                            : await smb.tasks.runSearchTask(task, progressCb);
    } finally {
      activeRunnerLocks.delete(lockKey);
    }
  }

  async function finalizeTaskResult(task, result, progressCb) {
    if (result?.after && smb.isTaskReady(result.after) && !result.claimed) {
      progressCb?.(`Забираю награду: ${task.name}`);
      await smb.claimTask(result.after.id);
      result.claimed = true;
      const claimedState = await smb.tasks.loadState();
      result.after = claimedState.tasks.find(item => item.id === result.after.id) || result.after;
    }
    return result;
  }

  function pushDryRunPlan(ui, plan) {
    if (!plan) return;
    ui.pushLog(t.dryRunTitle(plan.taskName), 'plan');
    if (plan.expectedProgress) ui.pushLog(t.dryRunExpected(plan.expectedProgress), 'plan');
    ui.pushLog(t.dryRunSelected((plan.selected || []).length), 'plan');
    if (Array.isArray(plan.filters) && plan.filters.length) {
      for (const filter of plan.filters) {
        const tags = (filter.tags || []).map(tag => `${tag.name} #${tag.id}`).join(', ');
        ui.pushLog(`${filter.type}: ${tags}`, 'plan');
      }
    }
    for (const item of (plan.selected || []).slice(0, 4)) {
      ui.pushLog(`${item.title}${item.chapterId ? ` #${item.chapterId}` : ''}`, 'plan');
    }
    if (Array.isArray(plan.warnings)) {
      for (const warning of plan.warnings.slice(0, 2)) ui.pushLog(warning, 'plan');
    }
    if (Array.isArray(plan.requests)) ui.pushLog(t.dryRunRequests(plan.requests.length), 'plan');
  }

  function createQueueHelpers(root) {
    const queue = document.createElement('div');
    queue.className = 'smbp-queue';
    queue.innerHTML = `
      <div class="smbp-queue-head">
        <span>${t.queueTitle}</span>
        <span data-role="queue-count">0</span>
      </div>
      <div class="smbp-queue-list" data-role="queue-list">
        <div class="smbp-log-empty">${t.queueEmpty}</div>
      </div>
    `;
    root.appendChild(queue);

    const countNode = queue.querySelector('[data-role="queue-count"]');
    const listNode = queue.querySelector('[data-role="queue-list"]');
    const items = new Map();
    const labels = {
      pending: t.queuePending,
      running: t.queueRunning,
      done: t.queueDone,
      error: t.queueError,
      skipped: t.queueSkipped
    };

    function render() {
      const rows = [...items.values()];
      countNode.textContent = String(rows.length);
      listNode.innerHTML = '';
      if (!rows.length) {
        listNode.innerHTML = `<div class="smbp-log-empty">${t.queueEmpty}</div>`;
        return;
      }
      for (const item of rows) {
        const node = document.createElement('div');
        node.className = `smbp-queue-item smbp-queue-item--${item.state}`;
        node.innerHTML = `
          <strong>${escapeHtml(item.name)}</strong>
          <span class="smbp-queue-state">${escapeHtml(labels[item.state] || item.state)}</span>
        `;
        listNode.appendChild(node);
      }
    }

    return {
      set(tasks = []) {
        items.clear();
        for (const task of tasks) {
          items.set(Number(task?.id || 0), {
            name: String(task?.name || 'Task'),
            state: 'pending'
          });
        }
        render();
      },
      update(taskId, state, name) {
        const key = Number(taskId || 0);
        const current = items.get(key) || { name: String(name || 'Task'), state: 'pending' };
        current.state = state;
        if (name) current.name = name;
        items.set(key, current);
        render();
      }
    };
  }

  function createTaskNode(task, options = {}) {
    const {
      actionLabel = '',
      previewLabel = '',
      note = '',
      onAction = null,
      onPreview = null,
      state = smb.isTaskReady(task) ? 'ready' : 'idle',
      actionClass = 'smbp-link'
    } = options;

    const node = document.createElement('div');
    node.className = 'smbp-item';
    node.dataset.taskId = String(task?.id || '');
    const title = escapeHtml(normalizePlainText(task?.name || 'Задача'));
    const description = escapeHtml(normalizePlainText(task?.description || ''));
    const noteText = escapeHtml(normalizePlainText(note || ''));
    const actionText = escapeHtml(normalizePlainText(actionLabel || ''));
    const rewardExp = getTaskRewardExp(task);
    node.innerHTML = `
      <div class="smbp-item-head">
        <strong>${title}</strong>
        <span class="smbp-progress">${smb.formatTaskProgress(task)}</span>
      </div>
      <div class="smbp-item-meta">
        <span class="smbp-badge">${getTaskTypeLabel(task)}</span>
        ${rewardExp ? `<span class="smbp-badge smbp-badge-exp">${escapeHtml(t.taskExp(rewardExp))}</span>` : ''}
      </div>
      ${description ? `<small>${description}</small>` : ''}
      ${noteText ? `<div class="smbp-item-note">${noteText}</div>` : ''}
      ${(actionText || previewLabel) ? `
        <div class="smbp-action-row">
          ${actionText ? `<a class="${actionClass}" data-role="task-action">${actionText}</a>` : ''}
          ${previewLabel ? `<a class="smbp-link" data-role="task-preview">${escapeHtml(normalizePlainText(previewLabel))}</a>` : ''}
        </div>
      ` : ''}
    `;
    setTaskState(node, state);
    if (actionLabel && onAction) {
      node.querySelector('[data-role="task-action"]')?.addEventListener('click', onAction);
    }
    if (previewLabel && onPreview) {
      node.querySelector('[data-role="task-preview"]')?.addEventListener('click', onPreview);
    }
    return node;
  }

  function createUiHelpers(root, initialStatus = t.ready) {
    const overview = document.createElement('div');
    overview.className = 'smbp-overview';
    overview.innerHTML = `
      <div class="smbp-meta">
        <div class="smbp-chip"><strong data-role="primary">0</strong><span>${t.doneChip}</span></div>
        <div class="smbp-chip"><strong data-role="secondary">0</strong><span>${t.readyChip}</span></div>
      </div>
      <div class="smbp-status">
        <div class="smbp-statusbar smbp-statusbar--idle">
          <strong data-role="status-label">${t.statusIdle}</strong>
          <span data-role="status-message">${initialStatus}</span>
        </div>
        <div class="smbp-current">
          <strong>${t.currentTask}</strong>
          <span class="smbp-muted" data-role="current-task">${t.noCurrentTask}</span>
        </div>
        <div class="smbp-log">
          <strong>${t.lastActions}</strong>
          <div class="smbp-log-list" data-role="log-list">
            <div class="smbp-log-empty">${t.noActions}</div>
          </div>
        </div>
      </div>
    `;
    root.appendChild(overview);

    const primaryValue = overview.querySelector('[data-role="primary"]');
    const secondaryValue = overview.querySelector('[data-role="secondary"]');
    const chips = overview.querySelectorAll('.smbp-chip');
    const primaryLabel = chips[0].querySelector('span');
    const secondaryLabel = chips[1].querySelector('span');
    const statusBar = overview.querySelector('.smbp-statusbar');
    const statusLabel = overview.querySelector('[data-role="status-label"]');
    const statusMessage = overview.querySelector('[data-role="status-message"]');
    const currentTask = overview.querySelector('[data-role="current-task"]');
    const logList = overview.querySelector('[data-role="log-list"]');
    const logEntries = [];

    return {
      status(message, tone = 'idle') {
        statusBar.className = `smbp-statusbar smbp-statusbar--${tone}`;
        statusLabel.textContent = tone === 'running'
          ? t.statusRunning
          : tone === 'done'
            ? t.statusDone
            : tone === 'error'
              ? t.statusError
              : t.statusIdle;
        statusMessage.textContent = message;
      },
      setCurrentTask(name = '') {
        currentTask.textContent = name || t.noCurrentTask;
        currentTask.classList.toggle('smbp-muted', !name);
      },
      pushLog(message, tone = 'idle') {
        if (!message) return;
        logEntries.unshift({ message, tone });
        if (logEntries.length > 5) logEntries.length = 5;
        logList.innerHTML = '';
        for (const entry of logEntries) {
          const item = document.createElement('div');
          item.className = `smbp-log-entry smbp-log-entry--${entry.tone}`;
          item.textContent = entry.message;
          logList.appendChild(item);
        }
      },
      setPrimary(value, label) {
        primaryValue.textContent = value;
        if (label) primaryLabel.textContent = label;
      },
      setSecondary(value, label) {
        secondaryValue.textContent = value;
        if (label) secondaryLabel.textContent = label;
      }
    };
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizePlainText(value) {
    return String(value || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractProgressNumbers(message) {
    const text = String(message || '').trim();
    const match = text.match(/^(?:Прогресс вырос:\s*|.+?:\s*)(\d+)\s*\/\s*(\d+)$/);
    if (!match) return null;
    return {
      progress: Number(match[1] || 0),
      goal: Number(match[2] || 0)
    };
  }

  let activeDeckChoiceCleanup = null;
  let activeCardUpgradeCleanup = null;

  function showDeckChoiceModal(options = {}) {
    injectStyles();
    activeDeckChoiceCleanup?.();

    const cards = Array.isArray(options.cards) ? options.cards : [];
    const overlay = document.createElement('div');
    overlay.className = 'smbp-deck-overlay';

    let selectedCardId = Number(cards.find(card => card?.canChoose)?.id || 0) || null;
    let settled = false;

    overlay.innerHTML = `
      <div class="smbp-deck-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(t.deckModalTitle)}">
        <div class="smbp-deck-modal-head">
          <div>
            <strong>${escapeHtml(options.deckName || t.deckModalTitle)}</strong>
            <span>${escapeHtml(t.deckModalDesc)}</span>
          </div>
          <button class="smbp-close" type="button" aria-label="${escapeHtml(t.close)}">${t.close}</button>
        </div>
        <div class="smbp-deck-modal-body">
          <div class="smbp-deck-status">
            ${escapeHtml(options.premiumAvailable ? t.deckPremiumAvailable : t.deckPremiumLocked)}
          </div>
          <div class="smbp-deck-grid">
            ${cards.map(card => `
              <button
                class="smbp-deck-card${card?.canChoose ? '' : ' is-disabled'}${Number(card?.id || 0) === selectedCardId ? ' is-selected' : ''}"
                type="button"
                data-card-id="${Number(card?.id || 0)}"
                ${card?.canChoose ? '' : 'disabled'}
              >
                <img src="${escapeHtml(card?.imageUrl || '')}" alt="${escapeHtml(card?.label || 'Card')}">
                <span class="smbp-deck-rank">${escapeHtml(card?.rankLabel || '?')}</span>
                ${card?.premiumSlot ? `<span class="smbp-deck-premium">VIP</span>` : ''}
                <div class="smbp-deck-copy">
                  <strong>${escapeHtml(card?.label || 'Карта')}</strong>
                  <span>${escapeHtml(card?.subtitle || card?.titleName || '')}</span>
                  <small>${escapeHtml(card?.canChoose ? `Ранг ${card?.rankLabel || '?'}` : t.deckPremiumOnly)}</small>
                </div>
              </button>
            `).join('')}
          </div>
          <div class="smbp-deck-actions">
            <button class="smbp-btn smbp-btn-secondary" type="button" data-role="cancel">${t.deckCancel}</button>
            <button class="smbp-btn smbp-btn-primary" type="button" data-role="submit" ${selectedCardId ? '' : 'disabled'}>${t.deckPickCard}</button>
          </div>
        </div>
      </div>
    `;

    const closeButton = overlay.querySelector('.smbp-close');
    const cancelButton = overlay.querySelector('[data-role="cancel"]');
    const submitButton = overlay.querySelector('[data-role="submit"]');
    const cardButtons = Array.from(overlay.querySelectorAll('.smbp-deck-card'));

    const cleanup = () => {
      if (overlay.isConnected) overlay.remove();
      document.removeEventListener('keydown', onKeyDown, true);
      if (activeDeckChoiceCleanup === cleanup) activeDeckChoiceCleanup = null;
    };

    const rejectChoice = reject => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(t.deckChoiceCancelled));
    };

    const updateSelection = nextId => {
      selectedCardId = Number(nextId || 0) || null;
      for (const button of cardButtons) {
        button.classList.toggle('is-selected', Number(button.dataset.cardId || 0) === selectedCardId);
      }
      submitButton.disabled = !selectedCardId;
    };

    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        rejectChoice(rejectRef);
      }
    };

    let rejectRef = null;

    const promise = new Promise((resolve, reject) => {
      rejectRef = reject;

      closeButton.addEventListener('click', () => rejectChoice(reject));
      cancelButton.addEventListener('click', () => rejectChoice(reject));
      overlay.addEventListener('click', event => {
        if (event.target === overlay) rejectChoice(reject);
      });

      for (const button of cardButtons) {
        if (button.disabled) continue;
        button.addEventListener('click', () => updateSelection(button.dataset.cardId));
      }

      submitButton.addEventListener('click', () => {
        const chosenCard = cards.find(card => Number(card?.id || 0) === selectedCardId);
        if (!chosenCard || !chosenCard.canChoose || settled) return;
        settled = true;
        cleanup();
        resolve(chosenCard);
      });
    });

    activeDeckChoiceCleanup = cleanup;
    document.addEventListener('keydown', onKeyDown, true);
    document.body.appendChild(overlay);
    return promise;
  }

  function showCardUpgradeModal(plan = {}) {
    injectStyles();
    activeCardUpgradeCleanup?.();

    const overlay = document.createElement('div');
    overlay.className = 'smbp-deck-overlay';
    const tabs = [
      { key: 'common', label: 'Обычный', helper: '2 карты одного произведения и одного ранга.' },
      { key: 'exclusive', label: 'Эксклюзивный', helper: 'Нужно минимум 3 карты одного ранга. Расширение выберет 3 карты разных произведений.' },
      { key: 'random', label: 'Рандомный', helper: 'Нужно минимум 3 карты одного ранга. Система выбора такая же, как для эксклюзивного.' }
    ];
    let selectedType = plan.commonCandidates?.length ? 'common' : (plan.exclusiveCandidates?.some(item => !item.disabled) ? 'exclusive' : 'random');
    let selectedKey = null;
    let settled = false;

    const getCandidates = type => {
      if (type === 'exclusive') return plan.exclusiveCandidates || [];
      if (type === 'random') return plan.randomCandidates || [];
      return plan.commonCandidates || [];
    };
    const getSelected = () => getCandidates(selectedType).find(item => item.key === selectedKey && !item.disabled) || null;
    const pickDefault = () => {
      const first = getCandidates(selectedType).find(item => !item.disabled);
      selectedKey = first?.key || null;
    };
    const rankSummary = () => {
      const rankOrder = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'RE', 'EV'];
      const totals = plan.rankTotals || {};
      return rankOrder
        .map(rank => [rank, Number(totals[rank] || 0)])
        .map(([rank, count]) => `<span class="smbp-upgrade-rank-pill">${escapeHtml(rank)}-${count}</span>`)
        .join('');
    };
    const renderCards = cards => (cards || []).slice(0, 3).map(card => (
      card?.imageUrl ? `<img src="${escapeHtml(card.imageUrl)}" alt="${escapeHtml(card.label || 'Card')}">` : ''
    )).join('');
    const typeLabel = type => tabs.find(tab => tab.key === type)?.label || type;
    const render = () => {
      const candidates = getCandidates(selectedType);
      if (!selectedKey || !candidates.some(item => item.key === selectedKey && !item.disabled)) pickDefault();
      const helper = tabs.find(tab => tab.key === selectedType)?.helper || '';
      overlay.innerHTML = `
        <div class="smbp-deck-modal" role="dialog" aria-modal="true" aria-label="Апгрейд карточек">
          <div class="smbp-deck-modal-head">
            <div>
              <strong>Апгрейд карточек</strong>
              <span>Выбери тип апгрейда и подходящий набор карт. Карты будут потрачены после подтверждения.</span>
            </div>
            <button class="smbp-close" type="button" aria-label="${escapeHtml(t.close)}">${t.close}</button>
          </div>
          <div class="smbp-deck-modal-body">
            <div class="smbp-upgrade-tabs">
              ${tabs.map(tab => `
                <button class="smbp-upgrade-tab${tab.key === selectedType ? ' is-active' : ''}" type="button" data-type="${escapeHtml(tab.key)}">${escapeHtml(tab.label)}</button>
              `).join('')}
            </div>
            <div class="smbp-upgrade-ranks">${rankSummary()}</div>
            <p class="smbp-upgrade-helper">${escapeHtml(helper)}</p>
            <div class="smbp-upgrade-list">
              ${candidates.length ? candidates.map(candidate => `
                <button
                  class="smbp-upgrade-option${candidate.key === selectedKey ? ' is-selected' : ''}${candidate.disabled ? ' is-disabled' : ''}"
                  type="button"
                  data-key="${escapeHtml(candidate.key)}"
                  ${candidate.disabled ? 'disabled' : ''}
                >
                  <strong>${escapeHtml(candidate.label || 'Вариант')}</strong>
                  <span>${escapeHtml(candidate.meta || '')}</span>
                  <div class="smbp-upgrade-cards">${renderCards(candidate.cards)}</div>
                </button>
              `).join('') : '<div class="smbp-upgrade-option is-disabled"><strong>Нет вариантов</strong><span>Для этого типа нет подходящих карт.</span></div>'}
            </div>
            <div class="smbp-deck-actions">
              <button class="smbp-btn smbp-btn-secondary" type="button" data-role="cancel">Отмена</button>
              <button class="smbp-btn smbp-btn-primary" type="button" data-role="submit" ${getSelected() ? '' : 'disabled'}>Выполнить апгрейд</button>
            </div>
          </div>
        </div>
      `;
      bind();
    };

    const cleanup = () => {
      if (overlay.isConnected) overlay.remove();
      document.removeEventListener('keydown', onKeyDown, true);
      if (activeCardUpgradeCleanup === cleanup) activeCardUpgradeCleanup = null;
    };
    const rejectChoice = reject => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Апгрейд карточек отменён.'));
    };
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (settled) return;
        settled = true;
        rejectRef?.(new Error('Апгрейд карточек отменён.'));
        cleanup();
      }
    };
    let rejectRef = null;
    let resolveRef = null;

    function bind() {
      overlay.querySelector('.smbp-close')?.addEventListener('click', () => rejectChoice(rejectRef));
      overlay.querySelector('[data-role="cancel"]')?.addEventListener('click', () => rejectChoice(rejectRef));
      overlay.querySelector('[data-role="submit"]')?.addEventListener('click', () => {
        const selected = getSelected();
        if (!selected || settled) return;
        settled = true;
        cleanup();
        resolveRef({
          ...selected,
          typeLabel: typeLabel(selectedType)
        });
      });
      for (const tab of overlay.querySelectorAll('.smbp-upgrade-tab')) {
        tab.addEventListener('click', () => {
          selectedType = tab.dataset.type || 'common';
          selectedKey = null;
          render();
        });
      }
      for (const option of overlay.querySelectorAll('.smbp-upgrade-option')) {
        if (option.disabled) continue;
        option.addEventListener('click', () => {
          selectedKey = option.dataset.key || null;
          render();
        });
      }
    }

    const promise = new Promise((resolve, reject) => {
      resolveRef = resolve;
      rejectRef = reject;
      overlay.addEventListener('click', event => {
        if (event.target === overlay) rejectChoice(reject);
      });
      render();
    });

    activeCardUpgradeCleanup = cleanup;
    document.addEventListener('keydown', onKeyDown, true);
    document.body.appendChild(overlay);
    return promise;
  }

  function showCardUpgradeResultModal(options = {}) {
    injectStyles();
    const overlay = document.createElement('div');
    overlay.className = 'smbp-deck-overlay';
    const card = options.resultCard || {};
    overlay.innerHTML = `
      <div class="smbp-deck-modal" role="dialog" aria-modal="true" aria-label="Результат апгрейда">
        <div class="smbp-deck-modal-head">
          <div>
            <strong>Апгрейд завершён</strong>
            <span>${escapeHtml(options.selected?.label || 'Карты объединены')}</span>
          </div>
          <button class="smbp-close" type="button" aria-label="${escapeHtml(t.close)}">${t.close}</button>
        </div>
        <div class="smbp-deck-modal-body">
          <div class="smbp-upgrade-result">
            ${card.imageUrl ? `<img src="${escapeHtml(card.imageUrl)}" alt="${escapeHtml(card.label || 'Card')}">` : '<div></div>'}
            <div class="smbp-upgrade-result-info">
              <strong>${escapeHtml(card.label || 'Получена карта')}</strong>
              <span>${escapeHtml(card.subtitle || '')}</span>
              <span>${escapeHtml(card.rankLabel ? `Ранг ${card.rankLabel}` : '')}</span>
            </div>
          </div>
          <div class="smbp-deck-actions">
            <button class="smbp-btn smbp-btn-primary" type="button" data-role="submit">Готово</button>
          </div>
        </div>
      </div>
    `;
    return new Promise(resolve => {
      const cleanup = () => {
        if (overlay.isConnected) overlay.remove();
        document.removeEventListener('keydown', onKeyDown, true);
        resolve();
      };
      const onKeyDown = event => {
        if (event.key === 'Escape') cleanup();
      };
      overlay.querySelector('.smbp-close')?.addEventListener('click', cleanup);
      overlay.querySelector('[data-role="submit"]')?.addEventListener('click', cleanup);
      overlay.addEventListener('click', event => {
        if (event.target === overlay) cleanup();
      });
      document.addEventListener('keydown', onKeyDown, true);
      document.body.appendChild(overlay);
    });
  }

  function formatCompactNumber(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return '0';
    return number.toLocaleString('ru-RU');
  }

  function resolveMediaUrl(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/^https?:\/\//i.test(text)) return text;
    try {
      return new URL(text, location.origin).href;
    } catch (_) {
      return text;
    }
  }

  function getUserAvatarUrl(user) {
    const candidates = [
      user?.avatar?.url,
      user?.avatar?.image,
      user?.avatar?.path,
      user?.avatar,
      user?.profile?.avatar
    ];
    return resolveMediaUrl(candidates.find(value => typeof value === 'string' && value.trim()));
  }

  function getBattlepassMaxLevel(payload) {
    const levels = Array.isArray(payload?.content?.levels) ? payload.content.levels : [];
    return Math.max(0, ...levels.map(level => Number(level?.level || 0)).filter(Boolean));
  }

  function findBattlepassBadge(payload, rewardsState) {
    const levels = Array.isArray(payload?.content?.levels) ? payload.content.levels : [];
    let found = null;
    for (const levelEntry of levels) {
      const level = Number(levelEntry?.level || 0);
      const rewardsByVersion = levelEntry?.rewards || {};
      for (const version of ['free', 'paid']) {
        const rewards = Array.isArray(rewardsByVersion?.[version]) ? rewardsByVersion[version] : [];
        const badgeReward = rewards.find(reward => {
          const text = `${reward?.reward_name || ''} ${reward?.name || ''}`.toLowerCase();
          return Number(reward?.reward_type || 0) === 2 || text.includes('бейдж') || text.includes('badge');
        });
        if (!badgeReward) continue;
        const settings = badgeReward.reward_settings || {};
        const stateReward = rewardsState?.rewards?.find(item => item.level === level && item.version === version);
        found = {
          id: Number(settings.badgeId || settings.badge_id || badgeReward.badge_id || badgeReward.id || 0),
          name: settings.name || badgeReward.reward_name || badgeReward.name || 'Бейдж батлпасса',
          icon: resolveMediaUrl(settings.icon || badgeReward.icon || badgeReward.image),
          level,
          version,
          claimed: Boolean(stateReward?.claimed)
        };
        if (version === 'free') return found;
      }
    }
    return found;
  }

  function getClaimedBattlepassRewards(rewardsState, rewardType) {
    const result = [];
    for (const item of rewardsState?.rewards || []) {
      if (!item?.claimed || item?.locked) continue;
      for (const reward of item.rewards || []) {
        if (Number(reward?.reward_type || 0) === Number(rewardType)) result.push(reward);
      }
    }
    return result;
  }

  function countClaimedRewardItems(rewardsState, rewardType) {
    const ids = new Set();
    let fallbackCount = 0;
    for (const reward of getClaimedBattlepassRewards(rewardsState, rewardType)) {
      const settings = reward.reward_settings || {};
      const stableId = settings.item_id || settings.card_id || reward.id || `${rewardType}:${fallbackCount}`;
      ids.add(String(stableId));
      fallbackCount += 1;
    }
    return ids.size || fallbackCount;
  }

  function sumClaimedRewardCount(rewardsState, rewardType) {
    return getClaimedBattlepassRewards(rewardsState, rewardType).reduce((sum, reward) => {
      const settings = reward.reward_settings || {};
      const count = Number(settings.count || settings.amount || 1);
      return sum + (Number.isFinite(count) && count > 0 ? count : 1);
    }, 0);
  }

  async function loadOverviewBadges(userId) {
    if (!userId) return [];
    const badges = [];
    for (let page = 1; page <= 5; page += 1) {
      const payload = await smb.apiGet(`/api/v2/users/${Number(userId)}/badges/?count=120&page=${page}`);
      const results = Array.isArray(payload?.results) ? payload.results : [];
      badges.push(...results);
      if (!payload?.next || !results.length) break;
    }
    return badges;
  }

  async function loadOverviewStats() {
    const [currentPayload, user] = await Promise.all([
      smb.apiGet('/api/battlepass/current/'),
      smb.apiGet('/api/v2/users/current/').catch(() => null)
    ]);
    const rewardsState = smb.tasks.buildRewardsStateFromPayload(currentPayload);
    const userId = Number(user?.id || 0);
    const [badges] = await Promise.all([
      loadOverviewBadges(userId).catch(() => [])
    ]);
    const claimedLightningCount = sumClaimedRewardCount(rewardsState, 7);
    const claimedTicketCount = sumClaimedRewardCount(rewardsState, 1);
    const claimedCustomizationCount = countClaimedRewardItems(rewardsState, 5);
    const claimedDeckCount = sumClaimedRewardCount(rewardsState, 8);
    const badge = findBattlepassBadge(currentPayload, rewardsState);
    const ownedBadge = Boolean(badge?.id && badges.some(item => Number(item?.id || item?.badge?.id || 0) === badge.id));
    const exp = Number(rewardsState.exp || 0);
    const expPerLevel = Number(rewardsState.expPerLevel || 0) || 400;
    const maxLevel = getBattlepassMaxLevel(currentPayload) || Math.max(1, Number(rewardsState.currentLevel || 0));
    const totalExp = Math.max(expPerLevel, maxLevel * expPerLevel);
    const currentLevel = Math.min(maxLevel, Math.floor(exp / expPerLevel));
    const remainingExp = Math.max(0, totalExp - exp);
    const levelProgressExp = exp % expPerLevel;
    const expToNext = currentLevel >= maxLevel ? 0 : Math.max(0, expPerLevel - levelProgressExp);
    return {
      user,
      userId,
      rewardsState,
      battlepassName: rewardsState.battlepassName || 'Battlepass',
      exp,
      expPerLevel,
      totalExp,
      currentLevel,
      maxLevel,
      remainingExp,
      expToNext,
      progressPercent: Math.max(0, Math.min(100, totalExp ? (exp / totalExp) * 100 : 0)),
      lightningTotal: claimedLightningCount,
      tickets: claimedTicketCount,
      customizationCount: claimedCustomizationCount,
      deckCount: claimedDeckCount,
      badge,
      badgeCollected: Boolean(badge?.claimed || ownedBadge)
    };
  }

  function renderOverviewDashboard(body, stats) {
    const username = stats.user?.username || 'не определен';
    const avatarUrl = getUserAvatarUrl(stats.user);
    const initials = username.trim().slice(0, 2).toUpperCase() || 'SM';
    const badge = stats.badge;
    const badgeStatusClass = stats.badgeCollected ? 'is-collected' : 'is-missing';
    const badgeStatus = stats.badgeCollected ? 'Бейдж собран' : 'Бейдж не собран';
    const badgeMeta = badge
      ? `${badge.name}. Уровень ${badge.level}, ${badge.version === 'paid' ? 'платная' : 'бесплатная'} ветка.`
      : 'В текущем батлпассе бейдж не найден.';

    body.innerHTML = `
      <div class="smbp-overview-dashboard">
        <section class="smbp-overview-panel smbp-overview-account">
          <div class="smbp-overview-account-main">
            <div class="smbp-overview-avatar">
              ${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(username)}">` : escapeHtml(initials)}
            </div>
            <div class="smbp-overview-name">
              <span>Аккаунт</span>
              <strong>${escapeHtml(username)}</strong>
              <small>ID ${escapeHtml(stats.userId || '-')}</small>
            </div>
          </div>
          <div class="smbp-overview-account-grid">
            <div class="smbp-overview-metric">
              <span>Молнии</span>
              <strong>${escapeHtml(formatCompactNumber(stats.lightningTotal))}</strong>
              <small>получено из BP</small>
            </div>
            <div class="smbp-overview-metric">
              <span>Тикеты</span>
              <strong>${escapeHtml(formatCompactNumber(stats.tickets))}</strong>
              <small>получено из BP</small>
            </div>
            <div class="smbp-overview-metric smbp-overview-metric--wide">
              <span>Кастомизация</span>
              <strong>${escapeHtml(formatCompactNumber(stats.customizationCount))}</strong>
              <small>получено из BP</small>
            </div>
            <div class="smbp-overview-metric">
              <span>Колоды</span>
              <strong>${escapeHtml(formatCompactNumber(stats.deckCount))}</strong>
              <small>получено из BP</small>
            </div>
            <div class="smbp-overview-metric">
              <span>Уровни</span>
              <strong>${escapeHtml(`${stats.currentLevel}/${stats.maxLevel}`)}</strong>
              <small>уже пройдено</small>
            </div>
          </div>
        </section>

        <section class="smbp-overview-panel smbp-overview-battlepass">
          <span class="smbp-overview-panel-title">Battlepass</span>
          <div class="smbp-bp-head">
            <div>
              <strong>${escapeHtml(stats.battlepassName)}</strong>
              <small>${escapeHtml(formatCompactNumber(stats.exp))} / ${escapeHtml(formatCompactNumber(stats.totalExp))} EXP</small>
            </div>
            <div class="smbp-bp-level">LVL ${escapeHtml(stats.currentLevel)}</div>
          </div>
          <div class="smbp-bp-progress-wrap">
            <div class="smbp-bp-progress-meta">
              <span>Прогресс сезона</span>
              <strong>${escapeHtml(Math.round(stats.progressPercent))}%</strong>
            </div>
            <div class="smbp-bp-track"><div class="smbp-bp-fill" style="width:${stats.progressPercent}%"></div></div>
          </div>
          <div class="smbp-bp-grid">
            <div class="smbp-bp-line">
              <span>До конца</span>
              <strong>${escapeHtml(formatCompactNumber(stats.remainingExp))} EXP</strong>
            </div>
            <div class="smbp-bp-line">
              <span>До уровня</span>
              <strong>${escapeHtml(formatCompactNumber(stats.expToNext))} EXP</strong>
            </div>
            <div class="smbp-bp-line">
              <span>EXP / уровень</span>
              <strong>${escapeHtml(formatCompactNumber(stats.expPerLevel))}</strong>
            </div>
          </div>
        </section>

        <section class="smbp-overview-panel smbp-overview-badge ${badgeStatusClass}">
          <div class="smbp-badge-icon">
            ${badge?.icon ? `<img src="${escapeHtml(badge.icon)}" alt="${escapeHtml(badge.name)}">` : 'BP'}
          </div>
          <div class="smbp-badge-state">
            <span>Бейдж батлпасса</span>
            <strong>${escapeHtml(badgeStatus)}</strong>
            <small>${escapeHtml(badgeMeta)}</small>
          </div>
          <div class="smbp-badge-mark">${escapeHtml(stats.badgeCollected ? 'Собран' : 'Не собран')}</div>
        </section>
      </div>
    `;
  }

  async function renderOverviewPage(body) {
    body.dataset.page = 'overview';
    activeTasksPageCleanup?.();
    activeTasksPageCleanup = null;
    body.innerHTML = `<div class="smbp-overview-loading">${escapeHtml(t.loadingOverview)}</div>`;
    try {
      renderOverviewDashboard(body, await loadOverviewStats());
    } catch (error) {
      body.innerHTML = `<div class="smbp-overview-error">${escapeHtml(t.failedLoad(error.message || error))}</div>`;
    }
  }

  async function renderTasksPage(body) {
    body.dataset.page = 'tasks';
    activeTasksPageCleanup?.();
    activeTasksPageCleanup = null;

    const ui = createUiHelpers(body, t.loadingBattlepass);
    ui.setPrimary('0', t.doneChip);
    ui.setSecondary('0', t.readyChip);
    let busy = false;
    let runningTaskId = null;
    let errorTaskId = null;
    let canClaimReady = false;
    let disposed = false;
    let backgroundRefreshInFlight = false;

    const buttons = document.createElement('div');
    buttons.className = 'smbp-buttons';
    buttons.innerHTML = `
      <button class="smbp-btn smbp-btn-primary" type="button">${t.refresh}</button>
      <button class="smbp-btn smbp-btn-secondary" type="button">${t.claimReady}</button>
      <button class="smbp-btn smbp-btn-secondary" type="button">${t.runAvailable}</button>
    `;
    const refreshButton = buttons.children[0];
    const claimReadyButton = buttons.children[1];
    const runAvailableButton = buttons.children[2];

    const dailyExpNode = document.createElement('div');
    dailyExpNode.className = 'smbp-daily-exp';
    dailyExpNode.innerHTML = `
      <div>
        <strong>${escapeHtml(t.dailyExpTitle)}</strong>
        <span>${escapeHtml(t.dailyExpReset)}</span>
      </div>
      <div class="smbp-daily-exp-value" data-role="daily-exp">0 EXP</div>
    `;
    const dailyExpValue = dailyExpNode.querySelector('[data-role="daily-exp"]');

    const list = document.createElement('div');
    list.className = 'smbp-list';
    const openSectionKeys = new Set();
    body.appendChild(buttons);
    body.appendChild(dailyExpNode);
    body.appendChild(list);

    function applyButtonState(button, enabled) {
      button.disabled = !enabled;
      button.style.opacity = enabled ? '1' : '0.65';
      button.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }

    function syncActionButtons() {
      applyButtonState(refreshButton, !busy);
      applyButtonState(claimReadyButton, !busy && canClaimReady);
      applyButtonState(runAvailableButton, !busy);
    }

    async function updateDailyExpNode() {
      const state = await loadDailyTaskExpState();
      dailyExpValue.textContent = `${Number(state.exp || 0)} EXP`;
    }

    function updateOverview(state, options = {}) {
      const doneCount = state.tasks.filter(task => smb.isTaskDone(task)).length;
      ui.setPrimary(String(doneCount), t.doneChip);
      ui.setSecondary(String(state.readyTasks.length), t.readyChip);

      if (!options.keepStatus) {
        const expText = state.expPerLevel ? `${state.exp} / ${state.expPerLevel} EXP` : `${state.exp} EXP`;
        ui.status(`${state.battlepassName}. ${expText}`, 'done');
      }
    }

    function updateTaskNodeProgress(node, nextTask) {
      const progressNode = node.querySelector('.smbp-progress');
      if (progressNode) progressNode.textContent = smb.formatTaskProgress(nextTask);
      setTaskState(node, smb.isTaskReady(nextTask) ? 'ready' : 'idle');
    }

    function updateSummaryNodes(state) {
      const summary = smb.tasks.summarizeBySection(state.tasks);
      for (const node of list.querySelectorAll('.smbp-item-summary')) {
        const key = String(node.dataset.section || '');
        const item = summary[key];
        if (!item) continue;
        renderSummaryNodeContent(node, item);
      }
    }

    function syncTaskNodes(state) {
      const taskMap = new Map(state.tasks.map(task => [Number(task?.id || 0), task]));
      for (const node of list.querySelectorAll('.smbp-item[data-task-id]')) {
        const taskId = Number(node.dataset.taskId || 0);
        const nextTask = taskMap.get(taskId);
        if (!nextTask || nextTask.claimed) {
          node.remove();
          continue;
        }

        const progressNode = node.querySelector('.smbp-progress');
        if (progressNode) progressNode.textContent = smb.formatTaskProgress(nextTask);

        const nextState = node.classList.contains('smbp-item--manual')
          ? 'manual'
          : taskId === errorTaskId
            ? 'error'
            : taskId === runningTaskId
              ? 'running'
              : smb.isTaskReady(nextTask)
                ? 'ready'
                : 'idle';
        setTaskState(node, nextState);
      }
    }

    async function settleTaskNode(node, nextTask) {
      if (!node?.isConnected) return;
      if (nextTask?.claimed) {
        node.remove();
        return;
      }
      updateTaskNodeProgress(node, nextTask);
    }

    function setBusyState(nextBusy) {
      busy = nextBusy;
      syncActionButtons();
      if (nextBusy) {
        refreshButton.style.cursor = 'wait';
        claimReadyButton.style.cursor = 'wait';
        runAvailableButton.style.cursor = 'wait';
      }
      for (const link of body.querySelectorAll('.smbp-link')) {
        link.style.pointerEvents = nextBusy ? 'none' : 'auto';
        link.style.opacity = nextBusy ? '0.65' : '1';
      }
    }

    async function loadBattlepassState(options = {}) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'smbp_get_battlepass_state',
          force: Boolean(options.force)
        });
        if (response?.ok && response?.tasksPayload && response?.currentPayload) {
          return smb.tasks.buildStateFromPayloads(response.tasksPayload, response.currentPayload);
        }
      } catch (_error) {
      }
      return smb.tasks.loadState();
    }

    async function runExclusive(label, runner) {
      if (busy) {
        ui.status(t.alreadyRunning(label), 'idle');
        return null;
      }
      setBusyState(true);
      ui.setCurrentTask(label);
      ui.status(t.runningTask(label), 'running');
      ui.pushLog(t.runningTask(label), 'running');
      try {
        return await runner();
      } catch (error) {
        ui.status(t.taskFailed(error.message || error), 'error');
        ui.pushLog(t.taskFailed(error.message || error), 'error');
        throw error;
      } finally {
        ui.setCurrentTask('');
        setBusyState(false);
      }
    }

    function createTaskCard(task) {
      const isReadyTask = smb.isTaskReady(task) && !task.claimed;
      const isManualTask = smb.tasks.isIgnoredManualTask(task);
      const route = smb.tasks.getTaskRoute(task);
      const isRouteGameTask = route &&
        !smb.tasks.isDirectGameTask(task) &&
        !smb.tasks.isAutonomousMemoryTask(task) &&
        !task.claimed;
      const isRunnableTask = (isInlineRunnableTask(task) || smb.tasks.isGuildJoinTask(task)) &&
        !task.claimed &&
        !isReadyTask &&
        !isManualTask;

      if (isManualTask) {
        const reason = smb.tasks.getManualTaskReason?.(task) || t.manualOnly;
        return createTaskNode(task, {
          note: reason,
          state: 'manual'
        });
      }

      if (isReadyTask) {
        const node = createTaskNode(task, {
          actionLabel: t.claimReward,
          state: task.id === runningTaskId ? 'running' : 'ready'
        });

        node.querySelector('[data-role="task-action"]')?.addEventListener('click', async () => {
          try {
            runningTaskId = task.id;
            errorTaskId = null;
            setTaskState(node, 'running');
            await runExclusive(task.name, async () => {
              ui.status(`Забираю награду: ${task.name}`, 'running');
              ui.pushLog(`Забираю награду: ${task.name}`, 'running');
              await smb.claimTask(task.id);
            });
            await recordDailyTaskExp(task);
            await updateDailyExpNode();
            runningTaskId = null;
            node.remove();
            const freshState = await smb.tasks.loadState();
            updateOverview(freshState, { keepStatus: true });
            updateSummaryNodes(freshState);
            syncTaskNodes(freshState);
            ui.status(`Награда забрана: ${task.name}`, 'done');
            ui.pushLog(`Награда забрана: ${task.name}`, 'done');
          } catch (error) {
            runningTaskId = null;
            errorTaskId = task.id;
            setTaskState(node, 'error');
            ui.status(t.taskFailed(error.message || error), 'error');
            ui.pushLog(`${task.name}: ${error.message || error}`, 'error');
          }
        });

        return node;
      }

      if (isRouteGameTask) {
        return createTaskNode(task, {
          actionLabel: t.openGame,
          state: task.id === runningTaskId ? 'running' : 'idle',
          onAction: () => {
            location.href = route;
          }
        });
      }

      if (isRunnableTask) {
        const node = createTaskNode(task, {
          actionLabel: getTaskActionLabel(task),
          previewLabel: t.previewPlan,
          onPreview: async () => {
            if (busy) return;
            try {
              ui.status(`Собираю dry-run: ${task.name}`, 'running');
              const plan = await smb.tasks.buildTaskDryRunPlan(task);
              pushDryRunPlan(ui, plan);
              ui.status(t.dryRunExpected(plan.expectedProgress || smb.formatTaskProgress(task)), 'done');
            } catch (error) {
              ui.status(t.taskFailed(error.message || error), 'error');
              ui.pushLog(`${task.name}: ${error.message || error}`, 'error');
            }
          },
          state: task.id === errorTaskId
            ? 'error'
            : task.id === runningTaskId
              ? 'running'
              : 'idle'
        });

        node.querySelector('[data-role="task-action"]')?.addEventListener('click', async () => {
          try {
            runningTaskId = task.id;
            errorTaskId = null;
            setTaskState(node, 'running');
            const result = await runExclusive(task.name, async () => {
              const report = message => {
                ui.status(message, 'running');
                ui.pushLog(message, 'running');
                const progress = extractProgressNumbers(message);
                if (progress) {
                  const progressNode = node.querySelector('.smbp-progress');
                  if (progressNode) {
                    progressNode.textContent = `${progress.progress} / ${progress.goal}`;
                  }
                  refreshTaskProgressInBackground();
                }
              };
              return smb.tasks.isGuildJoinTask(task)
                ? await smb.tasks.runGuildJoinTask(task, report)
                : await runTaskAutomation(task, report);
            });

            if (!result) return;

            await finalizeTaskResult(task, result, message => {
              ui.status(message, 'running');
              ui.pushLog(message, 'running');
            });
            if (result?.claimed) {
              await recordDailyTaskExp(result.before || task);
              await updateDailyExpNode();
            }

            const resultTone = smb.isTaskDone(result.after) || result.claimed ? 'done' : 'idle';
            const loadedMessage = t.loaded(task.name, result.after.progress, result.after.goal);
            ui.status(loadedMessage, resultTone);
            ui.pushLog(loadedMessage, resultTone);
            if (smb.tasks.isLikeTask(task) && Array.isArray(result.relatedTasks) && result.relatedTasks.length) {
              const relatedSummary = formatRelatedTaskSummary(result.relatedTasks);
              if (relatedSummary) {
                ui.pushLog(`${t.relatedLikeTasks}: ${relatedSummary}`, 'idle');
              }
            }
            smb.toast(t.progressToast(task.name, result.after.progress, result.after.goal));
            runningTaskId = null;
            await settleTaskNode(node, result.after || task);
            const freshState = await smb.tasks.loadState();
            updateOverview(freshState, { keepStatus: true });
            updateSummaryNodes(freshState);
            syncTaskNodes(freshState);
          } catch (error) {
            runningTaskId = null;
            errorTaskId = task.id;
            setTaskState(node, 'error');
            ui.status(t.taskFailed(error.message || error), 'error');
            ui.pushLog(`${task.name}: ${error.message || error}`, 'error');
          }
        });

        return node;
      }

      return createTaskNode(task, {
        state: task.id === runningTaskId
          ? 'running'
          : task.id === errorTaskId
            ? 'error'
            : isReadyTask
              ? 'ready'
              : 'idle'
      });
    }

    async function refresh() {
      ui.status(t.loadingTasks, 'idle');
      list.innerHTML = '';

      try {
        const state = await loadBattlepassState({ force: true });
        canClaimReady = state.readyTasks.length > 0;
        syncActionButtons();
        updateOverview(state);
        await updateDailyExpNode();

        if (!state.tasks.length) {
          list.innerHTML = `<div class="smbp-item">${t.noTasks}</div>`;
          return;
        }

        const summary = smb.tasks.summarizeBySection(state.tasks);
        for (const key of Object.keys(summary)) {
          const item = summary[key];
          const accordion = createSectionAccordion(key, item, openSectionKeys);
          const sectionTasks = state.tasks
            .filter(task => String(task?.section || 'other') === key && !task.claimed)
            .sort((left, right) => {
              const readyDelta = Number(smb.isTaskReady(right)) - Number(smb.isTaskReady(left));
              if (readyDelta) return readyDelta;
              const manualDelta = Number(smb.tasks.isIgnoredManualTask(left)) - Number(smb.tasks.isIgnoredManualTask(right));
              if (manualDelta) return manualDelta;
              return getAutomationTaskPriority(left) - getAutomationTaskPriority(right);
            });

          if (!sectionTasks.length) {
            accordion.content.innerHTML = `<div class="smbp-item">${t.noTasks}</div>`;
          } else {
            for (const task of sectionTasks) {
              accordion.content.appendChild(createTaskCard(task));
            }
          }

          list.appendChild(accordion.root);
        }
      } catch (error) {
        canClaimReady = false;
        syncActionButtons();
        ui.status(t.failedLoad(error.message || error), 'error');
        ui.pushLog(t.failedLoad(error.message || error), 'error');
      }
    }

    async function refreshTaskProgressInBackground() {
      if (disposed || backgroundRefreshInFlight || getActiveShellView() !== 'tasks') return;
      backgroundRefreshInFlight = true;
      try {
        const state = await loadBattlepassState();
        if (disposed) return;
        canClaimReady = state.readyTasks.length > 0;
        syncActionButtons();
        updateOverview(state, { keepStatus: true });
        updateSummaryNodes(state);
        syncTaskNodes(state);
        await updateDailyExpNode();
      } catch (_error) {
      } finally {
        backgroundRefreshInFlight = false;
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.hidden || busy) {
        if (!document.hidden) refreshTaskProgressInBackground();
        return;
      }
      refreshTaskProgressInBackground();
    }, TASKS_BACKGROUND_REFRESH_MS);

    const handleVisibilityChange = () => {
      if (!document.hidden) refreshTaskProgressInBackground();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange, true);

    activeTasksPageCleanup = () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange, true);
    };

    refreshButton.addEventListener('click', refresh);
    claimReadyButton.addEventListener('click', async () => {
      if (busy) {
        ui.status(t.waitCurrent, 'idle');
        return;
      }
      if (!canClaimReady) {
        ui.status(t.noReady, 'idle');
        return;
      }
      ui.status(t.checkingReady, 'running');
      ui.pushLog(t.checkingReady, 'running');
      try {
        setBusyState(true);
        const result = await smb.tasks.claimReadyTasks(message => {
          ui.status(message, 'running');
          ui.pushLog(message, 'running');
        });
        if (!result.ready.length) {
          ui.status(t.noReady, 'idle');
        } else {
          await recordDailyTaskExp(result.ready);
          await updateDailyExpNode();
          ui.status(t.claimedTasks(result.claimed), 'done');
          ui.pushLog(t.claimedTasks(result.claimed), 'done');
          smb.toast(t.claimedTasks(result.claimed));
        }
        await refresh();
      } catch (error) {
        ui.status(t.failedClaim(error.message || error), 'error');
        ui.pushLog(t.failedClaim(error.message || error), 'error');
      } finally {
        setBusyState(false);
      }
    });
    runAvailableButton.addEventListener('click', async () => {
      if (busy) {
        ui.status(t.waitCurrent, 'idle');
        return;
      }
      setBusyState(true);
      ui.status(t.runAvailableStart, 'running');
      ui.pushLog(t.runAvailableStart, 'running');
      let done = 0;
      let failed = 0;
      try {
        let state = await loadBattlepassState({ force: true });
        const queue = getRunnableAutomationTasks(state);
        if (!queue.length) {
          ui.status(t.noAutoTasks, 'idle');
          return;
        }
        for (const queuedTask of queue) {
          state = await loadBattlepassState({ force: true }).catch(() => state);
          const task = findFreshRunnableTask(state, queuedTask);
          if (!task) {
            ui.pushLog(`${queuedTask.name}: уже выполнено или больше не требует запуска.`, 'idle');
            continue;
          }
          runningTaskId = task.id;
          errorTaskId = null;
          ui.setCurrentTask(task.name);
          ui.status(t.runningTask(task.name), 'running');
          ui.pushLog(t.runningTask(task.name), 'running');
          try {
            const result = await runTaskAutomation(task, message => {
              ui.status(message, 'running');
              ui.pushLog(message, 'running');
            });
            await finalizeTaskResult(task, result, message => {
              ui.status(message, 'running');
              ui.pushLog(message, 'running');
            });
            if (result?.claimed) {
              await recordDailyTaskExp(result.before || task);
              await updateDailyExpNode();
            }
            done += 1;
            const after = result?.after || task;
            ui.pushLog(t.loaded(task.name, Number(after.progress || 0), Number(after.goal || 0)), 'done');
          } catch (error) {
            failed += 1;
            errorTaskId = task.id;
            ui.pushLog(`${task.name}: ${error.message || error}`, 'error');
          } finally {
            runningTaskId = null;
            state = await loadBattlepassState({ force: true }).catch(() => state);
            updateOverview(state, { keepStatus: true });
          }
        }
        ui.status(t.autoRunDone(done, failed), failed ? 'error' : 'done');
        ui.pushLog(t.autoRunDone(done, failed), failed ? 'error' : 'done');
        await refresh();
      } finally {
        ui.setCurrentTask('');
        setBusyState(false);
      }
    });

    syncActionButtons();
    refresh();
  }

  function createRewardNode(reward, options = {}) {
    const node = document.createElement('div');
    node.className = 'smbp-item';
    node.dataset.rewardId = String(reward?.id || '');
    const state = reward?.claimable
      ? 'ready'
      : reward?.locked || !reward?.enoughExp
        ? 'manual'
        : 'idle';
    const status = reward?.claimed
      ? t.rewardsAlreadyClaimed
      : reward?.claimable
        ? t.rewardsReady
        : reward?.locked
          ? t.rewardsLocked
          : t.rewardsNeedExp;
    node.innerHTML = `
      <div class="smbp-item-head">
        <strong>${escapeHtml(t.rewardsLevel(reward?.level || 0))}</strong>
        <span class="smbp-progress">${escapeHtml(t.rewardsVersion(reward?.version || 'free'))}</span>
      </div>
      <div class="smbp-item-meta">
        <span class="smbp-badge">${escapeHtml(status)}</span>
      </div>
      <small>${escapeHtml(normalizePlainText(reward?.name || 'Награда'))}</small>
      ${reward?.claimable && options.onAction ? `<a class="smbp-link">${escapeHtml(t.claimReward)}</a>` : ''}
    `;
    setTaskState(node, state);
    if (reward?.claimable && options.onAction) {
      node.querySelector('.smbp-link')?.addEventListener('click', options.onAction);
    }
    return node;
  }

  async function renderRewardsPage(body) {
    body.dataset.page = 'rewards';
    activeTasksPageCleanup?.();
    activeTasksPageCleanup = null;

    const ui = createUiHelpers(body, t.loadingRewards);
    ui.setPrimary('0', t.rewardsAvailable);
    ui.setSecondary('0', t.rewardsClaimed);
    let busy = false;
    let canClaimReady = false;
    const initialSettings = await smb.loadSettings().catch(() => ({}));
    let hidePaid = Boolean(initialSettings.rewardsHidePaid);

    const buttons = document.createElement('div');
    buttons.className = 'smbp-buttons';
    buttons.innerHTML = `
      <button class="smbp-btn smbp-btn-primary" type="button">${t.refresh}</button>
      <button class="smbp-btn smbp-btn-secondary" type="button">${t.claimRewards}</button>
      <button class="smbp-btn smbp-btn-secondary" type="button">${t.hidePaidRewards}</button>
    `;
    const refreshButton = buttons.children[0];
    const claimRewardsButton = buttons.children[1];
    const paidToggleButton = buttons.children[2];

    const list = document.createElement('div');
    list.className = 'smbp-list';
    body.appendChild(buttons);
    body.appendChild(list);

    function applyButtonState(button, enabled) {
      button.disabled = !enabled;
      button.style.opacity = enabled ? '1' : '0.65';
      button.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }

    function syncActionButtons() {
      applyButtonState(refreshButton, !busy);
      applyButtonState(claimRewardsButton, !busy && canClaimReady);
      applyButtonState(paidToggleButton, !busy);
      paidToggleButton.textContent = hidePaid ? t.showPaidRewards : t.hidePaidRewards;
      for (const link of body.querySelectorAll('.smbp-link')) {
        link.style.pointerEvents = busy ? 'none' : 'auto';
        link.style.opacity = busy ? '0.65' : '1';
      }
    }

    function setBusyState(nextBusy) {
      busy = nextBusy;
      syncActionButtons();
      if (nextBusy) {
        refreshButton.style.cursor = 'wait';
        claimRewardsButton.style.cursor = 'wait';
        paidToggleButton.style.cursor = 'wait';
      }
    }

    function updateOverview(state, options = {}) {
      const claimedCount = state.rewards.filter(reward => reward.claimed).length;
      ui.setPrimary(String(state.claimableRewards.length), t.rewardsAvailable);
      ui.setSecondary(String(claimedCount), t.rewardsClaimed);
      if (!options.keepStatus) {
        ui.status(`${state.battlepassName}. ${state.exp} / ${state.expPerLevel} EXP, ${t.rewardsLevel(state.currentLevel)}`, 'done');
      }
    }

    async function refresh(options = {}) {
      if (!options.keepStatus) ui.status(t.loadingRewardsState, 'idle');
      const keepLayout = Boolean(options.keepStatus);
      const previousHeight = list.getBoundingClientRect().height;
      if (keepLayout && previousHeight > 0) {
        list.style.minHeight = `${Math.ceil(previousHeight)}px`;
      }

      try {
        const state = await smb.tasks.loadRewardsState();
        canClaimReady = state.claimableRewards.length > 0;
        updateOverview(state, options);
        syncActionButtons();

        const fragment = document.createDocumentFragment();
        if (!state.rewards.length) {
          const emptyNode = document.createElement('div');
          emptyNode.className = 'smbp-item';
          emptyNode.textContent = t.noRewards;
          fragment.appendChild(emptyNode);
          list.replaceChildren(fragment);
          return;
        }

        const filteredRewards = hidePaid
          ? state.rewards.filter(reward => reward.version !== 'paid')
          : state.rewards;
        const pendingRewards = [
          ...filteredRewards.filter(reward => reward.claimable),
          ...filteredRewards.filter(reward => !reward.claimable && !reward.claimed)
        ];
        const claimedRewards = filteredRewards.filter(reward => reward.claimed);
        const seen = new Set();

        function appendRewards(rewards) {
          for (const reward of rewards) {
            if (seen.has(reward.id)) continue;
            seen.add(reward.id);
            fragment.appendChild(createRewardNode(reward, {
              onAction: async () => {
                if (busy) return;
                try {
                  setBusyState(true);
                  ui.status(`Забираю награду: ${t.rewardsVersion(reward.version)} ${reward.level}`, 'running');
                  ui.pushLog(`Забираю награду: ${t.rewardsVersion(reward.version)} ${reward.level}`, 'running');
                  await smb.tasks.claimReward(reward.level, reward.version);
                  ui.status(t.claimedRewards(1), 'done');
                  ui.pushLog(`${t.rewardsLevel(reward.level)}: ${t.claimedRewards(1)}`, 'done');
                  smb.toast(t.claimedRewards(1));
                  await refresh({ keepStatus: true });
                } catch (error) {
                  ui.status(t.failedClaim(error.message || error), 'error');
                  ui.pushLog(t.failedClaim(error.message || error), 'error');
                } finally {
                  setBusyState(false);
                }
              }
            }));
          }
        }

        if (pendingRewards.length) {
          fragment.appendChild(createSectionHeader(t.rewardsPendingSection, t.rewardsPendingSectionDesc));
          appendRewards(pendingRewards);
        }
        if (claimedRewards.length) {
          fragment.appendChild(createSectionHeader(t.rewardsClaimedSection, t.rewardsClaimedSectionDesc));
          appendRewards(claimedRewards);
        }
        if (!pendingRewards.length && !claimedRewards.length) {
          const emptyNode = document.createElement('div');
          emptyNode.className = 'smbp-item';
          emptyNode.textContent = t.noRewards;
          fragment.appendChild(emptyNode);
        }
        list.replaceChildren(fragment);
      } catch (error) {
        canClaimReady = false;
        syncActionButtons();
        ui.status(t.failedLoad(error.message || error), 'error');
        ui.pushLog(t.failedLoad(error.message || error), 'error');
      } finally {
        if (keepLayout) {
          requestAnimationFrame(() => {
            list.style.minHeight = '';
          });
        }
      }
    }

    refreshButton.addEventListener('click', () => refresh());
    paidToggleButton.addEventListener('click', async () => {
      hidePaid = !hidePaid;
      syncActionButtons();
      await smb.saveSettings({ rewardsHidePaid: hidePaid }).catch(() => null);
      refresh({ keepStatus: true });
    });
    claimRewardsButton.addEventListener('click', async () => {
      if (busy) {
        ui.status(t.waitCurrent, 'idle');
        return;
      }
      if (!canClaimReady) {
        ui.status(t.noReadyRewards, 'idle');
        return;
      }
      try {
        setBusyState(true);
        ui.status(t.checkingRewards, 'running');
        ui.pushLog(t.checkingRewards, 'running');
        const result = await smb.tasks.claimReadyRewards(message => {
          ui.status(message, 'running');
          ui.pushLog(message, 'running');
        });
        if (!result.ready.length) {
          ui.status(t.noReadyRewards, 'idle');
        } else {
          ui.status(t.claimedRewards(result.claimed), 'done');
          ui.pushLog(t.claimedRewards(result.claimed), 'done');
          smb.toast(t.claimedRewards(result.claimed));
        }
        await refresh({ keepStatus: true });
      } catch (error) {
        ui.status(t.failedClaim(error.message || error), 'error');
        ui.pushLog(t.failedClaim(error.message || error), 'error');
      } finally {
        setBusyState(false);
      }
    });

    syncActionButtons();
    refresh();
  }

  async function init() {
    removeSettingsEntry();
    removeLegacyInlineButtons();

    if (isUserSettingsPage()) {
      injectSettingsEntry();
      if (isSmbpSettingsView()) {
        await renderSettingsPage();
      }
    }

    if (!isTasksPage() && !isRewardsPage() && !isUserSettingsPage()) {
      currentRouteKey = '';
      activeShellView = '';
      removeShell();
      return;
    }

    const shellView = getActiveShellView();
    const label = getShellViewLabel(shellView);
    const routeKey = `${location.pathname}::${location.hash || ''}::${shellView}`;
    if (routeKey === currentRouteKey && document.getElementById('smbp-panel')) return;
    currentRouteKey = routeKey;

    const shell = createShell(label);
    const body = shell.panel.querySelector('.smbp-body');
    delete body.dataset.page;
    body.innerHTML = '';

    if (shellView === 'settings') {
      await renderShellSettingsPage(body);
      return;
    }
    if (shellView === 'overview') {
      await renderOverviewPage(body);
      return;
    }
    if (shellView === 'tasks') {
      await renderTasksPage(body);
      return;
    }
    if (shellView === 'rewards') {
      await renderRewardsPage(body);
      return;
    }
  }

  function scheduleInit() {
    if (initScheduled) return;
    initScheduled = true;
    setTimeout(() => {
      initScheduled = false;
      init().catch(error => console.error('[SMBP] init failed', error));
    }, 60);
  }

  function installRouteTriggers() {
    if (window.__SMBP_ROUTE_TRIGGERS__) return;
    window.__SMBP_ROUTE_TRIGGERS__ = true;

    const wrapHistory = key => {
      const original = history[key];
      if (typeof original !== 'function') return;
      history[key] = function wrappedHistoryState(...args) {
        const result = original.apply(this, args);
        scheduleInit();
        return result;
      };
    };

    wrapHistory('pushState');
    wrapHistory('replaceState');
    window.addEventListener('popstate', scheduleInit, true);
    window.addEventListener('hashchange', scheduleInit, true);

    const observer = new MutationObserver(() => {
      if (location.pathname !== currentRouteKey.split('::')[0]) scheduleInit();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  smb.showDeckChoiceModal = showDeckChoiceModal;
  smb.showCardUpgradeModal = showCardUpgradeModal;
  smb.showCardUpgradeResultModal = showCardUpgradeResultModal;
  installRouteTriggers();
  scheduleInit();
})();


