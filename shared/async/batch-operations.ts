import { Notice } from "obsidian";

/**
 * Runs a batch operation on a collection of items with error handling and optional result notification.
 */
export async function runBatchOperation<T>(
	items: T[],
	operationLabel: string,
	handler: (item: T) => Promise<void>,
	showResult: boolean = true
): Promise<{ successCount: number; errorCount: number }> {
	let successCount = 0;
	let errorCount = 0;

	for (const item of items) {
		try {
			await handler(item);
			successCount++;
		} catch (error) {
			console.error(`${operationLabel}: error processing item:`, error);
			errorCount++;
		}
	}

	if (showResult) {
		if (errorCount === 0) {
			new Notice(`${operationLabel}: ${successCount} item${successCount === 1 ? "" : "s"} processed successfully`);
		} else {
			new Notice(`${operationLabel}: ${successCount} succeeded, ${errorCount} failed. Check console for details.`);
		}
	}

	return { successCount, errorCount };
}

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
