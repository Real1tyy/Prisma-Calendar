// Integration guard for the "renaming a stopwatch-tracked minimized event drops
// it as if deleted" bug, wiring the two real Prisma components that sit on either
// side of the bug together: a real MinimizedModalManager subscribed to a real
// EventFileRepository's events$.
//
// The repo forwards a rename's two halves (file-deleted{isRename} for the old
// path, file-changed{oldPath} for the new path) onto events$; the modal must
// rebind the running session to the new path instead of clearing it. Driving the
// underlying VaultTable through the mock's emitEvent reproduces exactly the
// row-deleted/row-created pair the real indexer emits for a rename — the shared
// VaultTable + Indexer suites prove that pair carries the metadata; this proves
// the Prisma consumer reacts to it correctly end to end.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDefaultState } from "../../src/components/modals/event/event-form-state";
import type { CalendarBundle } from "../../src/core/calendar-bundle";
import { MinimizedModalManager, type MinimizedModalState } from "../../src/core/minimized-modal-manager";
import type { StopwatchSnapshot } from "../../src/react/views/stopwatch";
import type { Frontmatter, SingleCalendarConfig } from "../../src/types";
import {
	createRepoSettingsStore,
	createTimedFrontmatter,
	TestableEventFileRepository,
} from "../fixtures/event-file-repository-fixtures";
import { createMockApp } from "../setup";

const OLD_PATH = "Events/old-meeting.md";
const NEW_PATH = "Events/new-meeting.md";

describe("rename tracking (EventFileRepository → MinimizedModalManager integration)", () => {
	let repo: TestableEventFileRepository;
	let settings: SingleCalendarConfig;
	let bundle: CalendarBundle;

	const runningSnapshot = (state: StopwatchSnapshot["state"] = "running"): StopwatchSnapshot => ({
		state,
		startTime: Date.now(),
		breakStartTime: state === "paused" ? Date.now() : null,
		sessionStartTime: Date.now(),
		totalBreakMs: 0,
	});

	const saveSession = (state: StopwatchSnapshot["state"], fm: Frontmatter): void => {
		const modalState: MinimizedModalState = {
			formState: createDefaultState(),
			stopwatch: runningSnapshot(state),
			modalType: "edit",
			filePath: OLD_PATH,
			originalFrontmatter: fm,
			calendarId: "test-calendar",
			title: "Original Title",
		};
		MinimizedModalManager.saveState(modalState, bundle);
	};

	// Replays the row events a rename produces: the old-path row removed as a
	// rename (isRename), the new-path row created carrying oldPath.
	const emitRename = (renamedFrontmatter: Frontmatter): void => {
		const oldRow = repo.mockTable.seed("old-meeting", createTimedFrontmatter());
		const newRow = repo.mockTable.seed("new-meeting", renamedFrontmatter);
		repo.mockTable.emitEvent({
			type: "row-deleted",
			id: "old-meeting",
			filePath: oldRow.filePath,
			oldRow,
			isRename: true,
		});
		repo.mockTable.emitEvent({
			type: "row-created",
			id: "new-meeting",
			filePath: newRow.filePath,
			row: newRow,
			oldPath: oldRow.filePath,
		});
	};

	beforeEach(async () => {
		MinimizedModalManager.clear();
		const settingsStore = createRepoSettingsStore();
		settings = settingsStore.value;
		repo = new TestableEventFileRepository(createMockApp(), settingsStore);
		await repo.start();

		bundle = {
			calendarId: "test-calendar",
			plugin: { app: {}, calendarBundles: [] },
			fileRepository: repo,
			settingsStore: { currentSettings: settings },
		} as unknown as CalendarBundle;
	});

	afterEach(() => {
		MinimizedModalManager.clear();
		repo.destroy();
	});

	it.each([{ state: "running" as const }, { state: "paused" as const }])(
		"keeps a $state session and rebinds it to the new path across a rename",
		async ({ state }) => {
			saveSession(state, createTimedFrontmatter({ Title: "Original Title" }));

			emitRename(createTimedFrontmatter({ Title: "Renamed Title" }));

			await new Promise((resolve) => window.setTimeout(resolve, 0));

			const result = MinimizedModalManager.getState();
			expect(result).not.toBeNull();
			expect(result!.filePath).toBe(NEW_PATH);
			expect(result!.title).toBe("Renamed Title");
		}
	);

	it("still clears the session when the tracked file is genuinely deleted", async () => {
		saveSession("running", createTimedFrontmatter());

		const oldRow = repo.mockTable.seed("old-meeting", createTimedFrontmatter());
		repo.mockTable.emitEvent({ type: "row-deleted", id: "old-meeting", filePath: oldRow.filePath, oldRow });

		await new Promise((resolve) => window.setTimeout(resolve, 0));

		expect(MinimizedModalManager.hasMinimizedModal()).toBe(false);
	});
});
