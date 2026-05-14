const VISIT_TIMEOUT_MS = 25000;
const ACTION_TIMEOUT_MS = 60000;
const DEFAULT_STAY_MS = 5000;
const BATTLEPASS_STATE_CACHE_TTL_MS = 10000;

let battlepassStateCache = {
  key: '',
  savedAt: 0,
  data: null
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'smbp_get_battlepass_state') {
    respondToMessage(sendResponse, 'smbp_get_battlepass_state', message, sender, () => getBattlepassState(message, sender));
    return true;
  }

  if (message?.type === 'smbp_visit_urls') {
    respondToMessage(sendResponse, 'smbp_visit_urls', message, sender, () => visitUrls(message.urls || [], message.delayMs || DEFAULT_STAY_MS, sender?.tab?.windowId));
    return true;
  }

  if (message?.type === 'smbp_run_memory_task') {
    respondToMessage(sendResponse, 'smbp_run_memory_task', message, sender, () => runMemoryTask(message, sender?.tab?.windowId));
    return true;
  }

  if (message?.type === 'smbp_run_inventory_task') {
    respondToMessage(sendResponse, 'smbp_run_inventory_task', message, sender, () => runInventoryTask(message, sender?.tab?.windowId, sender?.tab?.id));
    return true;
  }

  if (message?.type === 'smbp_run_ticket_spend_task') {
    respondToMessage(sendResponse, 'smbp_run_ticket_spend_task', message, sender, () => runTicketSpendTask(message, sender?.tab?.windowId));
    return true;
  }

  if (message?.type === 'smbp_run_title_rating_task') {
    respondToMessage(sendResponse, 'smbp_run_title_rating_task', message, sender, () => runTitleRatingTask(message, sender?.tab?.windowId));
    return true;
  }

  if (message?.type === 'smbp_run_comment_vote_task') {
    respondToMessage(sendResponse, 'smbp_run_comment_vote_task', message, sender, () => runCommentVoteTask(message, sender?.tab?.windowId));
    return true;
  }

  if (message?.type === 'smbp_run_remanga_api') {
    respondToMessage(sendResponse, 'smbp_run_remanga_api', message, sender, () => runRemangaApi(message, sender));
    return true;
  }

  if (message?.type === 'smbp_run_profile_context_api') {
    respondToMessage(sendResponse, 'smbp_run_profile_context_api', message, sender, () => runProfileContextApi(message, sender?.tab?.windowId, sender?.tab?.id));
    return true;
  }

  if (message?.type === 'smbp_run_profile_visit_task') {
    respondToMessage(sendResponse, 'smbp_run_profile_visit_task', message, sender, () => runProfileVisitTask(message, sender?.tab?.windowId, sender?.tab?.id));
    return true;
  }

  if (message?.type === 'smbp_run_friend_request_page_task') {
    respondToMessage(sendResponse, 'smbp_run_friend_request_page_task', message, sender, () => runFriendRequestPageTask(message, sender?.tab?.windowId, sender?.tab?.id));
    return true;
  }

  if (message?.type === 'smbp_run_guild_join_task') {
    respondToMessage(sendResponse, 'smbp_run_guild_join_task', message, sender, () => runGuildJoinTask(message, sender?.tab?.windowId));
    return true;
  }

  return undefined;
});

function respondToMessage(sendResponse, type, message, sender, runner) {
  Promise.resolve()
    .then(runner)
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(async error => {
      const errorMessage = error?.message || String(error);
      await recordBackgroundDiagnostic(type, message, sender, errorMessage);
      sendResponse({ ok: false, error: errorMessage });
    });
}

async function visitUrls(urls, stayMs, windowId) {
  let visited = 0;
  for (const url of urls) {
    await visitOne(url, stayMs, windowId);
    visited += 1;
  }
  return { visited };
}

async function visitOne(url, stayMs, windowId) {
  return withTab(url, windowId, async () => {
    await delay(Math.max(Number(stayMs || 0), 0));
    return { visited: true, url };
  });
}

async function runMemoryTask(message, windowId) {
  const url = message?.url || 'https://remanga.org/user/battlepass/games/memory';
  const taskId = Number(message?.taskId || 0) || null;
  const goal = Number(message?.goal || 1) || 1;

  return withTab(url, windowId, async tabId => {
    await waitForFunction(tabId, () => {
      return Boolean(window.SMBP?.games?.MemoryGame?.start);
    }, 20000, 'Не загрузился solver memory.');

    await runScript(tabId, () => {
      const ui = {
        status() {},
        setPrimary() {},
        setSecondary() {}
      };
      window.SMBP.games.MemoryGame.start(ui);
      return true;
    });

    const result = await waitForFunction(tabId, (targetTaskId, targetGoal) => {
      const groups = ['daily', 'dailyRefresh', 'weekly', 'weeklyRefresh', 'monthly', 'monthlyRefresh', 'permanent', 'special'];
      const findTask = data => groups
        .flatMap(key => Array.isArray(data?.content?.[key]) ? data.content[key] : [])
        .find(task => Number(task?.id || 0) === Number(targetTaskId));

      return fetch('/api/battlepass/tasks/', { credentials: 'include' })
        .then(response => response.json())
        .then(data => {
          const task = findTask(data);
          if (!task) return null;
          if (Number(task.progress || 0) >= Math.max(Number(targetGoal || 0), Number(task.goal || 0), 1)) {
            return {
              id: task.id,
              progress: Number(task.progress || 0),
              goal: Number(task.goal || 0),
              claimed: Boolean(task.claimed)
            };
          }
          return null;
        })
        .catch(() => null);
    }, ACTION_TIMEOUT_MS, 'Memory РЅРµ РґР°Р» РїСЂРѕРіСЂРµСЃСЃ РІ battlepass.', [taskId, goal]);

    return {
      completed: true,
      task: result
    };
  });
}

