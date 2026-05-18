'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const sharedPath = path.join(__dirname, 'shared.js');
const tasksPath = path.join(__dirname, 'tasks.js');
const backgroundPath = path.join(__dirname, 'background.js');

function createStorageArea() {
  const state = Object.create(null);
  return {
    state,
    get(keys, callback) {
      if (Array.isArray(keys)) {
        const result = {};
        for (const key of keys) result[key] = state[key];
        callback(result);
        return;
      }
      if (typeof keys === 'string') {
        callback({ [keys]: state[keys] });
        return;
      }
      callback({ ...state });
    },
    set(patch, callback) {
      Object.assign(state, patch || {});
      callback?.();
    }
  };
}

function createBaseContext() {
  const storage = createStorageArea();
  const context = {
    console,
    setTimeout,
    clearTimeout,
    URL,
    Math,
    Date,
    Promise,
    location: { origin: 'https://remanga.org', pathname: '/', href: 'https://remanga.org/' },
    URLSearchParams,
    fetch: async () => {
      throw new Error('Unexpected fetch in test');
    },
    window: {},
    document: {
      getElementById: () => null,
      createElement: () => ({
        style: {},
        appendChild() {},
        remove() {},
        isConnected: true,
        textContent: '',
        querySelector: () => null
      }),
      documentElement: {
        appendChild() {}
      }
    },
    requestAnimationFrame: callback => callback(),
    chrome: {
      storage: {
        local: storage
      },
      runtime: {
        onMessage: {
          addListener() {}
        },
        lastError: null
      },
      tabs: {
        onUpdated: {
          addListener() {},
          removeListener() {}
        },
        onRemoved: {
          addListener() {},
          removeListener() {}
        }
      },
      scripting: {
        executeScript() {}
      }
    }
  };

  context.window = context;
  context.globalThis = context;
  return { context, storage };
}

function runScriptFile(filePath, context) {
  const code = fs.readFileSync(filePath, 'utf8');
  vm.runInNewContext(code, context, { filename: filePath });
}

test('shared diagnostics can record and clear entries', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);

  const first = await context.window.SMBP.recordDiagnostic({
    level: 'warn',
    scope: 'tasks',
    type: 'task_blocked',
    message: 'blocked for test',
    details: { event: 35 }
  });

  assert.equal(first.message, 'blocked for test');
  let diagnostics = await context.window.SMBP.loadDiagnostics();
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].scope, 'tasks');
  assert.equal(diagnostics[0].details.event, 35);

  await context.window.SMBP.clearDiagnostics();
  diagnostics = await context.window.SMBP.loadDiagnostics();
  assert.equal(Array.isArray(diagnostics), true);
  assert.equal(diagnostics.length, 0);
});

test('new outfit inventory task is automatable', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);
  runScriptFile(tasksPath, context);
  const source = fs.readFileSync(tasksPath, 'utf8');

  const task = {
    id: 101,
    event: 57,
    progress: 0,
    goal: 1,
    claimed: false,
    name: 'New outfit',
    description: 'Change profile customization.'
  };

  const state = context.window.SMBP.tasks.buildStateFromPayloads({
    content: {
      dailyRefresh: [task]
    }
  }, {
    content: {
      battlepass: {
        exp: 0,
        battlepass: { exp_per_level: 100, name: 'Battlepass' }
      }
    }
  });

  assert.equal(context.window.SMBP.tasks.isInventoryTask(task), true);
  assert.equal(context.window.SMBP.tasks.isIgnoredManualTask(task), false);
  assert.equal(context.window.SMBP.tasks.getAutomationBlockReason(task), '');
  assert.equal(state.automatableTasks.length, 1);
  assert.equal(state.automatableTasks[0].id, 101);
  assert.match(source, /for \(const categoryKey of \['frames', 'wallpapers', 'theme', 'avatars'\]\)/);
});

test('customization shopping task is automatable', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);
  runScriptFile(tasksPath, context);

  const task = {
    id: 98,
    event: 52,
    progress: 0,
    goal: 1,
    claimed: false,
    name: 'Вперёд за покупками',
    description: 'Купи любой предмет кастомизации.'
  };

  const state = context.window.SMBP.tasks.buildStateFromPayloads({
    content: {
      permanent: [task]
    }
  }, {
    content: {
      battlepass: {
        exp: 0,
        battlepass: { exp_per_level: 100, name: 'Battlepass' }
      }
    }
  });

  assert.equal(context.window.SMBP.tasks.isShopPurchaseTask(task), true);
  assert.equal(context.window.SMBP.tasks.isIgnoredManualTask(task), false);
  assert.equal(context.window.SMBP.tasks.getAutomationBlockReason(task), '');
  assert.equal(state.automatableTasks.length, 1);
  assert.equal(state.automatableTasks[0].id, 98);
});

