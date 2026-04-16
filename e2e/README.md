# Prisma-Calendar — End-to-End Tests

Playwright-driven E2E suite that launches a real Obsidian Electron binary against
an isolated per-test temp vault with Prisma-Calendar installed from the freshly
built artifacts. The generic runtime lives in
[`shared/src/testing/e2e/`](../../shared/src/testing/e2e) — this directory only
holds Prisma-specific wiring (data.json seeding, calendar-bundle readiness) and
the spec files.

## Run locally

```bash
# headless default — uses xvfb on Linux, no visible window
pnpm --filter Prisma-Calendar run test:e2e

# same, with full debug logs on stderr (stdout/stderr/CDP/enable-trace)
pnpm --filter Prisma-Calendar run test:e2e:verbose
# or forward --debug through the runner
pnpm --filter Prisma-Calendar run test:e2e -- --debug

# headed (watch Obsidian actually do things)
pnpm --filter Prisma-Calendar run test:e2e:headed

# demo mode — headed + slowMo so every action is easy to follow visually
pnpm --filter Prisma-Calendar run test:e2e:demo -- specs/events/create-allday.spec.ts

# interactive Playwright UI mode
pnpm --filter Prisma-Calendar run test:e2e:ui

# single spec, with Playwright inspector
pnpm --filter Prisma-Calendar run test:e2e:debug -- specs/plugin-load.spec.ts
```

### Demo mode

`PW_DEMO=1` forces headed mode (xvfb off) and feeds `slowMo` into the Playwright
CDP connection so every click / fill / press is paced at 500ms. Use it when you
want to watch a flow execute without a debugger. Override the pacing with any
positive integer (milliseconds):

```bash
PW_DEMO=250  pnpm --filter Prisma-Calendar run test:e2e -- specs/events/create-allday.spec.ts
PW_DEMO=1200 pnpm --filter Prisma-Calendar run test:e2e -- specs/events/recurring.spec.ts
```

Demo mode is local-only; CI always runs headless and unthrottled.

First run downloads the pinned Obsidian binary + asar via `obsidian-launcher` into
its cache (`~/.obsidian-cache/` on Linux). Subsequent runs reuse it.

### Headless on Linux

`test:e2e` wraps Playwright in `xvfb-run` so Electron renders to a virtual display
and no window appears. Install it once:

```bash
sudo apt install xvfb
```

If `xvfb-run` is missing, the runner falls back to headed mode with a warning.
macOS and Windows always run with the native display.

### Binary override

Set `OBSIDIAN_BIN` to point at a locally installed Obsidian to skip the launcher:

```bash
OBSIDIAN_BIN=/opt/obsidian/Obsidian pnpm --filter Prisma-Calendar run test:e2e
```

### Pinning the Obsidian version

`e2e/obsidian-version.json` pins the app + installer versions. Bump it when the
plugin starts using a newer Obsidian API (symptom: `Plugin failure: Class extends
value undefined`).

## Isolation model

Each test gets its own temp directory containing:

