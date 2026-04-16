import { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { VaultRow } from "../../src/core/vault-table/types";
import type { VaultTableChildRestConfig, VaultTableRestConfig } from "../../src/core/vault-table/vault-table-rest-api";
import { VaultTableRestApi } from "../../src/core/vault-table/vault-table-rest-api";
import type { ActionDefMap } from "../../src/integrations/api-gateway/types";

// ─── Domain: a "Projects" table with child "Tasks" ─────────────

interface Project {
	name: string;
	status: string;
	budget: number;
	startDate: string;
}

interface Task {
	title: string;
	done: boolean;
	priority: number;
}

const ProjectShape = {
	name: z.string(),
	status: z.string(),
	budget: z.number(),
	startDate: z.iso.date(),
};

const TaskShape = {
	title: z.string(),
	done: z.boolean(),
	priority: z.number(),
};

// ─── Fixture Data ───────────────────────────────────────────────

const NOW = 1700000000000;

function projectRow(id: string, data: Project, mtimeOffset = 0): VaultRow<Project> {
	return {
		id,
		file: new TFile(`Projects/${id}.md`),
		filePath: `Projects/${id}.md`,
		data,
		content: "",
		mtime: NOW + mtimeOffset,
	};
}

function taskRow(id: string, data: Task, parentId: string): VaultRow<Task> {
	return {
		id,
		file: new TFile(`Projects/${parentId}/Tasks/${id}.md`),
		filePath: `Projects/${parentId}/Tasks/${id}.md`,
		data,
		content: "",
		mtime: NOW,
	};
}

const PROJECTS: VaultRow<Project>[] = [
	projectRow("website-redesign", {
		name: "Website Redesign",
		status: "active",
		budget: 50000,
		startDate: "2025-01-15",
	}),
	projectRow("mobile-app", { name: "Mobile App", status: "active", budget: 120000, startDate: "2025-03-01" }),
	projectRow("data-pipeline", { name: "Data Pipeline", status: "completed", budget: 35000, startDate: "2024-11-01" }),
	projectRow("api-migration", { name: "API Migration", status: "planning", budget: 80000, startDate: "2025-06-01" }),
	projectRow("design-system", { name: "Design System", status: "active", budget: 25000, startDate: "2025-02-10" }),
];

const TASKS_BY_PROJECT: Record<string, VaultRow<Task>[]> = {
	"website-redesign": [
		taskRow("wr-1", { title: "Wireframes", done: true, priority: 1 }, "website-redesign"),
		taskRow("wr-2", { title: "Frontend Build", done: false, priority: 2 }, "website-redesign"),
		taskRow("wr-3", { title: "QA Review", done: false, priority: 3 }, "website-redesign"),
	],
	"mobile-app": [
		taskRow("ma-1", { title: "Prototype", done: true, priority: 1 }, "mobile-app"),
		taskRow("ma-2", { title: "Backend API", done: false, priority: 1 }, "mobile-app"),
	],
};

// ─── Mock VaultTable ────────────────────────────────────────────

function createMockTable(rows: VaultRow<Project>[]) {
	const store = new Map(rows.map((r) => [r.id, r]));
	let nextId = 100;

	const childTables: Record<string, ReturnType<typeof createMockChildTable>> = {};
	for (const [parentId, tasks] of Object.entries(TASKS_BY_PROJECT)) {
		childTables[parentId] = createMockChildTable(tasks);
	}

	return {
		toClonedArray: () => [...store.values()],
		get: (id: string) => store.get(id),
		create: vi.fn(async (insert: { fileName: string; data: Project; content?: string }) => {
			const id = `project-${nextId++}`;
			const row = projectRow(id, insert.data);
			store.set(id, row);
			return row;
		}),
		update: vi.fn(async (id: string, data: Partial<Project>) => {
			const existing = store.get(id);
			if (!existing) throw new Error(`Not found: ${id}`);
			const updated = { ...existing, data: { ...existing.data, ...data } };
			store.set(id, updated);
			return updated;
		}),
		delete: vi.fn(async (id: string) => {
			store.delete(id);
		}),
		getHydrated: vi.fn(async (id: string) => {
			const row = store.get(id);
			if (!row) return undefined;
			return {
				...row,
				relations: {
					tasks: childTables[id] ?? createMockChildTable([]),
				},
			};
		}),
	} as any;
}

function createMockChildTable(rows: VaultRow<Task>[]) {
	const store = new Map(rows.map((r) => [r.id, r]));
	let nextId = 100;

	return {
		toClonedArray: () => [...store.values()],
		get: (id: string) => store.get(id),
		create: vi.fn(async (insert: { fileName: string; data: Task; content?: string }) => {
			const id = `task-${nextId++}`;
			const row: VaultRow<Task> = {
				id,
				file: new TFile(`Tasks/${id}.md`),
				filePath: `Tasks/${id}.md`,
				data: insert.data as Task,
				content: insert.content ?? "",
				mtime: NOW,
			};
			store.set(id, row);
			return row;
		}),
		update: vi.fn(async (id: string, data: Record<string, unknown>) => {
			const existing = store.get(id);
			if (!existing) throw new Error(`Not found: ${id}`);
			const updated = { ...existing, data: { ...existing.data, ...data } };
			store.set(id, updated);
			return updated;
		}),
		delete: vi.fn(async (id: string) => {
			store.delete(id);
		}),
	};
}

// ─── Config ─────────────────────────────────────────────────────

const CHILD_CONFIG: VaultTableChildRestConfig = {
	resourceName: "tasks",
	shape: TaskShape,
	childKey: "tasks",
};

const REST_CONFIG: VaultTableRestConfig = {
	resourceName: "projects",
	shape: ProjectShape,
	children: { tasks: CHILD_CONFIG },
};

// ─── Helper ─────────────────────────────────────────────────────

function buildApi(config = REST_CONFIG, rows = PROJECTS) {
	const table = createMockTable(rows);
	const restApi = new VaultTableRestApi(table, config);
	return { actions: restApi.buildActions(), table };
}

// ─── Tests ──────────────────────────────────────────────────────

describe("VaultTableRestApi", () => {
	describe("buildActions", () => {
		it("registers all parent CRUD + schema actions", () => {
			const { actions } = buildApi();
			expect(actions["projects.list"]).toBeDefined();
			expect(actions["projects.get"]).toBeDefined();
			expect(actions["projects.create"]).toBeDefined();
			expect(actions["projects.update"]).toBeDefined();
			expect(actions["projects.delete"]).toBeDefined();
			expect(actions["projects.schema"]).toBeDefined();
		});

		it("registers child CRUD actions", () => {
			const { actions } = buildApi();
			expect(actions["projects.tasks.list"]).toBeDefined();
			expect(actions["projects.tasks.get"]).toBeDefined();
			expect(actions["projects.tasks.create"]).toBeDefined();
			expect(actions["projects.tasks.update"]).toBeDefined();
			expect(actions["projects.tasks.delete"]).toBeDefined();
		});

		it("omits write actions when readOnly", () => {
			const { actions } = buildApi({ ...REST_CONFIG, readOnly: true, children: undefined });
			expect(actions["projects.list"]).toBeDefined();
			expect(actions["projects.get"]).toBeDefined();
			expect(actions["projects.schema"]).toBeDefined();
			expect(actions["projects.create"]).toBeUndefined();
			expect(actions["projects.update"]).toBeUndefined();
			expect(actions["projects.delete"]).toBeUndefined();
		});

		it("omits child write actions when child readOnly", () => {
			const config: VaultTableRestConfig = {
				...REST_CONFIG,
				children: { tasks: { ...CHILD_CONFIG, readOnly: true } },
			};
			const { actions } = buildApi(config);
			expect(actions["projects.tasks.list"]).toBeDefined();
			expect(actions["projects.tasks.get"]).toBeDefined();
			expect(actions["projects.tasks.create"]).toBeUndefined();
			expect(actions["projects.tasks.update"]).toBeUndefined();
			expect(actions["projects.tasks.delete"]).toBeUndefined();
		});

		it("configures correct HTTP routes for parent", () => {
			const { actions } = buildApi();
			expect(actions["projects.list"].http).toEqual({ method: "GET", path: "/projects" });
			expect(actions["projects.get"].http).toEqual({ method: "GET", path: "/projects/:id" });
			expect(actions["projects.create"].http).toMatchObject({ method: "POST", path: "/projects" });
			expect(actions["projects.update"].http).toMatchObject({ method: "PUT", path: "/projects/:id" });
			expect(actions["projects.delete"].http).toEqual({ method: "DELETE", path: "/projects/:id" });
			expect(actions["projects.schema"].http).toEqual({ method: "GET", path: "/projects/_schema" });
		});

		it("configures correct HTTP routes for children", () => {
			const { actions } = buildApi();
			expect(actions["projects.tasks.list"].http).toEqual({ method: "GET", path: "/projects/:id/tasks" });
			expect(actions["projects.tasks.get"].http).toEqual({ method: "GET", path: "/projects/:id/tasks/:childId" });
			expect(actions["projects.tasks.create"].http).toMatchObject({ method: "POST", path: "/projects/:id/tasks" });
			expect(actions["projects.tasks.update"].http).toMatchObject({
				method: "PUT",
				path: "/projects/:id/tasks/:childId",
			});
			expect(actions["projects.tasks.delete"].http).toEqual({ method: "DELETE", path: "/projects/:id/tasks/:childId" });
		});
	});

	describe("parent list", () => {
		it("returns all rows with pagination metadata", () => {
			const { actions } = buildApi();
			const result = actions["projects.list"].handler({});

			expect(result.total).toBe(5);
			expect(result.filtered).toBe(5);
			expect(result.data).toHaveLength(5);
			expect(result.data[0].id).toBe("website-redesign");
			expect(result.data[0].data.name).toBe("Website Redesign");
			expect(result.data[0].filePath).toBe("Projects/website-redesign.md");
		});

		it("filters by field equality via parsed filter params", () => {
			const { actions } = buildApi();
			const result = actions["projects.list"].handler({
				filters: [{ field: "status", operator: "eq", value: "active" }],
			});

			expect(result.filtered).toBe(3);
			expect(result.data.every((r: any) => r.data.status === "active")).toBe(true);
		});

		it("filters by numeric comparison", () => {
			const { actions } = buildApi();
			const result = actions["projects.list"].handler({
				filters: [{ field: "budget", operator: "gte", value: 50000 }],
			});

			expect(result.filtered).toBe(3);
			const budgets = result.data.map((r: any) => r.data.budget);
			expect(budgets.every((b: number) => b >= 50000)).toBe(true);
		});

		it("sorts ascending by name", () => {
			const { actions } = buildApi();
			const result = actions["projects.list"].handler({
				sorts: [{ field: "name", direction: "asc" }],
			});

			const names = result.data.map((r: any) => r.data.name);
			expect(names).toEqual(["API Migration", "Data Pipeline", "Design System", "Mobile App", "Website Redesign"]);
		});

		it("sorts descending by budget", () => {
			const { actions } = buildApi();
			const result = actions["projects.list"].handler({
				sorts: [{ field: "budget", direction: "desc" }],
			});

			const budgets = result.data.map((r: any) => r.data.budget);
			expect(budgets).toEqual([120000, 80000, 50000, 35000, 25000]);
		});

		it("filters + sorts + paginates together", () => {
			const { actions } = buildApi();
			const result = actions["projects.list"].handler({
				filters: [{ field: "status", operator: "eq", value: "active" }],
				sorts: [{ field: "budget", direction: "desc" }],
				limit: 2,
				offset: 0,
			});

			expect(result.total).toBe(5);
			expect(result.filtered).toBe(3);
			expect(result.data).toHaveLength(2);
			expect(result.data[0].data.name).toBe("Mobile App");
			expect(result.data[1].data.name).toBe("Website Redesign");
			expect(result.limit).toBe(2);
			expect(result.offset).toBe(0);
		});

		it("paginates with offset", () => {
			const { actions } = buildApi();
			const result = actions["projects.list"].handler({
				sorts: [{ field: "name", direction: "asc" }],
				limit: 2,
				offset: 2,
			});

			expect(result.data).toHaveLength(2);
			expect(result.data[0].data.name).toBe("Design System");
			expect(result.data[1].data.name).toBe("Mobile App");
		});

		it("parseParams converts query string to typed params", () => {
			const { actions } = buildApi();
			const parsed = actions["projects.list"].parseParams!({
				status: "active",
				budget_gte: "50000",
				sort: "name:asc",
				limit: "10",
				offset: "5",
			});

			expect(parsed.filters).toEqual([
				{ field: "status", operator: "eq", value: "active" },
				{ field: "budget", operator: "gte", value: 50000 },
			]);
			expect(parsed.sorts).toEqual([{ field: "name", direction: "asc" }]);
			expect(parsed.limit).toBe(10);
			expect(parsed.offset).toBe(5);
		});
	});

	describe("parent get", () => {
		it("returns a single serialized row", () => {
			const { actions } = buildApi();
			const result = actions["projects.get"].handler({ id: "mobile-app" });

			expect(result.data.id).toBe("mobile-app");
			expect(result.data.data.name).toBe("Mobile App");
			expect(result.data.data.budget).toBe(120000);
			expect(result.data.filePath).toBe("Projects/mobile-app.md");
		});

		it("returns 404 for missing row", () => {
			const { actions } = buildApi();
			const result = actions["projects.get"].handler({ id: "nonexistent" });

			expect(result.status).toBe(404);
			expect(result.body.error).toContain("nonexistent");
		});

		it("parseParams extracts id from route params", () => {
			const { actions } = buildApi();
			const parsed = actions["projects.get"].parseParams!({ id: "mobile-app" });
			expect(parsed).toEqual({ id: "mobile-app" });
		});
	});

	describe("parent create", () => {
		it("creates a row and returns serialized result", async () => {
			const { actions, table } = buildApi();
			const result = await actions["projects.create"].handler({
				fileName: "New Initiative",
				data: { name: "New Initiative", status: "planning", budget: 60000, startDate: "2025-07-01" },
			});

			expect(result.data.data.name).toBe("New Initiative");
			expect(result.data.data.budget).toBe(60000);
			expect(table.create).toHaveBeenCalledOnce();
		});
	});

	describe("parent update", () => {
		it("updates a row and returns serialized result", async () => {
			const { actions, table } = buildApi();
			const result = await actions["projects.update"].handler({
				id: "website-redesign",
				data: { status: "completed", budget: 55000 },
			});

			expect(result.data.data.status).toBe("completed");
			expect(result.data.data.budget).toBe(55000);
			expect(table.update).toHaveBeenCalledWith("website-redesign", { status: "completed", budget: 55000 });
		});
	});

	describe("parent delete", () => {
		it("deletes a row and returns success", async () => {
			const { actions, table } = buildApi();
			const result = await actions["projects.delete"].handler({ id: "data-pipeline" });

			expect(result).toEqual({ success: true });
			expect(table.delete).toHaveBeenCalledWith("data-pipeline");
		});
	});

	describe("schema", () => {
		it("returns resource metadata with filter/sort fields", () => {
			const { actions } = buildApi();
			const result = actions["projects.schema"].handler();

			expect(result.resource).toBe("projects");
			expect(result.readOnly).toBe(false);
			expect(result.filterFields.map((f: any) => f.key)).toEqual(["name", "status", "budget", "startDate"]);
			expect(result.sortFields.map((f: any) => f.key)).toEqual(["name", "status", "budget", "startDate"]);
			expect(result.children).toEqual([{ resource: "tasks", readOnly: false }]);
		});

		it("marks readOnly correctly", () => {
			const { actions } = buildApi({ ...REST_CONFIG, readOnly: true, children: undefined });
			const result = actions["projects.schema"].handler();
			expect(result.readOnly).toBe(true);
			expect(result.children).toEqual([]);
		});
	});

	describe("child list", () => {
		it("returns child rows for a parent", async () => {
			const { actions } = buildApi();
			const result = await actions["projects.tasks.list"].handler({ id: "website-redesign" });

			expect(result.total).toBe(3);
			expect(result.data).toHaveLength(3);
			expect(result.data[0].data.title).toBe("Wireframes");
		});

		it("returns 404 when parent does not exist", async () => {
			const { actions } = buildApi();
			const result = await actions["projects.tasks.list"].handler({ id: "nonexistent" });

			expect(result.status).toBe(404);
			expect(result.body.error).toContain("nonexistent");
		});

		it("filters child rows", async () => {
			const { actions } = buildApi();
			const result = await actions["projects.tasks.list"].handler({
				id: "website-redesign",
				filters: [{ field: "done", operator: "eq", value: "false" }],
			});

			expect(result.filtered).toBe(2);
			expect(result.data.every((r: any) => r.data.done === false)).toBe(true);
		});

		it("sorts child rows", async () => {
			const { actions } = buildApi();
			const result = await actions["projects.tasks.list"].handler({
				id: "website-redesign",
				sorts: [{ field: "priority", direction: "desc" }],
			});

			const priorities = result.data.map((r: any) => r.data.priority);
			expect(priorities).toEqual([3, 2, 1]);
		});

		it("paginates child rows", async () => {
			const { actions } = buildApi();
			const result = await actions["projects.tasks.list"].handler({
				id: "website-redesign",
				limit: 2,
				offset: 1,
			});

			expect(result.data).toHaveLength(2);
			expect(result.total).toBe(3);
			expect(result.data[0].data.title).toBe("Frontend Build");
		});

		it("returns empty data for parent with no children", async () => {
			const { actions } = buildApi();
			const result = await actions["projects.tasks.list"].handler({ id: "data-pipeline" });

			expect(result.total).toBe(0);
			expect(result.data).toEqual([]);
		});
	});

	describe("child get", () => {
		it("returns a single child row", async () => {
			const { actions } = buildApi();
			const result = await actions["projects.tasks.get"].handler({
				id: "website-redesign",
				childId: "wr-2",
			});

			expect(result.data.id).toBe("wr-2");
			expect(result.data.data.title).toBe("Frontend Build");
			expect(result.data.data.done).toBe(false);
		});

		it("returns 404 when parent does not exist", async () => {
			const { actions } = buildApi();
			const result = await actions["projects.tasks.get"].handler({
				id: "nonexistent",
				childId: "wr-1",
			});

			expect(result.status).toBe(404);
			expect(result.body.error).toContain("nonexistent");
		});

		it("returns 404 when child does not exist", async () => {
			const { actions } = buildApi();
			const result = await actions["projects.tasks.get"].handler({
				id: "website-redesign",
				childId: "nonexistent",
			});

			expect(result.status).toBe(404);
			expect(result.body.error).toContain("nonexistent");
		});
	});

	describe("child create", () => {
		it("creates a child row under the parent", async () => {
			const { actions } = buildApi();
			const result = await actions["projects.tasks.create"].handler({
				id: "website-redesign",
				fileName: "Deployment",
				data: { title: "Deployment", done: false, priority: 4 },
			});

			expect(result.data.data.title).toBe("Deployment");
			expect(result.data.data.priority).toBe(4);
		});

		it("returns 404 when parent does not exist", async () => {
			const { actions } = buildApi();
			const result = await actions["projects.tasks.create"].handler({
				id: "nonexistent",
				fileName: "Task",
				data: { title: "Task", done: false, priority: 1 },
			});

			expect(result.status).toBe(404);
		});
	});

	describe("child update", () => {
		it("updates a child row", async () => {
			const { actions } = buildApi();
			const result = await actions["projects.tasks.update"].handler({
				id: "website-redesign",
				childId: "wr-1",
				data: { done: true, priority: 0 },
			});

			expect(result.data.data.done).toBe(true);
			expect(result.data.data.priority).toBe(0);
		});

		it("returns 404 when parent does not exist", async () => {
			const { actions } = buildApi();
			const result = await actions["projects.tasks.update"].handler({
				id: "nonexistent",
				childId: "wr-1",
				data: { done: true },
			});

			expect(result.status).toBe(404);
		});
	});

	describe("child delete", () => {
		it("deletes a child row", async () => {
			const { actions } = buildApi();
			const result = await actions["projects.tasks.delete"].handler({
				id: "website-redesign",
				childId: "wr-3",
			});

			expect(result).toEqual({ success: true });
		});

		it("returns 404 when parent does not exist", async () => {
			const { actions } = buildApi();
			const result = await actions["projects.tasks.delete"].handler({
				id: "nonexistent",
				childId: "wr-1",
			});

			expect(result.status).toBe(404);
		});
	});

	describe("serialization", () => {
		it("serialized rows contain id, filePath, data, content, mtime", () => {
			const { actions } = buildApi();
			const result = actions["projects.get"].handler({ id: "website-redesign" });

			expect(result.data).toEqual({
				id: "website-redesign",
				filePath: "Projects/website-redesign.md",
				data: { name: "Website Redesign", status: "active", budget: 50000, startDate: "2025-01-15" },
				content: "",
				mtime: NOW,
			});
		});

		it("list serialization matches get serialization for the same row", () => {
			const { actions } = buildApi();
			const listResult = actions["projects.list"].handler({
				filters: [{ field: "name", operator: "eq", value: "Mobile App" }],
			});
			const getResult = actions["projects.get"].handler({ id: "mobile-app" });

			expect(listResult.data[0]).toEqual(getResult.data);
		});
	});
});