async function runInventoryTask(message, windowId, sourceTabId = null) {
  const url = message?.url;
  const mode = message?.mode || 'visit';
  const restoreOriginal = message?.restoreOriginal !== false;
  const restoreItemId = Number(message?.restoreItemId || 0) || null;
  const restoreImage = message?.restoreImage || '';
  const restoreUnequip = Boolean(message?.restoreUnequip);
  const restoreCategoryKey = message?.restoreCategoryKey || '';
  const categoryUrls = message?.categoryUrls && typeof message.categoryUrls === 'object'
    ? message.categoryUrls
    : {};
  const equippedImages = message?.equippedImages && typeof message.equippedImages === 'object'
    ? message.equippedImages
    : {};
  const categoryOrder = Array.isArray(message?.categoryOrder) && message.categoryOrder.length
    ? message.categoryOrder
    : ['wallpapers', 'frames', 'theme'];
  if (!url) throw new Error('Не передан URL инвентаря.');

  return withInventoryTab(url, windowId, sourceTabId, async tabId => {
    if (mode === 'visit') {
      await waitForInventoryReady(tabId);
      await delay(1200);
      return { mode, visited: true };
    }

    if (mode === 'restore_customization') {
      const categoryKey = restoreCategoryKey || categoryOrder[0] || 'frames';
      const targetUrl = categoryUrls?.[categoryKey] || url;
      const categoryMeta = {
        avatars: { label: 'аватары' },
        wallpapers: { label: 'обои' },
        frames: { label: 'рамки' },
        theme: { label: 'темы' }
      };
      await navigateTab(tabId, targetUrl);
      await waitForInventoryReady(tabId);
      const result = await runScript(tabId, inventoryRestoreScript, [{
        categoryKey,
        categoryLabel: categoryMeta[categoryKey]?.label || categoryKey,
        itemId: restoreItemId,
        expectedImage: restoreImage,
        unequip: restoreUnequip
      }]);
      if (result?.status === 'error' && result?.error) {
        throw new Error(result.error);
      }
      return {
        mode,
        categoryKey,
        ...result
      };
    }

    if (mode !== 'swap_customization') {
      throw new Error(`Неизвестный режим инвентаря: ${mode}`);
    }

    const categoryMeta = {
      avatars: { label: 'аватары' },
      wallpapers: { label: 'обои' },
      frames: { label: 'рамки' },
      theme: { label: 'темы' }
    };
    const attempts = [];

    for (const categoryKey of categoryOrder) {
      const targetUrl = categoryUrls?.[categoryKey] || url;
      if (!targetUrl) continue;

      await navigateTab(tabId, targetUrl);
      await waitForInventoryReady(tabId);
      const categoryLabel = categoryMeta[categoryKey]?.label || categoryKey;
      const result = await runScript(tabId, inventorySwapScript, [{
        categoryKey,
        categoryLabel,
        equippedImage: equippedImages?.[categoryKey] || '',
        restoreOriginal
      }]);
      attempts.push({ categoryKey, ...result });

      if (result?.changed) {
        return {
          mode,
          categoryKey,
          attempts,
          ...result
        };
      }

      if (result?.status === 'error' && result?.error) {
        throw new Error(result.error);
      }
    }

    const attemptedLabels = attempts.length
      ? attempts.map(item => categoryMeta[item.categoryKey]?.label || item.categoryKey).join(', ')
      : 'обои, рамки, темы';
    throw new Error(`Не нашёл другой предмет для смены через инвентарь (${attemptedLabels}).`);
  });
}

async function runTicketSpendTask(message, windowId) {
  const url = message?.url;
  if (!url) throw new Error('Не передан URL платной главы.');

  return withTab(url, windowId, async tabId => {
    await waitForFunction(tabId, () => {
      const text = document.body?.innerText || '';
      return location.pathname.includes('/manga/') && (
        text.includes('Открыть за 1') ||
        text.includes('Открыть за 1') ||
        text.includes('тикет')
      );
    }, VISIT_TIMEOUT_MS, 'Платная глава не загрузила кнопку открытия за тикет.');

    const started = await runScript(tabId, ticketSpendScript);
    if (!started?.started) {
      throw new Error(started?.error || 'Не удалось нажать открытие главы за тикет.');
    }

    const result = await waitForFunction(tabId, () => {
      const text = document.body?.innerText || '';
      const stillLocked = text.includes('Открыть за 1') && text.toLowerCase().includes('тикет');
      const hasReaderContent = Boolean(
        location.search.includes('page=') ||
        document.querySelector('img[src*="/media/titles/"], img[src*="/media/chapters/"], canvas') ||
        Array.from(document.images || []).some(image => /chapters|titles/i.test(image.src || ''))
      );
      return (!stillLocked || hasReaderContent) ? {
        purchased: true,
        href: location.href,
        text: text.slice(0, 600)
      } : null;
    }, ACTION_TIMEOUT_MS, 'Глава не открылась после нажатия покупки за тикет.');

    return result;
  });
}

function ticketSpendScript() {
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const clickNode = node => {
    node.scrollIntoView?.({ block: 'center', inline: 'center' });
    node.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
    node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    node.click();
  };

  const allButtons = () => Array.from(document.querySelectorAll('button, [role="button"]'))
    .filter(node => !node.disabled && normalize(node.innerText || node.textContent));

  const findTicketButton = () => {
    const buttons = allButtons();
    return buttons.find(button => normalize(button.innerText || button.textContent).includes('открыть за 1')) ||
      buttons.find(button => {
        const text = normalize(button.innerText || button.textContent);
        return text.includes('тикет') && (text.includes('открыть') || text.includes('купить') || text.includes('получить'));
      });
  };

  const beforeText = document.body?.innerText || '';
  const ticketButton = findTicketButton();
  if (!ticketButton) {
    return {
      started: false,
      error: 'На странице не найдена кнопка открытия главы за 1 тикет.',
      href: location.href,
      text: beforeText.slice(0, 500)
    };
  }

  setTimeout(() => clickNode(ticketButton), 0);
  setTimeout(() => {
    const confirmButton = allButtons().find(button => {
      const text = normalize(button.innerText || button.textContent);
      if (!text) return false;
      if (text.includes('отмена') || text.includes('закрыть')) return false;
      return (
        text.includes('подтверд') ||
        text.includes('купить') ||
        text.includes('открыть за 1') ||
        (text.includes('открыть') && text.includes('тикет'))
      );
    });
    if (confirmButton && confirmButton !== ticketButton) clickNode(confirmButton);
  }, 900);

  return {
    started: true,
    href: location.href,
    clickedText: normalize(ticketButton.innerText || ticketButton.textContent),
    text: beforeText.slice(0, 600)
  };
}

async function withInventoryTab(url, windowId, sourceTabId, runner) {
  const sourceTab = await getTabSafe(sourceTabId);
  const canReuseSourceTab = Boolean(
    sourceTab?.id &&
    typeof sourceTab.url === 'string' &&
    !sourceTab.url.startsWith('edge://') &&
    !sourceTab.url.startsWith('chrome://') &&
    !sourceTab.url.startsWith('devtools://')
  );

  if (!canReuseSourceTab) {
    return withTab(url, windowId, runner);
  }

  const originalUrl = sourceTab.url;
  try {
    await navigateTab(sourceTab.id, url);
    return await runner(sourceTab.id);
  } finally {
    if (originalUrl && originalUrl !== url) {
      try {
        await navigateTab(sourceTab.id, originalUrl);
      } catch (_error) {
        // If the source tab was closed or the restore failed, the task result is still valid.
      }
    }
  }
}

