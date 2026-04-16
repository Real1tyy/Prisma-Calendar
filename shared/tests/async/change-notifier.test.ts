import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChangeNotifier } from "../../src/utils/async/change-notifier";

// Test implementation of ChangeNotifier
class TestNotifier extends ChangeNotifier {
	private value = 0;

	getValue(): number {
		return this.value;
	}

	setValue(newValue: number): void {
		this.value = newValue;
		this.notifyChange();
	}

	setValueSilently(newValue: number): void {
		this.value = newValue;
	}

	// Expose protected method for testing
	triggerNotification(): void {
		this.notifyChange();
	}
}

describe("ChangeNotifier", () => {
	let notifier: TestNotifier;

	beforeEach(() => {
		notifier = new TestNotifier();
	});

	afterEach(() => {
		notifier.destroy();
	});

	describe("basic subscription", () => {
		it("should notify subscribers when change occurs", () => {
			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.setValue(42);

			expect(observer).toHaveBeenCalledTimes(1);
		});

		it("should notify multiple subscribers", () => {
			const observer1 = vi.fn();
			const observer2 = vi.fn();
			const observer3 = vi.fn();

			notifier.subscribe(observer1);
			notifier.subscribe(observer2);
			notifier.subscribe(observer3);

			notifier.setValue(100);

			expect(observer1).toHaveBeenCalledTimes(1);
			expect(observer2).toHaveBeenCalledTimes(1);
			expect(observer3).toHaveBeenCalledTimes(1);
		});

		it("should not notify when no change is triggered", () => {
			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.setValueSilently(42);

			expect(observer).not.toHaveBeenCalled();
		});
	});

	describe("multiple notifications", () => {
		it("should notify for each change", () => {
			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.setValue(1);
			notifier.setValue(2);
			notifier.setValue(3);

			expect(observer).toHaveBeenCalledTimes(3);
		});

		it("should track state correctly across multiple changes", () => {
			const values: number[] = [];
			notifier.subscribe(() => {
				values.push(notifier.getValue());
			});

			notifier.setValue(10);
			notifier.setValue(20);
			notifier.setValue(30);

			expect(values).toEqual([10, 20, 30]);
		});
	});

	describe("subscription management", () => {
		it("should allow unsubscribing", () => {
			const observer = vi.fn();
			const subscription = notifier.subscribe(observer);

			notifier.setValue(1);
			expect(observer).toHaveBeenCalledTimes(1);

			subscription.unsubscribe();

			notifier.setValue(2);
			expect(observer).toHaveBeenCalledTimes(1); // Still 1, not called again
		});

		it("should handle multiple subscriptions and unsubscriptions independently", () => {
			const observer1 = vi.fn();
			const observer2 = vi.fn();

			const sub1 = notifier.subscribe(observer1);
			notifier.subscribe(observer2);

			notifier.setValue(1);
			expect(observer1).toHaveBeenCalledTimes(1);
			expect(observer2).toHaveBeenCalledTimes(1);

			sub1.unsubscribe();

			notifier.setValue(2);
			expect(observer1).toHaveBeenCalledTimes(1); // Not called
			expect(observer2).toHaveBeenCalledTimes(2); // Called again
		});
	});

	describe("destroy", () => {
		it("should complete the observable on destroy", () => {
			const observer = vi.fn();
			const completeHandler = vi.fn();

			notifier.changes$.subscribe({
				next: observer,
				complete: completeHandler,
			});

			notifier.setValue(1);
			expect(observer).toHaveBeenCalledTimes(1);

			notifier.destroy();
			expect(completeHandler).toHaveBeenCalledTimes(1);

			notifier.triggerNotification();
			expect(observer).toHaveBeenCalledTimes(1); // Not called after destroy
		});

		it("should not notify after destroy", () => {
			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.destroy();
			notifier.triggerNotification();

			expect(observer).not.toHaveBeenCalled();
		});
	});

	describe("observable access", () => {
		it("should expose changes$ as observable", () => {
			expect(notifier.changes$).toBeDefined();
			expect(typeof notifier.changes$.subscribe).toBe("function");
		});

		it("should allow direct observable subscription", () => {
			const observer = vi.fn();
			const subscription = notifier.changes$.subscribe(observer);

			notifier.setValue(42);
			expect(observer).toHaveBeenCalledTimes(1);

			subscription.unsubscribe();
		});
	});

	describe("independent subscriptions", () => {
		it("should allow multiple independent notifiers", () => {
			const notifier1 = new TestNotifier();
			const notifier2 = new TestNotifier();

			const observer1 = vi.fn();
			const observer2 = vi.fn();

			notifier1.subscribe(observer1);
			notifier2.subscribe(observer2);

			notifier1.setValue(1);
			expect(observer1).toHaveBeenCalledTimes(1);
			expect(observer2).not.toHaveBeenCalled();

			notifier2.setValue(2);
			expect(observer1).toHaveBeenCalledTimes(1);
			expect(observer2).toHaveBeenCalledTimes(1);

			notifier1.destroy();
			notifier2.destroy();
		});

		it("should not interfere between different instances", () => {
			const notifier1 = new TestNotifier();
			const notifier2 = new TestNotifier();
			const notifier3 = new TestNotifier();

			const values: number[] = [];

			notifier1.subscribe(() => values.push(1));
			notifier2.subscribe(() => values.push(2));
			notifier3.subscribe(() => values.push(3));

			notifier2.setValue(100);
			expect(values).toEqual([2]);

			notifier1.setValue(200);
			expect(values).toEqual([2, 1]);

			notifier3.setValue(300);
			expect(values).toEqual([2, 1, 3]);

			notifier1.destroy();
			notifier2.destroy();
			notifier3.destroy();
		});
	});

	describe("real-world usage patterns", () => {
		it("should support state management pattern", () => {
			class Counter extends ChangeNotifier {
				private count = 0;

				increment(): void {
					this.count++;
					this.notifyChange();
				}

				decrement(): void {
					this.count--;
					this.notifyChange();
				}

				getCount(): number {
					return this.count;
				}
			}

			const counter = new Counter();
			const values: number[] = [];

			counter.subscribe(() => {
				values.push(counter.getCount());
			});

			counter.increment();
			counter.increment();
			counter.decrement();
			counter.increment();

			expect(values).toEqual([1, 2, 1, 2]);

			counter.destroy();
		});

		it("should support conditional notifications", () => {
			class SmartNotifier extends ChangeNotifier {
				private value = 0;

				setValue(newValue: number, notify = true): void {
					const changed = this.value !== newValue;
					this.value = newValue;

					if (notify && changed) {
						this.notifyChange();
					}
				}

				getValue(): number {
					return this.value;
				}
			}

			const notifier = new SmartNotifier();
			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.setValue(10);
			expect(observer).toHaveBeenCalledTimes(1);

			notifier.setValue(10); // Same value, should still notify
			expect(observer).toHaveBeenCalledTimes(1);

			notifier.setValue(20);
			expect(observer).toHaveBeenCalledTimes(2);

			notifier.setValue(30, false); // Explicitly no notification
			expect(observer).toHaveBeenCalledTimes(2);

			notifier.destroy();
		});
	});
});
