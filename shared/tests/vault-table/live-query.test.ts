import { afterEach, describe, expect, it } from "vitest";

import type { LiveQuery } from "../../src/core/vault-table/live-query";
import type { VaultRow } from "../../src/core/vault-table/types";
import { VaultTableView } from "../../src/core/vault-table/vault-table-view";
import { createMockTable, makeRow } from "./helpers";

interface ItemData {
	name: string;
	priority: number;
	status: string;
}

const taskA = makeRow<ItemData>("task-a", { name: "Task A", priority: 3, status: "active" }, "items");
const taskB = makeRow<ItemData>("task-b", { name: "Task B", priority: 1, status: "active" }, "items");
const taskC = makeRow<ItemData>("task-c", { name: "Task C", priority: 2, status: "done" }, "items");
const taskD = makeRow<ItemData>("task-d", { name: "Task D", priority: 4, status: "active" }, "items");

describe("LiveQuery", () => {
	let view: VaultTableView<ItemData>;
	let liveQuery: LiveQuery<ItemData>;

	afterEach(() => {
		liveQuery?.destroy();
		view?.destroy();
	});

	describe("initial results", () => {
		it("should return all rows when no filters configured", () => {
			const { table } = createMockTable([taskA, taskB, taskC]);
			view = new VaultTableView(table, { filter: () => true });

			liveQuery = view.createLiveQuery().build();

			expect(liveQuery.value()).toHaveLength(3);
		});

		it("should apply predicate filter on initial results", () => {
			const { table } = createMockTable([taskA, taskB, taskC]);
			view = new VaultTableView(table, { filter: () => true });

			liveQuery = view
				.createLiveQuery()
				.filter((r) => r.data.status === "active")
				.build();

			expect(liveQuery.value()).toHaveLength(2);
			expect(liveQuery.value().every((r) => r.data.status === "active")).toBe(true);
		});

		it("should return empty array when nothing matches", () => {
			const { table } = createMockTable([taskA, taskB]);
			view = new VaultTableView(table, { filter: () => true });

			liveQuery = view
				.createLiveQuery()
				.filter((r) => r.data.status === "archived")
				.build();

			expect(liveQuery.value()).toHaveLength(0);
		});

		it("should emit initial results via results$ on subscribe", () => {
			const { table } = createMockTable([taskA]);
			view = new VaultTableView(table, { filter: () => true });

			liveQuery = view.createLiveQuery().build();

			const emissions: ReadonlyArray<VaultRow<ItemData>>[] = [];
			liveQuery.results$.subscribe((r) => emissions.push(r));

			expect(emissions).toHaveLength(1);
			expect(emissions[0]).toHaveLength(1);
		});
	});

	describe("reactive updates", () => {
		it("should include new rows that match the filter", () => {
			const { table, eventsSubject } = createMockTable([taskA, taskB]);
			view = new VaultTableView(table, { filter: () => true });

			liveQuery = view
				.createLiveQuery()
				.filter((r) => r.data.status === "active")
				.build();

			expect(liveQuery.value()).toHaveLength(2);

			eventsSubject.next({ type: "row-created", id: "task-d", filePath: taskD.filePath, row: taskD });

			expect(liveQuery.value()).toHaveLength(3);
		});

		it("should exclude deleted rows", () => {
			const { table, eventsSubject } = createMockTable([taskA, taskB]);
			view = new VaultTableView(table, { filter: () => true });

			liveQuery = view.createLiveQuery().build();

			expect(liveQuery.value()).toHaveLength(2);

			eventsSubject.next({ type: "row-deleted", id: "task-a", filePath: taskA.filePath, oldRow: taskA });

			expect(liveQuery.value()).toHaveLength(1);
			expect(liveQuery.value()[0].id).toBe("task-b");
		});

		it("should react to rows entering the filter after update", () => {
			const { table, eventsSubject } = createMockTable([taskA, taskC]);
			view = new VaultTableView(table, { filter: () => true });

			liveQuery = view
				.createLiveQuery()
				.filter((r) => r.data.status === "active")
				.build();

			expect(liveQuery.value()).toHaveLength(1);

			const updatedC = makeRow<ItemData>("task-c", { name: "Task C", priority: 2, status: "active" }, "items");
			eventsSubject.next({
				type: "row-updated",
				id: "task-c",
				filePath: taskC.filePath,
				oldRow: taskC,
				newRow: updatedC,
				contentChanged: false,
			});

			expect(liveQuery.value()).toHaveLength(2);
		});

		it("should react to rows leaving the filter after update", () => {
			const { table, eventsSubject } = createMockTable([taskA, taskB]);
			view = new VaultTableView(table, { filter: () => true });

			liveQuery = view
				.createLiveQuery()
				.filter((r) => r.data.status === "active")
				.build();

			expect(liveQuery.value()).toHaveLength(2);

			const doneA = makeRow<ItemData>("task-a", { name: "Task A", priority: 3, status: "done" }, "items");
			eventsSubject.next({
				type: "row-updated",
				id: "task-a",
				filePath: taskA.filePath,
				oldRow: taskA,
				newRow: doneA,
				contentChanged: false,
			});

			expect(liveQuery.value()).toHaveLength(1);
			expect(liveQuery.value()[0].id).toBe("task-b");
		});

		it("should emit each re-evaluation via results$", () => {
			const { table, eventsSubject } = createMockTable([taskA]);
			view = new VaultTableView(table, { filter: () => true });

			liveQuery = view.createLiveQuery().build();

			const emissions: ReadonlyArray<VaultRow<ItemData>>[] = [];
			liveQuery.results$.subscribe((r) => emissions.push(r));

			eventsSubject.next({ type: "row-created", id: "task-b", filePath: taskB.filePath, row: taskB });
			eventsSubject.next({ type: "row-created", id: "task-c", filePath: taskC.filePath, row: taskC });

			expect(emissions).toHaveLength(3);
			expect(emissions[0]).toHaveLength(1);
			expect(emissions[1]).toHaveLength(2);
			expect(emissions[2]).toHaveLength(3);
		});
	});

	describe("parsed filters", () => {
		it("should apply field-level parsed filters", () => {
			const { table } = createMockTable([taskA, taskB, taskC, taskD]);
			view = new VaultTableView(table, { filter: () => true });

			liveQuery = view.createLiveQuery().addFilter({ field: "priority", operator: "gt", value: 2 }).build();

			const results = liveQuery.value();
			expect(results).toHaveLength(2);
			expect(results.every((r) => r.data.priority > 2)).toBe(true);
		});

		it("should combine predicate and parsed filters", () => {
			const { table } = createMockTable([taskA, taskB, taskC, taskD]);
			view = new VaultTableView(table, { filter: () => true });

			liveQuery = view
				.createLiveQuery()
				.filter((r) => r.data.status === "active")
				.addFilter({ field: "priority", operator: "gt", value: 2 })
				.build();

			const results = liveQuery.value();
			expect(results).toHaveLength(2);
			expect(results.every((r) => r.data.status === "active" && r.data.priority > 2)).toBe(true);
		});
	});

	describe("pagination", () => {
		it("should respect limit", () => {
			const { table } = createMockTable([taskA, taskB, taskC, taskD]);
			view = new VaultTableView(table, { filter: () => true });

			liveQuery = view.createLiveQuery().limit(2).build();

			expect(liveQuery.value()).toHaveLength(2);
		});

		it("should respect offset", () => {
			const { table } = createMockTable([taskA, taskB, taskC]);
			view = new VaultTableView(table, { filter: () => true });

			liveQuery = view.createLiveQuery().offset(1).limit(1).build();

			expect(liveQuery.value()).toHaveLength(1);
		});

		it("should clamp to available rows when offset + limit exceeds total", () => {
			const { table } = createMockTable([taskA, taskB]);
			view = new VaultTableView(table, { filter: () => true });

			liveQuery = view.createLiveQuery().offset(1).limit(10).build();

			expect(liveQuery.value()).toHaveLength(1);
		});

		it("should update paginated results reactively", () => {
			const { table, eventsSubject } = createMockTable([taskA, taskB]);
			view = new VaultTableView(table, { filter: () => true });

			liveQuery = view.createLiveQuery().limit(2).build();

			expect(liveQuery.value()).toHaveLength(2);

			eventsSubject.next({ type: "row-created", id: "task-c", filePath: taskC.filePath, row: taskC });

			// Still limited to 2
			expect(liveQuery.value()).toHaveLength(2);
		});
	});

	describe("lifecycle", () => {
		it("should complete results$ on destroy", () => {
			const { table } = createMockTable([taskA]);
			view = new VaultTableView(table, { filter: () => true });

			liveQuery = view.createLiveQuery().build();

			let completed = false;
			liveQuery.results$.subscribe({ complete: () => (completed = true) });

			liveQuery.destroy();
			expect(completed).toBe(true);
		});

		it("should stop reacting to events after destroy", () => {
			const { table, eventsSubject } = createMockTable([taskA]);
			view = new VaultTableView(table, { filter: () => true });

			liveQuery = view.createLiveQuery().build();

			const emissions: ReadonlyArray<VaultRow<ItemData>>[] = [];
			liveQuery.results$.subscribe((r) => emissions.push(r));

			expect(emissions).toHaveLength(1);

			liveQuery.destroy();

			eventsSubject.next({ type: "row-created", id: "task-b", filePath: taskB.filePath, row: taskB });

			// No new emission after destroy
			expect(emissions).toHaveLength(1);
		});

		it("should preserve last value after destroy", () => {
			const { table } = createMockTable([taskA, taskB]);
			view = new VaultTableView(table, { filter: () => true });

			liveQuery = view.createLiveQuery().build();
			const lastValue = liveQuery.value();

			liveQuery.destroy();

			expect(liveQuery.value()).toBe(lastValue);
		});
	});
});