1. a copy of `fixtures/vault-seed/` as the vault root,
2. the freshly built plugin dropped into `.obsidian/plugins/prisma-calendar/`,
3. a pre-seeded `data.json` pointing the default calendar at `Events/` and
   pinning the stored version to the current manifest (suppresses the "What's
   new" modal),
4. a dedicated `--user-data-dir` produced by `obsidian-launcher.setupConfigDir`,
5. a short, run-specific `XDG_RUNTIME_DIR` so the Obsidian single-instance socket
   can't collide with a desktop Obsidian session (see below).

Directories are retained by default for post-mortem; set `E2E_CLEANUP=1` to
delete on test close.

## Logging

The shared bootstrap logger is level-aware:

- **info** (default): one line per test (`bootstrap ok id=… (2.1s)`, plus
  `pageerror` / `PAGE CRASHED` when something breaks). Clean enough to read
  the suite summary on stderr.
- **debug** (`E2E_VERBOSE=1` or `--debug`): everything — stdout/stderr, CDP
  handshake, renderer `console.*`, the enable-plugin trace, vault paths, etc.

Both levels always write to `e2e/.cache/last-run.log`, so a failed run still has
full detail even when you ran without `--debug`.

Prisma's own plugin logging is controlled by `PRISMA_LOG_LEVEL`. The harness sets
it to `warn` by default and `debug` under `E2E_VERBOSE=1`. Renderer
`console.log/info/debug` are no-op'd by default too; `console.warn` /
`console.error` still flow through. Set `E2E_VERBOSE=1` to restore everything.

Environment flags:

- `E2E_VERBOSE=1` — full debug logs + restore renderer `console.*`.
- `E2E_BOOTSTRAP_LOGS=1` — restore the legacy two-line `bootstrap start` /
  `bootstrap ready` breadcrumbs (useful when diagnosing a hang).
- `E2E_CLEANUP=1` — delete per-run vault on close instead of retaining it.

## Problems we hit getting Playwright to drive Obsidian

Leaving these here because none of them are in the Playwright docs and every one
cost real time. The fixes live in
[`shared/src/testing/e2e/bootstrap.ts`](../../shared/src/testing/e2e/bootstrap.ts).

### 1. `_electron.launch({ executablePath: obsidian-installer })` hangs forever

**Symptom:** `_electron.launch` sits for the full test timeout (~120 s) with no
output; the process is alive but Playwright never returns.

**Cause:** Obsidian's packaged installer binary ignores the CDP flags Playwright
needs for the electron launch handshake. Tried using the standalone `electron`
npm package as the runtime instead — that fails differently: `main.js` runs but
never creates a BrowserWindow (confirmed by attaching a separate CDP client).

**Fix:** Spawn the installer binary ourselves with `--remote-debugging-port=9222`,
read the `DevTools listening on ws://...` line from its stderr, then attach
Playwright via `chromium.connectOverCDP`. The installer IS the Electron runtime
Obsidian was built with and it does honour Chromium's CDP flag — it just won't
talk to Playwright's launcher.

### 2. Obsidian exits with code 0 and no window ever appears

**Symptom:** process spawns, prints a couple of stdout lines, exits cleanly. No
DevTools line. Looks like everything is fine until you realise no window opened.

**Cause:** Obsidian checks `$XDG_RUNTIME_DIR/.obsidian-cli.sock` at startup. If
the developer has Obsidian running on their desktop, the spawned instance sees
that socket, decides another copy is already in charge, and drops into a
no-window CLI mode where it silently exits.

**Fix:** Give each test run its own `XDG_RUNTIME_DIR=/tmp/o-e2e-<short-id>`.

### 3. Unix socket path too long

**Symptom:** after isolating XDG, Obsidian still silently fails — or wayland
complains about a truncated socket path.

**Cause:** Unix socket paths are capped at 108 bytes. Our first attempt used the
vault's full absolute path (~150 bytes) as the XDG dir; Obsidian/Chromium create
multiple sockets under that dir (`wayland-0`, etc.) and the names get truncated.

**Fix:** `/tmp/o-e2e-${id.slice(0,8)}` — always short, always under the limit.

### 4. Chromium CDP handshake stalls under xvfb

**Symptom:** `chromium.connectOverCDP` times out, but the process is clearly
alive and the DevTools URL was printed.

**Cause:** xvfb gives you a virtual display with no GPU. Chromium's hardware
accel path errors out and the renderer can get stuck before the CDP side is
ready to talk.

**Fix:** always pass `--disable-gpu --disable-software-rasterizer` on Linux.

### 5. `browser.firstWindow()` never resolves

**Symptom:** after `connectOverCDP` succeeds, awaiting `firstWindow()` hangs.

**Cause:** the workspace window is attached to the context after we've already
connected, and firstWindow seems to be racing with that.

**Fix:** poll `context.pages()` directly; pick `pages[pages.length - 1]` once
the array is non-empty. That's always the workspace window.

### 6. Plugin stays disabled (trust dialog never clicked)

**Symptom:** Obsidian boots, but `app.plugins.plugins['prisma-calendar']` is
undefined — the plugin folder was staged but never loaded.

**Cause:** community plugins start disabled on a fresh vault until the user
clicks "Trust author and enable plugins". The dialog's DOM varies across
Obsidian versions and races with window paint, so clicking it from Playwright
is flaky.

**Fix:** skip the dialog entirely — call `app.plugins.setEnable(true)` +
`loadManifests()` + `enablePluginAndSave('prisma-calendar')` from the renderer.
That's what the dialog does anyway.

### 7. Prisma's "What's new" modal blocks every test

**Symptom:** specs that click into the calendar fail because a "What's new in
v2.12.0" modal sits on top of the workspace.

**Cause:** the plugin fires its changelog modal when the version it finds
stored in `data.json` differs from the version in `manifest.json`. Fresh vault
→ no stored version → modal.

**Fix:** pre-seed `data.json` with `version: manifest.version` before boot. The
shared `seedPluginData` hook in `bootstrap.ts` is where we do this for Prisma.

### 8. Vitest picking up Playwright specs

**Symptom:** `pnpm test` (Vitest) tries to run `e2e/**/*.spec.ts` and crashes on
Playwright imports.

**Fix:** add `"e2e/**"` to `vitest.config.ts`'s `exclude`.

## CI gating

E2E is **not** part of `mise run ci` (PR path). It runs as the final step of
`mise run ci-full --plugin Prisma-Calendar --release`, which is the pre-release
gate for the plugin. Failures do not abort the rest of the suite — Playwright
runs every spec and surfaces all failures at the end.

## Adding a new spec

1. Add a `*.spec.ts` file under `e2e/specs/`.
2. Import `{ expect, test }` from `../fixtures/electron` for the Obsidian fixture.
3. Import generic renderer helpers (`executeCommand`, `openNote`,
   `openSettingsTab`, etc.) directly from `@real1ty-obsidian-plugins/testing/e2e`.
4. Reference stable locators from `../fixtures/selectors.ts`. Add entries there
   rather than inlining selectors — React migration will churn the DOM and a
   single diff surface is easier to keep current.
5. Prefer driving behaviour through `obsidian.page.evaluate(() => window.app…)`
   for state assertions; prefer `obsidian.page.click(...)` for real UI
   interaction.

## Known gaps (intentional, land later)

- FullCalendar drag/resize interactions — needs time-grid locators and
  `page.dragAndDrop`.
- Statistics view button coverage.
- Exhaustive settings-toggle coverage with `data.json` diffing.
- Category / property rename migration flows.
- Visual-regression integration (the existing visual pilot keeps its own runner
  for now).

Tracked separately in the Sprint 6+ backlog.
