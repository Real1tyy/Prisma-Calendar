import { describe, expect, it, vi } from "vitest";

import { onceAsync } from "../../src/utils/async";

describe("onceAsync", () => {
	it("should execute the function only once", async () => {
		const mockFn = vi.fn().mockResolvedValue("result");
		const onceAsyncFn = onceAsync(mockFn);

		const result1 = await onceAsyncFn();
		const result2 = await onceAsyncFn();
		const result3 = await onceAsyncFn();

		expect(mockFn).toHaveBeenCalledTimes(1);
		expect(result1).toBe("result");
		expect(result2).toBe("result");
		expect(result3).toBe("result");
	});

	it("should return the same promise for concurrent calls", async () => {
		let resolvePromise: (value: string) => void;
		const mockFn = vi.fn().mockImplementation(() => {
			return new Promise<string>((resolve) => {
				resolvePromise = resolve;
			});
		});
		const onceAsyncFn = onceAsync(mockFn);

		// Start multiple concurrent calls
		const promise1 = onceAsyncFn();
		const promise2 = onceAsyncFn();
		const promise3 = onceAsyncFn();

		// Verify they are the same promise
		expect(promise1).toBe(promise2);
		expect(promise2).toBe(promise3);

		// Resolve the promise
		resolvePromise!("concurrent-result");

		const results = await Promise.all([promise1, promise2, promise3]);
		expect(results).toEqual(["concurrent-result", "concurrent-result", "concurrent-result"]);
		expect(mockFn).toHaveBeenCalledTimes(1);
	});

	it("should handle rejected promises correctly", async () => {
		const error = new Error("Test error");
		const mockFn = vi.fn().mockRejectedValue(error);
		const onceAsyncFn = onceAsync(mockFn);

		await expect(onceAsyncFn()).rejects.toThrow("Test error");
		await expect(onceAsyncFn()).rejects.toThrow("Test error");

		expect(mockFn).toHaveBeenCalledTimes(1);
	});

	it("should work with different return types", async () => {
		const numberFn = onceAsync(async () => 42);
		const objectFn = onceAsync(async () => ({ key: "value" }));
		const arrayFn = onceAsync(async () => [1, 2, 3]);

		expect(await numberFn()).toBe(42);
		expect(await objectFn()).toEqual({ key: "value" });
		expect(await arrayFn()).toEqual([1, 2, 3]);
	});

	it("should handle functions that throw synchronously", async () => {
		const mockFn = vi.fn().mockImplementation(() => {
			throw new Error("Sync error");
		});
		const onceAsyncFn = onceAsync(mockFn);

		await expect(onceAsyncFn()).rejects.toThrow("Sync error");
		await expect(onceAsyncFn()).rejects.toThrow("Sync error");

		expect(mockFn).toHaveBeenCalledTimes(1);
	});

	it("should work with void return type", async () => {
		const mockFn = vi.fn().mockResolvedValue(undefined);
		const onceAsyncFn = onceAsync(mockFn);

		const result1 = await onceAsyncFn();
		const result2 = await onceAsyncFn();

		expect(result1).toBeUndefined();
		expect(result2).toBeUndefined();
		expect(mockFn).toHaveBeenCalledTimes(1);
	});
});

describe("Real-world usage scenarios", () => {
	it("should work for indexer initialization pattern", async () => {
		let isReady = false;
		const initializeIndexer = onceAsync(async () => {
			// Simulate expensive initialization
			await new Promise((resolve) => setTimeout(resolve, 10));
			isReady = true;
		});

		const ensureReady = async () => {
			if (isReady) return;
			await initializeIndexer();
		};

		// Multiple calls should only initialize once
		await Promise.all([ensureReady(), ensureReady(), ensureReady()]);

		expect(isReady).toBe(true);
	});

	it("should work for API client initialization", async () => {
		const mockApiCall = vi.fn().mockResolvedValue({ token: "abc123" });

		const initializeClient = onceAsync(async () => {
			const response = await mockApiCall();
			return response.token;
		});

		// Multiple components trying to initialize
		const [token1, token2, token3] = await Promise.all([initializeClient(), initializeClient(), initializeClient()]);

		expect(mockApiCall).toHaveBeenCalledTimes(1);
		expect(token1).toBe("abc123");
		expect(token2).toBe("abc123");
		expect(token3).toBe("abc123");
	});
});
