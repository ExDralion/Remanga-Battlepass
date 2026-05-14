(() => {
  const smb = window.SMBP;
  if (!smb?.tasks || !smb?.games) return;
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
    memoryIdle: 'Memory \u0436\u0434\u0451\u0442 \u0437\u0430\u043f\u0443\u0441\u043a\u0430.',
    cards: '\u041a\u0430\u0440\u0442\u044b',
    solved: '\u0420\u0435\u0448\u0435\u043d\u043e',
    solve: '\u0420\u0435\u0448\u0438\u0442\u044c',
    stop: '\u0421\u0442\u043e\u043f',
    quizIdle: 'Quiz \u0436\u0434\u0451\u0442 \u0437\u0430\u043f\u0443\u0441\u043a\u0430.',
    mode: '\u0420\u0435\u0436\u0438\u043c',
    answers: '\u041e\u0442\u0432\u0435\u0442\u043e\u0432',
    autoPlay: '\u0410\u0432\u0442\u043e-\u0438\u0433\u0440\u0430',
    start: '\u0421\u0442\u0430\u0440\u0442',
    autoPlayOn: '\u0410\u0432\u0442\u043e-\u0438\u0433\u0440\u0430 \u0432\u043a\u043b\u044e\u0447\u0435\u043d\u0430.',
    autoPlayOff: '\u0410\u0432\u0442\u043e-\u0438\u0433\u0440\u0430 \u0432\u044b\u043a\u043b\u044e\u0447\u0435\u043d\u0430.',
    differenceIdle: 'Difference \u0436\u0434\u0451\u0442 \u0437\u0430\u043f\u0443\u0441\u043a\u0430.',
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
  const isShellSettingsView = () => location.hash === SHELL_SETTINGS_HASH && (isTasksPage() || isRewardsPage() || !!smb.games.getCurrentGame() || isUserSettingsPage());

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
    const currentGame = smb.games.getCurrentGame();
    if (currentGame === 'memory') return 'memory';
    if (currentGame === 'quiz') return 'quiz';
    if (currentGame === 'difference') return 'difference';
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

    let fab = document.getElementById('smbp-fab');
    let panel = document.getElementById('smbp-panel');
    if (fab && panel) {
      panel.querySelector('.smbp-title span').textContent = pageLabel;
      panel.querySelector('[data-role="page-title"]').textContent = pageLabel;
      panel.querySelector('[data-role="page-subtitle"]').textContent = getShellViewSubtitle(getActiveShellView());
      syncShellNavigation(panel);
      installShellDragging(panel);
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
        <span class="smbp-progress">${done}/${total}</span>
      </div>
    `;
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
        if (!nextTask || nextTask.claimed || smb.isTaskDone(nextTask)) {
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
      if (smb.isTaskDone(nextTask) || nextTask?.claimed) {
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
          const node = document.createElement('div');
          node.className = 'smbp-item smbp-item-summary';
          node.dataset.section = key;
          renderSummaryNodeContent(node, item);
          list.appendChild(node);
        }

        const gameTasks = state.automatableTasks.filter(task =>
          smb.tasks.getTaskRoute(task) &&
          !smb.tasks.isDirectGameTask(task) &&
          !smb.tasks.isAutonomousMemoryTask(task) &&
          !task.claimed
        );

        if (gameTasks.length) {
          list.appendChild(createSectionHeader(t.gameTasks, t.gameTasksDesc));

          for (const task of gameTasks) {
            const route = smb.tasks.getTaskRoute(task);
            const node = createTaskNode(task, {
              actionLabel: t.openGame,
              state: task.id === runningTaskId ? 'running' : smb.isTaskReady(task) ? 'ready' : 'idle',
              onAction: () => {
              location.href = route;
              }
            });
            list.appendChild(node);
          }
        }

        const catalogTasks = state.automatableTasks.filter(task => (isInlineRunnableTask(task) || smb.tasks.isGuildJoinTask(task)) && !task.claimed && !smb.isTaskReady(task));

        if (catalogTasks.length) {
          list.appendChild(createSectionHeader(t.autoSection, t.autoSectionDesc));
        }

        for (const task of catalogTasks) {
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
                : smb.isTaskReady(task)
                  ? 'ready'
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
            } catch (error) {
              runningTaskId = null;
              errorTaskId = task.id;
              setTaskState(node, 'error');
              ui.status(t.taskFailed(error.message || error), 'error');
              ui.pushLog(`${task.name}: ${error.message || error}`, 'error');
            }
          });

          list.appendChild(node);
        }

        const readyTasks = state.readyTasks.filter(task => !task.claimed);
        if (readyTasks.length) {
          list.appendChild(createSectionHeader(t.readyTasksSection, t.readyTasksSectionDesc));
          for (const task of readyTasks) {
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

            list.appendChild(node);
          }
        }

        const manualTasks = state.tasks.filter(task => smb.tasks.isIgnoredManualTask(task) && !task.claimed);
        if (manualTasks.length) {
          list.appendChild(createSectionHeader(t.manualSection, t.manualSectionDesc));
          for (const task of manualTasks) {
            const reason = smb.tasks.getManualTaskReason?.(task) || t.manualOnly;
            const node = createTaskNode(task, {
              note: reason,
              state: 'manual'
            });
            list.appendChild(node);
          }
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

  async function renderMemoryPage(body) {
    const ui = createUiHelpers(body, t.memoryIdle);
    ui.setPrimary('0', t.cards);
    ui.setSecondary('0', t.solved);

    const buttons = document.createElement('div');
    buttons.className = 'smbp-buttons';
    buttons.innerHTML = `
      <button class="smbp-btn smbp-btn-primary" type="button">${t.solve}</button>
      <button class="smbp-btn smbp-btn-danger" type="button">${t.stop}</button>
    `;
    body.appendChild(buttons);

    buttons.children[0].addEventListener('click', () => smb.games.MemoryGame.start(ui));
    buttons.children[1].addEventListener('click', () => smb.games.MemoryGame.stop(ui));
  }

  async function renderQuizPage(body) {
    const settings = await smb.loadSettings();
    const ui = createUiHelpers(body, t.quizIdle);
    ui.setPrimary('1', t.mode);
    ui.setSecondary('0', t.answers);

    const toggle = document.createElement('label');
    toggle.className = 'smbp-toggle';
    toggle.innerHTML = `
      <span>${t.autoPlay}</span>
      <input type="checkbox" ${settings.quizAutoPlay ? 'checked' : ''}>
    `;

    const buttons = document.createElement('div');
    buttons.className = 'smbp-buttons';
    buttons.innerHTML = `
      <button class="smbp-btn smbp-btn-primary" type="button">${t.start}</button>
      <button class="smbp-btn smbp-btn-danger" type="button">${t.stop}</button>
    `;

    body.appendChild(toggle);
    body.appendChild(buttons);

    const checkbox = toggle.querySelector('input');
    checkbox.addEventListener('change', async () => {
      await smb.saveSettings({ quizAutoPlay: checkbox.checked });
      ui.status(checkbox.checked ? t.autoPlayOn : t.autoPlayOff);
    });

    buttons.children[0].addEventListener('click', () => {
      smb.games.QuizGame.start(ui, { autoPlay: checkbox.checked });
    });
    buttons.children[1].addEventListener('click', () => smb.games.QuizGame.stop(ui));
  }

  async function renderDifferencePage(body) {
    const ui = createUiHelpers(body, t.differenceIdle);
    ui.setPrimary('0', t.points);
    ui.setSecondary('0', t.found);

    const buttons = document.createElement('div');
    buttons.className = 'smbp-buttons';
    buttons.innerHTML = `
      <button class="smbp-btn smbp-btn-secondary" type="button">${t.scan}</button>
      <button class="smbp-btn smbp-btn-primary" type="button">${t.autoClick}</button>
    `;

    const stopRow = document.createElement('div');
    stopRow.className = 'smbp-buttons';
    stopRow.innerHTML = `<button class="smbp-btn smbp-btn-danger" type="button">${t.stop}</button>`;

    body.appendChild(buttons);
    body.appendChild(stopRow);

    buttons.children[0].addEventListener('click', () => smb.games.DifferenceGame.scan(ui));
    buttons.children[1].addEventListener('click', () => smb.games.DifferenceGame.start(ui));
    stopRow.children[0].addEventListener('click', () => smb.games.DifferenceGame.stop(ui));
  }

  async function init() {
    const currentGame = smb.games.getCurrentGame();
    removeSettingsEntry();
    removeLegacyInlineButtons();

    if (isUserSettingsPage()) {
      injectSettingsEntry();
      if (isSmbpSettingsView()) {
        await renderSettingsPage();
      }
    }

    if (!isTasksPage() && !isRewardsPage() && !currentGame && !isUserSettingsPage()) {
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
    if (shellView === 'memory') {
      await renderMemoryPage(body);
      return;
    }
    if (shellView === 'quiz') {
      await renderQuizPage(body);
      return;
    }
    if (shellView === 'difference') {
      await renderDifferencePage(body);
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