test('ticket spending task is automatable', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);
  runScriptFile(tasksPath, context);

  const task = {
    id: 87,
    event: 14,
    progress: 0,
    goal: 1,
    claimed: false,
    name: 'Потрать тикеты',
    description: 'Используйте накопленные тикеты, чтобы бесплатно получить доступ к главе.'
  };

  const state = context.window.SMBP.tasks.buildStateFromPayloads({
    content: {
      dailyRefresh: [task]
    }
  }, {
    content: {
      battlepass: {
        exp: 0,
        battlepass: { exp_per_level: 100, name: 'Battlepass' }
      }
    }
  });

  assert.equal(context.window.SMBP.tasks.isTicketSpendTask(task), true);
  assert.equal(context.window.SMBP.tasks.isIgnoredManualTask(task), false);
  assert.equal(context.window.SMBP.tasks.getAutomationBlockReason(task), '');
  assert.equal(state.automatableTasks.length, 1);
  assert.equal(state.automatableTasks[0].id, 87);
});

test('buy it task uses ticket chapter automation', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);
  runScriptFile(tasksPath, context);

  const task = {
    id: 88,
    event: 9999,
    progress: 0,
    goal: 1,
    claimed: false,
    name: 'Купи её',
    description: 'Откройте любую платную главу.'
  };

  const state = context.window.SMBP.tasks.buildStateFromPayloads({
    content: {
      dailyRefresh: [task]
    }
  }, {
    content: {
      battlepass: {
        exp: 0,
        battlepass: { exp_per_level: 100, name: 'Battlepass' }
      }
    }
  });

  assert.equal(context.window.SMBP.tasks.isTicketSpendTask(task), true);
  assert.equal(context.window.SMBP.tasks.isShopPurchaseTask(task), false);
  assert.equal(context.window.SMBP.tasks.getTaskVisualKind(task), 'ticket');
  assert.equal(context.window.SMBP.tasks.isIgnoredManualTask(task), false);
  assert.equal(state.automatableTasks.length, 1);
  assert.equal(state.automatableTasks[0].id, 88);
});

test('profile visit task is automatable', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);
  runScriptFile(tasksPath, context);

  const task = {
    id: 86,
    event: 35,
    progress: 0,
    goal: 1,
    claimed: false,
    name: 'Шпионская миссия',
    description: 'Посетите чужой профиль.'
  };

  const state = context.window.SMBP.tasks.buildStateFromPayloads({
    content: {
      dailyRefresh: [task]
    }
  }, {
    content: {
      battlepass: {
        exp: 0,
        battlepass: { exp_per_level: 100, name: 'Battlepass' }
      }
    }
  });

  assert.equal(context.window.SMBP.tasks.isProfileTask(task), true);
  assert.equal(context.window.SMBP.tasks.isIgnoredManualTask(task), false);
  assert.equal(context.window.SMBP.tasks.getAutomationBlockReason(task), '');
  assert.equal(state.automatableTasks.length, 1);
  assert.equal(state.automatableTasks[0].id, 86);
});

test('difference minigame task runs through direct API instead of opening route', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);
  runScriptFile(tasksPath, context);

  const task = {
    id: 88,
    event: 63,
    progress: 0,
    goal: 1,
    claimed: false,
    name: 'Они разные?',
    description: 'Найдите отличия.'
  };
  let postedGameId = null;

  context.window.SMBP.manageMinigame = async gameId => {
    postedGameId = gameId;
    return { ok: true };
  };
  context.window.SMBP.claimTask = async taskId => {
    assert.equal(taskId, 88);
    return { ok: true };
  };

  let taskPayload = { ...task };
  context.window.SMBP.apiGet = async pathName => {
    if (pathName === '/api/battlepass/tasks/') {
      const response = {
        content: {
          dailyRefresh: [taskPayload]
        }
      };
      taskPayload = { ...taskPayload, progress: 1 };
      return response;
    }
    if (pathName === '/api/battlepass/current/') {
      return {
        content: {
          battlepass: {
            exp: 0,
            battlepass: { exp_per_level: 100, name: 'Battlepass' }
          }
        }
      };
    }
    throw new Error(`Unexpected get: ${pathName}`);
  };

  assert.equal(context.window.SMBP.tasks.isDirectGameTask(task), true);
  assert.equal(context.window.SMBP.gameFromTask(task), 'difference');
  const result = await context.window.SMBP.tasks.runDirectGameTask(task);

  assert.equal(postedGameId, 63);
  assert.equal(Number(result.after.progress), 1);
});

test('personal profile task is automatable without inventory runner', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);
  runScriptFile(tasksPath, context);

  const task = {
    id: 73,
    event: 34,
    progress: 0,
    goal: 1,
    claimed: false,
    name: 'Личное пространство',
    description: 'Зайдите в свой профиль.'
  };

  const state = context.window.SMBP.tasks.buildStateFromPayloads({
    content: {
      dailyRefresh: [task]
    }
  }, {
    content: {
      battlepass: {
        exp: 0,
        battlepass: { exp_per_level: 100, name: 'Battlepass' }
      }
    }
  });

  assert.equal(context.window.SMBP.tasks.isPersonalProfileTask(task), true);
  assert.equal(context.window.SMBP.tasks.isInventoryTask(task), false);
  assert.equal(context.window.SMBP.tasks.isIgnoredManualTask(task), false);
  assert.equal(state.automatableTasks.length, 1);
  assert.equal(state.automatableTasks[0].id, 73);
});

