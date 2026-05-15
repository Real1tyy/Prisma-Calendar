import { describe, expect, it, vi } from "vitest";

import { defineCrudContractSuite, inProcessInvoker, runContractSuite } from "../../src/testing/api-contract";

describe("runContractSuite", () => {
	it("threads results between steps via the prev resolver", async () => {
		const store = new Map<string, { title: string }>();

		const api = {
			createTask: (params: { title: string }) => {
				const id = `task-${store.size + 1}`;
				store.set(id, params);
				return { id };
			},
			getTask: (params: { id: string }) => {
				const found = store.get(params.id);
				return found ? { ...found, id: params.id } : null;
			},
			deleteTask: (params: { id: string }) => {
				return store.delete(params.id);
			},
		};

		const suite = defineCrudContractSuite({
			name: "task-crud",
			steps: [
				{
					name: "create",
					action: "createTask",
					params: { title: "Project Planning" },
					expect: (result) => {
						expect(result).toMatchObject({ id: expect.any(String) as string });
					},
				},
				{
					name: "read",
					action: "getTask",
					params: (prev) => ({ id: (prev["create"] as { id: string }).id }),
					expect: (result) => {
						expect(result).toEqual({ id: expect.any(String) as string, title: "Project Planning" });
					},
				},
				{
					name: "delete",
					action: "deleteTask",
					params: (prev) => ({ id: (prev["create"] as { id: string }).id }),
					expect: (result) => expect(result).toBe(true),
				},
				{
					name: "readAfterDelete",
					action: "getTask",
					params: (prev) => ({ id: (prev["create"] as { id: string }).id }),
					expect: (result) => expect(result).toBeNull(),
				},
			],
		});

		const results = await runContractSuite(suite, { invoke: inProcessInvoker(api) });

		expect(Object.keys(results)).toEqual(["create", "read", "delete", "readAfterDelete"]);
		expect(results["delete"]).toBe(true);
	});

	it("wraps errors with suite + step context", async () => {
		const api = {
			boom: () => {
				throw new Error("kaboom");
			},
		};

		const suite = defineCrudContractSuite({
			name: "errors",
			steps: [{ name: "step", action: "boom", params: undefined }],
		});

		await expect(runContractSuite(suite, { invoke: inProcessInvoker(api) })).rejects.toThrow(
			/\[contract:errors\] step "step" \(boom\) failed during invoke: kaboom/
		);
	});

	it("wraps expect-phase failures distinctly from invoke failures", async () => {
		const api = { ok: () => "value" };

		const suite = defineCrudContractSuite({
			name: "assertions",
			steps: [
				{
					name: "step",
					action: "ok",
					params: undefined,
					expect: () => {
						throw new Error("assertion failed");
					},
				},
			],
		});

		await expect(runContractSuite(suite, { invoke: inProcessInvoker(api) })).rejects.toThrow(
			/failed during expect: assertion failed/
		);
	});

	it("calls hooks in begin/step/end order", async () => {
		const api = { ping: () => "pong" };
		const order: string[] = [];

		const suite = defineCrudContractSuite({
			name: "hooks",
			steps: [{ name: "a", action: "ping", params: undefined }],
		});

		await runContractSuite(suite, {
			invoke: inProcessInvoker(api),
			hooks: {
				begin: () => {
					order.push("begin");
				},
				step: (s, r) => {
					order.push(`step:${s.name}=${String(r)}`);
				},
				end: () => {
					order.push("end");
				},
			},
		});

		expect(order).toEqual(["begin", "step:a=pong", "end"]);
	});

	it("inProcessInvoker rejects unknown actions with a helpful error", async () => {
		const invoke = inProcessInvoker({});
		await expect(invoke("missing", {})).rejects.toThrow(/action "missing" is not a function/);
	});

	it("hooks are not awaited synchronously in vain (async hooks are awaited)", async () => {
		const api = { ping: () => "pong" };
		const begin = vi.fn(async () => {});
		const end = vi.fn(async () => {});

		const suite = defineCrudContractSuite({
			name: "async-hooks",
			steps: [{ name: "x", action: "ping", params: undefined }],
		});

		await runContractSuite(suite, { invoke: inProcessInvoker(api), hooks: { begin, end } });

		expect(begin).toHaveBeenCalled();
		expect(end).toHaveBeenCalled();
	});
});
