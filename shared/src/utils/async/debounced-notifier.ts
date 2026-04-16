import { ChangeNotifier } from "./change-notifier";

/**
 * Extends ChangeNotifier with debounced notification capabilities.
 * Prevents excessive notifications when many changes happen rapidly by batching them.
 */
export abstract class DebouncedNotifier extends ChangeNotifier {
	private refreshTimeout: ReturnType<typeof setTimeout> | null = null;
	private readonly debounceMs: number;

	constructor(debounceMs = 150) {
		super();
		this.debounceMs = debounceMs;
	}

	/**
	 * Schedules a debounced refresh to prevent excessive notifications.
	 * Batches rapid changes into a single notification after inactivity period.
	 */
	protected scheduleRefresh(): void {
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
		}
		this.refreshTimeout = setTimeout(() => {
			this.notifyChange();
			this.refreshTimeout = null;
		}, this.debounceMs);
	}

	/**
	 * Flushes any pending debounced refresh and immediately notifies subscribers.
	 * Used after batch operations to ensure immediate updates without waiting for debounce.
	 */
	protected flushPendingRefresh(): void {
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
			this.refreshTimeout = null;
			this.notifyChange();
		}
	}

	/**
	 * Checks if there is a pending debounced refresh scheduled.
	 */
	protected hasPendingRefresh(): boolean {
		return this.refreshTimeout !== null;
	}

	override destroy(): void {
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout);
			this.refreshTimeout = null;
		}
		super.destroy();
	}
}