test('friend request task is automatable', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);
  runScriptFile(tasksPath, context);

  const task = {
    id: 85,
    event: 41,
    progress: 0,
    goal: 1,
    claimed: false,
    name: 'Дружеский жест',
    description: 'Отправьте заявку в друзья.'
  };

  const state = context.window.SMBP.tasks.buildStateFromPayloads({
    content: {
      dailyRefresh: [task]
    }
  }, {
    content: {
      battlepass: {
        exp: 0,
        battlepass: { exp_per_level: 100, name: 'Battlepass' }
      }
    }
  });

  assert.equal(context.window.SMBP.tasks.isFriendRequestTask(task), true);
  assert.equal(context.window.SMBP.tasks.isIgnoredManualTask(task), false);
  assert.equal(context.window.SMBP.tasks.getAutomationBlockReason(task), '');
  assert.equal(state.automatableTasks.length, 1);
  assert.equal(state.automatableTasks[0].id, 85);
});

test('battlepass rewards state exposes claimable owned rewards', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);
  runScriptFile(tasksPath, context);

  const state = context.window.SMBP.tasks.buildRewardsStateFromPayload({
    content: {
      battlepass: {
        exp: 900,
        battlepass: { exp_per_level: 300, name: 'Battlepass' },
        levels: [
          { version: 'free', level: 1 },
          { version: 'paid', level: 0 }
        ],
        versions: [
          { version: 'free', isOwned: true },
          { version: 'paid', isOwned: false }
        ]
      },
      levels: [
        {
          level: 2,
          rewards: {
            free: [{ reward_name: 'Молнии' }],
            paid: [{ reward_name: 'VIP' }]
          }
        },
        {
          level: 4,
          rewards: {
            free: [{ reward_name: 'Билет' }],
            paid: []
          }
        }
      ]
    }
  });

  assert.equal(state.currentLevel, 3);
  assert.equal(state.rewards.length, 3);
  assert.equal(state.claimableRewards.length, 1);
  assert.equal(state.claimableRewards[0].id, 'free:2');
  assert.equal(state.rewards.find(reward => reward.id === 'paid:2').locked, true);
  assert.equal(state.rewards.find(reward => reward.id === 'free:4').enoughExp, false);
});

test('battlepass rewards claim uses latest available level per version', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);
  runScriptFile(tasksPath, context);

  const claims = [];
  context.window.SMBP.apiGet = async pathName => {
    assert.equal(pathName, '/api/battlepass/current/');
    return {
      content: {
        battlepass: {
          exp: 1000,
          battlepass: { exp_per_level: 100, name: 'Battlepass' },
          levels: [
            { version: 'free', level: 1 },
            { version: 'paid', level: 2 }
          ],
          versions: [
            { version: 'free', isOwned: true },
            { version: 'paid', isOwned: true }
          ]
        },
        levels: [
          { level: 2, rewards: { free: [{ reward_name: 'Free 2' }], paid: [{ reward_name: 'Paid 2' }] } },
          { level: 3, rewards: { free: [{ reward_name: 'Free 3' }], paid: [{ reward_name: 'Paid 3' }] } },
          { level: 5, rewards: { free: [{ reward_name: 'Free 5' }], paid: [{ reward_name: 'Paid 5' }] } }
        ]
      }
    };
  };
  context.window.SMBP.apiPost = async (pathName, body) => {
    assert.equal(pathName, '/api/battlepass/current/');
    claims.push(body);
    return { ok: true };
  };

  const result = await context.window.SMBP.tasks.claimReadyRewards();

  assert.equal(result.claimed, 5);
  assert.deepEqual(JSON.parse(JSON.stringify(claims)), [
    { level: 5, level_version: 'free' },
    { level: 5, level_version: 'paid' }
  ]);
});

