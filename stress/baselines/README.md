# Stress baselines

Committed, **user-blessed** performance baselines — one JSON per scenario ×
profile (e.g. `calendar-navigation.small.json`). They are the regression anchor:
a run compares its p95 timings and exact counts against the matching baseline on
the **same machine**.

- Captured/refreshed only by running with `PERF_BLESS=1` (the `stress:bless`
  flow). Never auto-written by a normal run.
- Treated like visual `__baselines__` — the human owns them. Agents must not
  delete or silently overwrite them.
- A run with no matching baseline reports timings but does not flag regressions.
