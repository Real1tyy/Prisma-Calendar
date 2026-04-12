import { MockVaultTable } from "@real1ty-obsidian-plugins/testing";
import type { App } from "obsidian";
import { BehaviorSubject } from "rxjs";
import { vi } from "vitest";

import type { EventFileRepository } from "../../src/core/event-file-repository";
import type { EventStore } from "../../src/core/event-store";
import type { CalendarEvent } from "../../src/types/calendar";
import type { Frontmatter, SingleCalendarConfig } from "../../src/types/index";
import { createParserSettings } from "./settings-fixtures";

/**
 * Minimal stub exposing only the EventFileRepository surface the trackers use:
 * `getTable()`. Nothing else is called at construction or during the tests.
 */
export function createStubRepoWithTable(table: MockVaultTable<Frontmatter>): EventFileRepository {
	return { getTable: () => table } as unknown as EventFileRepository;
}

/**
 * Minimal stub EventStore. Trackers call `getEventByPath()` and `getAllEvents()`.
 * Callers pass a map of filePath → event and it resolves lookups from that map.
 */
export function createStubEventStore(events: Map<string, CalendarEvent> = new Map()): EventStore {
	return {
		getEventByPath: vi.fn((path: string) => events.get(path) ?? null),
		getAllEvents: vi.fn(() => [...events.values()]),
	} as unknown as EventStore;
}

/**
 * Creates a minimal App stub with just the members trackers touch.
 * - `fileManager.processFrontMatter` is a no-op vi.fn() — propagators call it but we
 *   verify *whether* propagation triggered, not whether it mutated frontmatter.
 * - `metadataCache.getFirstLinkpathDest` resolves wiki-links to TFile-like objects.
 */
export function createTrackerApp(linkResolver: (linkPath: string) => string | null = () => null) {
	return {
		fileManager: {
			processFrontMatter: vi.fn().mockResolvedValue(undefined),
		},
		metadataCache: {
			getFirstLinkpathDest: vi.fn((linkPath: string) => {
				const resolved = linkResolver(linkPath);
				return resolved ? { path: resolved } : null;
			}),
		},
	};
}

// ─── Unified tracker harness ─────────────────────────────────

type TrackerCtor<T> = new (
	app: App,
	repo: EventFileRepository,
	eventStore: EventStore,
	settingsStore: BehaviorSubject<SingleCalendarConfig>
) => T;

export interface TrackerHarnessOptions {
	settings?: Partial<SingleCalendarConfig>;
	seed?: Array<{ key: string; data: Frontmatter }>;
	events?: Map<string, CalendarEvent>;
	/** Resolves wiki-link targets to file paths (used by prerequisite-tracker). */
	linkResolver?: (linkPath: string) => string | null;
}

export interface TrackerHarness<T> {
	tracker: T;
	table: MockVaultTable<Frontmatter>;
	settingsStore: BehaviorSubject<SingleCalendarConfig>;
	eventStore: EventStore;
}

/**
 * Builds a tracker instance wired up against a MockVaultTable and stub collaborators,
 * then streams any seed rows through `table.create()` so they reach the view via the
 * same event pipeline production uses. Returns the tracker plus every collaborator
 * the tests need to drive.
 */
export async function buildTrackerHarness<T>(
	TrackerClass: TrackerCtor<T>,
	options: TrackerHarnessOptions = {}
): Promise<TrackerHarness<T>> {
	const table = new MockVaultTable<Frontmatter>("Events");
	const settings = createParserSettings(options.settings ?? {});
	const settingsStore = new BehaviorSubject<SingleCalendarConfig>(settings);
	const app = createTrackerApp(options.linkResolver);
	const eventStore = createStubEventStore(options.events);
	const repo = createStubRepoWithTable(table);

	const tracker = new TrackerClass(app as unknown as App, repo, eventStore, settingsStore);

	for (const row of options.seed ?? []) {
		await table.create({ fileName: row.key, data: row.data });
	}

	return { tracker, table, settingsStore, eventStore };
}