test('deck opening uses the current account instead of a fixed user id', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);
  runScriptFile(tasksPath, context);

  const requested = [];
  const currentUserId = 987654;
  context.window.SMBP.api = async (pathName, options = {}) => {
    requested.push({ pathName, method: options.method || 'GET', body: options.body });
    if (pathName === '/api/v2/users/current/') {
      return { id: currentUserId, username: 'AnyUser', is_premium: false };
    }
    if (pathName === '/api/v2/shop/decks/?deck_id=10&page=1') {
      return { results: [{ deck: { id: 10, name: 'Случайные карты' } }] };
    }
    if (pathName === `/api/v2/inventory/decks/?is_opened=false&user_id=${currentUserId}&deck_id=10&page=1`) {
      return { results: [{ id: 111222, deck: { id: 10, name: 'Случайные карты' } }] };
    }
    if (pathName === '/api/v2/inventory/decks/111222/open/') {
      return [
        { id: 501, rank: 'rank_f', score: 1, cover: { mid: 'cards/501.webp' } },
        { id: 502, rank: 'rank_e', score: 2, cover: { mid: 'cards/502.webp' } },
        { id: 503, rank: 'rank_d', score: 3, cover: { mid: 'cards/503.webp' } },
        { id: 504, rank: 'rank_c', score: 4, cover: { mid: 'cards/504.webp' } }
      ];
    }
    if (pathName.startsWith('/api/inventory/cards/')) {
      const cardId = Number(pathName.match(/cards\/(\d+)/)?.[1] || 0);
      return {
        id: cardId,
        character: { name: `Card ${cardId}` },
        title: { main_name: 'Deck Test' }
      };
    }
    if (pathName === '/api/v2/inventory/decks/111222/choose/') {
      assert.equal(options.method, 'POST');
      assert.equal(options.body.card_id, 501);
      return { ok: true };
    }
    throw new Error(`Unexpected path: ${pathName}`);
  };
  context.window.SMBP.apiGet = pathName => context.window.SMBP.api(pathName);
  context.window.SMBP.showDeckChoiceModal = async options => options.cards.find(card => card.canChoose);

  const result = await context.window.SMBP.tasks.openConfiguredDeck('10');

  assert.equal(result.deckId, 10);
  assert.equal(result.deckInstanceId, 111222);
  assert.equal(result.chosenCard.id, 501);
  assert.equal(
    requested.some(request => request.pathName === `/api/v2/inventory/decks/?is_opened=false&user_id=${currentUserId}&deck_id=10&page=1`),
    true
  );
  assert.equal(requested.some(request => /user_id=(627468|3044752)/.test(request.pathName)), false);
});

test('reading planner skips licensed titles before selecting chapters', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);
  runScriptFile(tasksPath, context);

  const requested = [];
  context.window.SMBP.apiGet = async pathName => {
    requested.push(pathName);
    if (pathName === '/api/v2/titles/licensed-title/') {
      return {
        dir: 'licensed-title',
        is_licensed: true,
        status: { name: 'Лицензировано' },
        translate_status: { name: 'Продолжается' },
        branches: [{ id: 10 }]
      };
    }
    if (pathName.includes('/api/v2/titles/chapters/')) {
      throw new Error('chapter endpoint should not be called for licensed title');
    }
    throw new Error(`Unexpected path: ${pathName}`);
  };

  const chapters = await context.window.SMBP.tasks.getFreeChapters('licensed-title', 1);

  assert.equal(Array.isArray(chapters), true);
  assert.equal(chapters.length, 0);
  assert.equal(requested.includes('/api/v2/titles/licensed-title/'), true);
  assert.equal(requested.some(pathName => pathName.includes('/api/v2/titles/chapters/')), false);
});

test('reading planner skips viewed and paid chapters', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);
  runScriptFile(tasksPath, context);

  const requested = [];
  context.window.SMBP.apiGet = async pathName => {
    requested.push(pathName);
    if (pathName === '/api/v2/titles/sample-title/') {
      return {
        dir: 'sample-title',
        is_licensed: false,
        branches: [{ id: 25 }],
        continue_reading: { index: 3 },
        current_reading: { index: 2 }
      };
    }
    if (pathName.includes('/api/v2/titles/chapters/')) {
      assert.equal(pathName.includes('user_data=1'), true);
      return {
        next: null,
        results: [
          { id: 1, index: 1, is_published: true, viewed: true, is_bought: false, price: null, is_paid: false },
          { id: 2, index: 2, is_published: true, viewed: false, is_bought: false, price: null, is_paid: false },
          { id: 3, index: 3, is_published: true, viewed: true, is_bought: false, price: null, is_paid: false },
          { id: 4, index: 4, is_published: true, viewed: false, is_bought: false, price: '20.00', is_paid: false },
          { id: 5, index: 5, is_published: true, viewed: false, is_bought: false, price: null, is_paid: true },
          { id: 6, index: 6, is_published: true, viewed: false, is_bought: false, price: null, is_paid: false }
        ]
      };
    }
    throw new Error(`Unexpected path: ${pathName}`);
  };

  const chapters = await context.window.SMBP.tasks.getFreeChapters('sample-title', 3);

  assert.equal(JSON.stringify(chapters.map(chapter => chapter.id)), '[6]');
  assert.equal(requested.some(pathName => pathName.includes('ordering=index') && pathName.includes('user_data=1')), true);
});

