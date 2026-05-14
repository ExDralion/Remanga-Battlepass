(() => {
  const root = document.documentElement;
  const runId = root.dataset.smbpMemoryRun;
  const total = Number(root.dataset.smbpMemoryTotal || '0');
  if (!runId) return;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  const getGrid = () =>
    document.querySelector('div.grid-cols-4.gap-4.p-8.max-w-3xl') ||
    document.querySelector('div.grid-cols-4.max-w-3xl') ||
    document.querySelector('div[class*="grid-cols-4"][class*="max-w-3xl"]') ||
    Array.from(document.querySelectorAll('div')).find(node => {
      const buttons = Array.from(node.children || []);
      return buttons.length >= 16 &&
        buttons.every(button => button.tagName === 'BUTTON' && button.querySelector('img[alt="card"]'));
    }) ||
    null;

  const getCards = grid => grid
    ? Array.from(grid.children).filter(node => node.tagName === 'BUTTON' && node.querySelector('img[alt="card"]'))
    : [];

  const getSrc = card => {
    const img = card?.querySelector('img[alt="card"]');
    return img ? (img.currentSrc || img.src || '') : '';
  };

  const isClosed = src => !src || src.includes('random-card.webp');

  function clickCard(card) {
    card?.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true
    }));
  }

  function waitFor(card, predicate, timeout = 2500) {
    return new Promise(resolve => {
      const img = card?.querySelector('img[alt="card"]');
      if (!img) return resolve(null);

      const current = img.currentSrc || img.src || '';
      if (predicate(current)) return resolve(current);

      let done = false;
      const finish = value => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        clearInterval(poller);
        observer.disconnect();
        resolve(value);
      };

      const timer = setTimeout(() => finish(img.currentSrc || img.src || ''), timeout);
      const observer = new MutationObserver(() => {
        const next = img.currentSrc || img.src || '';
        if (predicate(next)) finish(next);
      });
      observer.observe(img, { attributes: true, attributeFilter: ['src', 'srcset'] });
      observer.observe(card, { attributes: true, attributeFilter: ['class'] });

      const poller = setInterval(() => {
        const next = img.currentSrc || img.src || '';
        if (predicate(next)) finish(next);
      }, 50);
    });
  }

  const waitOpen = card => waitFor(card, src => !isClosed(src));
  const waitClosed = card => waitFor(card, src => isClosed(src), 2500);

  function getReactFiber(node) {
    if (!node) return null;
    for (const key in node) {
      if (key.startsWith('__reactFiber$')) return node[key];
    }
    return null;
  }

  function isLayout(value, expectedLength) {
    return Array.isArray(value) &&
      value.length === expectedLength &&
      value.every(item =>
        item &&
        typeof item === 'object' &&
        typeof item.id === 'number' &&
        typeof item.symbol === 'number'
      );
  }

  function getLayout(cards) {
    const fiber = getReactFiber(cards[0]);
    let node = fiber;
    let hops = 0;

    while (node && hops < 25) {
      hops += 1;
      let hook = node.memoizedState;
      let hookSteps = 0;

      while (hook && hookSteps < 40) {
        hookSteps += 1;
        if (isLayout(hook.memoizedState, cards.length)) return hook.memoizedState;
        if (isLayout(hook.baseState, cards.length)) return hook.baseState;
        hook = hook.next;
      }

      node = node.return;
    }
    return null;
  }

  (async () => {
    try {
      root.dataset.smbpMemoryStatus = 'Читаю раскладку...';

      const cards = getCards(getGrid());
      const layout = getLayout(cards);
      if (!layout) throw new Error('Layout not found');

      const bySymbol = new Map();
      for (const item of layout) {
        if (!bySymbol.has(item.symbol)) bySymbol.set(item.symbol, []);
        bySymbol.get(item.symbol).push(item.id);
      }

      const pairs = Array.from(bySymbol.values())
        .filter(group => group.length >= 2)
        .map(group => [group[0], group[1]]);

      const matched = new Set(layout.filter(item => item?.isMatched).map(item => item.id));
      root.dataset.smbpMemorySolved = String(matched.size);
      root.dataset.smbpMemoryStatus = `Готовая раскладка найдена: ${pairs.length} пар`;

      for (const [first, second] of pairs) {
        if (root.dataset.smbpMemoryRun !== runId) return;
        if (matched.has(first) || matched.has(second)) continue;

        const liveCards = getCards(getGrid());
        const cardA = liveCards[first];
        const cardB = liveCards[second];
        if (!cardA || !cardB) continue;

        if (isClosed(getSrc(cardA))) {
          clickCard(cardA);
          const srcA = await waitOpen(cardA);
          if (!srcA || isClosed(srcA)) continue;
          await sleep(80);
        }

        if (isClosed(getSrc(cardB))) {
          clickCard(cardB);
          const srcB = await waitOpen(cardB);
          if (!srcB || isClosed(srcB)) continue;
        }

        await sleep(700);

        const currentA = getSrc(cardA);
        const currentB = getSrc(cardB);
        if (!isClosed(currentA) && !isClosed(currentB)) {
          matched.add(first);
          matched.add(second);
          root.dataset.smbpMemorySolved = String(matched.size);
          root.dataset.smbpMemoryStatus = `Собрано пар: ${matched.size / 2} / ${total / 2}`;
        } else {
          await Promise.all([waitClosed(cardA), waitClosed(cardB)]);
        }

        await sleep(80);
      }

      root.dataset.smbpMemorySolved = String(matched.size);
      root.dataset.smbpMemoryDone = '1';
      root.dataset.smbpMemoryStatus = matched.size >= total ? 'Memory завершён' : 'Fast pass incomplete';
    } catch (error) {
      root.dataset.smbpMemoryDone = '1';
      root.dataset.smbpMemoryError = error?.message || String(error);
      root.dataset.smbpMemoryStatus = `Ошибка: ${error?.message || error}`;
    }
  })();
})();
