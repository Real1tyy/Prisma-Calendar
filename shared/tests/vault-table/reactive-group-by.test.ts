import { Subject } from "rxjs";
import { afterEach, describe, expect, it } from "vitest";

import { ReactiveGroupBy, ReactiveMultiGroupBy } from "../../src/core/vault-table/reactive-group-by";
import type { VaultTableEvent } from "../../src/core/vault-table/types";
import { makeRow } from "./helpers";

// ─── Helpers ─────────────────────────────────────────────────

interface TaskData {
	title: string;
	status: string;
	tags: string[];
}

const review = makeRow<TaskData>(
	"review",
	{ title: "Weekly Review", status: "active", tags: ["work", "review"] },
	"tasks"
);
const standup = makeRow<TaskData>("standup", { title: "Standup", status: "active", tags: ["work"] }, "tasks");
const workout = makeRow<TaskData>("workout", { title: "Workout", status: "done", tags: ["fitness"] }, "tasks");
const groceries = makeRow<TaskData>("groceries", { title: "Groceries", status: "active", tags: ["personal"] }, "tasks");
const yoga = makeRow<TaskData>("yoga", { title: "Yoga", status: "done", tags: ["fitness", "personal"] }, "tasks");

// ─── ReactiveGroupBy (1:1) ───────────────────────────────────

describe("ReactiveGroupBy", () => {
	let events$: Subject<VaultTableEvent<TaskData>>;
	let groupBy: ReactiveGroupBy<TaskData, string>;

	afterEach(() => {
		groupBy?.destroy();
	});

	function create(rows: VaultRow<TaskData>[], keyFn: (row: VaultRow<TaskData>) => string | null) {
		events$ = new Subject();
		groupBy = new ReactiveGroupBy(rows, events$.asObservable(), keyFn);
		return groupBy;
	}

	describe("initial population", () => {
		it("should group rows by key on construction", () => {
			create([review, standup, workout, groceries], (r) => r.data.status);

			expect(groupBy.getGroup("active")).toHaveLength(3);
			expect(groupBy.getGroup("done")).toHaveLength(1);
			expect(groupBy.getKeys()).toEqual(expect.arrayContaining(["active", "done"]));
		});

		it("should exclude rows where keyFn returns null", () => {
			create([review, standup, workout], (r) => (r.data.status === "done" ? null : r.data.status));

			expect(groupBy.getKeys()).toEqual(["active"]);
			expect(groupBy.getGroup("active")).toHaveLength(2);
			expect(groupBy.getGroup("done")).toHaveLength(0);
		});

		it("should handle empty initial rows", () => {
			create([], (r) => r.data.status);

			expect(groupBy.getKeys()).toHaveLength(0);
			expect(groupBy.getGroups().size).toBe(0);
		});
	});

	describe("reactive updates", () => {
		it("should add new row to correct group on row-created", () => {
			create([review], (r) => r.data.status);

			events$.next({ type: "row-created", id: "standup", filePath: standup.filePath, row: standup });

			expect(groupBy.getGroup("active")).toHaveLength(2);
		});

		it("should move row between groups on row-updated", () => {
			create([review, standup, workout], (r) => r.data.status);

			expect(groupBy.getGroup("active")).toHaveLength(2);
			expect(groupBy.getGroup("done")).toHaveLength(1);

			const updatedReview = makeRow<TaskData>("review", { ...review.data, status: "done" }, "tasks");
			events$.next({
				type: "row-updated",
				id: "review",
				filePath: review.filePath,
				oldRow: review,
				newRow: updatedReview,
				contentChanged: false,
			});

			expect(groupBy.getGroup("active")).toHaveLength(1);
			expect(groupBy.getGroup("done")).toHaveLength(2);
		});

		it("should remove row from group on row-deleted", () => {
			create([review, standup, workout], (r) => r.data.status);

			events$.next({ type: "row-deleted", id: "review", filePath: review.filePath, oldRow: review });

			expect(groupBy.getGroup("active")).toHaveLength(1);
			expect(groupBy.getGroup("active")[0].id).toBe("standup");
		});

		it("should remove empty groups", () => {
			create([workout], (r) => r.data.status);

			expect(groupBy.getKeys()).toEqual(["done"]);

			events$.next({ type: "row-deleted", id: "workout", filePath: workout.filePath, oldRow: workout });

			expect(groupBy.getKeys()).toHaveLength(0);
		});

		it("should handle row-updated where key changes to null", () => {
			create([review, standup], (r) => (r.data.status === "archived" ? null : r.data.status));

			const archivedReview = makeRow<TaskData>("review", { ...review.data, status: "archived" }, "tasks");
			events$.next({
				type: "row-updated",
				id: "review",
				filePath: review.filePath,
				oldRow: review,
				newRow: archivedReview,
				contentChanged: false,
			});

			expect(groupBy.getGroup("active")).toHaveLength(1);
			expect(groupBy.getKeys()).toEqual(["active"]);
		});
	});

	describe("getMultiMemberGroups", () => {
		it("should return only groups with 2+ members", () => {
			create([review, standup, workout], (r) => r.data.status);

			const multi = groupBy.getMultiMemberGroups();
			expect(multi.size).toBe(1);
			expect(multi.has("active")).toBe(true);
			expect(multi.has("done")).toBe(false);
		});
	});

	describe("rapid removals from large group", () => {
		it("should correctly remove multiple rows from the same group in sequence", () => {
			const rows = Array.from({ length: 20 }, (_, i) =>
				makeRow<TaskData>(`task-${i}`, { title: `Task ${i}`, status: "active", tags: [] }, "tasks")
			);
			create(rows, (r) => r.data.status);

			expect(groupBy.getGroup("active")).toHaveLength(20);

			for (let i = 0; i < 10; i++) {
				events$.next({
					type: "row-deleted",
					id: `task-${i}`,
					filePath: `tasks/task-${i}.md`,
					oldRow: rows[i],
				});
			}

			expect(groupBy.getGroup("active")).toHaveLength(10);
			expect(groupBy.getGroup("active").every((r) => Number(r.id.split("-")[1]) >= 10)).toBe(true);
		});

		it("should preserve correct rows when removing from middle of group", () => {
			create([review, standup, groceries], (r) => r.data.status);

			expect(groupBy.getGroup("active")).toHaveLength(3);

			events$.next({ type: "row-deleted", id: "standup", filePath: standup.filePath, oldRow: standup });

			const remaining = groupBy.getGroup("active");
			expect(remaining).toHaveLength(2);
			expect(remaining.map((r) => r.id)).toEqual(expect.arrayContaining(["review", "groceries"]));
		});
	});

	describe("destroy", () => {
		it("should clear all state and stop reacting to events", () => {
			create([review, standup], (r) => r.data.status);

			groupBy.destroy();

			expect(groupBy.getKeys()).toHaveLength(0);

			// Should not throw or update after destroy
			events$.next({ type: "row-created", id: "workout", filePath: workout.filePath, row: workout });
			expect(groupBy.getKeys()).toHaveLength(0);
		});
	});
});

