/**
 * Approval snapshots for the VaultTable reactive event stream.
 *
 * The events$ observable is the ONLY way consumers (trackers, indexers, views)
 * learn about CRUD in a VaultTable. Its exact shape — event type, key,
 * filePath, old/new row ordering, contentChanged flag, diff presence — is a
 * load-bearing public contract. These tests drive a MockVaultTable through
 * representative CRUD sequences and pin the emitted event log as JSON.
 *
 * If a future refactor changes event ordering, renames a field, or silently
 * drops an event, the diff surfaces in the snapshot file.
 *
 * The mock faithfully mirrors the real VaultTable event shapes (same
 * discriminants, same field names) — tests here pin the contract the rest of
 * the codebase subscribes to.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { VaultTableEvent } from "../../src/core/vault-table/types";
import { MockVaultTable } from "../../src/testing/mocks/vault-table";

// Vitest's toMatchFileSnapshot() interacts poorly with shared's
// environmentMatchGlobs config, so we roll our own golden-file comparison.
// Re-run with UPDATE_GOLDENS=1 to refresh the approved files on intentional
// output changes.
const FIXTURES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "__snapshots__");
const UPDATE = process.env["UPDATE_GOLDENS"] === "1";

function expectGolden(actual: string, name: string): void {
	const path = resolve(FIXTURES_DIR, name);
	if (UPDATE || !existsSync(path)) {
		mkdirSync(FIXTURES_DIR, { recursive: true });
		writeFileSync(path, actual, "utf8");
		return;
	}
	const expected = readFileSync(path, "utf8");
	expect(actual).toBe(expected);
}

interface Row {
	Title: string;
	Status?: string;
	Count?: number;
}

function collectEvents(table: MockVaultTable<Row>): {
	events: Array<Record<string, unknown>>;
	push: (evt: VaultTableEvent<Row>) => void;
} {
	const events: Array<Record<string, unknown>> = [];
	const push = (evt: VaultTableEvent<Row>) => {
		events.push(stabilize(evt));
	};
	table.events$.subscribe(push);
	return { events, push };
}

/** Strips the TFile object and mtime, which aren't part of the public event contract. */
function stabilize(event: VaultTableEvent<Row>): Record<string, unknown> {
	const serializeRow = (row: Record<string, unknown>) => ({
		id: row["id"],
		filePath: row["filePath"],
		data: row["data"],
		content: row["content"],
	});

	if (event.type === "row-created") {
		return { type: event.type, id: event.id, filePath: event.filePath, row: serializeRow(event.row as any) };
	}
	if (event.type === "row-updated") {
		const payload: Record<string, unknown> = {
			type: event.type,
			id: event.id,
			filePath: event.filePath,
			oldRow: serializeRow(event.oldRow as any),
			newRow: serializeRow(event.newRow as any),
			contentChanged: event.contentChanged,
		};
		if (event.diff) payload["diff"] = event.diff;
		return payload;
	}
	return { type: event.type, id: event.id, filePath: event.filePath, oldRow: serializeRow(event.oldRow as any) };
}

function asSnapshotJson(events: Array<Record<string, unknown>>): string {
	return JSON.stringify(events, null, 2) + "\n";
}

