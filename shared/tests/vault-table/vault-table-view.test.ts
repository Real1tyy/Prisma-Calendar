import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { VaultRow, VaultTableEvent } from "../../src/core/vault-table/types";
import { VaultTableView } from "../../src/core/vault-table/vault-table-view";
import { createMockTable, makeRow } from "./helpers";

interface FruitData {
	name: string;
	color: string;
	ripe: boolean;
}

const apple = makeRow<FruitData>("apple", { name: "Apple", color: "red", ripe: true }, "fruits");
const banana = makeRow<FruitData>("banana", { name: "Banana", color: "yellow", ripe: true }, "fruits");
const greenApple = makeRow<FruitData>("green-apple", { name: "Green Apple", color: "green", ripe: false }, "fruits");
const cherry = makeRow<FruitData>("cherry", { name: "Cherry", color: "red", ripe: true }, "fruits");

const isRed = (row: VaultRow<FruitData>) => row.data.color === "red";
const isRipe = (row: VaultRow<FruitData>) => row.data.ripe;

describe("VaultTableView", () => {
	let eventsSubject: Subject<VaultTableEvent<FruitData>>;
	let view: VaultTableView<FruitData>;

	afterEach(() => {
		view?.destroy();
	});

	describe("initial population", () => {
		it("should populate with matching rows from parent table", () => {
			const { table, eventsSubject: es } = createMockTable([apple, banana, greenApple, cherry]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			expect(view.count()).toBe(2);
			expect(view.has("apple")).toBe(true);
			expect(view.has("cherry")).toBe(true);
			expect(view.has("banana")).toBe(false);
			expect(view.has("green-apple")).toBe(false);
		});

		it("should be empty when no rows match filter", () => {
			const { table, eventsSubject: es } = createMockTable([banana, greenApple]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			expect(view.count()).toBe(0);
			expect(view.toArray()).toEqual([]);
		});

		it("should include all rows when filter matches everything", () => {
			const { table, eventsSubject: es } = createMockTable([apple, banana]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: () => true });

			expect(view.count()).toBe(2);
		});

		it("should work with empty parent table", () => {
			const { table, eventsSubject: es } = createMockTable([]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			expect(view.count()).toBe(0);
		});
	});

	describe("row-created events", () => {
		beforeEach(() => {
			const { table, eventsSubject: es } = createMockTable([apple]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });
		});

		it("should add row when it matches filter", () => {
			eventsSubject.next({ type: "row-created", id: "cherry", filePath: cherry.filePath, row: cherry });

			expect(view.count()).toBe(2);
			expect(view.has("cherry")).toBe(true);
		});

		it("should ignore row when it does not match filter", () => {
			eventsSubject.next({ type: "row-created", id: "banana", filePath: banana.filePath, row: banana });

			expect(view.count()).toBe(1);
			expect(view.has("banana")).toBe(false);
		});

		it("should emit event for matching row", () => {
			const events: VaultTableEvent<FruitData>[] = [];
			view.events$.subscribe((e) => events.push(e));

			eventsSubject.next({ type: "row-created", id: "cherry", filePath: cherry.filePath, row: cherry });

			expect(events).toHaveLength(1);
			expect(events[0]).toEqual({ type: "row-created", id: "cherry", filePath: cherry.filePath, row: cherry });
		});

		it("should not emit event for non-matching row", () => {
			const events: VaultTableEvent<FruitData>[] = [];
			view.events$.subscribe((e) => events.push(e));

			eventsSubject.next({ type: "row-created", id: "banana", filePath: banana.filePath, row: banana });

			expect(events).toHaveLength(0);
		});
	});

	describe("row-updated events", () => {
		it("should update row that stays in view", () => {
			const { table, eventsSubject: es } = createMockTable([apple]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			const updatedApple = makeRow<FruitData>("apple", { name: "Apple Updated", color: "red", ripe: false });
			eventsSubject.next({
				type: "row-updated",
				id: "apple",
				filePath: apple.filePath,
				oldRow: apple,
				newRow: updatedApple,
				diff: { changes: [], added: [], removed: [] },
				contentChanged: false,
			});

			expect(view.count()).toBe(1);
			expect(view.get("apple")?.data.name).toBe("Apple Updated");
		});

		it("should emit row-updated when row stays in view", () => {
			const { table, eventsSubject: es } = createMockTable([apple]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			const events: VaultTableEvent<FruitData>[] = [];
			view.events$.subscribe((e) => events.push(e));

			const updatedApple = makeRow<FruitData>("apple", { name: "Apple Updated", color: "red", ripe: false });
			eventsSubject.next({
				type: "row-updated",
				id: "apple",
				filePath: apple.filePath,
				oldRow: apple,
				newRow: updatedApple,
				diff: { changes: [], added: [], removed: [] },
				contentChanged: false,
			});

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("row-updated");
		});

		it("should add row that enters the view (not in view → matches filter)", () => {
			const { table, eventsSubject: es } = createMockTable([apple, banana]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			expect(view.has("banana")).toBe(false);

			const redBanana = makeRow<FruitData>("banana", { name: "Banana", color: "red", ripe: true });
			eventsSubject.next({
				type: "row-updated",
				id: "banana",
				filePath: banana.filePath,
				oldRow: banana,
				newRow: redBanana,
				diff: { changes: [{ key: "color", oldValue: "yellow", newValue: "red" }], added: [], removed: [] },
				contentChanged: false,
			});

			expect(view.count()).toBe(2);
			expect(view.has("banana")).toBe(true);
			expect(view.get("banana")?.data.color).toBe("red");
		});

		it("should emit row-created when row enters the view", () => {
			const { table, eventsSubject: es } = createMockTable([apple, banana]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			const events: VaultTableEvent<FruitData>[] = [];
			view.events$.subscribe((e) => events.push(e));

			const redBanana = makeRow<FruitData>("banana", { name: "Banana", color: "red", ripe: true });
			eventsSubject.next({
				type: "row-updated",
				id: "banana",
				filePath: banana.filePath,
				oldRow: banana,
				newRow: redBanana,
				diff: { changes: [{ key: "color", oldValue: "yellow", newValue: "red" }], added: [], removed: [] },
				contentChanged: false,
			});

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("row-created");
		});

		it("should remove row that leaves the view (in view → no longer matches)", () => {
			const { table, eventsSubject: es } = createMockTable([apple]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			expect(view.has("apple")).toBe(true);

			const blueApple = makeRow<FruitData>("apple", { name: "Apple", color: "blue", ripe: true });
			eventsSubject.next({
				type: "row-updated",
				id: "apple",
				filePath: apple.filePath,
				oldRow: apple,
				newRow: blueApple,
				diff: { changes: [{ key: "color", oldValue: "red", newValue: "blue" }], added: [], removed: [] },
				contentChanged: false,
			});

			expect(view.count()).toBe(0);
			expect(view.has("apple")).toBe(false);
		});

		it("should emit row-deleted when row leaves the view", () => {
			const { table, eventsSubject: es } = createMockTable([apple]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			const events: VaultTableEvent<FruitData>[] = [];
			view.events$.subscribe((e) => events.push(e));

			const blueApple = makeRow<FruitData>("apple", { name: "Apple", color: "blue", ripe: true });
			eventsSubject.next({
				type: "row-updated",
				id: "apple",
				filePath: apple.filePath,
				oldRow: apple,
				newRow: blueApple,
				diff: { changes: [{ key: "color", oldValue: "red", newValue: "blue" }], added: [], removed: [] },
				contentChanged: false,
			});

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("row-deleted");
		});

		it("should ignore update for row not in view that still does not match", () => {
			const { table, eventsSubject: es } = createMockTable([banana]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			const events: VaultTableEvent<FruitData>[] = [];
			view.events$.subscribe((e) => events.push(e));

			const greenBanana = makeRow<FruitData>("banana", { name: "Banana", color: "green", ripe: false });
			eventsSubject.next({
				type: "row-updated",
				id: "banana",
				filePath: banana.filePath,
				oldRow: banana,
				newRow: greenBanana,
				diff: { changes: [{ key: "color", oldValue: "yellow", newValue: "green" }], added: [], removed: [] },
				contentChanged: false,
			});

			expect(view.count()).toBe(0);
			expect(events).toHaveLength(0);
		});
	});

	describe("row-deleted events", () => {
		it("should remove row that was in view", () => {
			const { table, eventsSubject: es } = createMockTable([apple, cherry]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			expect(view.count()).toBe(2);

			eventsSubject.next({ type: "row-deleted", id: "apple", filePath: apple.filePath, oldRow: apple });

			expect(view.count()).toBe(1);
			expect(view.has("apple")).toBe(false);
			expect(view.has("cherry")).toBe(true);
		});

		it("should emit event when deleting a row that was in view", () => {
			const { table, eventsSubject: es } = createMockTable([apple]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			const events: VaultTableEvent<FruitData>[] = [];
			view.events$.subscribe((e) => events.push(e));

			eventsSubject.next({ type: "row-deleted", id: "apple", filePath: apple.filePath, oldRow: apple });

			expect(events).toHaveLength(1);
			expect(events[0]).toEqual({ type: "row-deleted", id: "apple", filePath: apple.filePath, oldRow: apple });
		});

		it("should ignore delete for row not in view", () => {
			const { table, eventsSubject: es } = createMockTable([apple, banana]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			const events: VaultTableEvent<FruitData>[] = [];
			view.events$.subscribe((e) => events.push(e));

			eventsSubject.next({ type: "row-deleted", id: "banana", filePath: banana.filePath, oldRow: banana });

			expect(view.count()).toBe(1);
			expect(events).toHaveLength(0);
		});
	});

	describe("reads", () => {
		beforeEach(() => {
			const { table, eventsSubject: es } = createMockTable([apple, banana, cherry]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });
		});

		it("get should return matching row", () => {
			expect(view.get("apple")).toBe(apple);
		});

		it("get should return undefined for non-matching row", () => {
			expect(view.get("banana")).toBeUndefined();
		});

		it("has should return true for matching row", () => {
			expect(view.has("apple")).toBe(true);
		});

		it("has should return false for non-matching row", () => {
			expect(view.has("banana")).toBe(false);
		});

		it("count should return number of matching rows", () => {
			expect(view.count()).toBe(2);
		});

		it("first should return first row without predicate", () => {
			const row = view.first();
			expect(row).toBeDefined();
			expect(row!.data.color).toBe("red");
		});

		it("first should return first matching row with predicate", () => {
			const row = view.first((r) => r.data.name === "Cherry");
			expect(row).toBe(cherry);
		});

		it("first should return undefined when predicate matches nothing", () => {
			expect(view.first((r) => r.data.name === "Banana")).toBeUndefined();
		});
	});

	describe("collection access", () => {
		beforeEach(() => {
			const { table, eventsSubject: es } = createMockTable([apple, banana, cherry]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });
		});

		it("toArray should return readonly array of matching rows", () => {
			const arr = view.toArray();
			expect(arr).toHaveLength(2);
			expect(arr.every((r) => r.data.color === "red")).toBe(true);
		});

		it("toClonedArray should return a new array", () => {
			const arr1 = view.toClonedArray();
			const arr2 = view.toClonedArray();
			expect(arr1).not.toBe(arr2);
			expect(arr1).toEqual(arr2);
		});
	});

	describe("queries", () => {
		beforeEach(() => {
			const { table, eventsSubject: es } = createMockTable([apple, banana, greenApple, cherry]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRipe });
		});

		it("where should filter within view", () => {
			const reds = view.where((r) => r.data.color === "red");
			expect(reds).toHaveLength(2);
		});

		it("findBy should search by key within view", () => {
			const reds = view.findBy("color", "red");
			expect(reds).toHaveLength(2);
		});

		it("findBy should return empty when no match in view", () => {
			const greens = view.findBy("color", "green");
			expect(greens).toHaveLength(0);
		});

		it("orderBy should sort view rows", () => {
			const sorted = view.orderBy((a, b) => a.data.name.localeCompare(b.data.name));
			expect(sorted[0].data.name).toBe("Apple");
			expect(sorted[1].data.name).toBe("Banana");
			expect(sorted[2].data.name).toBe("Cherry");
		});

		it("groupBy should group view rows", () => {
			const groups = view.groupBy((r) => r.data.color);
			expect(groups.get("red")).toHaveLength(2);
			expect(groups.get("yellow")).toHaveLength(1);
			expect(groups.has("green")).toBe(false);
		});

		it("pluck should extract field values from view", () => {
			const colors = view.pluck("color");
			expect(colors).toContain("red");
			expect(colors).toContain("yellow");
			expect(colors).not.toContain("green");
		});

		it("some should return true when at least one matches", () => {
			expect(view.some((r) => r.data.color === "yellow")).toBe(true);
		});

		it("some should return false when none match", () => {
			expect(view.some((r) => r.data.color === "purple")).toBe(false);
		});

		it("every should return true when all match", () => {
			expect(view.every((r) => r.data.ripe)).toBe(true);
		});

		it("every should return false when not all match", () => {
			expect(view.every((r) => r.data.color === "red")).toBe(false);
		});
	});

	describe("destroy", () => {
		it("should unsubscribe from parent events", () => {
			const { table, eventsSubject: es } = createMockTable([apple]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			view.destroy();

			eventsSubject.next({ type: "row-created", id: "cherry", filePath: cherry.filePath, row: cherry });

			expect(view.count()).toBe(0);
		});

		it("should clear all caches", () => {
			const { table, eventsSubject: es } = createMockTable([apple, cherry]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			expect(view.count()).toBe(2);
			view.destroy();

			expect(view.count()).toBe(0);
			expect(view.get("apple")).toBeUndefined();
			expect(view.toArray()).toEqual([]);
		});

		it("should complete events$ subject", () => {
			const { table, eventsSubject: es } = createMockTable([apple]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			let completed = false;
			view.events$.subscribe({ complete: () => (completed = true) });

			view.destroy();
			expect(completed).toBe(true);
		});
	});

	describe("complex scenarios", () => {
		it("should handle rapid enter/leave/enter transitions", () => {
			const { table, eventsSubject: es } = createMockTable([apple]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			const events: VaultTableEvent<FruitData>[] = [];
			view.events$.subscribe((e) => events.push(e));

			const blueApple = makeRow<FruitData>("apple", { name: "Apple", color: "blue", ripe: true });
			eventsSubject.next({
				type: "row-updated",
				id: "apple",
				filePath: apple.filePath,
				oldRow: apple,
				newRow: blueApple,
				diff: { changes: [{ key: "color", oldValue: "red", newValue: "blue" }], added: [], removed: [] },
				contentChanged: false,
			});
			expect(view.count()).toBe(0);

			const redAppleAgain = makeRow<FruitData>("apple", { name: "Apple", color: "red", ripe: true });
			eventsSubject.next({
				type: "row-updated",
				id: "apple",
				filePath: apple.filePath,
				oldRow: blueApple,
				newRow: redAppleAgain,
				diff: { changes: [{ key: "color", oldValue: "blue", newValue: "red" }], added: [], removed: [] },
				contentChanged: false,
			});
			expect(view.count()).toBe(1);

			expect(events).toHaveLength(2);
			expect(events[0].type).toBe("row-deleted");
			expect(events[1].type).toBe("row-created");
		});

		it("should handle multiple views on the same table with different filters", () => {
			const { table, eventsSubject: es } = createMockTable([apple, banana, greenApple, cherry]);
			eventsSubject = es;

			const redView = new VaultTableView(table, { filter: isRed });
			const ripeView = new VaultTableView(table, { filter: isRipe });

			expect(redView.count()).toBe(2);
			expect(ripeView.count()).toBe(3);

			eventsSubject.next({ type: "row-deleted", id: "apple", filePath: apple.filePath, oldRow: apple });

			expect(redView.count()).toBe(1);
			expect(ripeView.count()).toBe(2);

			redView.destroy();
			ripeView.destroy();
		});

		it("should handle create followed by immediate delete", () => {
			const { table, eventsSubject: es } = createMockTable([]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			eventsSubject.next({ type: "row-created", id: "apple", filePath: apple.filePath, row: apple });
			expect(view.count()).toBe(1);

			eventsSubject.next({ type: "row-deleted", id: "apple", filePath: apple.filePath, oldRow: apple });
			expect(view.count()).toBe(0);
		});
	});

	describe("lazy array rebuild", () => {
		it("should return correct toArray after multiple creates without intermediate reads", () => {
			const { table, eventsSubject: es } = createMockTable([]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: () => true });

			eventsSubject.next({ type: "row-created", id: "apple", filePath: apple.filePath, row: apple });
			eventsSubject.next({ type: "row-created", id: "banana", filePath: banana.filePath, row: banana });
			eventsSubject.next({ type: "row-created", id: "cherry", filePath: cherry.filePath, row: cherry });

			const arr = view.toArray();
			expect(arr).toHaveLength(3);
			expect(new Set(arr.map((r) => r.id))).toEqual(new Set(["apple", "banana", "cherry"]));
		});

		it("should return correct toArray after interleaved creates and deletes without reads", () => {
			const { table, eventsSubject: es } = createMockTable([apple, banana]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: () => true });

			eventsSubject.next({ type: "row-created", id: "cherry", filePath: cherry.filePath, row: cherry });
			eventsSubject.next({ type: "row-deleted", id: "apple", filePath: apple.filePath, oldRow: apple });
			eventsSubject.next({
				type: "row-created",
				id: "green-apple",
				filePath: greenApple.filePath,
				row: greenApple,
			});
			eventsSubject.next({ type: "row-deleted", id: "banana", filePath: banana.filePath, oldRow: banana });

			const arr = view.toArray();
			expect(arr).toHaveLength(2);
			expect(new Set(arr.map((r) => r.id))).toEqual(new Set(["cherry", "green-apple"]));
		});

		it("should return stable array reference when no mutations occur between reads", () => {
			const { table, eventsSubject: es } = createMockTable([apple, cherry]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			const first = view.toArray();
			const second = view.toArray();
			expect(first).toBe(second);
		});

		it("should return new array reference after mutation", () => {
			const { table, eventsSubject: es } = createMockTable([apple]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			const before = view.toArray();
			eventsSubject.next({ type: "row-created", id: "cherry", filePath: cherry.filePath, row: cherry });
			const after = view.toArray();

			expect(before).not.toBe(after);
			expect(before).toHaveLength(1);
			expect(after).toHaveLength(2);
		});

		it("should keep get/has consistent with toArray after batch mutations", () => {
			const { table, eventsSubject: es } = createMockTable([]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: () => true });

			eventsSubject.next({ type: "row-created", id: "apple", filePath: apple.filePath, row: apple });
			eventsSubject.next({ type: "row-created", id: "banana", filePath: banana.filePath, row: banana });

			expect(view.has("apple")).toBe(true);
			expect(view.has("banana")).toBe(true);
			expect(view.get("apple")).toBe(apple);
			expect(view.toArray()).toHaveLength(2);

			eventsSubject.next({ type: "row-deleted", id: "apple", filePath: apple.filePath, oldRow: apple });

			expect(view.has("apple")).toBe(false);
			expect(view.get("apple")).toBeUndefined();
			expect(view.toArray()).toHaveLength(1);
		});

		it("should handle update (remove+insert) as single logical operation", () => {
			const { table, eventsSubject: es } = createMockTable([apple]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			const updatedApple = makeRow<FruitData>("apple", { name: "Red Delicious", color: "red", ripe: true });
			eventsSubject.next({
				type: "row-updated",
				id: "apple",
				filePath: apple.filePath,
				oldRow: apple,
				newRow: updatedApple,
				contentChanged: false,
			});

			const arr = view.toArray();
			expect(arr).toHaveLength(1);
			expect(arr[0].data.name).toBe("Red Delicious");
		});
	});

	describe("updateFilter", () => {
		it("should widen the view when filter becomes more permissive", () => {
			const { table, eventsSubject: es } = createMockTable([apple, banana, greenApple, cherry]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			expect(view.count()).toBe(2);

			view.updateFilter(() => true);
			expect(view.count()).toBe(4);
		});

		it("should narrow the view when filter becomes more restrictive", () => {
			const { table, eventsSubject: es } = createMockTable([apple, banana, greenApple, cherry]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: () => true });

			expect(view.count()).toBe(4);

			view.updateFilter(isRed);
			expect(view.count()).toBe(2);
			expect(view.has("apple")).toBe(true);
			expect(view.has("cherry")).toBe(true);
			expect(view.has("banana")).toBe(false);
		});

		it("should emit row-created for rows entering the view", () => {
			const { table, eventsSubject: es } = createMockTable([apple, banana]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			const events: VaultTableEvent<FruitData>[] = [];
			view.events$.subscribe((e) => events.push(e));

			view.updateFilter(() => true);

			const created = events.filter((e) => e.type === "row-created");
			expect(created).toHaveLength(1);
			expect(created[0].type === "row-created" && created[0].row.id).toBe("banana");
		});

		it("should emit row-deleted for rows leaving the view", () => {
			const { table, eventsSubject: es } = createMockTable([apple, banana]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: () => true });

			const events: VaultTableEvent<FruitData>[] = [];
			view.events$.subscribe((e) => events.push(e));

			view.updateFilter(isRed);

			const deleted = events.filter((e) => e.type === "row-deleted");
			expect(deleted).toHaveLength(1);
			expect(deleted[0].type === "row-deleted" && deleted[0].oldRow.id).toBe("banana");
		});

		it("should not emit events for rows that stay in the view", () => {
			const { table, eventsSubject: es } = createMockTable([apple, cherry]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			const events: VaultTableEvent<FruitData>[] = [];
			view.events$.subscribe((e) => events.push(e));

			view.updateFilter(isRipe);

			expect(events).toHaveLength(0);
			expect(view.count()).toBe(2);
		});

		it("should use the new filter for subsequent events from the table", () => {
			const { table, eventsSubject: es } = createMockTable([apple]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			view.updateFilter(isRipe);

			eventsSubject.next({ type: "row-created", id: "banana", filePath: banana.filePath, row: banana });
			expect(view.has("banana")).toBe(true);

			eventsSubject.next({ type: "row-created", id: "green-apple", filePath: greenApple.filePath, row: greenApple });
			expect(view.has("green-apple")).toBe(false);
		});

		it("should handle switching to empty result set", () => {
			const { table, eventsSubject: es } = createMockTable([apple, banana, cherry]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: () => true });

			view.updateFilter(() => false);
			expect(view.count()).toBe(0);
			expect(view.toArray()).toEqual([]);
		});

		it("should handle switching from empty to populated result set", () => {
			const { table, eventsSubject: es } = createMockTable([apple, banana]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: () => false });

			expect(view.count()).toBe(0);

			view.updateFilter(() => true);
			expect(view.count()).toBe(2);
		});
	});

	describe("distinctBy", () => {
		it("should suppress row-updated event when distinctBy returns true", () => {
			const { table, eventsSubject: es } = createMockTable([apple]);
			eventsSubject = es;
			view = new VaultTableView(table, {
				filter: isRed,
				distinctBy: (oldRow, newRow) => oldRow.data.color === newRow.data.color,
			});

			const events: VaultTableEvent<FruitData>[] = [];
			view.events$.subscribe((e) => events.push(e));

			const updatedApple = makeRow<FruitData>("apple", { name: "Apple Updated", color: "red", ripe: false });
			eventsSubject.next({
				type: "row-updated",
				id: "apple",
				filePath: apple.filePath,
				oldRow: apple,
				newRow: updatedApple,
				contentChanged: false,
			});

			expect(events).toHaveLength(0);
		});

		it("should still update internal state when event is suppressed", () => {
			const { table, eventsSubject: es } = createMockTable([apple]);
			eventsSubject = es;
			view = new VaultTableView(table, {
				filter: isRed,
				distinctBy: () => true,
			});

			const updatedApple = makeRow<FruitData>("apple", { name: "Updated", color: "red", ripe: false });
			eventsSubject.next({
				type: "row-updated",
				id: "apple",
				filePath: apple.filePath,
				oldRow: apple,
				newRow: updatedApple,
				contentChanged: false,
			});

			expect(view.get("apple")?.data.name).toBe("Updated");
			expect(view.get("apple")?.data.ripe).toBe(false);
		});

		it("should emit row-updated when distinctBy returns false", () => {
			const { table, eventsSubject: es } = createMockTable([apple]);
			eventsSubject = es;
			view = new VaultTableView(table, {
				filter: isRed,
				distinctBy: (oldRow, newRow) => oldRow.data.name === newRow.data.name,
			});

			const events: VaultTableEvent<FruitData>[] = [];
			view.events$.subscribe((e) => events.push(e));

			const updatedApple = makeRow<FruitData>("apple", { name: "Apple Updated", color: "red", ripe: false });
			eventsSubject.next({
				type: "row-updated",
				id: "apple",
				filePath: apple.filePath,
				oldRow: apple,
				newRow: updatedApple,
				contentChanged: false,
			});

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("row-updated");
		});

		it("should not affect enter/leave transitions", () => {
			const { table, eventsSubject: es } = createMockTable([apple, banana]);
			eventsSubject = es;
			view = new VaultTableView(table, {
				filter: isRed,
				distinctBy: () => true,
			});

			const events: VaultTableEvent<FruitData>[] = [];
			view.events$.subscribe((e) => events.push(e));

			const redBanana = makeRow<FruitData>("banana", { name: "Banana", color: "red", ripe: true });
			eventsSubject.next({
				type: "row-updated",
				id: "banana",
				filePath: banana.filePath,
				oldRow: banana,
				newRow: redBanana,
				contentChanged: false,
			});

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("row-created");
		});

		it("should behave normally without distinctBy configured", () => {
			const { table, eventsSubject: es } = createMockTable([apple]);
			eventsSubject = es;
			view = new VaultTableView(table, { filter: isRed });

			const events: VaultTableEvent<FruitData>[] = [];
			view.events$.subscribe((e) => events.push(e));

			const updatedApple = makeRow<FruitData>("apple", { name: "Apple Updated", color: "red", ripe: false });
			eventsSubject.next({
				type: "row-updated",
				id: "apple",
				filePath: apple.filePath,
				oldRow: apple,
				newRow: updatedApple,
				contentChanged: false,
			});

			expect(events).toHaveLength(1);
		});
	});
});
