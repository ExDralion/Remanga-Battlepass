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
  const CARD_UPGRADE_TYPES = {
    common: { id: 1, label: 'РћР±С‹С‡РЅС‹Р№', required: 2 },
    exclusive: { id: 2, label: 'Р­РєСЃРєР»СЋР·РёРІРЅС‹Р№', required: 3 },
    random: { id: 3, label: 'Р Р°РЅРґРѕРјРЅС‹Р№', required: 3 }
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
      'Р¶РёРІРѕС‚РЅС‹Рµ РєРѕРјРїР°РЅСЊРѕРЅС‹': 70
    },
    genres: {}
  };
  const MANUAL_ONLY_TASK_NAMES = new Set([
    'Р”Р°РІРЅРёР№ Р·РЅР°РєРѕРјС‹Р№',
    'Р‘РѕР»СЊС€Рµ Р·РѕР»РѕС‚Р°'
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
  const LIKE_PLAN_QUERY_PAGES = 6;
  const LIKE_PLAN_PROBE_BATCH_SIZE = 4;
  const SEARCH_HISTORY_LIMIT = 40;
  const REMANGA_API_ORIGIN = 'https://api.remanga.org';
  const READING_FAST_CHUNK_SIZE = 3;
  const READING_FAST_ITEM_DELAY_MS = 350;
  const READING_FAST_SETTLE_ATTEMPTS = 8;
  const READING_FAST_SETTLE_DELAY_MS = 450;
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
    if (!names.length) return 'РќР°РіСЂР°РґР°';
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

  async function claimReadyRewards(progressCb) {
    const state = await loadRewardsState();
    let claimed = 0;
    const claimedRewards = [];

    for (const reward of state.claimableRewards) {
      progressCb?.(`Р—Р°Р±РёСЂР°СЋ РЅР°РіСЂР°РґСѓ: ${reward.version} ${reward.level} СѓСЂРѕРІРµРЅСЊ`);
      await claimReward(reward.level, reward.version);
      claimed += 1;
      claimedRewards.push(reward);
      await smb.sleep(150);
    }

    return {
      claimed,
      ready: state.claimableRewards,
      claimedRewards
    };
  }

  async function claimReadyTasks(progressCb) {
    const state = await loadState();
    let claimed = 0;

    for (const task of state.readyTasks) {
      progressCb?.(`Р—Р°Р±РёСЂР°СЋ: ${task.name}`);
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
    const game = smb.gameFromTask(task);
    return game ? smb.GAME_ROUTES[game] : null;
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
          progressCb?.(`РџСЂРѕРіСЂРµСЃСЃ РІС‹СЂРѕСЃ: ${currentProgress} / ${goal}`);
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
          progressCb?.(`РџСЂРѕРіСЂРµСЃСЃ РІС‹СЂРѕСЃ: ${currentProgress} / ${goal}`);
        } else if (onNoProgress) {
          noProgressItems.push(...batchItems);
          consecutiveNoProgress += batchItems.length;
          const labels = batchItems.map(item => onNoProgress(item)).filter(Boolean);
          if (labels.length === 1) {
            progressCb?.(labels[0]);
          } else if (labels.length > 1) {
            progressCb?.('РџР°РєРµС‚ РІС‹РїРѕР»РЅРµРЅ Р±РµР· РїСЂРёСЂРѕСЃС‚Р° РїСЂРѕРіСЂРµСЃСЃР°.');
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
    return text.includes('РЅР°Р№РґРё РїР°СЂСѓ') || text.includes('РїРѕС‚СЂРµРЅРёСЂСѓР№С‚Рµ РїР°РјСЏС‚СЊ') || text.includes('РЅР°Р№РґРё РµРіРѕ');
  }

  function isDirectGameTask(task) {
    return AUTO_DIRECT_GAME_EVENTS.has(Number(task?.event));
  }

  function isExpertRatingTask(task) {
    if (AUTO_EXPERT_RATING_EVENTS.has(Number(task?.event))) return true;
    const text = smb.normalizeText(`${task?.name || ''} ${task?.description || ''}`);
    return text.includes('РѕС†РµРЅРёС‚Рµ С‚Р°Р№С‚Р»') || text.includes('РѕС†РµРЅРёС‚Рµ РїСЂРѕРёР·РІРµРґРµРЅРёРµ') || text.includes('РїРѕСЃС‚Р°РІСЊ РѕС†РµРЅРєСѓ') || text.includes('РѕС†РµРЅРєР° СЌРєСЃРїРµСЂС‚Р°');
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
    return text.includes('СЏ РјС‹ РѕРґРЅРѕ С†РµР»РѕРµ') || (text.includes('РіРёР»СЊРґ') && text.includes('Р·Р°СЏРІ'));
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
    return text.includes('РІРїРµСЂС‘Рґ Р·Р° РїРѕРєСѓРїРєР°РјРё') || (text.includes('РїСЂРµРґРјРµС‚ РєР°СЃС‚РѕРјРёР·Р°С†РёРё') && text.includes('РєСѓРїРё'));
  }

  function isTicketSpendTask(task) {
    if (AUTO_TICKET_SPEND_EVENTS.has(Number(task?.event))) return true;
    const text = smb.normalizeText(`${task?.name || ''} ${task?.description || ''}`);
    return text.includes('РїРѕС‚СЂР°С‚СЊ С‚РёРєРµС‚С‹') || (text.includes('С‚РёРєРµС‚') && text.includes('РіР»Р°РІ'));
  }

  function isDeckCardTask(task) {
    return AUTO_DECK_CARD_EVENTS.has(Number(task?.event));
  }

  function isCardUpgradeTask(task) {
    if (AUTO_CARD_UPGRADE_EVENTS.has(Number(task?.event))) return true;
    const text = smb.normalizeText(`${task?.name || ''} ${task?.description || ''}`);
    return (
      text.includes('РїРѕС…РѕР¶Рµ РЅР° С‚СЂРёРїР»РµС‚') ||
      (text.includes('РєР°СЂС‚РѕС‡') && text.includes('Р°РїРіСЂРµР№Рґ')) ||
      (text.includes('РєР°СЂС‚РѕС‡') && text.includes('СѓР»СѓС‡С€')) ||
      (text.includes('РєР°СЂС‚') && text.includes('Р°РїРіСЂРµР№Рґ'))
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

    if (text.includes('РїРѕРєСѓРї')) {
      return 'РўСЂРµР±СѓРµС‚ РїРѕРєСѓРїРєРё РёР»Рё РґСЂСѓРіРѕРіРѕ РїР»Р°С‚РЅРѕРіРѕ РґРµР№СЃС‚РІРёСЏ РЅР° СЃР°Р№С‚Рµ.';
    }
    if (text.includes('СѓР»СѓС‡С€') || text.includes('РёРЅРІРµРЅС‚Р°СЂ')) {
      return 'РўСЂРµР±СѓРµС‚ СЂСѓС‡РЅРѕРіРѕ РІС‹Р±РѕСЂР° РїСЂРµРґРјРµС‚Р° РёР»Рё СѓР»СѓС‡С€РµРЅРёСЏ РІ РёРЅС‚РµСЂС„РµР№СЃРµ.';
    }
    if (text.includes('Р·РЅР°РєРѕРј') || text.includes('РґСЂСѓР·')) {
      return 'РЎРІСЏР·Р°РЅР° СЃ СЃРѕС†РёР°Р»СЊРЅС‹Рј РґРµР№СЃС‚РІРёРµРј, РєРѕС‚РѕСЂРѕРµ РїРѕРєР° Р±РµР·РѕРїР°СЃРЅРµРµ РѕСЃС‚Р°РІРёС‚СЊ СЂСѓС‡РЅС‹Рј.';
    }
    if (text.includes('Р·РѕР»РѕС‚') || text.includes('РґРѕРЅР°С‚') || text.includes('РїРѕРїРѕР»РЅ')) {
      return 'Р—Р°РІРёСЃРёС‚ РѕС‚ Р·РѕР»РѕС‚Р° РёР»Рё РїРѕРїРѕР»РЅРµРЅРёСЏ Р±Р°Р»Р°РЅСЃР°, РїРѕСЌС‚РѕРјСѓ РЅРµ Р°РІС‚РѕРјР°С‚РёР·РёСЂСѓРµС‚СЃСЏ.';
    }

    return 'РћСЃС‚Р°РІР»РµРЅР° РІ СЂСѓС‡РЅРѕРј СЂРµР¶РёРјРµ, С‡С‚РѕР±С‹ РЅРµ Р»РѕРјР°С‚СЊ СЃС†РµРЅР°СЂРёР№ Рё РЅРµ С‚СЂРѕРіР°С‚СЊ С‡СѓРІСЃС‚РІРёС‚РµР»СЊРЅС‹Рµ РґРµР№СЃС‚РІРёСЏ.';
  }

  function getSearchField(task) {
    return Number(task?.event) === 8 ? 'genres' : 'categories';
  }

  function extractTagNames(task) {
    const description = String(task?.description || '');
    const match = description.match(/(?:Р¶Р°РЅСЂ|Р¶Р°РЅСЂР°|Р¶Р°РЅСЂС‹|РєР°С‚РµРіРѕСЂРёСЏ|РєР°С‚РµРіРѕСЂРёРё)\s*:\s*(.+?)(?:[.!]|$)/i);
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

  function getReadableTitleName(entity, fallback = 'С‚Р°Р№С‚Р»') {
    return entity?.rus_name
      || entity?.main_name
      || entity?.secondary_name
      || entity?.en_name
      || entity?.dir
      || fallback;
  }

  function getReadableChapterLabel(entity, fallback = 'РіР»Р°РІР°') {
    const titleName = getReadableTitleName(entity, fallback);
    const chapterId = entity?.chapterId || entity?.id || null;
    return chapterId ? `${titleName} #${chapterId}` : titleName;
  }

  function getTitleLicenseBlockReason(title) {
    const statusText = smb.normalizeText(`${title?.status?.name || ''} ${title?.translate_status?.name || ''}`);
    if (title?.is_licensed || statusText.includes('Р»РёС†РµРЅР·')) return 'Р›РёС†РµРЅР·РёСЂРѕРІР°РЅРЅС‹Р№ С‚Р°Р№С‚Р»';
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

  async function getFreeChapters(dir, limit = 1) {
    const title = await getTitleDetails(dir);
    if (getTitleLicenseBlockReason(title)) return [];

    const branch = Array.isArray(title?.branches) ? title.branches[0] : null;
    if (!branch?.id) return [];
    const unreadStartIndex = getUnreadChapterStartIndex(title);

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

    for (let page = 1; page <= 8 && chaptersOut.length < limit; page += 1) {
      const chapters = await smb.apiGet(`/api/v2/titles/chapters/?branch_id=${branch.id}&chapter=&ordering=index&count=30&page=${page}&user_data=1`);
      appendReadableChapters(chapters);
      if (!chapters?.next) break;
    }

    for (let page = 1; page <= 6 && chaptersOut.length < limit; page += 1) {
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
    const limit = Math.max(remaining * 3, 10);
    const candidateMap = createCandidateMap();

    const shouldSkipCandidate = (candidate, ignoreHistory = false) => {
      if (!candidate?.dir || selectedDirs.has(candidate.dir) || probedDirs.has(candidate.dir)) return true;
      if (!ignoreHistory && visitedDirs.has(candidate.dir)) return true;
      if (!ignoreHistory && failedDirs.has(candidate.dir)) return true;
      if (!ignoreHistory && blacklistedDirs.has(candidate.dir)) return true;
      return false;
    };

    const probeCandidate = async candidate => {
      probedDirs.add(candidate.dir);
      const freeChapter = (await getFreeChapters(candidate.dir, 1)).find(chapter => !viewedChapters.has(chapter.id));
      if (!freeChapter?.id) return null;
      return {
        dir: candidate.dir,
        rus_name: candidate.rus_name,
        avg_rating: candidate.avg_rating,
        chapterId: freeChapter.id,
        chapterUrl: freeChapter.url
      };
    };

    const probeCandidates = async (candidates, ignoreHistory = false) => {
      const ordered = candidates
        .filter(candidate => !shouldSkipCandidate(candidate, ignoreHistory))
        .sort((left, right) => right.avg_rating - left.avg_rating);

      for (let index = 0; index < ordered.length && selectedTitles.length < limit; index += WORLD_TRAVEL_PROBE_BATCH_SIZE) {
        const batch = ordered.slice(index, index + WORLD_TRAVEL_PROBE_BATCH_SIZE);
        const settled = await Promise.allSettled(batch.map(probeCandidate));
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

    if (!selectedTitles.length) {
      probedDirs.clear();
      await probeCandidates([...candidateMap.values()], true);
    }

    return {
      remaining,
      selectedTitles
    };
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

    const selectedChapters = [];
    const ordered = [...candidateMap.values()].sort((left, right) => right.avg_rating - left.avg_rating);
    for (const candidate of ordered) {
      if (selectedChapters.length >= Math.max(remaining * 2, 20)) break;
      if (blacklistedDirs.has(candidate.dir)) continue;

      const freeChapters = await getFreeChapters(candidate.dir, Math.max(remaining, 12));
      for (const chapter of freeChapters) {
        if (viewedChapters.has(chapter.id)) continue;
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
    const probedDirs = new Set();
    const limit = Math.max(remaining * 2, 20);
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
            selectedChapterIds.add(chapter.chapterId);
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
    if (!ids.length) throw new Error('РќРµ РїРµСЂРµРґР°РЅС‹ РіР»Р°РІС‹ РґР»СЏ Р»Р°Р№РєР°.');
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

    throw lastError || new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РѕС†РµРЅРєСѓ С‚Р°Р№С‚Р»Р°.');
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
    return message.includes('РІС‹ РЅРµ РјРѕР¶РµС‚Рµ РѕСЃС‚Р°РІР»СЏС‚СЊ РєРѕРјРјРµРЅС‚Р°СЂРёРё');
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
    if (!profileId) throw new Error('РќРµ РїРµСЂРµРґР°РЅ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РґР»СЏ РїРѕСЃРµС‰РµРЅРёСЏ РїСЂРѕС„РёР»СЏ.');

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
    if (!userId) throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ С‚РµРєСѓС‰РµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.');
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
          reject(new Error(response?.error || 'Р¤РѕРЅРѕРІС‹Р№ СЃС†РµРЅР°СЂРёР№ РЅРµ РІС‹РїРѕР»РЅРёР»СЃСЏ.'));
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
      const detail = extractApiErrorMessage(response?.data) || response?.text || 'API-Р·Р°РїСЂРѕСЃ Р·Р°РІРµСЂС€РёР»СЃСЏ РѕС€РёР±РєРѕР№.';
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
      const detail = extractApiErrorMessage(response?.data) || response?.text || 'Profile-context API Р·Р°РІРµСЂС€РёР»СЃСЏ РѕС€РёР±РєРѕР№.';
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
      label: 'Р°РІР°С‚Р°СЂС‹'
    },
    wallpapers: {
      shopType: 'wallpapers',
      filterBy: 'wallpaper',
      currentUserKey: 'wallpaper',
      imageItemType: 'wallpaper',
      label: 'РѕР±РѕРё'
    },
    frames: {
      shopType: 'frames',
      filterBy: 'frame',
      currentUserKey: 'frame',
      imageItemType: 'frame',
      label: 'СЂР°РјРєРё'
    },
    theme: {
      shopType: 'theme',
      filterBy: 'theme',
      currentUserKey: 'theme',
      imageItemType: 'theme',
      label: 'С‚РµРјС‹'
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
      throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РёР»Рё РїСЂРµРґРјРµС‚ РєР°СЃС‚РѕРјРёР·Р°С†РёРё РґР»СЏ API.');
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
      throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РґР»СЏ СЃРЅСЏС‚РёСЏ РїСЂРµРґРјРµС‚Р° РєР°СЃС‚РѕРјРёР·Р°С†РёРё.');
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
      throw new Error(`РЎР°Р№С‚ РЅРµ РїСЂРёРјРµРЅРёР» РґСЂСѓРіРѕР№ РїСЂРµРґРјРµС‚ С‡РµСЂРµР· API (${categoryMeta.label}).`);
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
    if (!userId) throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ С‚РµРєСѓС‰РµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.');

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
      throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ СЂР°Р·РѕР±СЂР°С‚СЊ С‚РµРіРё РёР· РѕРїРёСЃР°РЅРёСЏ Р·Р°РґР°С‡Рё.');
    }

    const candidateMap = createCandidateMap();
    const previewMode = Boolean(options.preview);
    const selectionLimit = previewMode ? Math.max(remaining, 3) : Math.max(remaining * 4, 6);
    const minimumStrongCandidates = Math.max(remaining, 1);
    let resolvedTags = [];

    resolvedTags = await collectFilterCandidates(field, tagNames, candidateMap);
    if (!resolvedTags.length) {
      throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РЅР°Р№С‚Рё ID РЅСѓР¶РЅС‹С… Р¶Р°РЅСЂРѕРІ РёР»Рё РєР°С‚РµРіРѕСЂРёР№ РґР»СЏ С„РёР»СЊС‚СЂР° РєР°С‚Р°Р»РѕРіР°.');
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
      taskName: String(task?.name || 'Р—Р°РґР°С‡Р°'),
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
              reason: 'РЅРµС‚ РїРѕРґС…РѕРґСЏС‰РµР№ Р±РµСЃРїР»Р°С‚РЅРѕР№ РЅРµРїСЂРѕС‡РёС‚Р°РЅРЅРѕР№ РіР»Р°РІС‹ РёР»Рё РЅРёР¶Рµ РїСЂРёРѕСЂРёС‚РµС‚'
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
        warnings: ['РћС‚РїСЂР°РІРєР° Р±СѓРґРµС‚ РёРґС‚Рё Р±С‹СЃС‚СЂС‹РјРё РїРѕСЃР»РµРґРѕРІР°С‚РµР»СЊРЅС‹РјРё СЃРµСЂРёСЏРјРё, РЅРµ РѕРґРЅРёРј РїР°СЂР°Р»Р»РµР»СЊРЅС‹Рј РїР°РєРµС‚РѕРј.'],
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
        warnings: ['РљР°Р¶РґС‹Р№ Р»Р°Р№Рє Р±СѓРґРµС‚ РѕС‚РґРµР»СЊРЅС‹Рј POST С‡РµСЂРµР· РЅРѕРІС‹Р№ endpoint ReManga; РµСЃР»Рё battlepass РЅРµ СЂР°СЃС‚С‘С‚ РґРІРµ СЃРµСЂРёРё РїРѕРґСЂСЏРґ, runner РѕСЃС‚Р°РЅРѕРІРёС‚СЃСЏ.'],
        expectedProgress: `${Number(task?.progress || 0)}/${Number(task?.goal || 0)} -> ${Math.min(Number(task?.goal || 0), Number(task?.progress || 0) + plan.selectedChapters.length)}/${Number(task?.goal || 0)}`
      });
    }

    return makeDryRunResult(task, {
      kind: getTaskVisualKind(task),
      warnings: ['Р”Р»СЏ СЌС‚РѕР№ Р·Р°РґР°С‡Рё РїРѕРєР° РґРѕСЃС‚СѓРїРµРЅ С‚РѕР»СЊРєРѕ РѕР±С‰РёР№ РїСЂРµРґРїСЂРѕСЃРјРѕС‚СЂ.'],
      requests: ['Р—Р°РґР°С‡Р° Р±СѓРґРµС‚ РІС‹РїРѕР»РЅРµРЅР° С‡РµСЂРµР· С‚РµРєСѓС‰РёР№ API-СЂР°РЅРЅРµСЂ Р±РµР· РѕС‚РєСЂС‹С‚РёСЏ РЅРѕРІС‹С… РІРєР»Р°РґРѕРє.']
    });
  }

  async function runAutonomousMemoryTask(task, progressCb) {
    if (!isAutonomousMemoryTask(task)) {
      throw new Error('Р­С‚Р° Р·Р°РґР°С‡Р° РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє Р°РІС‚РѕРЅРѕРјРЅРѕР№ memory-РёРіСЂРµ.');
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

    progressCb?.('РћС‚РїСЂР°РІР»СЏСЋ Р·Р°РІРµСЂС€РµРЅРёРµ memory С‡РµСЂРµР· API...');
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
      throw new Error('РЎР°Р№С‚ РЅРµ Р·Р°СЃС‡РёС‚Р°Р» memory РїРѕСЃР»Рµ РїСЂСЏРјРѕРіРѕ API-РІС‹Р·РѕРІР°.');
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Р—Р°Р±РёСЂР°СЋ РЅР°РіСЂР°РґСѓ: ${finalTask.name}`);
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
      throw new Error('Р­С‚Р° Р·Р°РґР°С‡Р° РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє РёРЅРІРµРЅС‚Р°СЂСЋ РёР»Рё РєР°СЃС‚РѕРјРёР·Р°С†РёРё.');
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

    for (const categoryKey of ['avatars', 'frames', 'wallpapers', 'theme']) {
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
        throw new Error('РЎР°Р№С‚ РЅРµ Р·Р°СЃС‡РёС‚Р°Р» СЃРјРµРЅСѓ РѕС„РѕСЂРјР»РµРЅРёСЏ.');
      }

      let claimed = false;
      if (smb.isTaskReady(finalTask)) {
        progressCb?.(`Р—Р°Р±РёСЂР°СЋ РЅР°РіСЂР°РґСѓ: ${finalTask.name}`);
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
      throw new Error('Р­С‚Р° Р·Р°РґР°С‡Р° РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє РїРѕСЃРµС‰РµРЅРёСЋ СЃРІРѕРµРіРѕ РїСЂРѕС„РёР»СЏ.');
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

    progressCb?.('РћС‚РєСЂС‹РІР°СЋ СЃРІРѕР№ РїСЂРѕС„РёР»СЊ С„РѕРЅРѕРІС‹Рј Р·Р°РїСЂРѕСЃРѕРј...');
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
      throw new Error('РЎР°Р№С‚ РЅРµ Р·Р°СЃС‡РёС‚Р°Р» РїРѕСЃРµС‰РµРЅРёРµ СЃРІРѕРµРіРѕ РїСЂРѕС„РёР»СЏ.');
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Р—Р°Р±РёСЂР°СЋ РЅР°РіСЂР°РґСѓ: ${finalTask.name}`);
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
      commentText: normalizeAutomationText(settings?.commentTaskText, 'РЎРїР°СЃРёР±Рѕ Р·Р° РіР»Р°РІСѓ!'),
      replyText: normalizeAutomationText(settings?.commentReplyTaskText, 'РЎРїР°СЃРёР±Рѕ Р·Р° РѕС‚РІРµС‚!')
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
        progressCb?.(`РњР°РіР°Р·РёРЅ ${type}: РЅР°Р№РґРµРЅРѕ РїРѕРґС…РѕРґСЏС‰РёС… ${candidates.length}`);
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
      throw new Error(`РќРµ РЅР°Р№РґРµРЅ РґРѕСЃС‚СѓРїРЅС‹Р№ РїСЂРµРґРјРµС‚ РєР°СЃС‚РѕРјРёР·Р°С†РёРё Р·Р° РјРѕРЅРµС‚С‹. Р‘Р°Р»Р°РЅСЃ РјРѕР»РЅРёР№: ${availableCoins}, РјРёРЅРёРјСѓРј РґР»СЏ РїРѕРєСѓРїРєРё: ${SHOP_MIN_CUSTOMIZATION_COST}.`);
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
      throw new Error('Р­С‚Р° Р·Р°РґР°С‡Р° РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє РїРѕРєСѓРїРєРµ РєР°СЃС‚РѕРјРёР·Р°С†РёРё РІ РјР°РіР°Р·РёРЅРµ.');
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

    progressCb?.('РџРѕРґР±РёСЂР°СЋ СЃР°РјС‹Р№ РґРµС€РµРІС‹Р№ РїСЂРµРґРјРµС‚ РєР°СЃС‚РѕРјРёР·Р°С†РёРё РІ РјР°РіР°Р·РёРЅРµ...');
    const plan = await buildShopPurchasePlan(progressCb);
    progressCb?.(`РџРѕРєСѓРїР°СЋ: ${plan.selected.name} (${plan.selected.type}) Р·Р° ${plan.selected.cost} РјРѕР»РЅРёР№.`);
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
      throw new Error('РџРѕРєСѓРїРєР° РїСЂРѕС€Р»Р°, РЅРѕ СЃР°Р№С‚ РЅРµ Р·Р°СЃС‡РёС‚Р°Р» Р·Р°РґР°С‡Сѓ.');
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Р—Р°Р±РёСЂР°СЋ РЅР°РіСЂР°РґСѓ: ${finalTask.name}`);
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

  async function fetchPaidTicketChapterFromTitle(dir, progressCb) {
    const details = await getTitleDetails(dir).catch(() => null);
    const branchId = Number(details?.active_branch?.id || details?.branches?.[0]?.id || 0);
    if (!branchId) return null;
    const titleName = getReadableTitleName(details, dir);

    for (let page = 1; page <= 3; page += 1) {
      const payload = await smb.apiGet(`/api/v2/titles/chapters/?branch_id=${branchId}&chapter=&ordering=-index&count=30&page=${page}&user_data=1`).catch(() => null);
      const chapters = Array.isArray(payload?.results) ? payload.results : [];
      const chapter = chapters.find(item => {
        if (!item || item.is_bought || item.is_free_today) return false;
        if (!isLockedChapter(item)) return false;
        return Number.parseFloat(String(item?.price ?? '').replace(',', '.')) > 0;
      });
      if (chapter) {
        return {
          dir,
          titleName,
          branchId,
          chapterId: Number(chapter.id),
          chapterIndex: Number(chapter.index || chapter.chapter || 0),
          price: Number.parseFloat(String(chapter.price ?? '').replace(',', '.')) || 0,
          url: `https://remanga.org/manga/${encodeURIComponent(dir)}/${Number(chapter.id)}`
        };
      }
      progressCb?.(`РџСЂРѕРІРµСЂСЏСЋ РїР»Р°С‚РЅС‹Рµ РіР»Р°РІС‹: ${titleName}, СЃС‚СЂР°РЅРёС†Р° ${page}`);
      if (!payload?.next || !chapters.length) break;
    }

    return null;
  }

  async function buildTicketSpendPlan(progressCb) {
    const currentUser = await getCurrentUserProfile();
    const ticketBalance = getTicketBalanceFromUser(currentUser);
    if (ticketBalance <= 0) {
      throw new Error('РќР° Р°РєРєР°СѓРЅС‚Рµ РЅРµС‚ С‚РёРєРµС‚РѕРІ РґР»СЏ РїРѕРєСѓРїРєРё РіР»Р°РІС‹.');
    }

    const dirs = [];
    const seen = new Set();
    for (const dir of TICKET_CHAPTER_SOURCE_DIRS) {
      if (!dir || seen.has(dir)) continue;
      seen.add(dir);
      dirs.push(dir);
    }

    for (let page = 1; page <= 3 && dirs.length < 18; page += 1) {
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
        if (dirs.length >= 18) break;
      }
      if (!payload?.next) break;
    }

    for (const dir of dirs) {
      const chapter = await fetchPaidTicketChapterFromTitle(dir, progressCb);
      if (chapter) {
        return {
          ticketBalance,
          chapter
        };
      }
    }

    throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РЅР°Р№С‚Рё РїР»Р°С‚РЅСѓСЋ РЅРµРєСѓРїР»РµРЅРЅСѓСЋ РіР»Р°РІСѓ, РєРѕС‚РѕСЂСѓСЋ РјРѕР¶РЅРѕ РѕС‚РєСЂС‹С‚СЊ Р·Р° С‚РёРєРµС‚.');
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
      return buttons.find(button => normalize(button.innerText || button.textContent).includes('РѕС‚РєСЂС‹С‚СЊ Р·Р° 1')) ||
        buttons.find(button => {
          const text = normalize(button.innerText || button.textContent);
          return text.includes('С‚РёРєРµС‚') && (text.includes('РѕС‚РєСЂС‹С‚СЊ') || text.includes('РєСѓРїРёС‚СЊ') || text.includes('РїРѕР»СѓС‡РёС‚СЊ'));
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
        throw new Error(`РќРµ РЅР°Р№РґРµРЅР° РєРЅРѕРїРєР° РѕС‚РєСЂС‹С‚РёСЏ Р·Р° С‚РёРєРµС‚. РўРµРєСЃС‚ СЃС‚СЂР°РЅРёС†С‹: ${(doc?.body?.innerText || '').slice(0, 300)}`);
      }

      progressCb?.('РќР°Р¶РёРјР°СЋ РѕС‚РєСЂС‹С‚РёРµ РіР»Р°РІС‹ Р·Р° 1 С‚РёРєРµС‚...');
      await clickNode(ticketButton);
      await smb.sleep(900);

      const docAfterClick = getFrameDocument();
      const confirmButton = docAfterClick ? allButtons(docAfterClick).find(button => {
        const text = normalize(button.innerText || button.textContent);
        if (!text || text.includes('РѕС‚РјРµРЅР°') || text.includes('Р·Р°РєСЂС‹С‚СЊ')) return false;
        return (
          text.includes('РїРѕРґС‚РІРµСЂРґ') ||
          text.includes('РєСѓРїРёС‚СЊ') ||
          text.includes('РѕС‚РєСЂС‹С‚СЊ Р·Р° 1') ||
          (text.includes('РѕС‚РєСЂС‹С‚СЊ') && text.includes('С‚РёРєРµС‚'))
        );
      }) : null;

      if (confirmButton && confirmButton !== ticketButton) {
        progressCb?.('РџРѕРґС‚РІРµСЂР¶РґР°СЋ РїРѕРєСѓРїРєСѓ РіР»Р°РІС‹ Р·Р° С‚РёРєРµС‚...');
        await clickNode(confirmButton);
      }

      const unlocked = await waitUntil(() => {
        const doc = getFrameDocument();
        if (!doc?.body) return null;
        const text = doc.body.innerText || '';
        const stillLocked = text.includes('РћС‚РєСЂС‹С‚СЊ Р·Р° 1') && text.toLowerCase().includes('С‚РёРєРµС‚');
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
        throw new Error(`РЎР°Р№С‚ РЅРµ РїРѕРєР°Р·Р°Р», С‡С‚Рѕ РіР»Р°РІР° РѕС‚РєСЂС‹С‚Р° Р·Р° С‚РёРєРµС‚. РўРµРєСЃС‚ СЃС‚СЂР°РЅРёС†С‹: ${(doc?.body?.innerText || '').slice(0, 300)}`);
      }

      return unlocked;
    } finally {
      frame.remove();
    }
  }

  async function runTicketSpendTask(task, progressCb) {
    assertTaskAutomatable(task);

    if (!isTicketSpendTask(task)) {
      throw new Error('Р­С‚Р° Р·Р°РґР°С‡Р° РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє С‚СЂР°С‚Рµ С‚РёРєРµС‚РѕРІ.');
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

    progressCb?.('РџРѕРґР±РёСЂР°СЋ РїР»Р°С‚РЅСѓСЋ РіР»Р°РІСѓ РґР»СЏ РѕС‚РєСЂС‹С‚РёСЏ Р·Р° С‚РёРєРµС‚...');
    const plan = await buildTicketSpendPlan(progressCb);
    progressCb?.(`РћС‚РєСЂС‹РІР°СЋ Р·Р° С‚РёРєРµС‚: ${plan.chapter.titleName}, РіР»Р°РІР° ${plan.chapter.chapterIndex || plan.chapter.chapterId}.`);

    let response = null;
    let iframeError = null;
    try {
      response = await runTicketSpendInIframe(plan.chapter.url, progressCb);
    } catch (error) {
      iframeError = error;
      progressCb?.(`Iframe-РѕС‚РєСЂС‹С‚РёРµ РЅРµ СЃСЂР°Р±РѕС‚Р°Р»Рѕ, РїСЂРѕР±СѓСЋ background: ${error?.message || error}`);
    }

    if (!response?.purchased) {
      response = await sendRuntimeMessage({
        type: 'smbp_run_ticket_spend_task',
        url: plan.chapter.url
      }).catch(error => {
        if (iframeError) {
          throw new Error(`Iframe: ${iframeError.message || iframeError}; background: ${error?.message || error}`);
        }
        throw error;
      });
    }

    if (!response?.purchased) {
      throw new Error(response?.error || 'РЎР°Р№С‚ РЅРµ РїРѕРґС‚РІРµСЂРґРёР» РїРѕРєСѓРїРєСѓ РіР»Р°РІС‹ Р·Р° С‚РёРєРµС‚.');
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
      throw new Error('Р“Р»Р°РІР° РѕС‚РєСЂС‹С‚Р° Р·Р° С‚РёРєРµС‚, РЅРѕ СЃР°Р№С‚ РЅРµ Р·Р°СЃС‡РёС‚Р°Р» Р·Р°РґР°С‡Сѓ.');
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Р—Р°Р±РёСЂР°СЋ РЅР°РіСЂР°РґСѓ: ${finalTask.name}`);
      await smb.claimTask(finalTask.id);
      claimed = true;
      const claimedState = await loadState();
      finalTask = claimedState.tasks.find(item => item.id === beforeTask.id) || finalTask;
    }

    return {
      before: beforeTask,
      after: finalTask,
      claimed,
      chapter: plan.chapter
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
        throw new Error(`РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РєР°СЂС‚С‹ РґР»СЏ Р°РїРіСЂРµР№РґР°: ${error?.message || error}`);
      });
      const results = Array.isArray(payload?.results) ? payload.results : [];
      allItems.push(...results);
      progressCb?.(`Р—Р°РіСЂСѓР¶РµРЅРѕ РєР°СЂС‚ РґР»СЏ Р°РїРіСЂРµР№РґР°: ${allItems.length}`);
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
      label: characterName || titleName || `РљР°СЂС‚Р° #${card?.id || item?.id || '?'}`,
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
        label: `${first.titleName || 'РўР°Р№С‚Р»'} В· ${first.rankLabel}`,
        meta: `${expanded.length} РєР°СЂС‚ РѕРґРЅРѕРіРѕ РїСЂРѕРёР·РІРµРґРµРЅРёСЏ Рё СЂР°РЅРіР°`,
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
          label: `Р Р°РЅРі ${rankLabel}`,
          meta: `${total} РєР°СЂС‚. РќСѓР¶РЅРѕ РјРёРЅРёРјСѓРј 3 РєР°СЂС‚С‹ РѕРґРЅРѕРіРѕ СЂР°РЅРіР° РёР· СЂР°Р·РЅС‹С… РїСЂРѕРёР·РІРµРґРµРЅРёР№.`,
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
        label: `Р Р°РЅРі ${rankLabel}`,
        meta: `${total} РєР°СЂС‚. Р‘СѓРґСѓС‚ РІС‹Р±СЂР°РЅС‹ 3 СЃР»СѓС‡Р°Р№РЅС‹Рµ РєР°СЂС‚С‹ СЂР°Р·РЅС‹С… РїСЂРѕРёР·РІРµРґРµРЅРёР№.`,
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
      throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ С‚РµРєСѓС‰РёР№ Р°РєРєР°СѓРЅС‚ РґР»СЏ РѕС‚РєСЂС‹С‚РёСЏ РїР°РєР°.');
    }
    const deckCandidates = await getDeckIdCandidatesFromValue(deckIdSource);
    let deckId = null;
    let deckMeta = null;
    let deckInstanceId = null;

    progressCb?.(`РС‰Сѓ РЅРµРѕС‚РєСЂС‹С‚СѓСЋ РєРѕР»РѕРґСѓ СЃСЂРµРґРё РїР°РєРѕРІ: ${deckCandidates.join(', ')}...`);

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
      throw new Error(`РќРµ РЅР°С€С‘Р» РЅРµРѕС‚РєСЂС‹С‚СѓСЋ РєРѕР»РѕРґСѓ СЃСЂРµРґРё РЅР°СЃС‚СЂРѕРµРЅРЅС‹С… РїР°РєРѕРІ: ${deckCandidates.join(', ')}.`);
    }

    progressCb?.(`РћС‚РєСЂС‹РІР°СЋ РєРѕР»РѕРґСѓ #${deckInstanceId} РёР· РїР°РєР° #${deckId}...`);
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
      throw new Error('РњРѕРґР°Р»РєР° РІС‹Р±РѕСЂР° РєР°СЂС‚ РЅРµ РёРЅРёС†РёР°Р»РёР·РёСЂРѕРІР°РЅР°.');
    }

    progressCb?.('РљРѕР»РѕРґР° РѕС‚РєСЂС‹С‚Р°. Р’С‹Р±РµСЂРё РєР°СЂС‚Сѓ РІ РѕРєРЅРµ SailorM...');
    const chosenCard = await smb.showDeckChoiceModal({
      deckName: deckMeta?.name || 'РљРѕР»РѕРґР°',
      premiumAvailable: Boolean(user?.is_premium),
      cards
    });

    progressCb?.(`Р—Р°Р±РёСЂР°СЋ РєР°СЂС‚Сѓ: ${chosenCard.label}`);
    await chooseInventoryDeckCard(deckInstanceId, chosenCard.id);

    return {
      deckId,
      deckInstanceId,
      deckName: deckMeta?.name || 'РљРѕР»РѕРґР°',
      chosenCard,
      cards
    };
  }

  function buildDeckCardLabel(card) {
    const characterName = String(card?.character?.name || '').trim();
    const titleName = String(card?.title?.main_name || '').trim();
    return characterName || titleName || `РљР°СЂС‚Р° #${card?.id || '?'}`;
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
    if (!currentUserId) throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ С‚РµРєСѓС‰РµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РґР»СЏ РѕР±РјРµРЅР°.');

    const targetUserIds = await getExchangeTargetCandidates(currentUserId);
    if (!targetUserIds.length) {
      throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР±СЂР°С‚СЊ СЃРїРёСЃРѕРє РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ РґР»СЏ СЃР»СѓС‡Р°Р№РЅРѕРіРѕ РѕР±РјРµРЅР°.');
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

    throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕРґРѕР±СЂР°С‚СЊ РѕР±РјРµРЅ, РІ РєРѕС‚РѕСЂРѕРј РµСЃС‚СЊ С…РѕС‚СЏ Р±С‹ РѕРґРЅР° РґРѕСЃС‚СѓРїРЅР°СЏ РєР°СЂС‚РѕС‡РєР°.');
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
          lastError = new Error('РЎР°Р№С‚ РЅРµ РїРѕРґС‚РІРµСЂРґРёР» РѕС‚РјРµРЅСѓ РѕР±РјРµРЅР°.');
        } catch (error) {
          lastError = error;
        }
      }
    }

    throw lastError || new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РјРµРЅРёС‚СЊ РѕС‚РїСЂР°РІР»РµРЅРЅС‹Р№ РѕР±РјРµРЅ.');
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
      throw new Error('Р­С‚Р° Р·Р°РґР°С‡Р° РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє РѕР±РјРµРЅР°Рј РєР°СЂС‚РѕС‡РєР°РјРё.');
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

    progressCb?.('РџРѕРґР±РёСЂР°СЋ СЃР»СѓС‡Р°Р№РЅРѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РґР»СЏ РѕР±РјРµРЅР°...');
    const plan = await buildExchangePlan(beforeTask);
    let exchangeId = 0;
    let canceledExchange = null;
    let mainError = null;

    try {
      progressCb?.(`РћС‚РїСЂР°РІР»СЏСЋ РѕР±РјРµРЅ РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ #${plan.targetUserId}...`);
      const creatorCards = plan.creatorCard?.inventoryItemId ? [plan.creatorCard.inventoryItemId] : [];
      const partnerCards = plan.partnerCard?.inventoryItemId ? [plan.partnerCard.inventoryItemId] : [];
      if (!creatorCards.length && !partnerCards.length) {
        throw new Error('РќРµР»СЊР·СЏ РѕС‚РїСЂР°РІРёС‚СЊ РѕР±РјРµРЅ Р±РµР· РµРґРёРЅРѕР№ РєР°СЂС‚РѕС‡РєРё.');
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
        progressCb?.('РЎР°Р№С‚ РЅРµ РІРµСЂРЅСѓР» id РѕР±РјРµРЅР° СЃСЂР°Р·Сѓ, РїСЂРѕРІРµСЂСЋ РёСЃС‚РѕСЂРёСЋ РїРѕСЃР»Рµ Р·Р°СЃС‡С‘С‚Р°.');
      }

      progressCb?.('РћР±РјРµРЅ РѕС‚РїСЂР°РІР»РµРЅ. Р–РґСѓ Р·Р°СЃС‡С‘С‚ battlepass...');
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
        throw new Error('РЎР°Р№С‚ РЅРµ Р·Р°СЃС‡РёС‚Р°Р» РѕС‚РїСЂР°РІРєСѓ РѕР±РјРµРЅР° РІ battlepass.');
      }

      await rememberExchangeTarget(plan.currentUserId, plan.targetUserId);

      if (!exchangeId) {
        const pendingExchange = await findLatestPendingExchangeOffer(plan.currentUserId, plan.targetUserId);
        exchangeId = Number(pendingExchange?.id || 0);
      }

      if (exchangeId > 0) {
        progressCb?.(`Р—Р°СЃС‡С‘С‚ РїРѕРґС‚РІРµСЂР¶РґС‘РЅ. РћС‚РјРµРЅСЏСЋ РѕР±РјРµРЅ #${exchangeId}...`);
        canceledExchange = await cancelExchangeOffer(plan.currentUserId, plan.targetUserId, exchangeId);
      } else {
        progressCb?.('Р—Р°СЃС‡С‘С‚ РїРѕРґС‚РІРµСЂР¶РґС‘РЅ, РЅРѕ id РѕР±РјРµРЅР° СЃР°Р№С‚ РЅРµ РІРµСЂРЅСѓР».');
      }

      let claimed = false;
      if (smb.isTaskReady(finalTask)) {
        progressCb?.(`Р—Р°Р±РёСЂР°СЋ РЅР°РіСЂР°РґСѓ: ${finalTask.name}`);
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
          progressCb?.(`РџСЂРѕР±СѓСЋ СѓР±СЂР°С‚СЊ РЅРµР·Р°РІРµСЂС€С‘РЅРЅС‹Р№ РѕР±РјРµРЅ #${exchangeId}...`);
          canceledExchange = await cancelExchangeOffer(plan.currentUserId, plan.targetUserId, exchangeId);
        } catch (cancelError) {
          if (!mainError) {
            throw cancelError;
          }
          progressCb?.(`РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РјРµРЅРёС‚СЊ РѕР±РјРµРЅ #${exchangeId}: ${cancelError?.message || cancelError}`);
        }
      }
    }
  }

  async function runNewCardsTask(task, progressCb) {
    if (!isDeckCardTask(task)) {
      throw new Error('Р­С‚Р° Р·Р°РґР°С‡Р° РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє РѕС‚РєСЂС‹С‚РёСЋ РЅРѕРІС‹С… РєР°СЂС‚РѕС‡РµРє.');
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

    progressCb?.('РџРѕРґРіРѕС‚Р°РІР»РёРІР°СЋ РєРѕР»РѕРґСѓ СЃ РЅРѕРІС‹РјРё РєР°СЂС‚РѕС‡РєР°РјРё...');

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
      throw new Error('РЎР°Р№С‚ РЅРµ Р·Р°СЃС‡РёС‚Р°Р» РѕС‚РєСЂС‹С‚РёРµ РЅРѕРІРѕР№ РєР°СЂС‚РѕС‡РєРё РїРѕСЃР»Рµ РІС‹Р±РѕСЂР°.');
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Р—Р°Р±РёСЂР°СЋ РЅР°РіСЂР°РґСѓ: ${finalTask.name}`);
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
      throw new Error('Р­С‚Р° Р·Р°РґР°С‡Р° РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє Р°РїРіСЂРµР№РґСѓ РєР°СЂС‚РѕС‡РµРє.');
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
      throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ С‚РµРєСѓС‰РёР№ Р°РєРєР°СѓРЅС‚ РґР»СЏ Р°РїРіСЂРµР№РґР° РєР°СЂС‚.');
    }

    progressCb?.('Р—Р°РіСЂСѓР¶Р°СЋ РєР°СЂС‚С‹ РґР»СЏ Р°РїРіСЂРµР№РґР°...');
    const rawItems = await listCardUpgradeInventory(currentUserId, progressCb);
    const plan = buildCardUpgradePlan(rawItems);

    if (!plan.commonCandidates.length && !plan.exclusiveCandidates.some(item => !item.disabled) && !plan.randomCandidates.some(item => !item.disabled)) {
      throw new Error('РќРµ РЅР°С€С‘Р» РїРѕРґС…РѕРґСЏС‰РёРµ РєР°СЂС‚С‹ РґР»СЏ Р°РїРіСЂРµР№РґР°. РќСѓР¶РЅРѕ 2 РєР°СЂС‚С‹ РѕРґРЅРѕРіРѕ С‚Р°Р№С‚Р»Р° Рё СЂР°РЅРіР° РёР»Рё 3 РєР°СЂС‚С‹ РѕРґРЅРѕРіРѕ СЂР°РЅРіР° РёР· СЂР°Р·РЅС‹С… РїСЂРѕРёР·РІРµРґРµРЅРёР№.');
    }

    if (typeof smb.showCardUpgradeModal !== 'function') {
      throw new Error('РћРєРЅРѕ РІС‹Р±РѕСЂР° Р°РїРіСЂРµР№РґР° РєР°СЂС‚ РЅРµ РёРЅРёС†РёР°Р»РёР·РёСЂРѕРІР°РЅРѕ.');
    }

    progressCb?.('РћС‚РєСЂС‹Р» РѕРєРЅРѕ РІС‹Р±РѕСЂР° Р°РїРіСЂРµР№РґР° РєР°СЂС‚.');
    const selected = await smb.showCardUpgradeModal(plan);
    if (!selected?.cardIds?.length || !selected?.mergeType) {
      throw new Error('РќРµ РІС‹Р±СЂР°РЅ РІР°СЂРёР°РЅС‚ Р°РїРіСЂРµР№РґР° РєР°СЂС‚.');
    }

    progressCb?.(`Р—Р°РїСѓСЃРєР°СЋ ${selected.typeLabel || 'Р°РїРіСЂРµР№Рґ'}: ${selected.label}`);
    const upgradePayload = await submitCardUpgrade(currentUserId, selected);
    const resultCard = normalizeUpgradeResultCard(upgradePayload);
    progressCb?.(`РџРѕР»СѓС‡РµРЅР° РєР°СЂС‚Р°: ${resultCard.label}${resultCard.rankLabel ? ` В· ${resultCard.rankLabel}` : ''}`);

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
      throw new Error('РЎР°Р№С‚ РЅРµ Р·Р°СЃС‡РёС‚Р°Р» Р°РїРіСЂРµР№Рґ РєР°СЂС‚РѕС‡РµРє РїРѕСЃР»Рµ РІС‹РїРѕР»РЅРµРЅРёСЏ.');
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Р—Р°Р±РёСЂР°СЋ РЅР°РіСЂР°РґСѓ: ${finalTask.name}`);
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
      throw new Error('Р­С‚Р° Р·Р°РґР°С‡Р° РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє Р¶Р°РЅСЂР°Рј РёР»Рё РєР°С‚РµРіРѕСЂРёСЏРј.');
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

    progressCb?.('РџРѕРґР±РёСЂР°СЋ С‚Р°Р№С‚Р»С‹ С‡РµСЂРµР· РєР°С‚Р°Р»РѕРі /manga...');
    const plan = await buildSearchTaskPlan(beforeTask);

    if (!plan.selectedTitles.length) {
      throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РЅР°Р№С‚Рё РїРѕРґС…РѕРґСЏС‰РёРµ РіР»Р°РІС‹ РґР»СЏ СЌС‚РѕР№ Р·Р°РґР°С‡Рё.');
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
      batchStartMessage: (currentBatch, totalBatches) => `РћС‚РєСЂС‹РІР°СЋ РіР»Р°РІС‹ РїР°РєРµС‚Р°РјРё: ${currentBatch}/${totalBatches}`,
      maxNoProgressItems: 3,
      runItem: async title => {
        progressCb?.(`РћС‚РјРµС‡Р°СЋ РіР»Р°РІСѓ: ${getReadableTitleName(title)}`);
        await submitChapterView(title.chapterId);
        await rememberViewedChapter(title.chapterId, 'reading');
        await rememberVisitedTitle(beforeTask.id, title.dir);
        return title;
      },
      onNoProgress: title => `Р‘РµР· РїСЂРёСЂРѕСЃС‚Р°: ${getReadableTitleName(title)}`
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
      throw new Error('РЎР°Р№С‚ РїСЂРёРЅСЏР» С‡С‚РµРЅРёРµ РЅР°Р№РґРµРЅРЅС‹С… РіР»Р°РІ, РЅРѕ battlepass РЅРµ СѓРІРµР»РёС‡РёР» РїСЂРѕРіСЂРµСЃСЃ Р·Р°РґР°С‡Рё.');
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Р—Р°Р±РёСЂР°СЋ РЅР°РіСЂР°РґСѓ: ${finalTask.name}`);
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
      throw new Error('Р­С‚Р° Р·Р°РґР°С‡Р° РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє РїСѓС‚РµС€РµСЃС‚РІРёСЋ РїРѕ РјРёСЂР°Рј.');
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
        ? 'РџРѕРґР±РёСЂР°СЋ РЅРѕРІС‹Рµ С‚Р°Р№С‚Р»С‹ С‡РµСЂРµР· РєР°С‚Р°Р»РѕРі /manga...'
        : `Р”РѕР±РёСЂР°СЋ РѕСЃС‚Р°РІС€РёРµСЃСЏ РЅРѕРІС‹Рµ С‚Р°Р№С‚Р»С‹: СЂР°СѓРЅРґ ${round}/3...`);

      const plan = await buildWorldTravelPlan(finalTask);
      if (!plan.selectedTitles.length) {
        if (!hadAnyCandidates) {
          throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РЅР°Р№С‚Рё РЅРѕРІС‹Рµ С‚Р°Р№С‚Р»С‹ СЃ Р±РµСЃРїР»Р°С‚РЅС‹РјРё РіР»Р°РІР°РјРё.');
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
        batchStartMessage: (currentBatch, totalBatches) => `РћС‚РєСЂС‹РІР°СЋ РЅРѕРІС‹Рµ С‚Р°Р№С‚Р»С‹ РїРѕ РѕРґРЅРѕРјСѓ: ${currentBatch}/${totalBatches}`,
        maxNoProgressItems: 3,
        runItem: async title => {
          progressCb?.(`РћС‚РјРµС‡Р°СЋ РЅРѕРІС‹Р№ С‚Р°Р№С‚Р»: ${getReadableTitleName(title)}`);
          await submitChapterView(title.chapterId);
          await rememberVisitedTitle(beforeTask.id, title.dir);
          await rememberViewedChapter(title.chapterId, 'reading');
          return title;
        },
        onNoProgress: title => `Р‘РµР· РїСЂРёСЂРѕСЃС‚Р°: ${getReadableTitleName(title)}`
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
        throw new Error('РЎР°Р№С‚ РїСЂРёРЅСЏР» С‡С‚РµРЅРёРµ РЅРѕРІС‹С… С‚Р°Р№С‚Р»РѕРІ, РЅРѕ battlepass РЅРµ СѓРІРµР»РёС‡РёР» РїСЂРѕРіСЂРµСЃСЃ Р·Р°РґР°С‡Рё.');
      }
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Р—Р°Р±РёСЂР°СЋ РЅР°РіСЂР°РґСѓ: ${finalTask.name}`);
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
      progressCb?.(`Р§РёС‚Р°СЋ РіР»Р°РІС‹ Р±С‹СЃС‚СЂС‹РјРё СЃРµСЂРёСЏРјРё: ${chunkIndex + 1}/${chunks.length}`);

      for (const chapter of chunk) {
        try {
          progressCb?.(`РћС‚РјРµС‡Р°СЋ РіР»Р°РІСѓ: ${getReadableChapterLabel(chapter)}`);
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
        progressCb?.(`РџСЂРѕРіСЂРµСЃСЃ РІС‹СЂРѕСЃ: ${currentProgress} / ${goal}`);
      } else {
        noProgressItems.push(...chunk);
        noProgressStreak += 1;
        progressCb?.('Р‘С‹СЃС‚СЂР°СЏ СЃРµСЂРёСЏ РІС‹РїРѕР»РЅРµРЅР° Р±РµР· РїСЂРёСЂРѕСЃС‚Р° РїСЂРѕРіСЂРµСЃСЃР°.');
      }

      if (Number(finalTask?.progress || 0) >= goal || smb.isTaskReady(finalTask)) {
        break;
      }

      if (noProgressStreak >= 2) {
        progressCb?.('РћСЃС‚Р°РЅР°РІР»РёРІР°СЋ С‡С‚РµРЅРёРµ: СЃР°Р№С‚ РїСЂРёРЅСЏР» РґРµР№СЃС‚РІРёСЏ, РЅРѕ battlepass РЅРµ СѓРІРµР»РёС‡РёР» РїСЂРѕРіСЂРµСЃСЃ.');
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
      progressCb?.(`РЎС‚Р°РІР»СЋ Р»Р°Р№РєРё Р±С‹СЃС‚СЂС‹РјРё СЃРµСЂРёСЏРјРё: ${chunkIndex + 1}/${chunks.length}`);

      for (const chapter of chunk) {
        try {
          progressCb?.(`РЎС‚Р°РІР»СЋ Р»Р°Р№Рє: ${getReadableChapterLabel(chapter)}`);
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
        progressCb?.(`РџСЂРѕРіСЂРµСЃСЃ РІС‹СЂРѕСЃ: ${currentProgress} / ${goal}`);
      } else {
        noProgressItems.push(...chunk);
        noProgressStreak += 1;
        progressCb?.('Р‘С‹СЃС‚СЂР°СЏ СЃРµСЂРёСЏ Р»Р°Р№РєРѕРІ РІС‹РїРѕР»РЅРµРЅР° Р±РµР· РїСЂРёСЂРѕСЃС‚Р° РїСЂРѕРіСЂРµСЃСЃР°.');
      }

      if (Number(finalTask?.progress || 0) >= goal || smb.isTaskReady(finalTask)) {
        break;
      }

      if (noProgressStreak >= 2) {
        progressCb?.('РћСЃС‚Р°РЅР°РІР»РёРІР°СЋ Р»Р°Р№РєРё: СЃР°Р№С‚ РїСЂРёРЅСЏР» РґРµР№СЃС‚РІРёСЏ, РЅРѕ battlepass РЅРµ СѓРІРµР»РёС‡РёР» РїСЂРѕРіСЂРµСЃСЃ.');
        break;
      }
    }

    return { processedItems, failures, noProgressItems, finalTask, currentProgress };
  }

  async function runChapterReadTask(task, progressCb) {
    assertTaskAutomatable(task);

    if (!isChapterReadTask(task)) {
      throw new Error('Р­С‚Р° Р·Р°РґР°С‡Р° РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє С‡С‚РµРЅРёСЋ РіР»Р°РІ.');
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
        ? 'РџРѕРґР±РёСЂР°СЋ РЅРѕРІС‹Рµ РіР»Р°РІС‹ С‡РµСЂРµР· API...'
        : `Р”РѕР±РёСЂР°СЋ РѕСЃС‚Р°РІС€РёР№СЃСЏ РїСЂРѕРіСЂРµСЃСЃ РїРѕ РіР»Р°РІР°Рј: СЂР°СѓРЅРґ ${round}/4...`);

      const plan = await buildReadingPlan(finalTask);
      if (!plan.selectedChapters.length) {
        if (!hadAnyCandidates) {
          throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РЅР°Р№С‚Рё РЅРѕРІС‹Рµ Р±РµСЃРїР»Р°С‚РЅС‹Рµ РіР»Р°РІС‹.');
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
        throw new Error('РЎР°Р№С‚ РїСЂРёРЅСЏР» С‡С‚РµРЅРёРµ РіР»Р°РІ, РЅРѕ battlepass РЅРµ СѓРІРµР»РёС‡РёР» РїСЂРѕРіСЂРµСЃСЃ Р·Р°РґР°С‡Рё.');
      }
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Р—Р°Р±РёСЂР°СЋ РЅР°РіСЂР°РґСѓ: ${finalTask.name}`);
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
      throw new Error('Р­С‚Р° Р·Р°РґР°С‡Р° РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє Р»Р°Р№РєР°Рј.');
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

    progressCb?.('РџРѕРґР±РёСЂР°СЋ РЅРµР»Р°Р№РєРЅСѓС‚С‹Рµ РіР»Р°РІС‹ С‡РµСЂРµР· API...');
    const plan = await buildLikePlan(beforeTask);

    if (!plan.selectedChapters.length) {
      throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РЅР°Р№С‚Рё РґРѕСЃС‚СѓРїРЅС‹Рµ РЅРµР»Р°Р№РєРЅСѓС‚С‹Рµ РіР»Р°РІС‹.');
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
      throw new Error('РЎР°Р№С‚ РїСЂРёРЅСЏР» Р»Р°Р№РєРё РіР»Р°РІ, РЅРѕ battlepass РЅРµ СѓРІРµР»РёС‡РёР» РїСЂРѕРіСЂРµСЃСЃ Р·Р°РґР°С‡Рё.');
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Р—Р°Р±РёСЂР°СЋ РЅР°РіСЂР°РґСѓ: ${finalTask.name}`);
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
      throw new Error('Р­С‚Р° Р·Р°РґР°С‡Р° РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚ РїСЂСЏРјРѕРµ РІС‹РїРѕР»РЅРµРЅРёРµ С‡РµСЂРµР· API.');
    }

    const before = await loadState();
    const beforeTask = before.tasks.find(item => item.id === task.id) || task;
    const gameKey = smb.gameFromTask(beforeTask);

    if (!gameKey) {
      throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ РјРёРЅРё-РёРіСЂСѓ РґР»СЏ СЌС‚РѕР№ Р·Р°РґР°С‡Рё.');
    }

    if (Number(beforeTask.progress || 0) >= Number(beforeTask.goal || 0)) {
      return {
        before: beforeTask,
        after: beforeTask,
        claimed: false
      };
    }

    progressCb?.(`РћС‚РїСЂР°РІР»СЏСЋ РїСЂРѕРіСЂРµСЃСЃ ${beforeTask.name} С‡РµСЂРµР· API...`);
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
      progressCb?.(`Р—Р°Р±РёСЂР°СЋ РЅР°РіСЂР°РґСѓ: ${finalTask.name}`);
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
      throw new Error('Р­С‚Р° Р·Р°РґР°С‡Р° РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє РєРѕРјРјРµРЅС‚Р°СЂРёСЏРј.');
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
    progressCb?.('РџСѓР±Р»РёРєСѓСЋ РєРѕРјРјРµРЅС‚Р°СЂРёР№...');
    let created;
    try {
      created = await submitComment(commentText);
    } catch (error) {
      if (isCommentingUnavailableError(error)) {
        throw new Error('Р”Р»СЏ СЌС‚РѕРіРѕ Р°РєРєР°СѓРЅС‚Р° РєРѕРјРјРµРЅС‚Р°СЂРёРё СЃРµР№С‡Р°СЃ РЅРµРґРѕСЃС‚СѓРїРЅС‹.');
      }
      throw error;
    }
    const commentId = Number(created?.content?.id || 0) || null;
    if (!commentId) {
      throw new Error('РЎР°Р№С‚ РЅРµ РІРµСЂРЅСѓР» id РєРѕРјРјРµРЅС‚Р°СЂРёСЏ.');
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
        progressCb?.(`Р—Р°Р±РёСЂР°СЋ РЅР°РіСЂР°РґСѓ: ${finalTask.name}`);
        await smb.claimTask(finalTask.id);
        claimed = true;
        const claimedState = await loadState();
        finalTask = claimedState.tasks.find(item => item.id === beforeTask.id) || finalTask;
      }
    } finally {
      progressCb?.('РЈРґР°Р»СЏСЋ РєРѕРјРјРµРЅС‚Р°СЂРёР№...');
      try {
        await deleteComment(commentId);
        deleted = true;
      } catch (_error) {
        deleted = false;
      }
    }

    if (Number(finalTask.progress || 0) <= currentProgress) {
      throw new Error('РЎР°Р№С‚ РЅРµ Р·Р°СЃС‡РёС‚Р°Р» РєРѕРјРјРµРЅС‚Р°СЂРёР№.');
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
        throw new Error('Р”Р»СЏ СЌС‚РѕРіРѕ Р°РєРєР°СѓРЅС‚Р° РєРѕРјРјРµРЅС‚Р°СЂРёРё СЃРµР№С‡Р°СЃ РЅРµРґРѕСЃС‚СѓРїРЅС‹.');
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
      throw new Error('РЎР°Р№С‚ РЅРµ Р·Р°СЃС‡РёС‚Р°Р» РѕС†РµРЅРєСѓ РєРѕРјРјРµРЅС‚Р°СЂРёРµРІ.');
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
      throw new Error('Р­С‚Р° Р·Р°РґР°С‡Р° РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє РїРѕС…РѕР¶РёРј С‚Р°Р№С‚Р»Р°Рј.');
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

    progressCb?.('РџРѕРґР±РёСЂР°СЋ РїР°СЂС‹ РїРѕС…РѕР¶РёС… С‚Р°Р№С‚Р»РѕРІ...');
    const plan = await buildSimilarPlan(beforeTask);
    if (!plan.selectedVotes.length) {
      throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РЅР°Р№С‚Рё РїР°СЂС‹ РґР»СЏ РіРѕР»РѕСЃРѕРІР°РЅРёСЏ РІ РїРѕС…РѕР¶РµРј.');
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
      batchStartMessage: (currentBatch, totalBatches) => `Р“РѕР»РѕСЃСѓСЋ Р·Р° РїРѕС…РѕР¶РµРµ РїР°РєРµС‚Р°РјРё: ${currentBatch}/${totalBatches}`,
      runItem: async entry => {
        progressCb?.(`Р“РѕР»РѕСЃСѓСЋ Р·Р° РїРѕС…РѕР¶РµРµ: ${entry.baseTitle} -> ${entry.similarTitle}`);
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
      progressCb?.(`Р—Р°Р±РёСЂР°СЋ РЅР°РіСЂР°РґСѓ: ${finalTask.name}`);
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
      throw new Error('Р­С‚Р° Р·Р°РґР°С‡Р° РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє РїРѕСЃРµС‰РµРЅРёСЋ РїСЂРѕС„РёР»РµР№.');
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

    progressCb?.('РџРѕРґР±РёСЂР°СЋ С‡СѓР¶РёРµ РїСЂРѕС„РёР»Рё...');
    const plan = await buildProfilePlan(beforeTask);
    if (!plan.selectedUserIds.length) {
      throw new Error('РќРµ СѓРґР°Р»РѕСЃСЊ РЅР°Р№С‚Рё РїРѕРґС…РѕРґСЏС‰РёРµ С‡СѓР¶РёРµ РїСЂРѕС„РёР»Рё.');
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
      batchStartMessage: (currentBatch, totalBatches) => `РћС‚РєСЂС‹РІР°СЋ РїСЂРѕС„РёР»Рё: ${currentBatch}/${totalBatches}`,
      onNoProgress: userId => `Р’РёР·РёС‚ РІ РїСЂРѕС„РёР»СЊ #${userId} РЅРµ РґР°Р» РїСЂРѕРіСЂРµСЃСЃР°, РїСЂРѕР±СѓСЋ СЃР»РµРґСѓСЋС‰РёР№ РїСЂРѕС„РёР»СЊ.`,
      runItem: async userId => {
        progressCb?.(`РџСЂРѕРІРµСЂСЏСЋ РїСЂРѕС„РёР»СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ #${userId} С‡РµСЂРµР· API...`);
        const directResult = await submitProfileVisitDirect(userId);
        await rememberProfileVisit(userId);
        return directResult;
      }
    });

    const visitedProfiles = batchResult.processedItems;
    let finalTask = batchResult.finalTask || beforeTask;
    currentProgress = batchResult.currentProgress;

    if (Number(finalTask.progress || 0) <= Number(beforeTask.progress || 0)) {
      throw new Error('РЎР°Р№С‚ РЅРµ Р·Р°СЃС‡РёС‚Р°Р» РїРѕСЃРµС‰РµРЅРёРµ С‡СѓР¶РѕРіРѕ РїСЂРѕС„РёР»СЏ С‡РµСЂРµР· Р·Р°РїСЂРѕСЃ СЃ С‚РµРєСѓС‰РµР№ СЃС‚СЂР°РЅРёС†С‹.');
    }

    let claimed = false;
    if (smb.isTaskReady(finalTask)) {
      progressCb?.(`Р—Р°Р±РёСЂР°СЋ РЅР°РіСЂР°РґСѓ: ${finalTask.name}`);
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
        progressCb?.(`Р“РёР»СЊРґРёСЏ ${entry.dir} РЅРµ РѕС‚РєСЂС‹Р»Р°СЃСЊ: ${result.error}`);
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
        progressCb?.(`Р—Р°СЏРІРєР° РІ ${entry.dir} СѓС€Р»Р°, РЅРѕ battlepass РїРѕРєР° РЅРµ РѕР±РЅРѕРІРёР» РїСЂРѕРіСЂРµСЃСЃ.`);
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