function inventorySwapScript(options = {}) {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalize = value => String(value || '')
    .toLowerCase()
    .replace(/\u0451/g, '\u0435')
    .replace(/[«»"'`]/g, '')
    .replace(/[.,!?():;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const urlToken = value => {
    try {
      const url = new URL(String(value || ''), location.origin);
      return decodeURIComponent(url.pathname)
        .replace(/^\/media(?=\/)/i, '')
        .toLowerCase();
    } catch (_error) {
      return decodeURIComponent(String(value || ''))
        .replace(/^\/?media(?=\/)/i, '')
        .replace(/^(?!\/)/, '/')
        .toLowerCase();
    }
  };
  const visible = node => {
    if (!node) return false;
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const clickNode = async node => {
    if (!node) return false;
    node.scrollIntoView({ block: 'center', inline: 'center' });
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
      node.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window
      }));
    });
    await sleep(220);
    return true;
  };
  const itemLabel = normalize(options.categoryLabel || '');
  const getTriggers = () => {
    const seen = new Set();
    const result = [];
    for (const node of document.querySelectorAll('[data-slot="dialog-trigger"],button,[role="button"]')) {
      if (!visible(node)) continue;
      if (seen.has(node)) continue;
      const text = normalize(node.innerText || node.textContent);
      const hasImage = Boolean(node.querySelector('img'));
      const isDirectTrigger = node.getAttribute('data-slot') === 'dialog-trigger';
      if (!isDirectTrigger && (!hasImage || text !== itemLabel)) continue;
      seen.add(node);
      result.push(node);
    }
    return result;
  };
  const getVisibleDialog = () => [...document.querySelectorAll('[role="dialog"]')].filter(visible).slice(-1)[0] || null;
  const getActionButton = dialog => {
    if (!dialog) return null;
    return [...dialog.querySelectorAll('button,[role="button"]')].find(button => {
      if (!visible(button)) return false;
      const text = normalize(button.innerText || button.textContent);
      return text.includes('надеть') || text.includes('снять') || text.includes('использ');
    }) || null;
  };
  const readCurrentCustomization = async kind => {
    if (!kind) return '';
    try {
      const response = await fetch('/api/v2/users/current/', { credentials: 'include' });
      const data = await response.json();
      return data?.[kind]?.high || data?.[kind]?.mid || data?.[kind]?.image?.high || data?.[kind]?.image?.mid || '';
    } catch (_error) {
      return '';
    }
  };
  const closeDialogs = async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const dialog = getVisibleDialog();
      if (!dialog) break;
      const closeButton = [...document.querySelectorAll('button,[role="button"]')].find(button => {
        if (!visible(button)) return false;
        const text = normalize(button.innerText || button.textContent);
        return !text && String(button.className || '').includes('absolute');
      });
      if (closeButton) {
        await clickNode(closeButton);
      } else {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }
      await sleep(180);
    }
  };
  const ensureCustomizationTab = async () => {
    const tab = [...document.querySelectorAll('[role="tab"],button')].find(node => {
      if (!visible(node)) return false;
      return normalize(node.innerText || node.textContent) === 'кастомизация';
    });
    if (!tab) return false;
    if (tab.getAttribute('data-state') === 'active') return true;
    await clickNode(tab);
    await sleep(600);
    return true;
  };
  const inspectTrigger = async index => {
    const triggers = getTriggers();
    const trigger = triggers[index];
    if (!trigger) return null;
    const reactPropKey = Object.keys(trigger).find(key => key.startsWith('__reactProps$'));
    const reactFiberKey = Object.keys(trigger).find(key => key.startsWith('__reactFiber$'));
    const reactProps = reactPropKey ? trigger[reactPropKey] : null;
    const image = reactProps?.children?.props?.imgSrc
      || trigger.querySelector('img')?.currentSrc
      || trigger.querySelector('img')?.src
      || '';
    const imageKey = urlToken(image);
    const itemName = String(reactProps?.children?.props?.name || '').trim();
    const isUsing = Boolean(reactProps?.children?.props?.isUsing);

    const searchItemMeta = root => {
      const queue = [root];
      const seen = new WeakSet();

      while (queue.length) {
        const node = queue.shift();
        if (!node || typeof node !== 'object') continue;
        if (seen.has(node)) continue;
        seen.add(node);

        const candidate = node?.pendingProps?.item || node?.memoizedProps?.item || node?.item;
        if (candidate && typeof candidate === 'object' && Number(candidate?.id || 0) > 0) {
          return {
            itemId: Number(candidate.id || 0),
            itemDir: String(candidate?.dir || '').trim(),
            imageItemId: Number(candidate?.image_item?.id || 0) || null,
            imageItemType: String(candidate?.image_item?.type || '').trim(),
            imageItemName: String(candidate?.image_item?.name || '').trim()
          };
        }

        for (const value of Object.values(node)) {
          if (value && typeof value === 'object') queue.push(value);
        }
      }

      return null;
    };

    const itemMeta = reactFiberKey ? searchItemMeta(trigger[reactFiberKey]) : null;
    return {
      index,
      image,
      imageKey,
      itemId: Number(itemMeta?.itemId || 0) || null,
      itemDir: itemMeta?.itemDir || '',
      itemName: itemMeta?.imageItemName || itemName,
      canWear: !isUsing,
      isEquipped: isUsing
    };
  };
  const clickAction = async (index, actionText) => {
    await closeDialogs();
    const triggers = getTriggers();
    const trigger = triggers[index];
    if (!trigger) return false;
    await clickNode(trigger);
    await sleep(420);
    const dialog = getVisibleDialog();
    const actionButton = getActionButton(dialog);
    const normalizedAction = normalize(actionButton?.innerText || actionButton?.textContent || '');
    if (!actionButton || !normalizedAction.includes(actionText)) {
      await closeDialogs();
      return false;
    }
    await clickNode(actionButton);
    await sleep(1600);
    await closeDialogs();
    return true;
  };

  return (async () => {
    try {
      await ensureCustomizationTab();
      await closeDialogs();

      const triggers = getTriggers();
      if (!triggers.length) {
        const bodyText = normalize(document.body?.innerText || '');
        return {
          status: 'no-items',
          changed: false,
          categoryKey: options.categoryKey,
          categoryLabel: options.categoryLabel,
          reason: bodyText.includes('нет результатов') ? 'Нет результатов' : 'Нет предметов'
        };
      }

      const equippedImageKey = urlToken(options.equippedImage || '');
      const currentUser = await fetch('/api/v2/users/current/', { credentials: 'include' }).then(response => response.json()).catch(() => null);
      const currentUserId = Number(currentUser?.id || 0);
      if (!currentUserId) {
        return {
          status: 'error',
          changed: false,
          categoryKey: options.categoryKey,
          categoryLabel: options.categoryLabel,
          error: 'Не удалось определить текущего пользователя для API инвентаря.'
        };
      }
      const customizationKind = options.categoryKey === 'avatars'
        ? 'avatar'
        : options.categoryKey === 'wallpapers'
        ? 'wallpaper'
        : options.categoryKey === 'frames'
          ? 'frame'
          : '';
      const rawItems = [];
      for (let index = 0; index < triggers.length; index += 1) {
        const info = await inspectTrigger(index);
        if (info) rawItems.push(info);
      }

      const uniqueItems = [];
      const seenItems = new Set();
      for (const info of rawItems) {
        const key = info.itemId ? `id:${info.itemId}` : info.imageKey ? `img:${info.imageKey}` : `idx:${info.index}`;
        if (seenItems.has(key)) continue;
        seenItems.add(key);
        uniqueItems.push(info);
      }

      const hasEquippedItem = uniqueItems.some(info => info.isEquipped);
      if (uniqueItems.length < 2 && (equippedImageKey || hasEquippedItem)) {
        return {
          status: 'not-enough-items',
          changed: false,
          categoryKey: options.categoryKey,
          categoryLabel: options.categoryLabel,
          itemCount: uniqueItems.length
        };
      }

      let equipped = null;
      let alternative = null;
      if (equippedImageKey) {
        for (const info of uniqueItems) {
          if (info?.imageKey && info.imageKey === equippedImageKey) {
            equipped = info;
            break;
          }
        }
        if (!equipped) {
          return {
            status: 'missing-original',
            changed: false,
            categoryKey: options.categoryKey,
            categoryLabel: options.categoryLabel,
            reason: 'Текущий предмет не найден в инвентаре для возврата.'
          };
        }
      }

      for (const info of uniqueItems) {
        if (!equipped && info.isEquipped) equipped = info;
        if (!alternative && info.canWear && (!equippedImageKey || info.imageKey !== equippedImageKey)) alternative = info;
        if (equipped && alternative && alternative.index !== equipped.index) break;
      }

      if (!alternative && !equippedImageKey && !equipped) {
        alternative = uniqueItems.find(info => info.itemId) || null;
      }

      if (alternative && equipped && alternative.index === equipped.index) {
        alternative = null;
        for (const info of uniqueItems) {
          if (info.index === equipped.index) continue;
          if (info?.canWear) {
            alternative = info;
            break;
          }
        }
      }

      if (!alternative) {
        await closeDialogs();
        return {
          status: 'no-alternative',
          changed: false,
          categoryKey: options.categoryKey,
          categoryLabel: options.categoryLabel,
          equippedIndex: equipped?.index ?? null
        };
      }

      const applyByApi = async itemId => {
        const response = await fetch(`/api/inventory/${currentUserId}/`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ item: Number(itemId) })
        });
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(text || `HTTP ${response.status}`);
        }
        return response.text().catch(() => '');
      };

      if (!alternative.itemId) {
        return {
          status: 'error',
          changed: false,
          categoryKey: options.categoryKey,
          categoryLabel: options.categoryLabel,
          error: `Не удалось определить item.id для ${options.categoryLabel || options.categoryKey}.`
        };
      }

      let changed = false;
      try {
        await applyByApi(alternative.itemId);
        changed = true;
      } catch (error) {
        return {
          status: 'error',
          changed: false,
          categoryKey: options.categoryKey,
          categoryLabel: options.categoryLabel,
          error: `Не удалось применить другой предмет через API (${options.categoryLabel || options.categoryKey}): ${error?.message || error}`
        };
      }
      if (!changed) {
        return {
          status: 'error',
          changed: false,
          categoryKey: options.categoryKey,
          categoryLabel: options.categoryLabel,
          error: `Не удалось надеть другой предмет через API (${options.categoryLabel || options.categoryKey}).`
        };
      }

      if (customizationKind) {
        const changedAsset = await readCurrentCustomization(customizationKind);
        if (urlToken(changedAsset) !== alternative.imageKey) {
          return {
            status: 'error',
            changed: false,
            categoryKey: options.categoryKey,
            categoryLabel: options.categoryLabel,
            error: `Сайт не применил другой предмет (${options.categoryLabel || options.categoryKey}).`
          };
        }
      }

      let restored = !options.restoreOriginal;
      if (options.restoreOriginal && equipped && equipped.index !== alternative.index && equipped.itemId) {
        try {
          await applyByApi(equipped.itemId);
          restored = true;
        } catch (_error) {
          restored = false;
        }
        if (restored && customizationKind && equippedImageKey) {
          const restoredAsset = await readCurrentCustomization(customizationKind);
          restored = urlToken(restoredAsset) === equippedImageKey;
        }
      }

      return {
        status: 'changed',
        changed: true,
        restored,
        categoryKey: options.categoryKey,
        categoryLabel: options.categoryLabel,
        equippedIndex: equipped?.index ?? null,
        equippedImage: equipped?.image || '',
        equippedItemId: equipped?.itemId ?? null,
        alternativeIndex: alternative.index,
        alternativeImage: alternative.image || '',
        alternativeItemId: alternative.itemId ?? null,
        alternativeName: alternative.itemName || '',
        itemCount: uniqueItems.length
      };
    } catch (error) {
      return {
        status: 'error',
        changed: false,
        categoryKey: options.categoryKey,
        categoryLabel: options.categoryLabel,
        error: error?.message || String(error)
      };
    }
  })();
}

