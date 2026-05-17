import { describe, expect, it } from "vitest";

import { AsyncBarrier } from "../../src/utils/async/async-barrier";

/**
 * A test promise paired with a release handle. Lets a test register pending
 * work with the barrier and control exactly when it settles, so we can assert
 * the barrier's state at every step.
 */
function gated(): { promise: Promise<void>; release: () => void; reject: (err: unknown) => void } {
	let release!: () => void;
	let reject!: (err: unknown) => void;
	const promise = new Promise<void>((resolve, rej) => {
		release = resolve;
		reject = rej;
	});
	return { promise, release, reject };
}

describe("AsyncBarrier", () => {
	describe("counter", () => {
		it("starts at zero in-flight", () => {
			const barrier = new AsyncBarrier();
			expect(barrier.inFlight).toBe(0);
		});

		it("increments synchronously when a promise is tracked", () => {
			const barrier = new AsyncBarrier();
			const { promise, release } = gated();

			barrier.track(promise);

			expect(barrier.inFlight).toBe(1);
			release();
		});

		it("decrements after a tracked promise resolves", async () => {
			const barrier = new AsyncBarrier();
			const { promise, release } = gated();

			barrier.track(promise);
			expect(barrier.inFlight).toBe(1);

			release();
			await promise;
			// .finally schedules a microtask — let it run.
			await Promise.resolve();

			expect(barrier.inFlight).toBe(0);
		});

		it("decrements after a tracked promise rejects", async () => {
			const barrier = new AsyncBarrier();
			const { promise, reject } = gated();

			barrier.track(promise.catch(() => undefined));
			expect(barrier.inFlight).toBe(1);

			reject(new Error("boom"));
			await promise.catch(() => undefined);
			await Promise.resolve();

			expect(barrier.inFlight).toBe(0);
		});

		it("tracks multiple concurrent promises independently", () => {
			const barrier = new AsyncBarrier();
			const a = gated();
			const b = gated();
			const c = gated();

			barrier.track(a.promise);
			barrier.track(b.promise);
			barrier.track(c.promise);

			expect(barrier.inFlight).toBe(3);

			a.release();
			b.release();
			c.release();
		});

		it("returns the same promise reference passed in", () => {
			const barrier = new AsyncBarrier();
			const { promise, release } = gated();

			const returned = barrier.track(promise);

			expect(returned).toBe(promise);
			release();
		});
	});

	describe("waitUntilSettled", () => {
		it("resolves immediately when no work is in flight", async () => {
			const barrier = new AsyncBarrier();
			let resolved = false;

			await barrier.waitUntilSettled().then(() => {
				resolved = true;
			});

			expect(resolved).toBe(true);
		});

		it("waits until the tracked promise settles", async () => {
			const barrier = new AsyncBarrier();
			const { promise, release } = gated();
			barrier.track(promise);

			let resolved = false;
			const waiting = barrier.waitUntilSettled().then(() => {
				resolved = true;
			});

			// Microtasks have run; the wait must still be pending.
			await Promise.resolve();
			await Promise.resolve();
			expect(resolved).toBe(false);

			release();
			await waiting;

			expect(resolved).toBe(true);
			expect(barrier.inFlight).toBe(0);
		});

		it("waits for ALL tracked promises, not just the first", async () => {
			const barrier = new AsyncBarrier();
			const a = gated();
			const b = gated();
			const c = gated();

			barrier.track(a.promise);
			barrier.track(b.promise);
			barrier.track(c.promise);

			let resolved = false;
			const waiting = barrier.waitUntilSettled().then(() => {
				resolved = true;
			});

			a.release();
			await a.promise;
			await Promise.resolve();
			expect(resolved).toBe(false);

			b.release();
			await b.promise;
			await Promise.resolve();
			expect(resolved).toBe(false);

			c.release();
			await waiting;

			expect(resolved).toBe(true);
		});

		// Critical: this is the quiescence property — work scheduled BY a tracked
		// handler must also be awaited. Without it, the barrier would "false-fire"
		// the moment the first round of work drained, even though more was queued.
		//
		// Models the real-world pattern: `first` is a tracked row-build that emits
		// an event during its execution; the event handler kicks off `second` and
		// tracks it independently — first does NOT await second.
		it("absorbs re-entrant work scheduled by a settling promise", async () => {
			const barrier = new AsyncBarrier();
			const first = gated();
			const second = gated();

			// Fire-and-forget enqueue inside first's resolution. Note the explicit
			// `return undefined` semantics: we do NOT propagate `second` up through
			// the chain — first resolves independently.
			const firstChain = first.promise.then(() => {
				barrier.track(second.promise);
			});
			barrier.track(firstChain);

			let resolved = false;
			const waiting = barrier.waitUntilSettled().then(() => {
				resolved = true;
			});

			first.release();
			await firstChain;
			// barrier's internal `.catch().finally()` chain settles one microtask
			// after firstChain itself — yield to let the decrement happen.
			await Promise.resolve();
			// firstChain settled, but `second` was tracked during its `.then` —
			// barrier must still be holding for second.
			expect(resolved).toBe(false);
			expect(barrier.inFlight).toBe(1);

			second.release();
			await waiting;
			expect(resolved).toBe(true);
		});

		it("supports multiple concurrent waiters — all resolve at the same drain", async () => {
			const barrier = new AsyncBarrier();
			const { promise, release } = gated();
			barrier.track(promise);

			const resolved = [false, false, false];
			const waits = [
				barrier.waitUntilSettled().then(() => (resolved[0] = true)),
				barrier.waitUntilSettled().then(() => (resolved[1] = true)),
				barrier.waitUntilSettled().then(() => (resolved[2] = true)),
			];

			await Promise.resolve();
			expect(resolved).toEqual([false, false, false]);

			release();
			await Promise.all(waits);

			expect(resolved).toEqual([true, true, true]);
		});

		it("is reusable across multiple settle cycles", async () => {
			const barrier = new AsyncBarrier();

			// Cycle 1
			const a = gated();
			barrier.track(a.promise);
			a.release();
			await barrier.waitUntilSettled();
			expect(barrier.inFlight).toBe(0);

			// Cycle 2 — new work, new wait
			const b = gated();
			barrier.track(b.promise);
			expect(barrier.inFlight).toBe(1);
			b.release();
			await barrier.waitUntilSettled();
			expect(barrier.inFlight).toBe(0);
		});
	});

	describe("inFlight$ observable", () => {
		it("emits the current count on subscribe and on every change", async () => {
			const barrier = new AsyncBarrier();
			const seen: number[] = [];
			const sub = barrier.inFlight$.subscribe((c) => seen.push(c));

			const { promise, release } = gated();
			barrier.track(promise);
			release();
			await promise;
			await Promise.resolve();

			expect(seen).toEqual([0, 1, 0]);
			sub.unsubscribe();
		});
	});
});
