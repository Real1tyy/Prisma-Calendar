# Prisma-Calendar stress / performance suite

Deterministic, agent-runnable performance measurement — separate from the
correctness `e2e/` suite. Reproduces a large-vault scenario, captures objective
metrics (internal stage timings + CDP), writes a report, and compares against a
same-machine baseline. See [docs/stress-testing.md](../../docs/stress-testing.md)
and [the spec](../../docs/specs/2026-05-21-120008-performance-stress-harness.md).

**Not wired into CI.** This is a local / agent-driven loop.

## Layout

```
stress/
  playwright.config.ts        # serial, no-retry, generous timeout
  stress.config.ts            # seed, repeats, profiles, budgets, paths
  vaults/
    profiles.ts               # small / medium vault profiles
    event-builder.ts          # deterministic Prisma event factory (frozen anchor year)
    generate-vault.ts         # standalone CLI to pre-seed a vault
  scenarios/navigate-months.ts
  specs/calendar-navigation.perf.spec.ts
  baselines/                  # committed, user-blessed (see baselines/README.md)
```

The reusable engine lives in `@real1ty-obsidian-plugins/testing/stress`
(harness runtime) and `@real1ty-obsidian-plugins/perf` (in-app tracker), so other
plugins adopt the same flow.

## Run

```bash
# Run the navigation scenario (builds the plugin first), writes a report.
pnpm --filter prisma-calendar run stress -- stress/specs/calendar-navigation.perf.spec.ts

# Capture / refresh the same-machine baseline.
PERF_BLESS=1 pnpm --filter prisma-calendar run stress -- stress/specs/calendar-navigation.perf.spec.ts

# Generate a vault on disk standalone (inspection / future cold-start flow).
pnpm --filter prisma-calendar run stress:generate -- --profile small --seed 42
```

Reports land in `logs/perf-reports/<run>/report.md` (+ `run.json`), gitignored.

## How it works

1. `generateVault` writes a deterministic set of event files into the test
   vault; the spec waits for the indexer to reach the exact count.
2. The scenario drives **real toolbar clicks** (next/prev), using the in-app
   `calendar.buildEvents` counter as the settle signal.
3. Internal stage timings (`recurrence.expandVisibleRange`, `eventStore.getEvents`,
   `calendar.buildEvents`) come from `window.__PRISMA_PERF__`; external metrics
   from CDP `Performance.getMetrics`.
4. The run is summarized (p95 over repeats), checked against budgets + baseline,
   and written to a Markdown + JSON report. The test fails on a budget breach or
   a regression.