// ─── ReactiveMultiGroupBy (1:many) ──────────────────────────

describe("ReactiveMultiGroupBy", () => {
	let events$: Subject<VaultTableEvent<TaskData>>;
	let groupBy: ReactiveMultiGroupBy<TaskData, string>;

	afterEach(() => {
		groupBy?.destroy();
	});

	function create(rows: VaultRow<TaskData>[], keysFn: (row: VaultRow<TaskData>) => string[]) {
		events$ = new Subject();
		groupBy = new ReactiveMultiGroupBy(rows, events$.asObservable(), keysFn);
		return groupBy;
	}

	describe("initial population", () => {
		it("should group rows by multiple keys on construction", () => {
			create([review, standup, yoga], (r) => r.data.tags);

			expect(groupBy.getGroup("work")).toHaveLength(2);
			expect(groupBy.getGroup("review")).toHaveLength(1);
			expect(groupBy.getGroup("fitness")).toHaveLength(1);
			expect(groupBy.getGroup("personal")).toHaveLength(1);
		});

		it("should handle rows with no keys (empty array)", () => {
			const noTags = makeRow<TaskData>("no-tags", { title: "No Tags", status: "active", tags: [] }, "tasks");
			create([review, noTags], (r) => r.data.tags);

			expect(groupBy.getKeys()).toEqual(expect.arrayContaining(["work", "review"]));
			expect(groupBy.getKeys()).toHaveLength(2);
		});
	});

	describe("reactive updates", () => {
		it("should add row to all its groups on row-created", () => {
			create([standup], (r) => r.data.tags);

			// yoga has tags: ["fitness", "personal"]
			events$.next({ type: "row-created", id: "yoga", filePath: yoga.filePath, row: yoga });

			expect(groupBy.getGroup("work")).toHaveLength(1);
			expect(groupBy.getGroup("fitness")).toHaveLength(1);
			expect(groupBy.getGroup("personal")).toHaveLength(1);
		});

		it("should update groups when row tags change", () => {
			create([review, yoga], (r) => r.data.tags);

			expect(groupBy.getGroup("fitness")).toHaveLength(1);
			expect(groupBy.getGroup("work")).toHaveLength(1);

			// yoga changes from ["fitness", "personal"] to ["work", "fitness"]
			const updatedYoga = makeRow<TaskData>("yoga", { ...yoga.data, tags: ["work", "fitness"] }, "tasks");
			events$.next({
				type: "row-updated",
				id: "yoga",
				filePath: yoga.filePath,
				oldRow: yoga,
				newRow: updatedYoga,
				contentChanged: false,
			});

			expect(groupBy.getGroup("work")).toHaveLength(2); // review + yoga
			expect(groupBy.getGroup("fitness")).toHaveLength(1); // still yoga
			expect(groupBy.getGroup("personal")).toHaveLength(0); // yoga removed
		});

		it("should remove row from all its groups on row-deleted", () => {
			create([review, yoga], (r) => r.data.tags);

			// review has tags: ["work", "review"]
			events$.next({ type: "row-deleted", id: "review", filePath: review.filePath, oldRow: review });

			expect(groupBy.getGroup("work")).toHaveLength(0);
			expect(groupBy.getGroup("review")).toHaveLength(0);
			expect(groupBy.getGroup("fitness")).toHaveLength(1); // yoga unchanged
		});

		it("should remove empty groups after deletion", () => {
			create([standup], (r) => r.data.tags);

			expect(groupBy.getKeys()).toEqual(["work"]);

			events$.next({ type: "row-deleted", id: "standup", filePath: standup.filePath, oldRow: standup });

			expect(groupBy.getKeys()).toHaveLength(0);
		});
	});

	describe("getMultiMemberGroups", () => {
		it("should return groups with 2+ members across multi-key rows", () => {
			create([review, standup, yoga, groceries], (r) => r.data.tags);

			const multi = groupBy.getMultiMemberGroups();
			// "work" has review + standup = 2 members
			expect(multi.has("work")).toBe(true);
			// "personal" has yoga + groceries = 2 members
			expect(multi.has("personal")).toBe(true);
			// "fitness" has only yoga = 1 member
			expect(multi.has("fitness")).toBe(false);
			// "review" has only review = 1 member
			expect(multi.has("review")).toBe(false);
		});
	});

	describe("rapid removals from shared groups", () => {
		it("should correctly handle removing rows that share multiple group keys", () => {
			const a = makeRow<TaskData>("a", { title: "A", status: "active", tags: ["x", "y", "z"] }, "tasks");
			const b = makeRow<TaskData>("b", { title: "B", status: "active", tags: ["x", "y"] }, "tasks");
			const c = makeRow<TaskData>("c", { title: "C", status: "active", tags: ["y", "z"] }, "tasks");
			create([a, b, c], (r) => r.data.tags);

			expect(groupBy.getGroup("x")).toHaveLength(2);
			expect(groupBy.getGroup("y")).toHaveLength(3);
			expect(groupBy.getGroup("z")).toHaveLength(2);

			events$.next({ type: "row-deleted", id: "a", filePath: a.filePath, oldRow: a });

			expect(groupBy.getGroup("x")).toHaveLength(1);
			expect(groupBy.getGroup("y")).toHaveLength(2);
			expect(groupBy.getGroup("z")).toHaveLength(1);

			events$.next({ type: "row-deleted", id: "b", filePath: b.filePath, oldRow: b });

			expect(groupBy.getGroup("x")).toHaveLength(0);
			expect(groupBy.getGroup("y")).toHaveLength(1);
			expect(groupBy.getGroup("z")).toHaveLength(1);
			expect(groupBy.getKeys()).toEqual(expect.arrayContaining(["y", "z"]));
			expect(groupBy.getKeys()).not.toContain("x");
		});

		it("should handle rapid add-remove cycles without corruption", () => {
			create([], (r) => r.data.tags);

			events$.next({ type: "row-created", id: "review", filePath: review.filePath, row: review });
			events$.next({ type: "row-created", id: "yoga", filePath: yoga.filePath, row: yoga });
			events$.next({ type: "row-deleted", id: "review", filePath: review.filePath, oldRow: review });
			events$.next({ type: "row-created", id: "standup", filePath: standup.filePath, row: standup });
			events$.next({ type: "row-deleted", id: "yoga", filePath: yoga.filePath, oldRow: yoga });

			expect(groupBy.getGroup("work")).toHaveLength(1);
			expect(groupBy.getGroup("work")[0].id).toBe("standup");
			expect(groupBy.getGroup("fitness")).toHaveLength(0);
			expect(groupBy.getGroup("personal")).toHaveLength(0);
			expect(groupBy.getGroup("review")).toHaveLength(0);
		});
	});

	describe("destroy", () => {
		it("should clear all state", () => {
			create([review, yoga], (r) => r.data.tags);

			groupBy.destroy();

			expect(groupBy.getKeys()).toHaveLength(0);
			expect(groupBy.getGroups().size).toBe(0);
		});
	});
});