function inventoryRestoreScript(options = {}) {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const urlToken = value => {
    try {
      const url = new URL(String(value || ''), location.origin);
      return decodeURIComponent(url.pathname)
        .replace(/^\/media(?=\/)/i, '')
        .toLowerCase();
    } catch (_error) {
      return decodeURIComponent(String(value || ''))
        .replace(/^\/?media(?=\/)/i, '')
        .replace(/^(?!\/)/, '/')
        .toLowerCase();
    }
  };
  const normalize = value => String(value || '')
    .toLowerCase()
    .replace(/\u0451/g, '\u0435')
    .replace(/[«»"'`]/g, '')
    .replace(/[.,!?():;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const visible = node => {
    if (!node) return false;
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const clickNode = async node => {
    if (!node) return false;
    node.scrollIntoView({ block: 'center', inline: 'center' });
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
      node.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window
      }));
    });
    await sleep(300);
    return true;
  };
  const getVisibleDialog = () => [...document.querySelectorAll('[role="dialog"]')].filter(visible).slice(-1)[0] || null;
  const closeDialogs = async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const dialog = getVisibleDialog();
      if (!dialog) break;
      const closeButton = [...document.querySelectorAll('button,[role="button"]')].find(button => {
        if (!visible(button)) return false;
        const text = normalize(button.innerText || button.textContent);
        return !text && String(button.className || '').includes('absolute');
      });
      if (closeButton) {
        await clickNode(closeButton);
      } else {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }
      await sleep(180);
    }
  };
  const getTriggers = () => [...document.querySelectorAll('[data-slot="dialog-trigger"],button,[role="button"]')]
    .filter(node => visible(node) && (node.getAttribute('data-slot') === 'dialog-trigger' || node.querySelector('img')));
  const inspectTrigger = index => {
    const trigger = getTriggers()[index];
    if (!trigger) return null;
    const reactPropKey = Object.keys(trigger).find(key => key.startsWith('__reactProps$'));
    const reactFiberKey = Object.keys(trigger).find(key => key.startsWith('__reactFiber$'));
    const reactProps = reactPropKey ? trigger[reactPropKey] : null;
    const image = reactProps?.children?.props?.imgSrc
      || trigger.querySelector('img')?.currentSrc
      || trigger.querySelector('img')?.src
      || '';
    const imageKey = urlToken(image);
    const isUsing = Boolean(reactProps?.children?.props?.isUsing);

    const searchItemMeta = root => {
      const queue = [root];
      const seen = new WeakSet();
      while (queue.length) {
        const node = queue.shift();
        if (!node || typeof node !== 'object' || seen.has(node)) continue;
        seen.add(node);
        const candidate = node?.pendingProps?.item || node?.memoizedProps?.item || node?.item;
        if (candidate && typeof candidate === 'object' && Number(candidate?.id || 0) > 0) {
          return Number(candidate.id || 0);
        }
        for (const value of Object.values(node)) {
          if (value && typeof value === 'object') queue.push(value);
        }
      }
      return null;
    };

    return {
      index,
      image,
      imageKey,
      isEquipped: isUsing,
      itemId: reactFiberKey ? searchItemMeta(trigger[reactFiberKey]) : null
    };
  };
  const clickDialogAction = async (index, actionText) => {
    await closeDialogs();
    const trigger = getTriggers()[index];
    if (!trigger) return false;
    await clickNode(trigger);
    await sleep(420);
    const dialog = getVisibleDialog();
    const actionButton = [...(dialog?.querySelectorAll('button,[role="button"]') || [])].find(button => {
      if (!visible(button)) return false;
      return normalize(button.innerText || button.textContent).includes(actionText);
    });
    if (!actionButton) {
      await closeDialogs();
      return false;
    }
    await clickNode(actionButton);
    await sleep(1600);
    await closeDialogs();
    return true;
  };

  return (async () => {
    try {
      const currentUser = await fetch('/api/v2/users/current/', { credentials: 'include' }).then(response => response.json()).catch(() => null);
      const currentUserId = Number(currentUser?.id || 0);
      const itemId = Number(options.itemId || 0);
      if (!currentUserId) {
        return {
          status: 'error',
          restored: false,
          error: 'Не удалось определить пользователя для возврата кастомизации.'
        };
      }

      if (options.unequip) {
        await closeDialogs();
        const expectedImageKey = urlToken(options.expectedImage || '');
        const inspected = getTriggers().map((_, index) => inspectTrigger(index)).filter(Boolean);
        const target = inspected.find(info => expectedImageKey && info.imageKey === expectedImageKey) ||
          inspected.find(info => info.isEquipped);
        if (!target) {
          return {
            status: 'restored',
            restored: true,
            itemId: null,
            unequipped: true,
            reason: 'Предмет уже снят.'
          };
        }
        const unequipped = await clickDialogAction(target.index, 'снять');
        if (!unequipped) {
          return {
            status: 'error',
            restored: false,
            error: 'Не удалось нажать кнопку снятия предмета кастомизации.'
          };
        }
        await sleep(1000);
        return {
          status: 'restored',
          restored: true,
          itemId: null,
          unequipped: true
        };
      }

      if (!itemId) {
        return {
          status: 'error',
          restored: false,
          error: 'Не удалось определить исходный item для возврата.'
        };
      }

      const response = await fetch(`/api/inventory/${currentUserId}/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ item: itemId })
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return {
          status: 'error',
          restored: false,
          error: text || `HTTP ${response.status}`
        };
      }

      await sleep(1200);
      const expectedImage = String(options.expectedImage || '');
      const kind = options.categoryKey === 'avatars'
        ? 'avatar'
        : options.categoryKey === 'wallpapers'
        ? 'wallpaper'
        : options.categoryKey === 'frames'
          ? 'frame'
          : '';

      if (kind && expectedImage) {
        const refreshedUser = await fetch('/api/v2/users/current/', { credentials: 'include' }).then(result => result.json()).catch(() => null);
        const currentImage = refreshedUser?.[kind]?.high ||
          refreshedUser?.[kind]?.mid ||
          refreshedUser?.[kind]?.image?.high ||
          refreshedUser?.[kind]?.image?.mid ||
          '';
        if (urlToken(currentImage) !== urlToken(expectedImage)) {
          return {
            status: 'error',
            restored: false,
            error: 'Сайт не вернул исходный предмет кастомизации.'
          };
        }
      }

      return {
        status: 'restored',
        restored: true,
        itemId
      };
    } catch (error) {
      return {
        status: 'error',
        restored: false,
        error: error?.message || String(error)
      };
    }
  })();
}

async function runTitleRatingTask(message, windowId) {
  const url = message?.url;
  const rating = Number(message?.rating || 10) || 10;
  if (!url) throw new Error('Не передан URL тайтла для оценки.');

  return withTab(url, windowId, async tabId => {
    await waitForFunction(tabId, () => {
      return [...document.querySelectorAll('button')].some(button => {
        const text = (button.innerText || button.textContent || '').trim();
        return text.includes('РћС†РµРЅРёС‚СЊ') || text.includes('РћС†РµРЅРєР°:');
      });
    }, 25000, 'РљРЅРѕРїРєР° РѕС†РµРЅРєРё С‚Р°Р№С‚Р»Р° РЅРµ РїРѕСЏРІРёР»Р°СЃСЊ.');

    const result = await runScript(tabId, async targetRating => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const clickButton = matcher => {
        const buttons = [...document.querySelectorAll('button, [role="button"]')];
        const button = buttons.find(node => matcher((node.innerText || node.textContent || '').trim(), node));
        if (!button) return false;
        button.click();
        return true;
      };

      const opened = clickButton(text => text.includes('РћС†РµРЅРёС‚СЊ') || text.includes('РћС†РµРЅРєР°:'));
      if (!opened) {
        throw new Error('Не удалось открыть окно оценки.');
      }

      await sleep(500);

      const clickedRating = clickButton(text => text === String(targetRating));
      if (!clickedRating) {
        throw new Error(`Не удалось выбрать оценку ${targetRating}.`);
      }

      await sleep(1500);
      const ratingApplied = [...document.querySelectorAll('button')].some(button => {
        const text = (button.innerText || button.textContent || '').trim();
        return text.includes(`РћС†РµРЅРєР°: ${targetRating}`);
      });

      return {
        opened: true,
        rating: targetRating,
        ratingApplied
      };
    }, [rating]);

    return result;
  });
}

async function runCommentVoteTask(message, windowId) {
  const urls = Array.isArray(message?.urls) ? message.urls.filter(Boolean) : [];
  const maxClicks = Math.max(Number(message?.maxClicks || 1), 1);
  if (!urls.length) throw new Error('Не переданы URL для оценки комментариев.');

  const results = [];
  let clicked = 0;

  for (const url of urls) {
    if (clicked >= maxClicks) break;

    const result = await withTab(url, windowId, async tabId => {
      await waitForFunction(tabId, () => {
        return document.querySelectorAll('button[data-sentry-component="LikeButton"]').length > 0;
      }, 25000, 'РљРЅРѕРїРєРё Р»Р°Р№РєРѕРІ РєРѕРјРјРµРЅС‚Р°СЂРёРµРІ РЅРµ РїРѕСЏРІРёР»РёСЃСЊ.');

      const clickResult = await runScript(tabId, () => {
        const normalize = value => String(value || '')
          .toLowerCase()
          .replace(/\u0451/g, '\u0435')
          .replace(/[«»"'`]/g, '')
          .replace(/[.,!?():;]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const visible = el => {
          if (!el) return false;
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };

        const looksLikeCommentAction = button => {
          if (!button) return false;
          const scope = button.closest('article, li, section, div');
          const text = normalize(scope?.innerText || button.parentElement?.innerText || '');
          return text.includes('ответить') && (
            text.includes('назад') ||
            text.includes('дней') ||
            text.includes('дня') ||
            text.includes('месяц') ||
            text.includes('месяца') ||
            text.includes('месяцев') ||
            text.includes('час') ||
            text.includes('мин') ||
            text.includes('только что')
          );
        };

        const buttons = [...document.querySelectorAll('button[data-sentry-component="LikeButton"]')].filter(visible);
        const commentButtons = buttons.filter(looksLikeCommentAction);
        const target = commentButtons.find(button => (button.innerText || button.textContent || '').trim() === '0')
          || commentButtons[0]
          || null;
        if (!target) {
          return {
            clicked: false,
            title: document.title,
            foundButtons: buttons.length,
            foundCommentButtons: commentButtons.length
          };
        }

        target.click();
        return {
          clicked: true,
          title: document.title,
          label: (target.innerText || target.textContent || '').trim(),
          foundButtons: buttons.length,
          foundCommentButtons: commentButtons.length
        };
      });

      if (clickResult?.clicked) await delay(1800);
      return clickResult;
    });

    results.push({
      url,
      ...result
    });

    if (result?.clicked) clicked += 1;
  }

  return {
    clicked,
    results
  };
}