test('like planner skips rated paid and licensed chapters', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);
  runScriptFile(tasksPath, context);

  context.window.SMBP.apiGet = async pathName => {
    if (pathName === '/api/v2/titles/licensed-like/') {
      return {
        dir: 'licensed-like',
        is_licensed: true,
        branches: [{ id: 30 }]
      };
    }
    if (pathName === '/api/v2/titles/like-title/') {
      return {
        dir: 'like-title',
        is_licensed: false,
        branches: [{ id: 31 }]
      };
    }
    if (pathName.includes('/api/v2/titles/chapters/')) {
      assert.equal(pathName.includes('user_data=1'), true);
      assert.equal(pathName.includes('count=30'), true);
      return {
        next: null,
        results: [
          { id: 11, index: 1, is_published: true, rated: true, is_bought: false, price: null, is_paid: false },
          { id: 12, index: 2, is_published: true, rated: false, is_bought: false, price: '15.00', is_paid: false },
          { id: 13, index: 3, is_published: true, rated: false, is_bought: false, price: null, is_paid: true },
          { id: 14, index: 4, is_published: true, rated: false, is_bought: false, price: null, is_paid: false }
        ]
      };
    }
    throw new Error(`Unexpected path: ${pathName}`);
  };

  const licensed = await context.window.SMBP.tasks.getLikableChapters('licensed-like', 2);
  const chapters = await context.window.SMBP.tasks.getLikableChapters('like-title', 3);

  assert.equal(licensed.length, 0);
  assert.equal(JSON.stringify(chapters.map(chapter => chapter.id)), '[14]');
});

test('category and genre tasks use catalog filters instead of title query search', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);
  runScriptFile(tasksPath, context);

  const requested = [];
  context.window.SMBP.apiGet = async pathName => {
    requested.push(pathName);
    if (pathName === '/api/v2/titles/categories/') {
      return [
        { id: 122, name: 'Бои на мечах', dir: 'boinamechah' },
        { id: 33, name: 'Самураи', dir: 'samurai' },
        { id: 30, name: 'Ниндзя', dir: 'nindzja' },
        { id: 90, name: 'Рыцари', dir: 'rtsari' },
        { id: 18, name: 'Культивация', dir: 'kultivatsija' },
        { id: 68, name: 'Ранги силы', dir: 'rangisil' },
        { id: 85, name: 'Пародия', dir: 'parodija' },
        { id: 125, name: 'Грузовик-сан', dir: 'gruzoviksan' },
        { id: 124, name: 'Упоротость', dir: 'uporotost' },
        { id: 34, name: 'Традиционные игры', dir: 'traditsionneigr' },
        { id: 70, name: 'Животные компаньоны', dir: 'zhivotnekompanon' }
      ];
    }
    if (pathName.startsWith('/api/v2/search/catalog/?')) {
      assert.equal(pathName.includes('query='), false);
      assert.equal(pathName.includes('unstrict_search_fields=genres'), true);
      assert.equal(pathName.includes('unstrict_search_fields=categories'), true);
      return {
        next: null,
        results: [{
          dir: 'samurai-title',
          main_name: 'Самурайский тайтл',
          avg_rating: 9,
          genres: [],
          categories: [
            { id: 122, name: 'Бои на мечах' },
            { id: 33, name: 'Самураи' },
            { id: 30, name: 'Ниндзя' },
            { id: 90, name: 'Рыцари' },
            { id: 18, name: 'Культивация' },
            { id: 68, name: 'Ранги силы' }
          ]
        }]
      };
    }
    if (pathName === '/api/v2/titles/samurai-title/') {
      return {
        id: 101,
        dir: 'samurai-title',
        main_name: 'Самурайский тайтл',
        is_licensed: false,
        avg_rating: 9,
        genres: [],
        categories: [
          { id: 122, name: 'Бои на мечах' },
          { id: 33, name: 'Самураи' },
          { id: 30, name: 'Ниндзя' },
          { id: 90, name: 'Рыцари' },
          { id: 18, name: 'Культивация' },
          { id: 68, name: 'Ранги силы' }
        ],
        branches: [{ id: 44 }]
      };
    }
    if (pathName.includes('/api/v2/titles/chapters/')) {
      assert.equal(pathName.includes('user_data=1'), true);
      return {
        next: null,
        results: [{ id: 777, index: 1, is_published: true, viewed: false, is_bought: false, price: null, is_paid: false }]
      };
    }
    throw new Error(`Unexpected path: ${pathName}`);
  };

  const plan = await context.window.SMBP.tasks.buildSearchTaskPlan({
    id: 901,
    event: 9,
    progress: 0,
    goal: 1,
    description: 'Найдите тайтл, у которого есть категория: Бои на мечах, Самураи, Ниндзя, Рыцари, Культивация, Ранги силы.'
  });

  assert.equal(JSON.stringify(plan.resolvedTags.map(tag => tag.id)), '[122,33,30,90,18,68]');
  assert.equal(plan.selectedTitles.length, 1);
  assert.equal(plan.selectedTitles[0].chapterId, 777);
  assert.equal(requested.some(pathName => pathName.includes('query=')), false);
  assert.equal(requested.some(pathName => [122, 33, 30, 90, 18, 68].every(id => pathName.includes(`categories=${id}`))), true);
});

