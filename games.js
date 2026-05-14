(() => {
  const smb = window.SMBP;
  if (!smb) return;

  function getCurrentGame() {
    const path = location.pathname;
    if (/\/user\/battlepass\/games\/memory\/?$/.test(path)) return 'memory';
    if (/\/user\/battlepass\/games\/quiz\/?$/.test(path)) return 'quiz';
    if (/\/user\/battlepass\/games\/difference\/?$/.test(path)) return 'difference';
    return null;
  }

  async function reportGameDone(gameKey, ui) {
    const gameId = smb.GAME_IDS[gameKey];
    if (!gameId) return;
    try {
      await smb.manageMinigame(gameId);
      ui?.status?.('Готово. Прогресс мини-игры отправлен через API.');
      smb.toast(`Мини-игра ${gameKey} завершена`);
    } catch (error) {
      ui?.status?.(`Игра решена, но API не подтвердил прогресс: ${error.message || error}`);
    }
  }

  const MemoryGame = (() => {
    let running = false;
    let runId = '';

    function isPage() {
      return getCurrentGame() === 'memory';
    }

    function getGrid() {
      return document.querySelector('div.grid-cols-4.gap-4.p-8.max-w-3xl')
        || document.querySelector('div.grid-cols-4.max-w-3xl')
        || document.querySelector('div[class*="grid-cols-4"][class*="max-w-3xl"]')
        || Array.from(document.querySelectorAll('div')).find(node => {
          const buttons = Array.from(node.children || []);
          return buttons.length >= 16 && buttons.every(button => button.tagName === 'BUTTON' && button.querySelector('img[alt="card"]'));
        })
        || null;
    }

    function getCards(grid) {
      return grid ? Array.from(grid.children).filter(node => node.tagName === 'BUTTON' && node.querySelector('img[alt="card"]')) : [];
    }

    async function start(ui) {
      if (!isPage()) {
        ui?.status?.('Открой страницу memory.');
        return;
      }
      if (running) return;

      const grid = getGrid();
      const cards = getCards(grid);
      if (!grid || cards.length < 2) {
        ui?.status?.('Не нашёл поле memory.');
        return;
      }

      running = true;
      runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const root = document.documentElement;
      root.dataset.smbpMemoryRun = runId;
      root.dataset.smbpMemoryTotal = String(cards.length);
      root.dataset.smbpMemoryDone = '0';
      root.dataset.smbpMemorySolved = '0';
      root.dataset.smbpMemoryStatus = 'Запускаю быстрый решатель...';
      delete root.dataset.smbpMemoryError;

      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('memory.page.js') + `?run=${encodeURIComponent(runId)}&ts=${Date.now()}`;
      script.async = false;
      script.onerror = () => {
        root.dataset.smbpMemoryDone = '1';
        root.dataset.smbpMemoryError = 'memory.page.js failed to load';
        root.dataset.smbpMemoryStatus = 'Не удалось загрузить page solver.';
      };
      (document.documentElement || document.body).appendChild(script);
      script.onload = () => script.remove();

      try {
        const total = cards.length;
        ui?.setPrimary?.(String(total), 'Cards');
        while (running) {
          await smb.sleep(120);
          ui?.setSecondary?.(String(root.dataset.smbpMemorySolved || '0'), 'Solved');
          ui?.status?.(root.dataset.smbpMemoryStatus || 'Решаю...');

          if (root.dataset.smbpMemoryDone === '1') {
            const solved = Number(root.dataset.smbpMemorySolved || '0');
            running = false;
            if (solved >= total) {
              await reportGameDone('memory', ui);
            } else {
              const error = root.dataset.smbpMemoryError;
              ui?.status?.(error ? `Memory остановлен: ${error}` : 'Не удалось решить memory до конца.');
            }
            return;
          }
        }
      } finally {
        running = false;
      }
    }

    function stop(ui) {
      running = false;
      document.documentElement.dataset.smbpMemoryRun = 'stopped';
      ui?.status?.('Memory остановлен.');
    }

    return { start, stop, isPage };
  })();

  const QuizGame = (() => {
    let running = false;
    let observer = null;
    let reported = false;
    let processing = false;
    let lastSignature = '';
    let autoPlay = false;

    function isPage() {
      return getCurrentGame() === 'quiz';
    }

    function normalize(value) {
      return smb.normalizeText(value);
    }

    function getQuestionEl() {
      return document.querySelector('h2.cs-text');
    }

    function getQuizRoot() {
      const question = getQuestionEl();
      return question?.closest('div.rounded-md.border')
        || question?.closest('div.rounded-md')
        || question?.closest('main')
        || document.body;
    }

    function isNavButton(button) {
      const text = normalize(button?.textContent || '');
      return text.includes('следующ') || text.includes('заверш');
    }

    function getButtons() {
      return Array.from(getQuizRoot().querySelectorAll('button.cs-button'));
    }

    function getAnswerButtons() {
      return getButtons().filter(button => {
        const text = normalize(button.textContent);
        if (!text || button.disabled || isNavButton(button)) return false;
        const cls = String(button.className || '');
        return /whitespace-normal|break-all|justify-start|border/.test(cls);
      });
    }

    function getNavButton() {
      return getButtons().find(isNavButton) || null;
    }

    function parseEmbeddedQuestions() {
      const cacheKey = '__smbpQuizQuestions';
      if (window[cacheKey]) return window[cacheKey];

      for (const script of Array.from(document.scripts)) {
        const text = script.textContent || '';
        if (!text.includes('correctAnswerId') || !text.includes('questions')) continue;

        const marker = '\\"questions\\":';
        const markerIndex = text.indexOf(marker);
        if (markerIndex === -1) continue;

        const start = text.indexOf('[', markerIndex + marker.length);
        if (start === -1) continue;

        let depth = 0;
        let end = -1;
        for (let index = start; index < text.length; index += 1) {
          const char = text[index];
          if (char === '[') depth += 1;
          if (char === ']') {
            depth -= 1;
            if (depth === 0) {
              end = index;
              break;
            }
          }
        }
        if (end === -1) continue;

        try {
          const payload = text.slice(start, end + 1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          const questions = JSON.parse(payload);
          if (Array.isArray(questions) && questions.length) {
            window[cacheKey] = questions;
            return questions;
          }
        } catch {}
      }

      window[cacheKey] = [];
      return window[cacheKey];
    }

    function resolveAnswer(questionText, buttons) {
      const questionNeedle = normalize(questionText);
      if (!questionNeedle) return null;

      for (const item of parseEmbeddedQuestions()) {
        if (normalize(item?.name) !== questionNeedle) continue;
        const answerIndex = Number(item?.correctAnswerId);
        const answerText = Array.isArray(item?.options) ? item.options[answerIndex] : '';
        if (!answerText) return null;

        const resolved = buttons.find(button => normalize(button.textContent) === normalize(answerText));
        if (!resolved) return null;

        return { button: resolved, answerText };
      }

      return null;
    }

    function decorateButtons(answerButton, buttons) {
      for (const button of buttons) {
        button.style.transition = 'opacity .18s ease, border-color .18s ease, box-shadow .18s ease';
        if (button === answerButton) {
          button.style.borderColor = '#32d27f';
          button.style.boxShadow = '0 0 18px rgba(50,210,127,.2)';
          button.style.background = 'rgba(50,210,127,.14)';
          button.style.color = '#32d27f';
          button.style.opacity = '1';
        } else {
          button.style.opacity = '0.38';
        }
      }
    }

    async function processPage(ui) {
      if (!running || processing) return;

      const navButton = getNavButton();
      if (autoPlay && navButton && !navButton.disabled) {
        processing = true;
        ui?.status?.('Перехожу к следующему вопросу...');
        navButton.click();
        if (normalize(navButton.textContent).includes('заверш')) {
          await smb.sleep(400);
          if (!reported) {
            reported = true;
            await reportGameDone('quiz', ui);
          }
          stop(ui, false);
          return;
        }
        await smb.sleep(200);
        processing = false;
        return;
      }

      const questionEl = getQuestionEl();
      const buttons = getAnswerButtons();
      if (!questionEl || !buttons.length) return;

      const signature = `${normalize(questionEl.textContent)}|${buttons.map(button => normalize(button.textContent)).join('|')}`;
      if (signature === lastSignature) return;

      const answer = resolveAnswer(questionEl.textContent, buttons);
      lastSignature = signature;
      if (!answer) {
        ui?.status?.('Ответ не найден в данных страницы.');
        return;
      }

      decorateButtons(answer.button, buttons);
      ui?.status?.(`Верный ответ: ${answer.answerText}`);

      if (!autoPlay) return;

      processing = true;
      answer.button.click();
      await smb.sleep(650);
      processing = false;
      processPage(ui);
    }

    async function start(ui, options = {}) {
      if (!isPage()) {
        ui?.status?.('Открой страницу quiz.');
        return;
      }

      const settings = await smb.loadSettings();
      autoPlay = options.autoPlay ?? settings.quizAutoPlay ?? false;
      running = true;
      reported = false;
      processing = false;
      lastSignature = '';

      if (observer) observer.disconnect();
      observer = new MutationObserver(() => {
        processPage(ui);
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
      });

      ui?.status?.(autoPlay ? 'Авто-режим квиза включён.' : 'Режим подсказки включён.');
      processPage(ui);
    }

    function stop(ui, changeStatus = true) {
      running = false;
      reported = false;
      processing = false;
      lastSignature = '';
      if (observer) observer.disconnect();
      observer = null;
      if (changeStatus) ui?.status?.('Квиз остановлен.');
    }

    return { start, stop, isPage };
  })();

  const DifferenceGame = (() => {
    let points = [];
    let overlays = [];
    let running = false;

    function isPage() {
      return getCurrentGame() === 'difference';
    }

    function clearOverlays() {
      for (const item of overlays) item.remove();
      overlays = [];
    }

    function findImages() {
      const images = Array.from(document.querySelectorAll('img')).filter(image => {
        const rect = image.getBoundingClientRect();
        return rect.width > 180 && rect.height > 180;
      });
      if (images.length < 2) return null;
      return [images[0], images[1]];
    }

    function parsePoints() {
      for (const script of Array.from(document.scripts)) {
        const text = script.textContent || '';
        if (!text.includes('differences')) continue;

        const marker = '\\"differences\\":';
        const markerIndex = text.indexOf(marker);
        if (markerIndex === -1) continue;

        const start = text.indexOf('[', markerIndex + marker.length);
        if (start === -1) continue;

        let depth = 0;
        let end = -1;
        for (let index = start; index < text.length; index += 1) {
          const char = text[index];
          if (char === '[') depth += 1;
          if (char === ']') {
            depth -= 1;
            if (depth === 0) {
              end = index;
              break;
            }
          }
        }
        if (end === -1) continue;

        try {
          const payload = text.slice(start, end + 1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          const list = JSON.parse(payload);
          if (Array.isArray(list) && list.length) return list;
        } catch {}
      }
      return [];
    }

    function drawMarker(left, top, size) {
      const marker = document.createElement('div');
      marker.style.cssText = [
        'position:absolute',
        `left:${left}px`,
        `top:${top}px`,
        `width:${size}px`,
        `height:${size}px`,
        'border:2px solid #32d27f',
        'border-radius:999px',
        'box-shadow:0 0 18px rgba(50,210,127,.28)',
        'pointer-events:none',
        'z-index:2147483646'
      ].join(';');
      document.body.appendChild(marker);
      overlays.push(marker);
    }

    function buildPoints() {
      const imagePair = findImages();
      const raw = parsePoints();
      if (!imagePair || !raw.length) return [];

      const [leftImage, rightImage] = imagePair;
      const leftRect = leftImage.getBoundingClientRect();
      const rightRect = rightImage.getBoundingClientRect();
      const leftWidth = leftImage.naturalWidth || leftRect.width;
      const leftHeight = leftImage.naturalHeight || leftRect.height;
      const rightWidth = rightImage.naturalWidth || rightRect.width;
      const rightHeight = rightImage.naturalHeight || rightRect.height;

      return raw.map(point => {
        const radius = Math.max(12, Number(point.radius) || 20);
        return {
          leftPageX: window.scrollX + leftRect.left + (Number(point.x) / leftWidth) * leftRect.width,
          leftPageY: window.scrollY + leftRect.top + (Number(point.y) / leftHeight) * leftRect.height,
          rightPageX: window.scrollX + rightRect.left + (Number(point.x) / rightWidth) * rightRect.width,
          rightPageY: window.scrollY + rightRect.top + (Number(point.y) / rightHeight) * rightRect.height,
          radius
        };
      });
    }

    function renderMarkers(nextPoints) {
      clearOverlays();
      for (const point of nextPoints) {
        const size = point.radius * 2;
        drawMarker(point.leftPageX - window.scrollX - point.radius, point.leftPageY - window.scrollY - point.radius, size);
        drawMarker(point.rightPageX - window.scrollX - point.radius, point.rightPageY - window.scrollY - point.radius, size);
      }
    }

    function getScore() {
      const match = document.body.innerText.match(/(\d+)\s*\/\s*5\s*найден/iu);
      return match ? Number(match[1]) : -1;
    }

    function ensureVisible(pageX, pageY) {
      const localX = pageX - window.scrollX;
      const localY = pageY - window.scrollY;
      const pad = 40;
      if (localX > pad && localX < innerWidth - pad && localY > pad && localY < innerHeight - pad) return;
      window.scrollTo({
        left: Math.max(0, pageX - innerWidth / 2),
        top: Math.max(0, pageY - innerHeight / 2),
        behavior: 'instant'
      });
    }

    function fireClick(pageX, pageY) {
      ensureVisible(pageX, pageY);
      const clientX = pageX - window.scrollX;
      const clientY = pageY - window.scrollY;
      const target = document.elementFromPoint(clientX, clientY);
      if (!target) return false;

      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        target.dispatchEvent(new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY
        }));
      }
      return true;
    }

    async function scan(ui) {
      points = buildPoints();
      clearOverlays();
      if (!points.length) {
        ui?.status?.('Не удалось прочитать точки загадки.');
        ui?.setPrimary?.('0', 'Points');
        return false;
      }
      renderMarkers(points);
      ui?.setPrimary?.(String(points.length), 'Points');
      ui?.setSecondary?.(String(Math.max(0, getScore())), 'Found');
      ui?.status?.(`Точки получены из данных страницы: ${points.length}`);
      return true;
    }

    async function start(ui) {
      if (!isPage()) {
        ui?.status?.('Открой страницу difference.');
        return;
      }
      if (running) return;
      running = true;

      try {
        if (!points.length) {
          const ok = await scan(ui);
          if (!ok) return;
        }

        for (let index = 0; index < points.length && running; index += 1) {
          const point = points[index];
          ui?.status?.(`Кликаю точку ${index + 1} из ${points.length}...`);
          const before = getScore();
          fireClick(point.leftPageX, point.leftPageY);
          await smb.sleep(320);

          if (getScore() <= before) {
            fireClick(point.rightPageX, point.rightPageY);
            await smb.sleep(320);
          }

          ui?.setSecondary?.(String(Math.max(0, getScore())), 'Found');
        }

        if (getScore() >= 5) {
          await reportGameDone('difference', ui);
        } else {
          ui?.status?.(`Авто-клик завершён. Найдено: ${Math.max(0, getScore())}/5`);
        }
      } finally {
        running = false;
      }
    }

    function stop(ui) {
      running = false;
      ui?.status?.('Difference остановлен.');
    }

    return { scan, start, stop, isPage };
  })();

  window.SMBP.games = {
    getCurrentGame,
    MemoryGame,
    QuizGame,
    DifferenceGame
  };
})();