async function runGuildJoinTask(message, windowId) {
  const url = message?.url;
  if (!url) throw new Error('\u041d\u0435 \u043f\u0435\u0440\u0435\u0434\u0430\u043d URL \u0433\u0438\u043b\u044c\u0434\u0438\u0438.');

  return withTab(url, windowId, async tabId => {
    await waitForFunction(
      tabId,
      () => document.readyState === 'complete' && Boolean(document.body),
      25000,
      '\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 \u0433\u0438\u043b\u044c\u0434\u0438\u0438 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043b\u0430\u0441\u044c.'
    );

    return runScript(tabId, async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const normalize = value => String(value || '')
        .toLowerCase()
        .replace(/\u0451/g, '\u0435')
        .replace(/[«»"'`]/g, '')
        .replace(/[.,!?():;]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const visible = node => {
        if (!node) return false;
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const textMatches = (text, values) => values.some(value => text.includes(value));
      const controls = () => [...document.querySelectorAll('button, [role="button"], a')].filter(visible);
      const bodyText = () => normalize(document.body?.innerText || '');
      const readGuildMeta = () => {
        const scripts = [...document.scripts];
        for (const script of scripts) {
          const text = String(script.textContent || '');
          if (!text.includes('members_count') || !text.includes('max_members_count')) continue;

          const membersMatch = text.match(/"members_count":\s*(\d+)/);
          const maxMatch = text.match(/"max_members_count":\s*(\d+)/);
          const isPublicMatch = text.match(/"is_public":\s*(true|false)/);
          const isWaitingMatch = text.match(/"is_waiting":\s*(true|false)/);
          const isMemberMatch = text.match(/"is_member":\s*(true|false)/);

          if (!membersMatch || !maxMatch) continue;
          return {
            membersCount: Number(membersMatch[1]),
            maxMembersCount: Number(maxMatch[1]),
            isPublic: isPublicMatch ? isPublicMatch[1] === 'true' : null,
            isWaiting: isWaitingMatch ? isWaitingMatch[1] === 'true' : null,
            isMember: isMemberMatch ? isMemberMatch[1] === 'true' : null
          };
        }
        return null;
      };
      const successTexts = [
        '\u0437\u0430\u044f\u0432\u043a\u0430 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0430',
        '\u043e\u0436\u0438\u0434\u0430\u0435\u0442 \u0440\u0430\u0441\u0441\u043c\u043e\u0442\u0440\u0435\u043d\u0438\u044f',
        '\u043e\u0442\u043e\u0437\u0432\u0430\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443',
        '\u0432\u044b \u0443\u0436\u0435 \u0432 \u0433\u0438\u043b\u044c\u0434\u0438\u0438',
        '\u0432 \u0433\u0438\u043b\u044c\u0434\u0438\u0438'
      ];
      const startTexts = [
        '\u043f\u043e\u0434\u0430\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443',
        '\u0432\u0441\u0442\u0443\u043f\u0438\u0442\u044c',
        '\u043f\u0440\u0438\u0441\u043e\u0435\u0434\u0438\u043d\u0438\u0442\u044c\u0441\u044f'
      ];
      const confirmTexts = [
        '\u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c',
        '\u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c',
        '\u043f\u043e\u0434\u0430\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443',
        '\u0432\u0441\u0442\u0443\u043f\u0438\u0442\u044c'
      ];

      const guildMeta = readGuildMeta();
      if (guildMeta?.isMember) {
        return {
          applied: false,
          status: 'already_member',
          title: document.title,
          guild: guildMeta
        };
      }

      if (guildMeta?.isWaiting) {
        return {
          applied: false,
          status: 'already_requested',
          title: document.title,
          guild: guildMeta
        };
      }

      if (
        guildMeta &&
        Number.isFinite(guildMeta.membersCount) &&
        Number.isFinite(guildMeta.maxMembersCount) &&
        guildMeta.maxMembersCount > 0 &&
        guildMeta.membersCount >= guildMeta.maxMembersCount
      ) {
        return {
          applied: false,
          status: 'full',
          title: document.title,
          guild: guildMeta
        };
      }

      if (textMatches(bodyText(), successTexts)) {
        return {
          applied: false,
          status: 'already_requested',
          title: document.title,
          guild: guildMeta
        };
      }

      const startButton = controls().find(node => textMatches(normalize(node.innerText || node.textContent), startTexts));
      if (!startButton) {
        return {
          applied: false,
          status: 'no_button',
          title: document.title,
          guild: guildMeta
        };
      }

      startButton.click();
      await sleep(500);

      const note = [...document.querySelectorAll('textarea, [contenteditable="true"]')].find(visible);
      if (note) {
        if ('value' in note) {
          note.value = note.value || '.';
          note.dispatchEvent(new Event('input', { bubbles: true }));
          note.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          note.textContent = note.textContent || '.';
          note.dispatchEvent(new InputEvent('input', { bubbles: true, data: '.' }));
        }
        await sleep(250);
      }

      const confirmButton = controls().find(node => {
        if (node === startButton) return false;
        return textMatches(normalize(node.innerText || node.textContent), confirmTexts);
      });
      if (confirmButton) confirmButton.click();

      for (let attempt = 0; attempt < 20; attempt += 1) {
        await sleep(400);
        if (textMatches(bodyText(), successTexts)) {
          return {
            applied: true,
            status: 'submitted',
            title: document.title,
            guild: guildMeta
          };
        }
      }

      return {
        applied: Boolean(confirmButton),
        status: 'unknown',
        title: document.title,
        guild: guildMeta
      };
    });
  });
}

async function runRemangaApi(message, sender) {
  const endpoint = String(message?.endpoint || '').trim();
  if (!endpoint) throw new Error('Не передан endpoint для API-запроса.');

  const tabId = await resolveRemangaTabId(sender?.tab?.id, sender?.tab?.windowId);
  if (!tabId) {
    throw new Error('Не удалось найти вкладку ReManga для API-запроса.');
  }

  return runScript(tabId, async request => {
    const method = String(request?.method || 'GET').toUpperCase();
    const endpoint = String(request?.endpoint || '').trim();
    const url = endpoint.startsWith('http')
      ? endpoint
      : new URL(endpoint, location.origin).toString();
    const headers = {
      Accept: 'application/json, text/plain, */*',
      ...(request?.headers && typeof request.headers === 'object' ? request.headers : {})
    };
    const options = {
      method,
      credentials: 'include',
      headers
    };

    if (request?.body !== undefined && request?.body !== null && method !== 'GET' && method !== 'HEAD') {
      if (!options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json';
      }
      options.body = typeof request.body === 'string'
        ? request.body
        : JSON.stringify(request.body);
    }

    const response = await fetch(url, options);
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    const rawText = await response.text();
    let data = null;

    if (rawText) {
      if (contentType.includes('application/json')) {
        try {
          data = JSON.parse(rawText);
        } catch (_error) {
          data = null;
        }
      } else {
        data = rawText;
      }
    }

    return {
      status: Number(response.status || 0),
      ok: Boolean(response.ok),
      url: response.url,
      contentType,
      data,
      text: rawText
    };
  }, [message]);
}

async function runProfileContextApi(message, windowId, sourceTabId = null) {
  const url = String(message?.url || '').trim();
  const endpoint = String(message?.endpoint || '').trim();
  if (!url) throw new Error('Не передан URL профиля для context API.');
  if (!endpoint) throw new Error('Не передан endpoint для context API.');

  return withInventoryTab(url, windowId, sourceTabId, async tabId => {
    await waitForFunction(
      tabId,
      () => document.readyState === 'complete' && /\/user\/\d+\/about/.test(location.pathname),
      25000,
      'Профиль для context API не загрузился.'
    );

    await delay(1500);

    return runScript(tabId, async request => {
      const method = String(request?.method || 'GET').toUpperCase();
      const endpoint = String(request?.endpoint || '').trim();
      const url = endpoint.startsWith('http')
        ? endpoint
        : new URL(endpoint, location.origin).toString();
      const headers = {
        Accept: 'application/json, text/plain, */*',
        ...(request?.headers && typeof request.headers === 'object' ? request.headers : {})
      };
      const options = {
        method,
        credentials: 'include',
        headers
      };

      if (request?.body !== undefined && request?.body !== null && method !== 'GET' && method !== 'HEAD') {
        if (!options.headers['Content-Type']) {
          options.headers['Content-Type'] = 'application/json';
        }
        options.body = typeof request.body === 'string'
          ? request.body
          : JSON.stringify(request.body);
      }

      const response = await fetch(url, options);
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      const rawText = await response.text();
      let data = null;

      if (rawText) {
        if (contentType.includes('application/json')) {
          try {
            data = JSON.parse(rawText);
          } catch (_error) {
            data = null;
          }
        } else {
          data = rawText;
        }
      }

      return {
        status: Number(response.status || 0),
        ok: Boolean(response.ok),
        url: response.url,
        contentType,
        data,
        text: rawText,
        pageHref: location.href
      };
    }, [message]);
  });
}

async function runProfileVisitTask(message, windowId, sourceTabId = null) {
  const url = message?.url;
  if (!url) throw new Error('Не передан URL профиля.');

  return withInventoryTab(url, windowId, sourceTabId, async tabId => {
    await waitForFunction(
      tabId,
      () => document.readyState === 'complete' && /\/user\/\d+\/about/.test(location.pathname),
      25000,
      'Профиль пользователя не загрузился.'
    );

    const result = await runScript(tabId, async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const smoothVisit = async () => {
        const root = document.scrollingElement || document.documentElement || document.body;
        if (!root) return;
        root.scrollTo({ top: 0, behavior: 'instant' });
        await sleep(700);
        root.scrollTo({ top: Math.max(320, Math.floor((root.scrollHeight || 0) * 0.25)), behavior: 'instant' });
        await sleep(1100);
        root.scrollTo({ top: 0, behavior: 'instant' });
      };

      await sleep(2500);
      await smoothVisit();
      await sleep(1200);
      return {
        visited: true,
        href: location.href,
        title: document.title
      };
    });

    return result;
  });
}

async function runFriendRequestPageTask(message, windowId, sourceTabId = null) {
  const url = message?.url;
  if (!url) throw new Error('Не передан URL профиля для заявки в друзья.');

  return withInventoryTab(url, windowId, sourceTabId, async tabId => {
    await waitForFunction(
      tabId,
      () => document.readyState === 'complete' && /\/user\/\d+\/about/.test(location.pathname),
      25000,
      'Профиль для заявки в друзья не загрузился.'
    );

    return runScript(tabId, async () => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const normalize = value => String(value || '')
        .toLowerCase()
        .replace(/\u0451/g, '\u0435')
        .replace(/[«»"'`]/g, '')
        .replace(/[.,!?():;]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const visible = node => {
        if (!node) return false;
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const clickNode = async node => {
        if (!node) return false;
        node.scrollIntoView({ block: 'center', inline: 'center' });
        node.click?.();
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
          node.dispatchEvent(new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window
          }));
        });
        await sleep(300);
        return true;
      };
      const buttons = () => [...document.querySelectorAll('button,[role="button"],a')].filter(visible);
      const findFriendButton = () => buttons().find(node => {
        const text = normalize(node.innerText || node.textContent);
        return text.includes('друз') || text.includes('заявка в друзья');
      }) || null;
      const findFriendMenu = () => [...document.querySelectorAll('[role="menu"]')].filter(visible).slice(-1)[0] || null;
      const findFriendSubmit = menu => {
        if (!menu) return null;
        return [...menu.querySelectorAll('button[type="submit"],button,[role="button"]')].find(button => {
          if (!visible(button)) return false;
          if (button.getAttribute('type') === 'submit') return true;
          const text = normalize(button.innerText || button.textContent);
          return text.includes('отправ') || text.includes('добав') || text.includes('заявк');
        }) || null;
      };

      const initialButton = findFriendButton();
      if (!initialButton) {
        return {
          applied: false,
          status: 'no_button',
          href: location.href,
          title: document.title
        };
      }

      const initialText = normalize(initialButton.innerText || initialButton.textContent);
      if (initialText.includes('отмен') || initialText.includes('принят') || initialText.includes('в друзьях')) {
        return {
          applied: false,
          status: 'already_sent',
          href: location.href,
          title: document.title,
          buttonText: initialText
        };
      }

      await clickNode(initialButton);
      await sleep(700);

      const friendMenu = findFriendMenu();
      const submitButton = findFriendSubmit(friendMenu);
      if (submitButton) {
        await clickNode(submitButton);
      }

      await sleep(2200);
      const nextText = normalize(findFriendButton()?.innerText || findFriendButton()?.textContent || '');
      return {
        applied: true,
        status: nextText && nextText !== initialText ? 'submitted' : submitButton ? 'submitted' : 'clicked',
        href: location.href,
        title: document.title,
        buttonText: nextText || initialText
      };
    });
  });
}

async function withTab(url, windowId, runner) {
  const tabId = await createInactiveTab(url, windowId);
  try {
    await waitForTabComplete(tabId, VISIT_TIMEOUT_MS);
    await delay(1000);
    return await runner(tabId);
  } finally {
    await removeTab(tabId);
  }
}

function createInactiveTab(url, windowId) {
  return new Promise((resolve, reject) => {
    const createOptions = {
      url,
      active: false
    };
    if (Number.isInteger(windowId)) {
      createOptions.windowId = windowId;
    }

    chrome.tabs.create(createOptions, tab => {
      if (chrome.runtime.lastError || !tab?.id) {
        reject(new Error(getChromeRuntimeError('Не удалось открыть вкладку.')));
        return;
      }
      resolve(tab.id);
    });
  });
}

function getTabSafe(tabId) {
  return new Promise(resolve => {
    if (!tabId) {
      resolve(null);
      return;
    }
    chrome.tabs.get(tabId, tab => {
      if (chrome.runtime.lastError || !tab?.id) {
        resolve(null);
        return;
      }
      resolve(tab);
    });
  });
}

async function navigateTab(tabId, url) {
  await new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, { url }, tab => {
      if (chrome.runtime.lastError || !tab?.id) {
        reject(new Error(getChromeRuntimeError('Не удалось обновить вкладку.')));
        return;
      }
      resolve();
    });
  });
  await waitForTabComplete(tabId, VISIT_TIMEOUT_MS);
  await delay(900);
}

