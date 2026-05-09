import "@testing-library/jest-dom/vitest";

import { act, renderHook, waitFor } from "@testing-library/react";
import { Notice } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useConnectionTest } from "../../../src/react/hooks/use-connection-test";

const NoticeMock = Notice as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
	NoticeMock.mockClear();
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("useConnectionTest — initial state", () => {
	it("starts with testing=false, testPassed=false, testData=undefined", () => {
		const { result } = renderHook(() => useConnectionTest(vi.fn().mockResolvedValue({ success: true })));

		expect(result.current.testing).toBe(false);
		expect(result.current.testPassed).toBe(false);
		expect(result.current.testData).toBeUndefined();
	});
});

describe("useConnectionTest — success path", () => {
	it("flips testPassed to true and stores testData when the test fn resolves with success", async () => {
		const testFn = vi.fn().mockResolvedValue({ success: true, data: { name: "calendar" } });
		const { result } = renderHook(() => useConnectionTest<{ name: string }>(testFn));

		await act(async () => {
			await result.current.runTest();
		});

		expect(testFn).toHaveBeenCalledOnce();
		expect(result.current.testPassed).toBe(true);
		expect(result.current.testData).toEqual({ name: "calendar" });
		expect(result.current.testing).toBe(false);
	});

	it("invokes options.successMessage with the returned data and shows it via Notice", async () => {
		const successMessage = vi.fn((d: { count: number }) => `Found ${d.count} items`);
		const testFn = vi.fn().mockResolvedValue({ success: true, data: { count: 7 } });
		const { result } = renderHook(() => useConnectionTest<{ count: number }>(testFn, { successMessage }));

		await act(async () => {
			await result.current.runTest();
		});

		expect(successMessage).toHaveBeenCalledWith({ count: 7 });
		expect(NoticeMock).toHaveBeenCalledWith("Found 7 items");
	});

	it("does NOT call successMessage when result.data is undefined", async () => {
		const successMessage = vi.fn(() => "msg");
		const testFn = vi.fn().mockResolvedValue({ success: true });
		const { result } = renderHook(() => useConnectionTest(testFn, { successMessage }));

		await act(async () => {
			await result.current.runTest();
		});

		expect(successMessage).not.toHaveBeenCalled();
		expect(NoticeMock).not.toHaveBeenCalled();
		expect(result.current.testPassed).toBe(true);
		expect(result.current.testData).toBeUndefined();
	});
});

describe("useConnectionTest — failure paths", () => {
	it("shows 'Connection failed: <error>' when result.success is false", async () => {
		const testFn = vi.fn().mockResolvedValue({ success: false, error: "401 Unauthorized" });
		const { result } = renderHook(() => useConnectionTest(testFn));

		await act(async () => {
			await result.current.runTest();
		});

		expect(NoticeMock).toHaveBeenCalledWith("Connection failed: 401 Unauthorized");
		expect(result.current.testPassed).toBe(false);
		expect(result.current.testing).toBe(false);
	});

	it("shows 'Connection failed: Unknown error' when failure has no error message", async () => {
		const testFn = vi.fn().mockResolvedValue({ success: false });
		const { result } = renderHook(() => useConnectionTest(testFn));

		await act(async () => {
			await result.current.runTest();
		});

		expect(NoticeMock).toHaveBeenCalledWith("Connection failed: Unknown error");
	});

	it("a previously-passing test that fails on re-run flips testPassed back to false", async () => {
		const testFn = vi
			.fn()
			.mockResolvedValueOnce({ success: true, data: 1 })
			.mockResolvedValueOnce({ success: false, error: "Timeout" });
		const { result } = renderHook(() => useConnectionTest<number>(testFn));

		await act(async () => {
			await result.current.runTest();
		});
		expect(result.current.testPassed).toBe(true);

		await act(async () => {
			await result.current.runTest();
		});
		expect(result.current.testPassed).toBe(false);
	});

	it("a thrown exception inside testFn is converted into a Notice and leaves testPassed=false", async () => {
		const testFn = vi.fn().mockRejectedValue(new Error("Network down"));
		const { result } = renderHook(() => useConnectionTest(testFn));

		await act(async () => {
			await result.current.runTest();
		});

		expect(NoticeMock).toHaveBeenCalledWith(expect.stringContaining("Connection failed:"));
		expect(NoticeMock).toHaveBeenCalledWith(expect.stringContaining("Network down"));
		expect(result.current.testPassed).toBe(false);
		expect(result.current.testing).toBe(false);
	});
});

describe("useConnectionTest — testing flag transitions", () => {
	it("testing flips to true while runTest is pending and back to false after settle", async () => {
		let resolveTest: (v: { success: boolean }) => void = () => {};
		const testFn = vi.fn(
			() =>
				new Promise<{ success: boolean }>((resolve) => {
					resolveTest = resolve;
				})
		);
		const { result } = renderHook(() => useConnectionTest(testFn));

		let runPromise: Promise<void> | undefined;
		act(() => {
			runPromise = result.current.runTest();
		});

		await waitFor(() => {
			expect(result.current.testing).toBe(true);
		});

		await act(async () => {
			resolveTest({ success: true });
			await runPromise;
		});

		expect(result.current.testing).toBe(false);
	});
});
