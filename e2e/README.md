# Prisma-Calendar — End-to-End Tests

This directory contains Prisma Calendar's Playwright specs plus the small amount
of Prisma-specific fixture wiring that sits on top of the shared E2E runtime.

## Run locally

```bash
# default headless run
pnpm --filter Prisma-Calendar run test:e2e

# verbose bootstrap + renderer logs
pnpm --filter Prisma-Calendar run test:e2e:verbose
pnpm --filter Prisma-Calendar run test:e2e -- --debug

# headed / interactive debugging
pnpm --filter Prisma-Calendar run test:e2e:headed
pnpm --filter Prisma-Calendar run test:e2e:ui
pnpm --filter Prisma-Calendar run test:e2e:debug -- specs/plugin-load.spec.ts

# demo mode
pnpm --filter Prisma-Calendar run test:e2e:demo -- specs/events/create-allday.spec.ts

# single spec
pnpm --filter Prisma-Calendar run test:e2e -- specs/events/create-allday.spec.ts

# feature-folder shortcut
pnpm --filter Prisma-Calendar run test:e2e -- --events
```

## Local notes

- First run downloads the pinned Obsidian binary via `obsidian-launcher` unless `OBSIDIAN_BIN` is set.
- Linux headless runs use `xvfb-run`; install `xvfb` if missing.
- Full run logs always land in `e2e/.cache/last-run.log`.
- Failure traces and screenshots land in `e2e/playwright-report/`.

## Directory shape

```text
e2e/
├── fixtures/              # Prisma-specific helpers and selectors
├── specs/                 # User journeys grouped by area
├── obsidian-version.json  # Pinned Obsidian version for the harness
└── README.md
```

The generic runtime lives in [`shared/src/testing/e2e/`](../../shared/src/testing/e2e).

## Adding a spec

1. Add a `*.spec.ts` file under `e2e/specs/<area>/`.
2. Import `{ expect, test }` from `../fixtures/electron`.
3. Reuse stable locators from `../fixtures/selectors.ts` instead of inlining selectors.
4. Assert persisted state as well as UI state.
