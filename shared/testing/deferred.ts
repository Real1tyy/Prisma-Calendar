/**
 * Process gate primitives for testing async race conditions.
 *
 * Use these to suspend an async operation mid-flight, mutate state while it's
 * suspended, then release the gate and verify correct behavior.
 *
 * @example
 * ```ts
 * const gate = createDeferredVoid();
 * const firstWrite = propagator.process(fileA); // starts, hits the gate
 * propagator.process(fileA);                    // second write while first is suspended
 * gate.resolve();                               // release first write
 * await firstWrite;
 * // assert no data was clobbered
 * ```
 */

interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (error: Error) => void;
}

interface DeferredVoid {
	promise: Promise<void>;
	resolve: () => void;
	reject: (error: Error) => void;
}

/**
 * Creates a deferred promise that resolves to void.
 * Call `resolve()` to release the gate, or `reject(error)` to fail it.
 */
export function createDeferredVoid(): DeferredVoid {
	let resolve!: () => void;
	let reject!: (error: Error) => void;

	const promise = new Promise<void>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
}

/**
 * Creates a deferred promise that resolves to a typed value.
 * Call `resolve(value)` to release the gate with a value, or `reject(error)` to fail it.
 */
export function createDeferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;

	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
}

export type { Deferred, DeferredVoid };
