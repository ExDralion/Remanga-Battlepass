# SailorM Battlepass

Chrome/Edge extension for automating ReManga Battlepass tasks.

This GitHub build does not include account-bound data, cookies, tokens, browser profiles, or local task history.

## Features

- Battlepass overview with account, EXP, levels, rewards, and badge status.
- Tasks page with grouped daily, weekly, and permanent task sections.
- Direct API automation for supported Battlepass tasks.
- Rewards page with claiming, paid reward filtering, and claimed/pending grouping.
- Settings page for automation preferences and title blacklist management.
- Local storage only through `chrome.storage`.

## Install

1. Open `chrome://extensions/` or `edge://extensions/`.
2. Enable developer mode.
3. Click `Load unpacked`.
4. Select this extension folder.
5. Open `https://remanga.org/user/battlepass/tasks`.

## Structure

```text
Remanga-Battlepass/
├── images/
├── manifest.json
├── background.js
├── batch-executor.js
├── cache-manager.js
├── popup.html
├── popup.js
├── rate-limiter.js
├── shared.js
├── tasks.js
├── ui.js
└── README.md
```

## Notes

The old page solvers for `/user/battlepass/games/quiz`, `/memory`, and `/difference` were removed. Supported mini-game tasks are completed through the current direct Battlepass API runner instead of opening or solving those pages.

Automation may violate site rules. Use at your own risk.
