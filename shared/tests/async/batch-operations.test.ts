import { silenceConsole } from "../../src/testing/silence-console";
import { runBatchOperation, withLock } from "../../src/utils/async/batch-operations";

describe("runBatchOperation", () => {
	silenceConsole();

	it("returns zero counts for an empty batch", async () => {
		const result = await runBatchOperation([], "Test Op", async () => {}, false);
		expect(result).toEqual({ successCount: 0, errorCount: 0 });
	});

	it("processes a single item successfully", async () => {
		const processed: string[] = [];
		const result = await runBatchOperation(
			["Alice"],
			"Greet",
			async (name) => {
				processed.push(name);
			},
			false
		);

		expect(result).toEqual({ successCount: 1, errorCount: 0 });
		expect(processed).toEqual(["Alice"]);
	});

	it("processes multiple items in order", async () => {
		const items = ["Alice", "Bob", "Charlie"];
		const processed: string[] = [];

		const result = await runBatchOperation(
			items,
			"Process",
			async (name) => {
				processed.push(name);
			},
			false
		);

		expect(result).toEqual({ successCount: 3, errorCount: 0 });
		expect(processed).toEqual(["Alice", "Bob", "Charlie"]);
	});

	it("counts errors and continues processing remaining items", async () => {
		const items = ["Alice", "Bob", "Charlie"];

		const result = await runBatchOperation(
			items,
			"Process",
			async (name) => {
				if (name === "Bob") throw new Error("Failed");
			},
			false
		);

		expect(result).toEqual({ successCount: 2, errorCount: 1 });
	});

	it("counts all failures when every item errors", async () => {
		const items = ["Alice", "Bob"];

		const result = await runBatchOperation(
			items,
			"Process",
			async () => {
				throw new Error("Failed");
			},
			false
		);

		expect(result).toEqual({ successCount: 0, errorCount: 2 });
	});

	it("shows success notice when showResult is true and no errors", async () => {
		const result = await runBatchOperation(["Alice"], "Test Op", async () => {}, true);

		expect(result).toEqual({ successCount: 1, errorCount: 0 });
	});

	it("shows error notice when showResult is true and there are errors", async () => {
		const result = await runBatchOperation(
			["Alice"],
			"Test Op",
			async () => {
				throw new Error("Fail");
			},
			true
		);

		expect(result).toEqual({ successCount: 0, errorCount: 1 });
	});

	it("defaults showResult to true", async () => {
		const result = await runBatchOperation(["Alice"], "Test Op", async () => {});
		expect(result).toEqual({ successCount: 1, errorCount: 0 });
	});

	it("uses singular 'item' in notice for single success", async () => {
		const result = await runBatchOperation(["Alice"], "Test Op", async () => {}, true);
		expect(result.successCount).toBe(1);
	});

	it("uses plural 'items' in notice for multiple successes", async () => {
		const result = await runBatchOperation(["Alice", "Bob"], "Test Op", async () => {}, true);
		expect(result.successCount).toBe(2);
	});
});

describe("withLock", () => {
	it("executes the operation and returns its result", async () => {
		const lockMap = new Map<string, Promise<number>>();

		const result = await withLock(lockMap, "key-1", async () => 42);

		expect(result).toBe(42);
	});

	it("removes the lock after successful completion", async () => {
		const lockMap = new Map<string, Promise<number>>();

		await withLock(lockMap, "key-1", async () => 42);

		expect(lockMap.has("key-1")).toBe(false);
	});

	it("removes the lock after an error", async () => {
		const lockMap = new Map<string, Promise<string>>();

		await expect(
			withLock(lockMap, "key-1", async () => {
				throw new Error("Operation failed");
			})
		).rejects.toThrow("Operation failed");

		expect(lockMap.has("key-1")).toBe(false);
	});

	it("returns the existing lock result when called concurrently with the same key", async () => {
		const lockMap = new Map<string, Promise<number>>();
		let callCount = 0;

		const operation = async () => {
			callCount++;
			await new Promise((resolve) => setTimeout(resolve, 50));
			return callCount;
		};

		const promise1 = withLock(lockMap, "key-1", operation);
		const promise2 = withLock(lockMap, "key-1", operation);

		const [result1, result2] = await Promise.all([promise1, promise2]);

		expect(result1).toBe(1);
		expect(result2).toBe(1);
		expect(callCount).toBe(1);
	});

	it("allows independent operations on different keys", async () => {
		const lockMap = new Map<string, Promise<string>>();

		const promise1 = withLock(lockMap, "key-1", async () => "Alice");
		const promise2 = withLock(lockMap, "key-2", async () => "Bob");

		const [result1, result2] = await Promise.all([promise1, promise2]);

		expect(result1).toBe("Alice");
		expect(result2).toBe("Bob");
	});

	it("allows re-acquiring a lock after the previous operation completes", async () => {
		const lockMap = new Map<string, Promise<number>>();

		const result1 = await withLock(lockMap, "key-1", async () => 1);
		const result2 = await withLock(lockMap, "key-1", async () => 2);

		expect(result1).toBe(1);
		expect(result2).toBe(2);
	});

	it("holds the lock while the operation is in progress", async () => {
		const lockMap = new Map<string, Promise<number>>();
		let lockPresent = false;

		await withLock(lockMap, "key-1", async () => {
			await Promise.resolve();
			lockPresent = lockMap.has("key-1");
			return 1;
		});

		expect(lockPresent).toBe(true);
		expect(lockMap.has("key-1")).toBe(false);
	});
});
