---
title: Inject a sequencer into CommandManager for cross-calendar undo ordering
type: decision
status: accepted
created: 2026-05-24
owner: real1ty
plugin:
  - prisma-calendar
  - shared
tags:
  - shared
  - convention
---

# Inject a sequencer into CommandManager for cross-calendar undo ordering

## Problem

Prisma can run several calendars ("planning systems") at once, and **each owns its
own `CommandManager`** (its own undo/redo history). There is only one `Ctrl+Z`, so
the plugin must decide *which* calendar's history to undo. The right answer is "the
calendar I just acted in" — which means we need a way to order activity **across**
otherwise-independent managers.

This surfaced as a bug: moving an event between calendars records the command on the
**source** calendar's stack but flips the *last-used* calendar to the **destination**.
Resolving undo by last-used hit the destination's empty stack and reported "Nothing
to undo." Undo must follow recency, not last-used.

## Decision

`CommandManager` stamps every history mutation (execute / register / undo / redo)
with the next value from an injectable `Sequencer` (`{ next(): number }`), exposed as
`lastActivityOrder`. Undo/redo resolution picks the manager with the highest stamp
that can act (`read-operations.resolveHistoryBundle`).

The plugin creates **one** `createMonotonicSequencer()` and hands the same instance to
every calendar's `CommandManager`, making exactly those histories comparable. A
manager constructed without one defaults to a **private per-instance** sequencer, so it
never ranks against histories it shouldn't.

## Why a sequencer, not a module-global counter

The ordering could have been a single module-level counter shared by every
`CommandManager` in the process. It would have functioned, but an injected,
explicitly-scoped sequencer prevents three real hazards:

- **Test pollution.** A module-global never resets between tests; an assertion that a
  manager's stamp was `2` instead read `118` because earlier tests in the same run had
  bumped the shared counter. Per-test sequencers make ordering deterministic.
- **Hidden cross-subsystem coupling.** `VaultTable` also uses `CommandManager`
  internally; a global would let unrelated background row edits advance the same counter
  the calendar undo-routing reads. The per-instance default keeps them on separate
  scales — only deliberately-shared managers are comparable.
- **Fragile scoping.** A module-global only behaved correctly because esbuild bundles
  `shared` separately per plugin, so each plugin happened to get its own copy. The
  injected sequencer makes the scope a deliberate decision instead of a side effect of
  bundling.

A counter rather than a timestamp because wall-clock values collide within a
millisecond, so two operations in the same tick would tie.

## Consequences

- `CommandManagerOptions` gains an optional `sequencer`; `shared` exports
  `createMonotonicSequencer` / `Sequencer`.
- Callers that own several managers and want cross-manager recency must pass one shared
  sequencer (Prisma does this from `main.ts`). Forgetting to share it degrades safely:
  histories simply rank independently rather than misordering.
- This is a heuristic — it drains the most-recently-touched calendar's stack before the
  next, not a single globally-chronological history. That matches the "undo in this
  calendar" mental model; a unified global history would be a larger, separate change.
