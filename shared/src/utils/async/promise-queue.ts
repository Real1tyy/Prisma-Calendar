/**
 * Serialized FIFO queue for async work.
 *
 * Patterned after the classic JavaScript "promise chain" lock: a single
 * `inFlight` promise that every enqueued job chains onto so the next job's
 * `work()` never starts until the previous one has settled. Equivalent in
 * spirit to a mutex with implicit ordering — the lock holder is always
 * "whoever's promise is at the tail of the chain."
 *
 * The use case: a class with shared mutable state (a history cursor, an
 * indexer write buffer, a single connection handle) exposes async methods
 * that must not interleave. Without serialization, two near-simultaneous
 * calls can read the same snapshot, mutate, and write back — clobbering
 * each other. Routing every mutating method through {@link enqueue} gives
 * FIFO execution for free.
 *
 * Error isolation is built in: a rejection in one job does not poison the
 * queue. The caller still sees the rejection on the returned promise, but
 * `inFlight` is reset to a resolved chain so the next enqueue starts clean.
 *
 * The {@link whenIdle} helper is for tests and fire-and-forget call sites
 * that need to bridge "work has been queued" to "work has actually settled."
 * Production code that already has a handle on the returned promise from
 * {@link enqueue} should `await` that instead.
 *
 * **Re-entrancy caveat.** Do not call back into the same queue from inside
 * a job's `work` — the nested call enqueues behind the current job and will
 * deadlock waiting for itself. Jobs may mutate domain state freely, but
 * they must not re-enter their owning queue.
 *
 * @example
 * class HistoryManager {
 *   private queue = new PromiseQueue();
 *
 *   commit(entry: Entry): Promise<void> {
 *     return this.queue.enqueue(async () => {
 *       const tip = await this.readTip();
 *       await this.writeTip({ ...tip, entry });
 *     });
 *   }
 *
 *   clear(): Promise<void> {
 *     return this.queue.enqueue(async () => {
 *       await this.writeTip({ entries: [] });
 *     });
 *   }
 * }
 */
export class PromiseQueue {
	private inFlight: Promise<unknown> = Promise.resolve();

	/**
	 * Schedule `work` to run after every previously enqueued job has settled.
	 * Returns a promise that mirrors `work()`'s own resolution — caller still
	 * sees rejections normally. Internal chain state swallows the error so a
	 * failed job does not block subsequent enqueues.
	 *
	 * The `inFlight.catch(...).then(work)` shape (vs. `inFlight.then(work, work)`)
	 * makes the intent explicit: ignore the previous failure for queue ordering,
	 * then run the new job, then expose its result to the caller.
	 */
	enqueue<T>(work: () => Promise<T>): Promise<T> {
		const next = this.inFlight.catch(() => undefined).then(work);
		this.inFlight = next.catch(() => undefined);
		return next;
	}

	/**
	 * Resolves once every queued job has settled. The `do/while` loop absorbs
	 * jobs scheduled while we are awaiting — by the time the most recently
	 * observed tail settles, a new tail may have been appended; the loop
	 * re-reads `inFlight` until it stops changing.
	 *
	 * Resolves immediately when the queue is already idle.
	 */
	async whenIdle(): Promise<void> {
		let last: Promise<unknown>;
		do {
			last = this.inFlight;
			await last.catch(() => undefined);
		} while (last !== this.inFlight);
	}
}
