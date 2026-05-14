document.addEventListener('DOMContentLoaded', async () => {
  const smb = window.SMBP;
  const settingsKey = smb?.STORE_KEY || 'smbp-settings';
  const defaults = {
    deckTaskPreferredDeckIds: '10',
    commentTaskText: 'Спасибо за главу!',
    commentReplyTaskText: 'Спасибо за ответ!'
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
      setStatus('Настройки сохранены. На открытой странице изменения применятся после обновления.', 'success');
    } catch (error) {
      setStatus(`Не удалось сохранить настройки: ${error?.message || error}`, 'error');
    }
  });

  document.querySelector('[data-action="reset"]').addEventListener('click', async () => {
    try {
      await saveSettings(defaults);
      applyToForm(defaults);
      setStatus('Настройки автоматизации сброшены к значениям по умолчанию.', 'success');
    } catch (error) {
      setStatus(`Не удалось сбросить настройки: ${error?.message || error}`, 'error');
    }
  });

  const initialSettings = await loadSettings();
  applyToForm(initialSettings);
  setActiveTab('settings');
  document.title = 'SailorM Battlepass';
});