async function waitForInventoryReady(tabId) {
  await waitForFunction(tabId, () => {
    const text = document.body?.innerText || '';
    return location.pathname.includes('/inventory') && text.length > 0;
  }, 25000, 'Инвентарь не загрузился.');
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;

    const finish = error => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      if (timer) clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };

    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status === 'complete') finish();
    };

    const onRemoved = removedTabId => {
      if (removedTabId !== tabId) return;
      finish(new Error('Вкладка была закрыта до завершения операции.'));
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    timer = setTimeout(() => finish(new Error('Таймаут загрузки вкладки.')), timeoutMs);

    chrome.tabs.get(tabId, tab => {
      if (chrome.runtime.lastError) {
        finish(new Error(getChromeRuntimeError('Не удалось получить состояние вкладки.')));
        return;
      }
      if (tab?.status === 'complete') finish();
    });
  });
}

function runScript(tabId, func, args = []) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func,
        args
      },
      results => {
        if (chrome.runtime.lastError) {
          reject(new Error(getChromeRuntimeError('Не удалось выполнить код во вкладке.')));
          return;
        }

        const firstResult = results?.[0];
        if (!firstResult) {
          reject(new Error('Не удалось получить результат выполнения во вкладке.'));
          return;
        }

        if (firstResult.exceptionDetails) {
          const description = firstResult.exceptionDetails.exception?.description
            || firstResult.exceptionDetails.text
            || 'Неизвестная ошибка скрипта.';
          reject(new Error(description));
          return;
        }

        resolve(firstResult.result);
      }
    );
  });
}

