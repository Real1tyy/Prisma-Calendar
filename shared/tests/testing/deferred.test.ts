import { describe, expect, it } from "vitest";

import { createDeferred, createDeferredVoid } from "../../src/testing/deferred";

describe("createDeferredVoid", () => {
	it("should create a pending promise that resolves when resolve() is called", async () => {
		const deferred = createDeferredVoid();
		let resolved = false;

		void deferred.promise.then(() => {
			resolved = true;
		});

		expect(resolved).toBe(false);

		deferred.resolve();
		await deferred.promise;

		expect(resolved).toBe(true);
	});

	it("should reject when reject() is called", async () => {
		const deferred = createDeferredVoid();

		deferred.reject(new Error("test error"));

		await expect(deferred.promise).rejects.toThrow("test error");
	});

	it("should work as a process gate for async operations", async () => {
		const gate = createDeferredVoid();
		const order: string[] = [];

		const operation = async () => {
			order.push("start");
			await gate.promise;
			order.push("end");
		};

		const promise = operation();
		order.push("after-start");

		expect(order).toEqual(["start", "after-start"]);

		gate.resolve();
		await promise;

		expect(order).toEqual(["start", "after-start", "end"]);
	});
});

describe("createDeferred", () => {
	it("should resolve with a typed value", async () => {
		const deferred = createDeferred<number>();
		deferred.resolve(42);
		expect(await deferred.promise).toBe(42);
	});

	it("should resolve with a complex value", async () => {
		const deferred = createDeferred<{ name: string; count: number }>();
		deferred.resolve({ name: "test", count: 3 });

		const result = await deferred.promise;
		expect(result).toEqual({ name: "test", count: 3 });
	});

	it("should reject with an error", async () => {
		const deferred = createDeferred<string>();
		deferred.reject(new Error("failed"));
		await expect(deferred.promise).rejects.toThrow("failed");
	});

	it("should allow suspending mid-operation to test interleaving", async () => {
		const gate1 = createDeferred<string>();
		const gate2 = createDeferred<string>();
		const results: string[] = [];

		const op1 = gate1.promise.then((v) => results.push(v));
		const op2 = gate2.promise.then((v) => results.push(v));

		gate2.resolve("second");
		await op2;
		expect(results).toEqual(["second"]);

		gate1.resolve("first");
		await op1;
		expect(results).toEqual(["second", "first"]);
	});
});
