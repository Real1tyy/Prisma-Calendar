import { describe, expect, it } from "vitest";

import { PromiseQueue } from "../../src/utils/async/promise-queue";

/**
 * A test promise paired with a release handle. Lets a test enqueue a job
 * whose body waits on a manually-controlled gate, so we can observe queue
 * state at each step before letting the job complete.
 */
function gated<T = void>(): {
	promise: Promise<T>;
	release: (value: T) => void;
	reject: (err: unknown) => void;
} {
	let release!: (value: T) => void;
	let reject!: (err: unknown) => void;
	const promise = new Promise<T>((resolve, rej) => {
		release = resolve;
		reject = rej;
	});
	return { promise, release, reject };
}

/**
 * `await Promise.resolve()` yields to the microtask queue. Several places in
 * the suite need to flush a handful of microtasks before observing state —
 * `inFlight.catch().then(work)` is a 2-microtask chain, plus the test's own
 * `.then(() => settled = true)` adds one more. Six flushes is more than
 * enough headroom without falling back to fake timers.
 */
async function flushMicrotasks(): Promise<void> {
	for (let i = 0; i < 6; i++) await Promise.resolve();
}

describe("PromiseQueue", () => {
	describe("enqueue — ordering", () => {
		it("runs a single job to completion and resolves with its value", async () => {
			const queue = new PromiseQueue();

			const result = await queue.enqueue(async () => 42);

			expect(result).toBe(42);
		});

		it("starts the next job only after the previous one settles (FIFO)", async () => {
			const queue = new PromiseQueue();
			const first = gated();
			const order: string[] = [];

			const a = queue.enqueue(async () => {
				order.push("a:start");
				await first.promise;
				order.push("a:end");
			});

			const b = queue.enqueue(async () => {
				order.push("b:start");
			});

			// `a` is running; `b` was queued synchronously but must not have started.
			await flushMicrotasks();
			expect(order).toEqual(["a:start"]);

			first.release();
			await Promise.all([a, b]);

			expect(order).toEqual(["a:start", "a:end", "b:start"]);
		});

		it("preserves FIFO across many concurrently-enqueued jobs", async () => {
			const queue = new PromiseQueue();
			const order: number[] = [];

			const jobs: Promise<void>[] = [];
			for (let i = 0; i < 10; i++) {
				jobs.push(
					queue.enqueue(async () => {
						await Promise.resolve();
						order.push(i);
					})
				);
			}

			await Promise.all(jobs);

			expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
		});

		it("returns a distinct promise per enqueued job", () => {
			const queue = new PromiseQueue();

			const a = queue.enqueue(async () => "a");
			const b = queue.enqueue(async () => "b");

			expect(a).not.toBe(b);
		});
	});

	describe("enqueue — error isolation", () => {
		it("surfaces a job's rejection to its caller", async () => {
			const queue = new PromiseQueue();

			await expect(
				queue.enqueue(async () => {
					throw new Error("boom");
				})
			).rejects.toThrow("boom");
		});

		it("does not poison the queue after a failed job", async () => {
			const queue = new PromiseQueue();

			const failed = queue.enqueue(async () => {
				throw new Error("boom");
			});
			await expect(failed).rejects.toThrow("boom");

			const after = await queue.enqueue(async () => "ok");

			expect(after).toBe("ok");
		});

		it("waits for a failed job to settle before starting the next (still FIFO)", async () => {
			const queue = new PromiseQueue();
			const first = gated();
			const order: string[] = [];

			const a = queue.enqueue(async () => {
				order.push("a:start");
				await first.promise;
				order.push("a:reject");
				throw new Error("boom");
			});

			const b = queue.enqueue(async () => {
				order.push("b:start");
			});

			await flushMicrotasks();
			expect(order).toEqual(["a:start"]);

			first.release();
			await Promise.allSettled([a, b]);

			expect(order).toEqual(["a:start", "a:reject", "b:start"]);
		});
	});

	describe("whenIdle", () => {
		it("resolves immediately when the queue has never been used", async () => {
			const queue = new PromiseQueue();
			let resolved = false;

			await queue.whenIdle().then(() => {
				resolved = true;
			});

			expect(resolved).toBe(true);
		});

		it("waits until the in-flight job settles", async () => {
			const queue = new PromiseQueue();
			const first = gated();
			void queue.enqueue(() => first.promise);

			let resolved = false;
			const idle = queue.whenIdle().then(() => {
				resolved = true;
			});

			await flushMicrotasks();
			expect(resolved).toBe(false);

			first.release();
			await idle;

			expect(resolved).toBe(true);
		});

		it("waits for every queued job, not just the head", async () => {
			const queue = new PromiseQueue();
			const a = gated();
			const b = gated();
			const c = gated();

			void queue.enqueue(() => a.promise);
			void queue.enqueue(() => b.promise);
			void queue.enqueue(() => c.promise);

			let resolved = false;
			const idle = queue.whenIdle().then(() => {
				resolved = true;
			});

			a.release();
			await flushMicrotasks();
			expect(resolved).toBe(false);

			b.release();
			await flushMicrotasks();
			expect(resolved).toBe(false);

			c.release();
			await idle;

			expect(resolved).toBe(true);
		});

		// Critical: if a running job enqueues more work, whenIdle() must absorb
		// it. The do/while loop in the implementation exists precisely for this
		// case — without it, whenIdle() would resolve the moment the originally-
		// observed tail settled, even though the queue is busy again.
		it("absorbs work enqueued by a running job", async () => {
			const queue = new PromiseQueue();
			const first = gated();
			const second = gated();

			void queue.enqueue(async () => {
				await first.promise;
				// Enqueue more work from inside the first job. Not awaiting it —
				// the second job runs on its own; we just want whenIdle() to wait
				// for both.
				void queue.enqueue(() => second.promise);
			});

			let resolved = false;
			const idle = queue.whenIdle().then(() => {
				resolved = true;
			});

			first.release();
			await flushMicrotasks();
			expect(resolved).toBe(false);

			second.release();
			await idle;

			expect(resolved).toBe(true);
		});

		it("resolves cleanly even when the only queued job rejects", async () => {
			const queue = new PromiseQueue();

			const failed = queue.enqueue(async () => {
				throw new Error("boom");
			});
			failed.catch(() => undefined);

			await expect(queue.whenIdle()).resolves.toBeUndefined();
		});
	});
});