async function waitForFunction(tabId, func, timeoutMs, errorMessage, args = []) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    let result = null;
    try {
      result = await runScript(tabId, func, args);
    } catch (error) {
      const message = String(error?.message || error || '');
      const isTransient = (
        message.includes('The tab was closed')
        || message.includes('Frame with ID 0 is showing error page')
        || message.includes('Cannot access contents of')
        || message.includes('No tab with id')
        || message.includes('before a response was received')
      );
      if (!isTransient) throw error;
    }
    if (result) return result;
    await delay(500);
  }
  throw new Error(errorMessage);
}

function removeTab(tabId) {
  return new Promise(resolve => {
    chrome.tabs.remove(tabId, () => resolve());
  });
}

function getChromeRuntimeError(fallback) {
  return chrome.runtime.lastError?.message || fallback;
}

async function recordBackgroundDiagnostic(type, message, sender, errorMessage) {
  try {
    const entries = await new Promise(resolve => {
      chrome.storage.local.get(['smbp-diagnostics'], data => {
        resolve(Array.isArray(data?.['smbp-diagnostics']) ? data['smbp-diagnostics'] : []);
      });
    });

    entries.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      level: 'error',
      scope: 'background',
      type: 'runtime_failure',
      message: String(errorMessage || 'Неизвестная ошибка background.'),
      details: {
        handler: String(type || ''),
        senderTabId: Number(sender?.tab?.id || 0) || null,
        senderWindowId: Number(sender?.tab?.windowId || 0) || null,
        request: safeCloneBackgroundMessage(message)
      }
    });

    await new Promise(resolve => {
      chrome.storage.local.set({
        'smbp-diagnostics': entries.slice(0, 120)
      }, () => resolve());
    });
  } catch (_error) {
    // Diagnostics must never break the primary response path.
  }
}