test('category task resolves the full odd category list from the battlepass description', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);
  runScriptFile(tasksPath, context);

  const requested = [];
  context.window.SMBP.apiGet = async pathName => {
    requested.push(pathName);
    if (pathName === '/api/v2/titles/categories/') {
      return [
        { id: 85, name: 'Пародия', dir: 'parodija' },
        { id: 125, name: 'Грузовик-сан', dir: 'gruzoviksan' },
        { id: 124, name: 'Упоротость', dir: 'uporotost' },
        { id: 34, name: 'Традиционные игры', dir: 'traditsionneigr' },
        { id: 70, name: 'Животные компаньоны', dir: 'zhivotnekompanon' }
      ];
    }
    if (pathName.startsWith('/api/v2/search/catalog/?')) {
      assert.equal(pathName.includes('query='), false);
      return {
        next: null,
        results: [{
          dir: 'odd-title',
          main_name: 'Странный тайтл',
          avg_rating: 8,
          genres: [],
          categories: [
            { id: 85, name: 'Пародия' },
            { id: 125, name: 'Грузовик-сан' },
            { id: 124, name: 'Упоротость' },
            { id: 34, name: 'Традиционные игры' },
            { id: 70, name: 'Животные компаньоны' }
          ]
        }]
      };
    }
    if (pathName === '/api/v2/titles/odd-title/') {
      return {
        id: 102,
        dir: 'odd-title',
        main_name: 'Странный тайтл',
        is_licensed: false,
        avg_rating: 8,
        genres: [],
        categories: [
          { id: 85, name: 'Пародия' },
          { id: 125, name: 'Грузовик-сан' },
          { id: 124, name: 'Упоротость' },
          { id: 34, name: 'Традиционные игры' },
          { id: 70, name: 'Животные компаньоны' }
        ],
        branches: [{ id: 45 }]
      };
    }
    if (pathName.includes('/api/v2/titles/chapters/')) {
      return {
        next: null,
        results: [{ id: 778, index: 1, is_published: true, viewed: false, is_bought: false, price: null, is_paid: false }]
      };
    }
    throw new Error(`Unexpected path: ${pathName}`);
  };

  const plan = await context.window.SMBP.tasks.buildSearchTaskPlan({
    id: 902,
    event: 9,
    progress: 0,
    goal: 1,
    description: 'Найдите тайтл, у которого есть категория: Пародия, Грузовик-сан, Упоротость, Традиционные игры, Животные компаньоны.'
  });

  assert.equal(JSON.stringify(plan.resolvedTags.map(tag => tag.id)), '[85,125,124,34,70]');
  assert.equal(plan.selectedTitles[0].chapterId, 778);
  assert.equal(requested.some(pathName => [85, 125, 124, 34, 70].every(id => pathName.includes(`categories=${id}`))), true);
});

test('genre task resolves every required genre and filters catalog by all genre ids', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);
  runScriptFile(tasksPath, context);

  const requested = [];
  context.window.SMBP.apiGet = async pathName => {
    requested.push(pathName);
    if (pathName === '/api/v2/titles/genres/') {
      return [
        { id: 38, name: 'Фэнтези', dir: 'fentezi' },
        { id: 20, name: 'Научная фантастика', dir: 'nauchnajafantastika' },
        { id: 19, name: 'Мистика', dir: 'mistika' },
        { id: 22, name: 'Постапокалиптика', dir: 'postapokaliptika' }
      ];
    }
    if (pathName.startsWith('/api/v2/search/catalog/?')) {
      assert.equal(pathName.includes('query='), false);
      assert.equal(pathName.includes('unstrict_search_fields=genres'), true);
      assert.equal(pathName.includes('unstrict_search_fields=categories'), true);
      return {
        next: null,
        results: [{
          dir: 'genre-title',
          main_name: 'Жанровый тайтл',
          avg_rating: 9,
          genres: [
            { id: 38, name: 'Фэнтези' },
            { id: 20, name: 'Научная фантастика' },
            { id: 19, name: 'Мистика' },
            { id: 22, name: 'Постапокалиптика' }
          ],
          categories: []
        }]
      };
    }
    if (pathName === '/api/v2/titles/genre-title/') {
      return {
        id: 103,
        dir: 'genre-title',
        main_name: 'Жанровый тайтл',
        is_licensed: false,
        avg_rating: 9,
        genres: [
          { id: 38, name: 'Фэнтези' },
          { id: 20, name: 'Научная фантастика' },
          { id: 19, name: 'Мистика' },
          { id: 22, name: 'Постапокалиптика' }
        ],
        categories: [],
        branches: [{ id: 46 }]
      };
    }
    if (pathName.includes('/api/v2/titles/chapters/')) {
      return {
        next: null,
        results: [{ id: 779, index: 1, is_published: true, viewed: false, is_bought: false, price: null, is_paid: false }]
      };
    }
    throw new Error(`Unexpected path: ${pathName}`);
  };

  const plan = await context.window.SMBP.tasks.buildSearchTaskPlan({
    id: 903,
    event: 8,
    progress: 0,
    goal: 1,
    description: 'Найдите тайтл, у которого есть жанр: Фэнтези, Научная фантастика, Мистика, Постапокалиптика.'
  });

  assert.equal(JSON.stringify(plan.resolvedTags.map(tag => tag.id)), '[38,20,19,22]');
  assert.equal(plan.selectedTitles[0].chapterId, 779);
  assert.equal(requested.includes('/api/v2/titles/genres/'), true);
  assert.equal(requested.some(pathName => pathName.includes('query=')), false);
  assert.equal(requested.some(pathName => [38, 20, 19, 22].every(id => pathName.includes(`genres=${id}`))), true);
});

