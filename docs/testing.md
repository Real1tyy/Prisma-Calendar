# Testing Conventions

Unit tests prove the correctness of the application. They **must** evolve in tandem with the source code — every feature, fix, or behavioral change that touches logic should have corresponding test updates.

## When to Write Tests

- **New features**: Every new function, utility, or behavioral path needs tests proving it works.
- **Bug fixes**: Add a test that reproduces the bug _before_ fixing it, then verify it passes after.
- **Refactors**: If you change how something works internally, run existing tests to confirm behavior is preserved. Add tests if the refactor exposes new edge cases.
- **New utilities**: Any exported function in `src/utils/` or `src/core/` must have a test file.

If you're unsure whether something needs tests, it does.

## File Organization

```
tests/
├── setup.ts                    # Global setup, polyfills, settings store factories
├── mocks/
│   ├── obsidian.ts             # Obsidian API mocks (Plugin, Modal, TFile, vault, etc.)
│   └── utils.ts                # File operation and link parser mocks
├── fixtures/
│   ├── index.ts                # Barrel export — all fixtures importable from "fixtures"
│   ├── event-fixtures.ts       # createMockTimedEvent, createMockAllDayEvent, createDefaultMetadata
│   ├── prisma-event-fixtures.ts # createPrismaEventInput (aliased as makeEvent), buildPreviousMap
│   ├── settings-fixtures.ts    # createParserSettings, createNotificationSettings
│   ├── obsidian-fixtures.ts    # createMockVault, createMockMetadataCache, createMockIntegrationApp
│   ├── raw-event-source-fixtures.ts # createRawEventSource
│   ├── ics-fixtures.ts         # createICSExportOptions, createImportedEvent
│   └── scenarios.ts            # SCENARIO namespace — semantic builders (completedEvent, skippedEvent, etc.)
├── core/                       # Tests for src/core/
├── components/                 # Tests for src/components/
├── utils/                      # Tests for src/utils/
└── types/                      # Tests for type-level logic
```

Test files mirror source paths: `src/utils/foo.ts` → `tests/utils/foo.test.ts`.

## Fixtures — Factory Functions

Every piece of test data is created through a **factory function** that returns a fresh object with sensible defaults and accepts `Partial<T>` overrides. Never construct test data inline when a fixture exists.

### Core Factories

| Factory                                      | Returns                  | Location                       |
| -------------------------------------------- | ------------------------ | ------------------------------ |
| `createMockTimedEvent(overrides?)`           | `CalendarEvent` (timed)  | `event-fixtures.ts`            |
| `createMockAllDayEvent(overrides?)`          | `CalendarEvent` (allDay) | `event-fixtures.ts`            |
| `createDefaultMetadata(overrides?)`          | `EventMetadata`          | `event-fixtures.ts`            |
| `createPrismaEventInput(overrides & { id })` | `PrismaEventInput`       | `prisma-event-fixtures.ts`     |
| `createRawEventSource(overrides?)`           | `RawEventSource`         | `raw-event-source-fixtures.ts` |
| `createParserSettings(overrides?)`           | `SingleCalendarConfig`   | `settings-fixtures.ts`         |
| `createMockVault(overrides?)`                | Mock Vault               | `obsidian-fixtures.ts`         |

### Usage

```ts
// Good — factory with targeted overrides
const event = createMockTimedEvent({
  start: "2025-03-15T09:00:00",
  end: "2025-03-15T10:30:00",
  metadata: createDefaultMetadata({ breakMinutes: 15 }),
});

// Bad — inline object with every field
const event = { id: "1", ref: { filePath: "x.md" }, title: "Event", ... };
```

### Adding New Fixtures

When adding a new type that multiple tests need:

1. Create a factory in `tests/fixtures/` following the `Partial<T>` override pattern.
2. Use `eventDefaults()` or similar base factories for composition — never duplicate defaults.
3. Export from the barrel `tests/fixtures/index.ts`.
4. Metadata fields merge via a dedicated `defaultMetadata()` helper — never raw spread.

## Scenarios — Semantic Test Builders

The `SCENARIO` namespace in `tests/fixtures/scenarios.ts` provides **domain-meaningful** event constructors built on top of the core factories:

