/**
 * Creates a function that ensures an async operation runs only once,
 * returning the same promise for concurrent calls.
 *
 * Useful for initialization patterns where you want to ensure
 * expensive async operations (like indexing, API calls, etc.)
 * only happen once even if called multiple times.
 *
 * @param fn The async function to memoize
 * @returns A function that returns the same promise on subsequent calls
 *
 * @example
 * ```typescript
 * const initializeOnce = onceAsync(async () => {
 *   await heavyInitialization();
 *   console.log("Initialized!");
 * });
 *
 * // All these calls will share the same promise
 * await initializeOnce();
 * await initializeOnce(); // Won't run again
 * await initializeOnce(); // Won't run again
 * ```
 */
export function onceAsync<T>(fn: () => Promise<T>): () => Promise<T> {
	let promise: Promise<T> | null = null;

	return () => {
		if (!promise) {
			try {
				promise = fn();
			} catch (error) {
				// Convert synchronous errors to rejected promises
				promise = Promise.reject(error);
			}
		}
		return promise;
	};
}