test('large category lists are split into grouped catalog probes and matched by ids', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);
  runScriptFile(tasksPath, context);

  const categories = Array.from({ length: 9 }, (_, index) => ({
    id: 300 + index,
    name: `Tag ${index + 1}`,
    dir: `tag-${index + 1}`
  }));
  const requested = [];

  context.window.SMBP.apiGet = async pathName => {
    requested.push(pathName);
    if (pathName === '/api/v2/titles/categories/') return categories;
    if (pathName.startsWith('/api/v2/search/catalog/?')) {
      return {
        next: null,
        results: [{
          dir: 'id-matched-title',
          main_name: 'ID Matched',
          avg_rating: 9,
          genres: [],
          categories: categories.slice(0, 4).map(tag => ({ id: tag.id, name: `Renamed ${tag.id}` }))
        }]
      };
    }
    if (pathName === '/api/v2/titles/id-matched-title/') {
      return {
        id: 301,
        dir: 'id-matched-title',
        main_name: 'ID Matched',
        is_licensed: false,
        genres: [],
        categories: categories.slice(0, 4).map(tag => ({ id: tag.id, name: `Renamed ${tag.id}` })),
        branches: [{ id: 71 }]
      };
    }
    if (pathName.includes('/api/v2/titles/chapters/')) {
      return {
        next: null,
        results: [{ id: 991, index: 1, is_published: true, viewed: false, is_bought: false, price: null, is_paid: false }]
      };
    }
    throw new Error(`Unexpected path: ${pathName}`);
  };

  const plan = await context.window.SMBP.tasks.buildSearchTaskPlan({
    id: 905,
    event: 9,
    progress: 0,
    goal: 1,
    description: `Найдите тайтл, у которого есть категория: ${categories.map(tag => tag.name).join(', ')}.`
  });

  assert.equal(plan.selectedTitles[0].chapterId, 991);
  assert.equal(plan.allCandidates[0]._matchScore, 4);
  assert.equal(requested.some(pathName => [300, 301, 302, 303].every(id => pathName.includes(`categories=${id}`))), true);
  assert.equal(requested.some(pathName => [304, 305, 306, 307].every(id => pathName.includes(`categories=${id}`))), true);
  assert.equal(requested.some(pathName => pathName.includes('categories=308')), true);
});

test('dry-run plan describes selected search chapters without executing task actions', async () => {
  const { context } = createBaseContext();
  runScriptFile(sharedPath, context);
  runScriptFile(tasksPath, context);

  let posted = false;
  context.window.SMBP.apiPost = async () => {
    posted = true;
    throw new Error('dry-run must not post');
  };
  context.window.SMBP.apiGet = async pathName => {
    if (pathName === '/api/v2/titles/categories/') {
      return [{ id: 33, name: 'Самураи', dir: 'samurai' }];
    }
    if (pathName.startsWith('/api/v2/search/catalog/?')) {
      return {
        next: null,
        results: [{
          dir: 'dry-title',
          main_name: 'Dry Title',
          avg_rating: 7,
          genres: [],
          categories: [{ id: 33, name: 'Самураи' }]
        }]
      };
    }
    if (pathName === '/api/v2/titles/dry-title/') {
      return {
        id: 201,
        dir: 'dry-title',
        main_name: 'Dry Title',
        is_licensed: false,
        genres: [],
        categories: [{ id: 33, name: 'Самураи' }],
        branches: [{ id: 60 }]
      };
    }
    if (pathName.includes('/api/v2/titles/chapters/')) {
      return {
        next: null,
        results: [{ id: 990, index: 1, is_published: true, viewed: false, is_bought: false, price: null, is_paid: false }]
      };
    }
    throw new Error(`Unexpected path: ${pathName}`);
  };

  const plan = await context.window.SMBP.tasks.buildTaskDryRunPlan({
    id: 904,
    event: 9,
    name: 'Погрузись в новые категории',
    progress: 0,
    goal: 1,
    description: 'Найдите тайтл, у которого есть категория: Самураи.'
  });

  assert.equal(posted, false);
  assert.equal(plan.dryRun, true);
  assert.equal(plan.opensTabs, false);
  assert.equal(plan.changesUrl, false);
  assert.equal(plan.filters[0].tags[0].id, 33);
  assert.equal(plan.selected[0].chapterId, 990);
});

