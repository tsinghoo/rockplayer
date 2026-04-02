# Repository Guidelines

## Architecture Overview
- This is a mixed-purpose repository with two cores: stock automation and video browsing.
- Stock flow: ingest quote/K-line data via API, persist to SQLite (`stock.db`), create trade rules, and trigger buy/sell actions from live prices.
- Video flow: browse/manage media files and run split/STT helper tasks.
- Common APIs include `/stock/quotes`, `/stock/k/upload`, `/stock/rule/actions`, and `/video/updateScript`.

## Project Structure & Module Organization
- `app.js`: main Express server, WebSocket entrypoint, stock APIs, and SQLite schema upgrades (`upgradeDb`).
- `okx.js` / `bnb.js`: exchange bridge workers that push quote/K-line/order data to stock APIs.
- `views/`: EJS templates (currently `fileList.ejs`).
- `public/fe` and `public/video`: browser assets (JS/CSS/vendor libs, static HTML pages).
- `shell/`: operational Python/Shell helpers (`qmt.*`, integration helpers, manual test scripts).
- Runtime data is directory-driven: `node app.js <port> <data_dir>` expects `stock.db`, `metadata`, `replacers`, `scripts`, and `toSplit` under `<data_dir>`.

## Build, Test, and Development Commands
- `npm install`: install Node dependencies.
- `node app.js 3000 /abs/path/to/data`: start the web server (required args).
- `npx nodemon app.js 3000 /abs/path/to/data`: dev loop with auto-reload (`nodemon.json` watches `views`, `public`, `app.js`).
- `npm run startokxdev`: run OKX bridge in dev mode (`node okx.js dev`).
- `npm run startokx`: run OKX bridge in default/prod mode.
- `node bnb.js dev http://127.0.0.1:8080`: run Binance bridge in dev mode.

## Coding Style & Naming Conventions
- Match existing style per file; this repo has no enforced root linter/formatter.
- Use 4-space indentation in JS/Python; keep semicolon and quote style consistent within the edited file.

## Testing Guidelines
- There is no formal automated test suite yet; `npm test` is a placeholder and currently fails.
- Use targeted script checks for behavior changes:
  - `bash shell/testStock.sh` for quote push and candidate/rule flows.
  - `python3 shell/stock.test.py` (or related `qmt.*` scripts) for integration smoke checks.
- For stock-rule changes, verify end-to-end: quote update -> rule fetch -> action status update.
- For video-script changes, verify `POST /video/updateScript` produces the expected `.htm` script diff.

## Commit & Pull Request Guidelines
- Follow existing commit style: short, scope-first messages.
- Keep commits single-purpose; separate schema, API, and UI edits when possible.
- PRs should include: problem statement, affected files/routes, test evidence, and screenshots for `public/` UI changes.

## Security & Configuration Tips
- Do not introduce new hardcoded secrets or internal endpoints; move credentials/URLs to environment variables.
- Review diffs for API keys, tokens, and local IPs before pushing.
