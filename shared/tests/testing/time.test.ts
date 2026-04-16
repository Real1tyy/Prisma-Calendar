import { describe, expect, it, vi } from "vitest";

import { advanceDebounce, advanceTimersAndFlush, pinDateNow, withFakeTimers } from "../../src/testing/time";

describe("withFakeTimers", () => {
	it("should enable fake timers during execution", async () => {
		await withFakeTimers(() => {
			const spy = vi.fn();
			setTimeout(spy, 1000);

			expect(spy).not.toHaveBeenCalled();
			vi.advanceTimersByTime(1000);
			expect(spy).toHaveBeenCalledOnce();
		});
	});

	it("should restore real timers after execution", async () => {
		await withFakeTimers(() => {
			// fake timers active
		});

		const before = Date.now();
		expect(before).toBeGreaterThan(0);
	});

	it("should restore real timers even if the function throws", async () => {
		await expect(
			withFakeTimers(() => {
				throw new Error("boom");
			})
		).rejects.toThrow("boom");

		const now = Date.now();
		expect(now).toBeGreaterThan(0);
	});
});

describe("advanceDebounce", () => {
	it("should advance by 300ms by default", async () => {
		await withFakeTimers(() => {
			const spy = vi.fn();
			setTimeout(spy, 300);
			advanceDebounce();
			expect(spy).toHaveBeenCalledOnce();
		});
	});

	it("should advance by custom amount", async () => {
		await withFakeTimers(() => {
			const spy = vi.fn();
			setTimeout(spy, 500);
			advanceDebounce(500);
			expect(spy).toHaveBeenCalledOnce();
		});
	});
});

describe("advanceTimersAndFlush", () => {
	it("should advance timers and flush microtasks", async () => {
		await withFakeTimers(async () => {
			const order: string[] = [];

			setTimeout(() => {
				order.push("timer");
				void Promise.resolve().then(() => order.push("microtask"));
			}, 100);

			await advanceTimersAndFlush(100);

			expect(order).toEqual(["timer", "microtask"]);
		});
	});
});

describe("pinDateNow", () => {
	it("should pin Date.now() to the given date", () => {
		const target = new Date("2026-03-15T10:00:00");
		const cleanup = pinDateNow(target);

		try {
			expect(Date.now()).toBe(target.getTime());
			expect(new Date().getTime()).toBe(target.getTime());
		} finally {
			cleanup();
		}
	});

	it("should restore real time after cleanup", () => {
		const target = new Date("2026-01-01T00:00:00");
		const cleanup = pinDateNow(target);
		cleanup();

		expect(Date.now()).not.toBe(target.getTime());
	});
});