test('chapter view automations run sequentially instead of parallel batches', () => {
  const source = fs.readFileSync(tasksPath, 'utf8');

  assert.match(source, /count_chapters_gte/);
  assert.match(source, /count_chapters_lte/);
  assert.match(source, /ordering:\s*'-count_chapters'/);
  assert.match(source, /collectReadingChapterCountCandidates\(candidateMap,\s*targetCandidateSize\)/);
  assert.match(source, /const selectedChapterIds = new Set\(\);[\s\S]*?selectedChapterIds\.has\(chapter\.id\)/);
  assert.match(source, /LIKE_MAX_CHAPTERS_PER_TITLE_FLOOR/);
  assert.match(source, /selectedByTitle\.set\(chapter\.dir,\s*perTitleCount \+ 1\)/);
  assert.match(source, /batchStartMessage:\s*\([^)]*\)\s*=>\s*`Открываю новые тайтлы по одному:/);
  assert.match(source, /READING_FAST_CHUNK_SIZE\s*=\s*3/);
  assert.match(source, /READING_FAST_ITEM_DELAY_MS\s*=\s*350/);
  assert.match(source, /LIKE_FAST_CHUNK_SIZE\s*=\s*3/);
  assert.match(source, /LIKE_FAST_ITEM_DELAY_MS\s*=\s*350/);
  assert.match(source, /\/api\/v2\/activity\/view-page\/',\s*\{\s*chapter_id:\s*chapterId,\s*page:\s*-1\s*\}/);
  assert.match(source, /await submitChapterView\(chapter\.chapterId\);[\s\S]*?await smb\.sleep\(READING_FAST_ITEM_DELAY_MS\);/);
  assert.match(source, /await submitChapterLike\(chapter\.chapterId\);[\s\S]*?await smb\.sleep\(LIKE_FAST_ITEM_DELAY_MS\);/);
  assert.doesNotMatch(source, /batchStartMessage:\s*\([^)]*\)\s*=>\s*`Открываю новые тайтлы пакетами:/);
  assert.doesNotMatch(source, /batchStartMessage:\s*\([^)]*\)\s*=>\s*`Читаю главы пакетами:/);
  assert.doesNotMatch(source, /batchStartMessage:\s*\([^)]*\)\s*=>\s*`Ставлю лайки пакетами:/);
});

test('world travel planner probes candidates in small batches', () => {
  const source = fs.readFileSync(tasksPath, 'utf8');

  assert.match(source, /const WORLD_TRAVEL_PROBE_BATCH_SIZE\s*=\s*4/);
  assert.match(source, /Promise\.allSettled\(batch\.map\(probeCandidate\)\)/);
  assert.match(source, /for \(let page = 1; page <= WORLD_TRAVEL_QUERY_PAGES && selectedTitles\.length < limit; page \+= 1\)/);
});

test('like planner probes candidates in small batches', () => {
  const source = fs.readFileSync(tasksPath, 'utf8');

  assert.match(source, /const LIKE_PLAN_PROBE_BATCH_SIZE\s*=\s*4/);
  assert.match(source, /Promise\.allSettled\(batch\.map\(probeCandidate\)\)/);
  assert.match(source, /for \(let page = 1; page <= LIKE_PLAN_QUERY_PAGES && selectedChapters\.length < limit; page \+= 1\)/);
});

test('background response helper records runtime failures', async () => {
  const { context, storage } = createBaseContext();
  let listener = null;
  context.chrome.runtime.onMessage.addListener = callback => {
    listener = callback;
  };
  runScriptFile(backgroundPath, context);

  assert.equal(typeof context.respondToMessage, 'function');
  assert.equal(typeof listener, 'function');

  const response = await new Promise(resolve => {
    context.respondToMessage(
      payload => resolve(payload),
      'smbp_test_failure',
      { type: 'smbp_test_failure', url: 'https://remanga.org/test' },
      { tab: { id: 7, windowId: 3 } },
      async () => {
        throw new Error('boom');
      }
    );
  });

  assert.equal(response.ok, false);
  assert.equal(response.error, 'boom');

  const diagnostics = storage.state['smbp-diagnostics'];
  assert.equal(Array.isArray(diagnostics), true);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].scope, 'background');
  assert.equal(diagnostics[0].type, 'runtime_failure');
  assert.equal(diagnostics[0].message, 'boom');
  assert.equal(diagnostics[0].details.handler, 'smbp_test_failure');
  assert.equal(diagnostics[0].details.senderTabId, 7);
});