function safeCloneBackgroundMessage(message) {
  if (!message || typeof message !== 'object') return null;
  return {
    type: message.type ? String(message.type) : '',
    mode: message.mode ? String(message.mode) : '',
    endpoint: message.endpoint ? String(message.endpoint) : '',
    url: message.url ? String(message.url) : '',
    taskId: Number(message.taskId || 0) || null
  };
}

async function resolveRemangaTabId(sourceTabId, preferredWindowId) {
  const sourceTab = await getTabSafe(sourceTabId);
  if (sourceTab?.id && isRemangaUrl(sourceTab.url)) return sourceTab.id;

  const tabs = await queryTabs({ url: ['*://remanga.org/*', '*://*.remanga.org/*'] });
  const preferredWindowTab = tabs.find(tab => tab.windowId === preferredWindowId && isRemangaUrl(tab.url));
  if (preferredWindowTab?.id) return preferredWindowTab.id;

  const activeTab = tabs.find(tab => tab.active && isRemangaUrl(tab.url));
  if (activeTab?.id) return activeTab.id;

  return tabs.find(tab => isRemangaUrl(tab.url))?.id || null;
}

async function getBattlepassState(message, sender) {
  const sourceTabId = Number(message?.tabId || sender?.tab?.id || 0) || null;
  const cacheKey = `${Number(sender?.tab?.windowId || 0)}:${sourceTabId || 0}`;
  const force = Boolean(message?.force);

  if (!force && battlepassStateCache.data && battlepassStateCache.key === cacheKey) {
    const ageMs = Date.now() - Number(battlepassStateCache.savedAt || 0);
    if (ageMs >= 0 && ageMs < BATTLEPASS_STATE_CACHE_TTL_MS) {
      return {
        tasksPayload: battlepassStateCache.data.tasksPayload,
        currentPayload: battlepassStateCache.data.currentPayload,
        cached: true,
        ageMs
      };
    }
  }

  const tabId = await resolveRemangaTabId(sourceTabId, sender?.tab?.windowId);
  if (!tabId) {
    throw new Error('Не удалось найти вкладку ReManga для проверки battlepass.');
  }

  const data = await runScript(tabId, fetchBattlepassStateScript);
  if (!data?.tasksPayload || !data?.currentPayload) {
    throw new Error('Не удалось получить состояние battlepass с сервера.');
  }

  battlepassStateCache = {
    key: cacheKey,
    savedAt: Date.now(),
    data
  };

  return {
    tasksPayload: data.tasksPayload,
    currentPayload: data.currentPayload,
    cached: false,
    ageMs: 0
  };
}

function fetchBattlepassStateScript() {
  return Promise.all([
    fetch('/api/battlepass/tasks/', { credentials: 'include' }).then(response => response.json()),
    fetch('/api/battlepass/current/', { credentials: 'include' }).then(response => response.json())
  ]).then(([tasksPayload, currentPayload]) => ({ tasksPayload, currentPayload }));
}

function queryTabs(queryInfo) {
  return new Promise(resolve => {
    chrome.tabs.query(queryInfo, tabs => resolve(Array.isArray(tabs) ? tabs : []));
  });
}

function isRemangaUrl(url) {
  return /^https?:\/\/(?:[^/]+\.)?remanga\.org\//i.test(String(url || ''));
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

