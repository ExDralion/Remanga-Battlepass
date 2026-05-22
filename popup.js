// SailorM Battlepass compact popup bundle.
// Generated from: shared.js, popup.js


// ===== shared.js =====

(() => {
  if (window.SMBP) return;

  const STORE_KEY = 'smbp-settings';
  const DIAGNOSTICS_KEY = 'smbp-diagnostics';
  const EXECUTION_HISTORY_KEY = 'smbp-execution-history';
  const VERSION = '1.0.0';
  const MAX_DIAGNOSTIC_ENTRIES = 120;
  const MAX_EXECUTION_HISTORY_ENTRIES = 80;
  const ACCOUNT_SCOPED_SETTING_KEYS = new Set([
    'deckTaskPreferredDeckIds',
    'searchHistory',
    'failedSearchHistory',
    'titleBlacklist',
    'chapterHistory',
    'similarHistory',
    'commentHistory',
    'commentVoteHistory',
    'commentReplyHistory',
    'profileHistory',
    'friendRequestHistory',
    'guildRequestHistory',
    'exchangeTargetHistory',
    'exchangeTargetHistoryOwnerUserId',
    'titleCandidateCache'
  ]);
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
    exchangeTargetHistory: [],
    titleCandidateCache: {}
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

  function compactDetails(value, limit = 700) {
    if (value === undefined || value === null) return value;
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text.length > limit ? `${text.slice(0, limit)}...` : text;
  }

  async function recordApiDiagnostic(entry) {
    try {
      await recordDiagnostic({
        level: entry.level || 'error',
        scope: 'api',
        type: entry.type || 'request_failed',
        message: entry.message || 'API request failed',
        details: {
          method: entry.method,
          path: entry.path,
          status: entry.status || null,
          attempt: entry.attempt || null,
          requestBody: compactDetails(entry.requestBody),
          response: compactDetails(entry.response)
        }
      });
    } catch (_error) {
    }
  }

  async function api(path, { method = 'GET', body, maxRequestsPerMinute, retryUnsafe = false } = {}) {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    const normalizedMethod = String(method || 'GET').toUpperCase();
    const retryStatuses = new Set([429, 502, 503, 504]);

    const runRequest = async () => {
      const maxAttempts = normalizedMethod === 'GET' || retryUnsafe ? 3 : 1;
      let lastError = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        let response = null;
        try {
          response = await fetch(path, {
            method,
            headers,
            credentials: 'include',
            body: body !== undefined ? JSON.stringify(body) : undefined
          });
        } catch (error) {
          lastError = error;
          await recordApiDiagnostic({
            level: attempt < maxAttempts ? 'warn' : 'error',
            type: 'network_failed',
            message: error?.message || String(error),
            method: normalizedMethod,
            path,
            attempt,
            requestBody: body
          });
          if (attempt < maxAttempts) {
            await sleep(450 * attempt);
            continue;
          }
          throw error;
        }

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
          await recordApiDiagnostic({
            level: retryStatuses.has(Number(response.status)) && attempt < maxAttempts ? 'warn' : 'error',
            type: 'http_failed',
            message: lastError.message,
            method: normalizedMethod,
            path,
            status: Number(response.status),
            attempt,
            requestBody: body,
            response: text
          });
          if (retryStatuses.has(Number(response.status)) && attempt < maxAttempts) {
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
        const raw = data?.[STORE_KEY] || {};
        const accountId = String(window.SMBP?.activeAccountId || '');
        const accountProfiles = raw?.accountProfiles && typeof raw.accountProfiles === 'object' ? raw.accountProfiles : {};
        const accountSettings = accountId && accountProfiles[accountId] && typeof accountProfiles[accountId] === 'object'
          ? accountProfiles[accountId]
          : {};
        resolve({ ...DEFAULT_SETTINGS, ...raw, ...accountSettings, accountProfiles });
      });
    });
  }

  async function saveSettings(patch) {
    if (!chrome?.storage?.local) return { ...(await loadSettings()), ...patch };
    return new Promise(resolve => {
      chrome.storage.local.get([STORE_KEY], data => {
        const raw = data?.[STORE_KEY] || {};
        const accountId = String(window.SMBP?.activeAccountId || '');
        const accountProfiles = raw?.accountProfiles && typeof raw.accountProfiles === 'object'
          ? { ...raw.accountProfiles }
          : {};
        const globalPatch = {};
        const scopedPatch = {};

        for (const [key, value] of Object.entries(patch || {})) {
          if (accountId && ACCOUNT_SCOPED_SETTING_KEYS.has(key)) scopedPatch[key] = value;
          else globalPatch[key] = value;
        }

        if (accountId && Object.keys(scopedPatch).length) {
          accountProfiles[accountId] = {
            ...(accountProfiles[accountId] || {}),
            ...scopedPatch
          };
        }

        const nextRaw = {
          ...raw,
          ...globalPatch,
          accountProfiles
        };

        chrome.storage.local.set({ [STORE_KEY]: nextRaw }, () => {
          resolve({ ...DEFAULT_SETTINGS, ...nextRaw, ...(accountId ? accountProfiles[accountId] : {}) });
        });
      });
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

  async function loadExecutionHistory() {
    if (!chrome?.storage?.local) return [];
    return new Promise(resolve => {
      chrome.storage.local.get([EXECUTION_HISTORY_KEY], data => {
        const entries = Array.isArray(data?.[EXECUTION_HISTORY_KEY]) ? data[EXECUTION_HISTORY_KEY] : [];
        resolve(entries);
      });
    });
  }

  async function saveExecutionHistory(entries) {
    const normalizedEntries = Array.isArray(entries)
      ? entries.slice(0, MAX_EXECUTION_HISTORY_ENTRIES)
      : [];
    if (!chrome?.storage?.local) return normalizedEntries;
    return new Promise(resolve => {
      chrome.storage.local.set({ [EXECUTION_HISTORY_KEY]: normalizedEntries }, () => resolve(normalizedEntries));
    });
  }

  async function recordTaskExecution(entry = {}) {
    const nextEntry = {
      id: String(entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      at: entry.at || new Date().toISOString(),
      accountId: Number(entry.accountId || window.SMBP?.activeAccountId || 0) || null,
      taskId: Number(entry.taskId || 0) || null,
      taskName: String(entry.taskName || 'Задача'),
      status: String(entry.status || 'done'),
      exp: Number(entry.exp || 0) || 0,
      progress: String(entry.progress || ''),
      message: String(entry.message || '').trim()
    };
    const current = await loadExecutionHistory();
    current.unshift(nextEntry);
    await saveExecutionHistory(current);
    return nextEntry;
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
    EXECUTION_HISTORY_KEY,
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
    loadExecutionHistory,
    saveExecutionHistory,
    recordTaskExecution,
    toast
  };
})();



// ===== popup.js =====

document.addEventListener('DOMContentLoaded', async () => {
  const smb = window.SMBP;
  const settingsKey = smb?.STORE_KEY || 'smbp-settings';
  const remangaUrlPatterns = [
    '*://remanga.org/*',
    '*://*.remanga.org/*',
    '*://xn--80aaig9ahr.xn--c1avg/*',
    '*://*.xn--80aaig9ahr.xn--c1avg/*'
  ];
  const defaults = {
    deckTaskPreferredDeckIds: '10',
    commentTaskText: 'РЎРїР°СЃРёР±Рѕ Р·Р° РіР»Р°РІСѓ!',
    commentReplyTaskText: 'РЎРїР°СЃРёР±Рѕ Р·Р° РѕС‚РІРµС‚!'
  };

  const tabButtons = [...document.querySelectorAll('[data-tab]')];
  const panels = [...document.querySelectorAll('[data-panel]')];
  const statusNode = document.querySelector('[data-role="status"]');
  const deckCatalogStatus = document.querySelector('[data-role="deck-catalog-status"]');
  const overviewDeckId = document.querySelector('[data-role="overview-deck-id"]');

  const controls = {
    deckIds: document.getElementById('deck-ids'),
    commentText: document.getElementById('comment-text'),
    replyText: document.getElementById('reply-text')
  };

  let saveTimer = null;

  function setActiveTab(name) {
    for (const button of tabButtons) {
      button.classList.toggle('is-active', button.dataset.tab === name);
    }
    for (const panel of panels) {
      panel.classList.toggle('is-active', panel.dataset.panel === name);
    }
  }

  function clampText(value, fallback) {
    const text = String(value || '').trim();
    return text || fallback;
  }

  function normalizeDeckIds(value) {
    const source = String(value || defaults.deckTaskPreferredDeckIds);
    const deckUrlIds = [...source.matchAll(/(?:^|\/)deck\/(\d+)(?:\/open)?(?:[/?#]|$)/gi)]
      .map(match => match[1])
      .filter(Boolean);
    return [
      ...deckUrlIds,
      ...source.split(/[,\s;]+/)
    ]
      .map(item => item.trim())
      .filter(Boolean)
      .filter(item => Number.isInteger(Number(item)) && Number(item) > 0)
      .filter((item, index, list) => list.indexOf(item) === index)
      .join(', ') || defaults.deckTaskPreferredDeckIds;
  }

  function readForm() {
    return {
      deckTaskPreferredDeckIds: normalizeDeckIds(controls.deckIds.value),
      commentTaskText: clampText(controls.commentText.value, defaults.commentTaskText),
      commentReplyTaskText: clampText(controls.replyText.value, defaults.commentReplyTaskText)
    };
  }

  function setStatus(message, tone = '') {
    statusNode.textContent = message || '';
    statusNode.className = `status${tone ? ` is-${tone}` : ''}`;
  }

  function setDeckCatalogStatus(message) {
    if (deckCatalogStatus) deckCatalogStatus.textContent = message || '';
  }

  function formatDeckOption(pack) {
    return `${pack?.name || `РџР°Рє #${pack?.id || '?'}`} В· ${Number(pack?.count || 0)} С€С‚. В· #${pack?.id || '?'}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function setDeckOptions(packs = [], selectedValue = defaults.deckTaskPreferredDeckIds) {
    const selectedId = Number(normalizeDeckIds(selectedValue).split(',')[0] || 0);
    const nextSelected = packs.some(pack => Number(pack.id) === selectedId)
      ? selectedId
      : Number(packs[0]?.id || selectedId || 10);
    const optionItems = packs.length
      ? packs
      : [{ id: nextSelected, name: `РџР°Рє #${nextSelected}`, count: 0 }];

    controls.deckIds.innerHTML = optionItems
      .map(pack => `<option value="${escapeHtml(pack.id)}">${escapeHtml(formatDeckOption(pack))}</option>`)
      .join('');
    controls.deckIds.value = String(nextSelected);
    if (overviewDeckId) overviewDeckId.textContent = controls.deckIds.value;
    return String(nextSelected) !== String(selectedId);
  }

  function applyToForm(settings) {
    setDeckOptions([], settings.deckTaskPreferredDeckIds);
    controls.commentText.value = settings.commentTaskText;
    controls.replyText.value = settings.commentReplyTaskText;
    if (overviewDeckId) overviewDeckId.textContent = settings.deckTaskPreferredDeckIds;
  }

  async function loadSettings() {
    const stored = await chrome.storage.local.get([settingsKey]);
    return { ...defaults, ...(stored?.[settingsKey] || {}) };
  }

  async function saveSettings(nextSettings) {
    await chrome.storage.local.set({
      [settingsKey]: {
        ...(await loadSettings()),
        ...nextSettings
      }
    });
  }

  async function saveCurrentSettings(message = 'РќР°СЃС‚СЂРѕР№РєРё СЃРѕС…СЂР°РЅРµРЅС‹ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.') {
    const nextSettings = readForm();
    await saveSettings(nextSettings);
    if (overviewDeckId) overviewDeckId.textContent = nextSettings.deckTaskPreferredDeckIds;
    setStatus(message, 'success');
    return nextSettings;
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveCurrentSettings().catch(error => {
        setStatus(`РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РЅР°СЃС‚СЂРѕР№РєРё: ${error?.message || error}`, 'error');
      });
    }, 450);
  }

  async function remangaApi(path) {
    const origin = await getRemangaOrigin();
    const response = await fetch(`${origin}${path}`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function isRemangaUrl(url) {
    try {
      const host = new URL(String(url || '')).hostname.toLowerCase();
      return host === 'remanga.org' ||
        host.endsWith('.remanga.org') ||
        host === 'xn--80aaig9ahr.xn--c1avg' ||
        host.endsWith('.xn--80aaig9ahr.xn--c1avg');
    } catch (_error) {
      return false;
    }
  }

  async function queryTabs(queryInfo) {
    return chrome.tabs.query(queryInfo);
  }

  async function getRemangaOrigin() {
    const activeTabs = await queryTabs({ active: true, currentWindow: true }).catch(() => []);
    const activeTab = activeTabs.find(tab => isRemangaUrl(tab.url));
    if (activeTab?.url) return new URL(activeTab.url).origin;

    const tabs = await queryTabs({ url: remangaUrlPatterns }).catch(() => []);
    const tab = tabs.find(item => isRemangaUrl(item.url));
    if (tab?.url) return new URL(tab.url).origin;

    return 'https://remanga.org';
  }

  function unwrapPayload(payload) {
    return payload?.content && typeof payload.content === 'object' ? payload.content : payload;
  }

  async function loadDeckPacks() {
    const user = unwrapPayload(await remangaApi('/api/v2/users/current/'));
    const userId = Number(user?.id || 0);
    if (!userId) throw new Error('Р°РєРєР°СѓРЅС‚ РЅРµ РѕРїСЂРµРґРµР»РµРЅ');

    const groups = new Map();
    for (let page = 1; page <= 8; page += 1) {
      const payload = await remangaApi(`/api/v2/inventory/decks/?is_opened=false&user_id=${encodeURIComponent(userId)}&page=${page}`);
      const items = Array.isArray(payload?.results)
        ? payload.results
        : Array.isArray(payload)
          ? payload
          : [];

      for (const item of items) {
        const deck = item?.deck || item || {};
        const id = Number(deck?.id || item?.deck_id || 0);
        if (!Number.isInteger(id) || id <= 0) continue;
        const current = groups.get(id) || {
          id,
          name: String(deck?.name || item?.name || `РџР°Рє #${id}`).trim() || `РџР°Рє #${id}`,
          count: 0
        };
        current.count += 1;
        groups.set(id, current);
      }

      if (!payload?.next || !items.length) break;
    }

    return [...groups.values()]
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru') || Number(a.id) - Number(b.id));
  }

  async function populateDeckSelect(selectedValue) {
    controls.deckIds.disabled = true;
    setDeckCatalogStatus('Р—Р°РіСЂСѓР¶Р°СЋ РґРѕСЃС‚СѓРїРЅС‹Рµ РїР°РєРё...');
    try {
      const packs = await loadDeckPacks();
      const changed = setDeckOptions(packs, selectedValue);
      setDeckCatalogStatus(packs.length ? 'Р’С‹Р±РµСЂРё РїР°Рє РґР»СЏ РєР°СЂС‚РѕС‡РЅС‹С… Р·Р°РґР°С‡.' : 'РќРµРѕС‚РєСЂС‹С‚С‹Рµ РїР°РєРё РЅРµ РЅР°Р№РґРµРЅС‹.');
      if (changed && packs.length) await saveCurrentSettings();
    } catch (error) {
      setDeckOptions([], selectedValue);
      setDeckCatalogStatus(`РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЃРїРёСЃРѕРє РїР°РєРѕРІ: ${error?.message || error}`);
    } finally {
      controls.deckIds.disabled = false;
    }
  }

  for (const button of tabButtons) {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  }

  controls.deckIds.addEventListener('change', () => {
    saveCurrentSettings().catch(error => {
      setStatus(`РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РЅР°СЃС‚СЂРѕР№РєРё: ${error?.message || error}`, 'error');
    });
  });

  for (const field of [controls.commentText, controls.replyText]) {
    field.addEventListener('input', () => {
      setStatus('');
      scheduleSave();
    });
    field.addEventListener('change', scheduleSave);
  }

  document.querySelector('[data-action="reset"]').addEventListener('click', async () => {
    try {
      await saveSettings(defaults);
      applyToForm(defaults);
      await populateDeckSelect(defaults.deckTaskPreferredDeckIds);
      setStatus('РќР°СЃС‚СЂРѕР№РєРё Р°РІС‚РѕРјР°С‚РёР·Р°С†РёРё СЃР±СЂРѕС€РµРЅС‹ Рє Р·РЅР°С‡РµРЅРёСЏРј РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ.', 'success');
    } catch (error) {
      setStatus(`РќРµ СѓРґР°Р»РѕСЃСЊ СЃР±СЂРѕСЃРёС‚СЊ РЅР°СЃС‚СЂРѕР№РєРё: ${error?.message || error}`, 'error');
    }
  });

  const initialSettings = await loadSettings();
  applyToForm(initialSettings);
  await populateDeckSelect(initialSettings.deckTaskPreferredDeckIds);
  setActiveTab('settings');
  document.title = 'SailorM Battlepass';
});