describe("VaultTable event stream — approval snapshots", () => {
	it("emits row-created on create with the full row embedded", async () => {
		const table = new MockVaultTable<Row>("Notes");
		const { events } = collectEvents(table);

		await table.create({ fileName: "alpha", data: { Title: "Alpha" } });

		expectGolden(asSnapshotJson(events), "vt-create.approved.json");
	});

	it("emits row-updated with oldRow + newRow for data mutations", async () => {
		const table = new MockVaultTable<Row>("Notes");
		const { events } = collectEvents(table);

		await table.create({ fileName: "bravo", data: { Title: "Bravo", Status: "open" } });
		await table.update("bravo", { Status: "done" });

		expectGolden(asSnapshotJson(events), "vt-update.approved.json");
	});

	it("distinguishes data-only updates from content-changing updates via contentChanged flag", async () => {
		const table = new MockVaultTable<Row>("Notes");
		const { events } = collectEvents(table);

		await table.create({ fileName: "charlie", data: { Title: "Charlie" }, content: "original body" });
		await table.update("charlie", { Title: "Charlie Renamed" });
		await table.updateContent("charlie", "new body");

		expectGolden(asSnapshotJson(events), "vt-data-vs-content.approved.json");
	});

	it("emits row-deleted with the final oldRow state after a full create-update-delete lifecycle", async () => {
		const table = new MockVaultTable<Row>("Notes");
		const { events } = collectEvents(table);

		await table.create({ fileName: "delta", data: { Title: "Delta", Count: 1 } });
		await table.update("delta", { Count: 2 });
		await table.delete("delta");

		expectGolden(asSnapshotJson(events), "vt-lifecycle.approved.json");
	});

	it("replace() emits row-updated with the fully-swapped data, not a merge", async () => {
		const table = new MockVaultTable<Row>("Notes");
		const { events } = collectEvents(table);

		await table.create({ fileName: "echo", data: { Title: "Echo", Status: "open", Count: 1 } });
		await table.replace("echo", { Title: "Echo Replaced" });

		expectGolden(asSnapshotJson(events), "vt-replace.approved.json");
	});

	it("upsert() fans out to either create or update depending on prior state", async () => {
		const table = new MockVaultTable<Row>("Notes");
		const { events } = collectEvents(table);

		await table.upsert({ fileName: "foxtrot", data: { Title: "Foxtrot" } });
		await table.upsert({ fileName: "foxtrot", data: { Title: "Foxtrot v2" } });
		await table.upsert({ fileName: "golf", data: { Title: "Golf" } });

		expectGolden(asSnapshotJson(events), "vt-upsert.approved.json");
	});

	it("emitUpdateWithDiff() surfaces the diff payload on row-updated for external edits", async () => {
		const table = new MockVaultTable<Row>("Notes");
		table.seed("hotel", { Title: "Hotel", Status: "open" });
		const { events } = collectEvents(table);

		table.emitUpdateWithDiff("hotel", { Status: "done" }, {
			added: {},
			removed: {},
			changed: { Status: { from: "open", to: "done" } },
		} as any);

		expectGolden(asSnapshotJson(events), "vt-external-diff.approved.json");
	});

	// ─── Complex integration flows ──────────────────────────────
	// The scenarios above cover individual CRUD shapes in isolation. Real consumers
	// (trackers, indexers, reactive projections) subscribe for the entire session
	// and see INTERLEAVED streams from multiple rows with churn patterns. The
	// snapshots below pin end-to-end flows so reactive regressions — dropped
	// events, wrong ordering, leaked rows between resurrections — surface here.

	it("interleaved create/update across many rows preserves insertion order", async () => {
		const table = new MockVaultTable<Row>("Notes");
		const { events } = collectEvents(table);

		await table.create({ fileName: "task-1", data: { Title: "Task 1", Status: "todo" } });
		await table.create({ fileName: "task-2", data: { Title: "Task 2", Status: "todo" } });
		await table.update("task-1", { Status: "doing" });
		await table.create({ fileName: "task-3", data: { Title: "Task 3", Status: "todo" } });
		await table.update("task-2", { Status: "done" });
		await table.update("task-1", { Status: "done" });

		expectGolden(asSnapshotJson(events), "vt-interleaved.approved.json");
	});

	it("resurrect after delete yields a fresh create — no ghost state leaks in", async () => {
		const table = new MockVaultTable<Row>("Notes");
		const { events } = collectEvents(table);

		await table.create({ fileName: "india", data: { Title: "India", Status: "open", Count: 99 } });
		await table.update("india", { Count: 100 });
		await table.delete("india");
		// New row with same key — must not inherit previous data in the event payload.
		await table.create({ fileName: "india", data: { Title: "India Reborn" } });
		await table.update("india", { Status: "open" });

		expectGolden(asSnapshotJson(events), "vt-resurrect.approved.json");
	});

	it("bulk churn on a single row emits every update in sequence", async () => {
		const table = new MockVaultTable<Row>("Notes");
		const { events } = collectEvents(table);

		await table.create({ fileName: "juliet", data: { Title: "Juliet", Count: 0 } });
		for (let i = 1; i <= 5; i++) {
			await table.update("juliet", { Count: i });
		}

		expectGolden(asSnapshotJson(events), "vt-bulk-churn.approved.json");
	});

	it("mixed data-update and content-update operations stay disambiguated in-stream", async () => {
		const table = new MockVaultTable<Row>("Notes");
		const { events } = collectEvents(table);

		await table.create({ fileName: "kilo", data: { Title: "Kilo" }, content: "v1" });
		await table.update("kilo", { Title: "Kilo v2" });
		await table.updateContent("kilo", "v2");
		await table.update("kilo", { Status: "done" });
		await table.updateContent("kilo", "v3");

		expectGolden(asSnapshotJson(events), "vt-data-content-interleave.approved.json");
	});

	it("upsert chains on the same key produce create → update → update", async () => {
		const table = new MockVaultTable<Row>("Notes");
		const { events } = collectEvents(table);

		await table.upsert({ fileName: "lima", data: { Title: "Lima", Count: 1 } });
		await table.upsert({ fileName: "lima", data: { Title: "Lima v2", Count: 2 } });
		await table.upsert({ fileName: "lima", data: { Count: 3 } });

		expectGolden(asSnapshotJson(events), "vt-upsert-chain.approved.json");
	});

	it("external edits interleaved with local writes preserve the action order", async () => {
		const table = new MockVaultTable<Row>("Notes");
		table.seed("mike", { Title: "Mike", Status: "open" });
		const { events } = collectEvents(table);

		// Local edit first.
		await table.update("mike", { Status: "doing" });
		// Indexer picks up an external file change with a diff.
		table.emitUpdateWithDiff("mike", { Status: "paused" }, {
			added: {},
			removed: {},
			changed: { Status: { from: "doing", to: "paused" } },
		} as any);
		// Local edit again.
		await table.update("mike", { Status: "done" });

		expectGolden(asSnapshotJson(events), "vt-external-and-local.approved.json");
	});

	it("late subscribers only receive events emitted AFTER they subscribe", async () => {
		const table = new MockVaultTable<Row>("Notes");

		await table.create({ fileName: "november", data: { Title: "November" } });
		await table.update("november", { Status: "open" });
		// Subscribe after the initial churn.
		const { events } = collectEvents(table);
		await table.update("november", { Status: "done" });
		await table.delete("november");

		expectGolden(asSnapshotJson(events), "vt-late-subscriber.approved.json");
	});

	it("multiple independent subscribers see identical event streams", async () => {
		const table = new MockVaultTable<Row>("Notes");
		const { events: a } = collectEvents(table);
		const { events: b } = collectEvents(table);

		await table.create({ fileName: "oscar", data: { Title: "Oscar" } });
		await table.update("oscar", { Status: "open" });
		await table.delete("oscar");

		expect(a).toEqual(b);
		expectGolden(asSnapshotJson(a), "vt-multi-subscriber.approved.json");
	});

	it("full lifecycle across many rows — creates, updates, deletions, all interleaved", async () => {
		const table = new MockVaultTable<Row>("Notes");
		const { events } = collectEvents(table);

		// Seed three concurrent "tasks" then churn them at different rates.
		await table.create({ fileName: "p-1", data: { Title: "P1", Status: "open" } });
		await table.create({ fileName: "p-2", data: { Title: "P2", Status: "open" } });
		await table.create({ fileName: "p-3", data: { Title: "P3", Status: "open" } });

		await table.update("p-1", { Status: "doing" });
		await table.update("p-2", { Status: "blocked" });
		await table.updateContent("p-1", "detailed notes");
		await table.update("p-3", { Status: "doing" });

		await table.delete("p-2");
		await table.update("p-1", { Status: "done" });
		await table.create({ fileName: "p-4", data: { Title: "P4" } });
		await table.delete("p-3");
		await table.update("p-1", { Title: "P1 (archived)" });

		expectGolden(asSnapshotJson(events), "vt-full-lifecycle.approved.json");
	});
});
