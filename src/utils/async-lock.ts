/**
 * Executes an async operation with a lock to prevent concurrent execution for the same key.
 * If a lock already exists for the key, waits for it to complete instead of starting a new operation.
 *
 * @param lockMap - Map storing active locks by key
 * @param key - Unique identifier for the lock
 * @param operation - Async function to execute with the lock
 * @returns Promise resolving to the operation's result
 */
export async function withLock<T>(
	lockMap: Map<string, Promise<T>>,
	key: string,
	operation: () => Promise<T>
): Promise<T> {
	// Check if there's already an operation in progress for this key
	const existingLock = lockMap.get(key);
	if (existingLock) {
		// Wait for the existing operation to complete instead of starting a new one
		return await existingLock;
	}

	// Create a new locked operation
	const lockPromise = operation();
	lockMap.set(key, lockPromise);

	try {
		return await lockPromise;
	} finally {
		// Always remove the lock when done
		lockMap.delete(key);
	}
}
