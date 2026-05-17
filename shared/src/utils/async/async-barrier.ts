import { BehaviorSubject, filter, firstValueFrom, type Observable } from "rxjs";

/**
 * Quiescence barrier for fire-and-forget async work.
 *
 * Patterned after Go's `sync.WaitGroup` / Java's `Phaser` / .NET's `CountdownEvent`
 * — a counter that's incremented when work starts and decremented when it settles,
 * with a `waitUntilSettled()` operation that resolves once the counter drains to
 * zero. Unlike a single-shot latch, the barrier is reusable: new work can be
 * tracked after a prior wait resolves.
 *
 * The classic use case: a producer wants to signal "all done" but its consumers
 * have async handlers running in parallel. Without coordination, the "all done"
 * signal fires while handlers are still awaiting. Have each handler `track()`
 * its promise; the producer `await`s `waitUntilSettled()` before signaling.
 *
 * Implementation: a BehaviorSubject so the count is observable. `firstValueFrom`
 * with a `filter(c => c === 0)` resolves the moment the count reaches zero —
 * and resolves immediately on subscribe when the count is already zero, so the
 * wait is deadlock-free regardless of timing.
 *
 * The `while` loop in `waitUntilSettled` handles re-entrant work: a tracked
 * handler can itself trigger new tracked work, momentarily dropping the count
 * to zero before bumping it back up. The loop catches that.
 *
 * @example
 * const barrier = new AsyncBarrier();
 *
 * // Each handler tracks its work:
 * source$.subscribe(event => {
 *   barrier.track(handler(event));
 * });
 *
 * // Producer waits for all in-flight work before signaling:
 * await barrier.waitUntilSettled();
 * readySubject.next(true);
 */
export class AsyncBarrier {
	private readonly counter = new BehaviorSubject<number>(0);

	/** Current count of in-flight tracked promises. Primarily for diagnostics. */
	get inFlight(): number {
		return this.counter.value;
	}

	/** Observable view of the in-flight counter. Primarily for diagnostics. */
	get inFlight$(): Observable<number> {
		return this.counter.asObservable();
	}

	/**
	 * Register a promise with the barrier. Increments the counter synchronously
	 * and decrements when the promise settles (resolves OR rejects — rejections
	 * are swallowed at the counter level; attach your own `.catch` to observe them).
	 *
	 * Returns the same promise unchanged so the call can be inlined:
	 * `barrier.track(doWork())` or `const result = await barrier.track(doWork())`.
	 */
	track<T>(work: Promise<T>): Promise<T> {
		this.counter.next(this.counter.value + 1);
		void work
			.catch(() => {
				/* don't unhandled-reject the original promise; caller's .catch is authoritative */
			})
			.finally(() => {
				this.counter.next(this.counter.value - 1);
			});
		return work;
	}

	/**
	 * Resolves once no tracked work is in flight. Loops to absorb work that
	 * arrives during the wait — relevant when tracked handlers themselves
	 * schedule further tracked work.
	 *
	 * Resolves immediately if the counter is already zero at call time.
	 */
	async waitUntilSettled(): Promise<void> {
		while (this.counter.value > 0) {
			await firstValueFrom(this.counter.pipe(filter((c) => c === 0)));
		}
	}
}
