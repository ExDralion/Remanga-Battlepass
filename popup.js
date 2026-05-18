// SailorM Battlepass compact popup bundle.
// Generated from: shared.js, popup.js


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



// ===== popup.js =====

document.addEventListener('DOMContentLoaded', async () => {
  const smb = window.SMBP;
  const settingsKey = smb?.STORE_KEY || 'smbp-settings';
  const defaults = {
    deckTaskPreferredDeckIds: '10',
    commentTaskText: 'РЎРїР°СЃРёР±Рѕ Р·Р° РіР»Р°РІСѓ!',
    commentReplyTaskText: 'РЎРїР°СЃРёР±Рѕ Р·Р° РѕС‚РІРµС‚!'
  };

  const tabButtons = [...document.querySelectorAll('[data-tab]')];
  const panels = [...document.querySelectorAll('[data-panel]')];
  const statusNode = document.querySelector('[data-role="status"]');
  const overviewDeckId = document.querySelector('[data-role="overview-deck-id"]');

  const controls = {
    deckIds: document.getElementById('deck-ids'),
    commentText: document.getElementById('comment-text'),
    replyText: document.getElementById('reply-text')
  };

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
    return String(value || '')
      .split(/[,\s;]+/)
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

  function applyToForm(settings) {
    controls.deckIds.value = settings.deckTaskPreferredDeckIds;
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

  for (const button of tabButtons) {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  }

  for (const field of [controls.deckIds, controls.commentText, controls.replyText]) {
    field.addEventListener('input', () => {
      const next = readForm();
      if (overviewDeckId) overviewDeckId.textContent = next.deckTaskPreferredDeckIds;
      setStatus('');
    });
    field.addEventListener('change', () => {
      const next = readForm();
      if (overviewDeckId) overviewDeckId.textContent = next.deckTaskPreferredDeckIds;
      setStatus('');
    });
  }

  document.querySelector('[data-action="save"]').addEventListener('click', async () => {
    try {
      const nextSettings = readForm();
      controls.deckIds.value = nextSettings.deckTaskPreferredDeckIds;
      await saveSettings(nextSettings);
      applyToForm(nextSettings);
      setStatus('РќР°СЃС‚СЂРѕР№РєРё СЃРѕС…СЂР°РЅРµРЅС‹. РќР° РѕС‚РєСЂС‹С‚РѕР№ СЃС‚СЂР°РЅРёС†Рµ РёР·РјРµРЅРµРЅРёСЏ РїСЂРёРјРµРЅСЏС‚СЃСЏ РїРѕСЃР»Рµ РѕР±РЅРѕРІР»РµРЅРёСЏ.', 'success');
    } catch (error) {
      setStatus(`РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РЅР°СЃС‚СЂРѕР№РєРё: ${error?.message || error}`, 'error');
    }
  });

  document.querySelector('[data-action="reset"]').addEventListener('click', async () => {
    try {
      await saveSettings(defaults);
      applyToForm(defaults);
      setStatus('РќР°СЃС‚СЂРѕР№РєРё Р°РІС‚РѕРјР°С‚РёР·Р°С†РёРё СЃР±СЂРѕС€РµРЅС‹ Рє Р·РЅР°С‡РµРЅРёСЏРј РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ.', 'success');
    } catch (error) {
      setStatus(`РќРµ СѓРґР°Р»РѕСЃСЊ СЃР±СЂРѕСЃРёС‚СЊ РЅР°СЃС‚СЂРѕР№РєРё: ${error?.message || error}`, 'error');
    }
  });

  const initialSettings = await loadSettings();
  applyToForm(initialSettings);
  setActiveTab('settings');
  document.title = 'SailorM Battlepass';
});

