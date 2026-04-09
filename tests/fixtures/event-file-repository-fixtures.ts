import { BehaviorSubject } from "rxjs";
import { vi } from "vitest";

import { MockVaultTable } from "../../../shared/src/testing/mocks/vault-table";
import { EventFileRepository } from "../../src/core/event-file-repository";
import type { Frontmatter } from "../../src/types";
import { createParserSettings } from "./settings-fixtures";

// ─── Testable Subclass ───────────────────────────────────────

/**
 * EventFileRepository subclass that injects a MockVaultTable
 * instead of creating a real VaultTable connected to Obsidian.
 */
export class TestableEventFileRepository extends EventFileRepository {
	readonly mockTable: MockVaultTable<Frontmatter>;

	constructor(app: any, settingsStore: BehaviorSubject<any>, syncStore: any = null) {
		super(app, settingsStore, syncStore);
		this.mockTable = new MockVaultTable(settingsStore.value.directory);
		(this as any).table = this.mockTable;
	}

	protected override createTable(): any {
		return new MockVaultTable("temp");
	}
}

// ─── Settings ────────────────────────────────────────────────

export function createRepoSettings(overrides: Record<string, unknown> = {}) {
	return createParserSettings({
		directory: "Events",
		statusProperty: "Status",
		doneValue: "done",
		rruleProp: "Recurrence",
		rruleIdProp: "RecurrenceId",
		rruleSpecProp: "RecurrenceSpec",
		skipProp: "Skip",
		calendarTitleProp: "",
		autoAssignZettelId: "disabled",
		markPastInstancesAsDone: false,
		...overrides,
	});
}

export function createRepoSettingsStore(overrides: Record<string, unknown> = {}) {
	return new BehaviorSubject(createRepoSettings(overrides));
}

// ─── Frontmatter Factories ───────────────────────────────────

export function createTimedFrontmatter(overrides: Record<string, unknown> = {}): Frontmatter {
	return {
		"Start Date": "2024-06-15T10:00:00",
		"End Date": "2024-06-15T11:00:00",
		Title: "Team Meeting",
		...overrides,
	};
}

export function createAllDayFrontmatter(overrides: Record<string, unknown> = {}): Frontmatter {
	return {
		Date: "2024-06-15",
		"All Day": true,
		Title: "Holiday",
		...overrides,
	};
}

// ─── Mock Parser ─────────────────────────────────────────────

export function createMockParser() {
	return {
		parseEventSource: vi.fn().mockImplementation((source: any) => {
			if (source.isUntracked) return null;
			return {
				id: `id-${source.filePath}`,
				ref: { filePath: source.filePath },
				title: source.frontmatter.Title || "Untitled",
				start: source.frontmatter["Start Date"] || source.frontmatter.Date || "2024-01-01T00:00:00",
				end: source.frontmatter["End Date"] || source.frontmatter["Start Date"] || "2024-01-01T01:00:00",
				type: source.isAllDay ? "allDay" : "timed",
				allDay: source.isAllDay,
				skipped: false,
				color: "",
				meta: source.frontmatter,
				metadata: source.metadata,
				virtualKind: "none" as const,
			};
		}),
	};
}

export function createMockRecurringEventManager() {
	return {
		generateAllVirtualInstances: vi.fn().mockReturnValue([]),
	};
}
