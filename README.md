# SailorM Battlepass

Compact build of the ReManga battlepass automation extension.

## What it does

- Reads battlepass tasks through ReManga API.
- Automates supported reading, catalog, likes, profile, minigame, card and reward tasks.
- Shows an in-page menu with Overview, Tasks, Rewards and Settings.
- Claims available battlepass rewards using the latest available level when possible.

## Install

1. Open `edge://extensions` or `chrome://extensions`.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select this folder.
5. Open `https://remanga.org/user/battlepass/tasks`.

## Build Layout

This repository stores the compact installable version:

- `content.js` contains the bundled content scripts.
- `popup.js` contains the bundled popup scripts.
- `background.js` is the MV3 service worker.
- `manifest.json` points to the compact bundles.
- `images/` contains extension icons.

Development tests and split source files are intentionally not included here.
