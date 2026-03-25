interface Destroyable {
	destroy(): void;
}

export class SyncState<TService extends Destroyable> {
	private services: Map<string, TService> = new Map();
	private autoSyncIntervals: Map<string, number> = new Map();
	private syncPromises: Map<string, Promise<void>> = new Map();
	private destroyed = false;

	constructor(private logPrefix: string) {}

	getService(key: string): TService | undefined {
		return this.services.get(key);
	}

	setService(key: string, service: TService): void {
		this.services.set(key, service);
	}

	async sync(id: string, performSync: () => Promise<void>): Promise<void> {
		if (this.destroyed) return;

		const existingSync = this.syncPromises.get(id);
		if (existingSync) {
			console.debug(`[${this.logPrefix}] Sync already in progress for ${id}, reusing promise`);
			return existingSync;
		}

		const syncPromise = performSync();
		this.syncPromises.set(id, syncPromise);

		try {
			await syncPromise;
		} finally {
			this.syncPromises.delete(id);
		}
	}

	startAutoSync(items: { id: string; syncIntervalMinutes: number }[], syncFn: (id: string) => Promise<void>): void {
		if (this.destroyed) return;
		this.stopAutoSync();

		for (const item of items) {
			const intervalMs = item.syncIntervalMinutes * 60 * 1000;

			const intervalId = window.setInterval(() => {
				if ("scheduler" in window && window.scheduler) {
					const scheduler = window.scheduler as {
						postTask: (callback: () => Promise<void>, options?: { priority?: string }) => Promise<void>;
					};
					void scheduler.postTask(() => syncFn(item.id), {
						priority: "background",
					});
				} else {
					void syncFn(item.id);
				}
			}, intervalMs);

			this.autoSyncIntervals.set(item.id, intervalId);
		}
	}

	stopAutoSync(): void {
		for (const intervalId of this.autoSyncIntervals.values()) {
			window.clearInterval(intervalId);
		}
		this.autoSyncIntervals.clear();
	}

	destroy(): void {
		this.destroyed = true;
		this.stopAutoSync();
		this.syncPromises.clear();
		for (const service of this.services.values()) {
			service.destroy();
		}
		this.services.clear();
	}
}