```ts
SCENARIO.completedEvent(); // timed event with status: "done"
SCENARIO.skippedEvent(); // timed event with skip: true
SCENARIO.fullyDecoratedEvent(); // event with all metadata fields populated
SCENARIO.eventWithReminder(30); // event with 30-minute reminder
SCENARIO.recurringSourceEvent(); // source event with rrule config
SCENARIO.virtualRecurringInstance(); // virtual recurring instance
SCENARIO.allDayHoliday(); // all-day event for a holiday
```

Add new scenarios when a domain concept appears in 3+ tests with the same setup.

## Mocks

### Obsidian API Mocks

Pre-built mocks for `App`, `Vault`, `TFile`, `Plugin`, `Modal`, etc. live in `tests/mocks/obsidian.ts`. Use `createMockApp()` for a complete mock app. Use `createMockFile(path)` for individual files.

### Manual Object Mocks

For dependencies injected via constructor, build mock objects in `beforeEach` using `vi.fn()`:

```ts
let mockParser: { parseEventSource: MockedFunction<...> };

beforeEach(() => {
  mockParser = { parseEventSource: vi.fn() };
  store = new EventStore(mockIndexer, mockParser, ...);
});
```

### RxJS Subjects

For reactive dependencies, use `Subject` or `BehaviorSubject`:

```ts
let eventsSubject: Subject<IndexerEvent>;

beforeEach(() => {
	eventsSubject = new Subject();
	mockIndexer = { events$: eventsSubject.asObservable() };
});

// In test: emit events
eventsSubject.next({ type: "add", source });
```

Always unsubscribe in `afterEach`.

## Test Structure

### Nesting

Use 2–3 levels of `describe` to group by feature area, then by behavior:

```ts
describe("Parser", () => {
  describe("timed event parsing", () => {
    it("should parse start and end from frontmatter", () => { ... });
    it("should use default end when end is missing", () => { ... });
  });

  describe("all-day event parsing", () => {
    it("should parse date-only events", () => { ... });
  });
});
```

### Test Names

Start with `"should"` — describe the expected behavior, not the implementation:

```ts
// Good
it("should return empty string for unparseable input", () => { ... });

// Bad
it("calls intoDate and checks for null", () => { ... });
```

### Arrange / Act / Assert

Keep each section visually distinct. For simple tests this is implicit; for complex tests, use blank lines:

```ts
it("should merge metadata overrides with defaults", () => {
	const source = createRawEventSource({
		frontmatter: { "Start Date": "2025-03-15T09:00:00" },
		metadata: createDefaultMetadata({ breakMinutes: 30 }),
	});

	const event = parser.parseEventSource(source);

	expect(event).toBeDefined();
	expect(event!.metadata.breakMinutes).toBe(30);
});
```

## Reuse Patterns

### Import Aliasing

When a fixture name is verbose, alias it at import for readability:

```ts
import { createPrismaEventInput as makeEvent } from "../fixtures";
```

### Shared Setup

Extract repeated setup into `beforeEach`. If the same 5 lines appear in every test, they belong in setup:

```ts
beforeEach(() => {
	settings = createParserSettings({ directory: "events" });
	settingsStore = new BehaviorSubject(settings);
	parser = new Parser(mockApp, settingsStore);
});
```

### Helper Functions Within Tests

For complex data transformations used across multiple tests in the same file, define a local helper at the top of the `describe` block:

```ts
describe("diffEvents", () => {
  const makeEvent = (overrides: ...) => createPrismaEventInput({ ... });
  const buildPrevious = (events: ...) => buildPreviousMap(events);
  // ...
});
```

## What NOT to Do

- **Never duplicate source code in tests.** Import the real function. If it's not exported, export it.
- **Never hardcode values that exist as constants.** Use `AI_DEFAULTS.MAX_REPROMPT_RETRIES`, not `2`.
- **Never construct test data inline when a fixture exists.** Use factories.
- **Never test Zod schema parsing in isolation.** Test the business logic that uses the parsed data.
- **Never use real/private data.** Use generic names: "Team Meeting", "Alice", "Work".
- **Never skip cleanup.** Unsubscribe observables, clear mocks, restore spies.
