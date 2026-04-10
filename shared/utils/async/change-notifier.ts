import { Subject, type Subscription } from "rxjs";

/**
 * Base class that provides observable change notification capabilities.
 * Eliminates boilerplate for classes that need to notify observers of state changes.
 */
export abstract class ChangeNotifier {
	private changeSubject = new Subject<void>();
	public readonly changes$ = this.changeSubject.asObservable();

	protected notifyChange(): void {
		try {
			this.changeSubject.next();
		} catch (error) {
			console.error("Error notifying change:", error);
		}
	}

	subscribe(observer: () => void): Subscription {
		return this.changes$.subscribe(observer);
	}

	destroy(): void {
		this.changeSubject.complete();
	}
}
