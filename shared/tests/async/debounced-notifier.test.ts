import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DebouncedNotifier } from "../../src/utils/async/debounced-notifier";

// Test implementation of DebouncedNotifier
class TestDebouncedNotifier extends DebouncedNotifier {
	private value = 0;

	getValue(): number {
		return this.value;
	}

	setValue(newValue: number): void {
		this.value = newValue;
		this.scheduleRefresh();
	}

	batchSetValues(...values: number[]): void {
		for (const value of values) {
			this.value = value;
			this.scheduleRefresh();
		}
		this.flushPendingRefresh();
	}

	// Expose protected methods for testing
	public testScheduleRefresh(): void {
		this.scheduleRefresh();
	}

	public testFlushPendingRefresh(): void {
		this.flushPendingRefresh();
	}

	public testHasPendingRefresh(): boolean {
		return this.hasPendingRefresh();
	}
}

describe("DebouncedNotifier", () => {
	let notifier: TestDebouncedNotifier;

	beforeEach(() => {
		vi.useFakeTimers();
		notifier = new TestDebouncedNotifier(100);
	});

	afterEach(() => {
		notifier.destroy();
		vi.useRealTimers();
	});

	describe("basic debouncing", () => {
		it("should debounce notifications", () => {
			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.setValue(1);
			expect(observer).not.toHaveBeenCalled();

			vi.advanceTimersByTime(100);
			expect(observer).toHaveBeenCalledTimes(1);
		});

		it("should use custom debounce time", () => {
			notifier.destroy();
			notifier = new TestDebouncedNotifier(200);

			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.setValue(1);
			vi.advanceTimersByTime(100);
			expect(observer).not.toHaveBeenCalled();

			vi.advanceTimersByTime(100);
			expect(observer).toHaveBeenCalledTimes(1);
		});

		it("should use default debounce time of 150ms", () => {
			notifier.destroy();
			notifier = new TestDebouncedNotifier();

			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.setValue(1);
			vi.advanceTimersByTime(149);
			expect(observer).not.toHaveBeenCalled();

			vi.advanceTimersByTime(1);
			expect(observer).toHaveBeenCalledTimes(1);
		});
	});

	describe("debounce batching", () => {
		it("should batch multiple rapid changes into single notification", () => {
			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.setValue(1);
			notifier.setValue(2);
			notifier.setValue(3);
			notifier.setValue(4);
			notifier.setValue(5);

			expect(observer).not.toHaveBeenCalled();

			vi.advanceTimersByTime(100);
			expect(observer).toHaveBeenCalledTimes(1);
			expect(notifier.getValue()).toBe(5);
		});

		it("should reset debounce timer on each change", () => {
			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.setValue(1);
			vi.advanceTimersByTime(50);

			notifier.setValue(2);
			vi.advanceTimersByTime(50);
			expect(observer).not.toHaveBeenCalled();

			notifier.setValue(3);
			vi.advanceTimersByTime(50);
			expect(observer).not.toHaveBeenCalled();

			vi.advanceTimersByTime(50);
			expect(observer).toHaveBeenCalledTimes(1);
		});

		it("should allow multiple debounced notifications over time", () => {
			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.setValue(1);
			vi.advanceTimersByTime(100);
			expect(observer).toHaveBeenCalledTimes(1);

			notifier.setValue(2);
			vi.advanceTimersByTime(100);
			expect(observer).toHaveBeenCalledTimes(2);

			notifier.setValue(3);
			vi.advanceTimersByTime(100);
			expect(observer).toHaveBeenCalledTimes(3);
		});
	});

	describe("flushPendingRefresh", () => {
		it("should immediately notify if pending refresh exists", () => {
			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.setValue(1);
			expect(observer).not.toHaveBeenCalled();

			notifier.testFlushPendingRefresh();
			expect(observer).toHaveBeenCalledTimes(1);
		});

		it("should do nothing if no pending refresh", () => {
			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.testFlushPendingRefresh();
			expect(observer).not.toHaveBeenCalled();
		});

		it("should cancel debounce timer when flushing", () => {
			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.setValue(1);
			notifier.testFlushPendingRefresh();
			expect(observer).toHaveBeenCalledTimes(1);

			vi.advanceTimersByTime(100);
			expect(observer).toHaveBeenCalledTimes(1); // Not called again
		});

		it("should support batch operations pattern", () => {
			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.batchSetValues(1, 2, 3, 4, 5);
			expect(observer).toHaveBeenCalledTimes(1);
			expect(notifier.getValue()).toBe(5);

			vi.advanceTimersByTime(100);
			expect(observer).toHaveBeenCalledTimes(1); // Still 1
		});
	});

	describe("hasPendingRefresh", () => {
		it("should return true when refresh is pending", () => {
			notifier.setValue(1);
			expect(notifier.testHasPendingRefresh()).toBe(true);
		});

		it("should return false when no refresh is pending", () => {
			expect(notifier.testHasPendingRefresh()).toBe(false);
		});

		it("should return false after debounce completes", () => {
			notifier.setValue(1);
			expect(notifier.testHasPendingRefresh()).toBe(true);

			vi.advanceTimersByTime(100);
			expect(notifier.testHasPendingRefresh()).toBe(false);
		});

		it("should return false after flush", () => {
			notifier.setValue(1);
			expect(notifier.testHasPendingRefresh()).toBe(true);

			notifier.testFlushPendingRefresh();
			expect(notifier.testHasPendingRefresh()).toBe(false);
		});
	});

	describe("destroy", () => {
		it("should clear pending refresh on destroy", () => {
			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.setValue(1);
			expect(notifier.testHasPendingRefresh()).toBe(true);

			notifier.destroy();
			expect(notifier.testHasPendingRefresh()).toBe(false);

			vi.advanceTimersByTime(100);
			expect(observer).not.toHaveBeenCalled();
		});

		it("should complete observable on destroy", () => {
			const observer = vi.fn();
			const completeHandler = vi.fn();

			notifier.changes$.subscribe({
				next: observer,
				complete: completeHandler,
			});

			notifier.setValue(1);
			notifier.destroy();

			expect(completeHandler).toHaveBeenCalledTimes(1);

			vi.advanceTimersByTime(100);
			expect(observer).not.toHaveBeenCalled();
		});

		it("should handle destroy with no pending refresh", () => {
			expect(() => notifier.destroy()).not.toThrow();
		});
	});

	describe("multiple subscribers", () => {
		it("should notify all subscribers on debounced refresh", () => {
			const observer1 = vi.fn();
			const observer2 = vi.fn();
			const observer3 = vi.fn();

			notifier.subscribe(observer1);
			notifier.subscribe(observer2);
			notifier.subscribe(observer3);

			notifier.setValue(42);
			vi.advanceTimersByTime(100);

			expect(observer1).toHaveBeenCalledTimes(1);
			expect(observer2).toHaveBeenCalledTimes(1);
			expect(observer3).toHaveBeenCalledTimes(1);
		});

		it("should notify all subscribers on flush", () => {
			const observer1 = vi.fn();
			const observer2 = vi.fn();

			notifier.subscribe(observer1);
			notifier.subscribe(observer2);

			notifier.setValue(42);
			notifier.testFlushPendingRefresh();

			expect(observer1).toHaveBeenCalledTimes(1);
			expect(observer2).toHaveBeenCalledTimes(1);
		});
	});

	describe("real-world usage patterns", () => {
		it("should support search input debouncing pattern", () => {
			class SearchManager extends DebouncedNotifier {
				private query = "";

				constructor() {
					super(300); // 300ms debounce for search
				}

				setQuery(newQuery: string): void {
					this.query = newQuery;
					this.scheduleRefresh();
				}

				getQuery(): string {
					return this.query;
				}
			}

			const searchManager = new SearchManager();
			const searchHandler = vi.fn();

			searchManager.subscribe(() => {
				searchHandler(searchManager.getQuery());
			});

			// Simulate rapid typing
			searchManager.setQuery("h");
			searchManager.setQuery("he");
			searchManager.setQuery("hel");
			searchManager.setQuery("hell");
			searchManager.setQuery("hello");

			expect(searchHandler).not.toHaveBeenCalled();

			vi.advanceTimersByTime(300);
			expect(searchHandler).toHaveBeenCalledTimes(1);
			expect(searchHandler).toHaveBeenCalledWith("hello");

			searchManager.destroy();
		});

		it("should support file system watcher pattern", () => {
			class FileWatcher extends DebouncedNotifier {
				private changedFiles: string[] = [];

				constructor() {
					super(100);
				}

				fileChanged(path: string): void {
					if (!this.changedFiles.includes(path)) {
						this.changedFiles.push(path);
					}
					this.scheduleRefresh();
				}

				getChangedFiles(): string[] {
					return [...this.changedFiles];
				}

				clearChangedFiles(): void {
					this.changedFiles = [];
				}
			}

			const watcher = new FileWatcher();
			const changeHandler = vi.fn();

			watcher.subscribe(() => {
				const files = watcher.getChangedFiles();
				changeHandler(files);
				watcher.clearChangedFiles();
			});

			// Simulate rapid file changes
			watcher.fileChanged("file1.ts");
			watcher.fileChanged("file2.ts");
			watcher.fileChanged("file1.ts"); // Duplicate
			watcher.fileChanged("file3.ts");

			vi.advanceTimersByTime(100);

			expect(changeHandler).toHaveBeenCalledTimes(1);
			expect(changeHandler).toHaveBeenCalledWith(["file1.ts", "file2.ts", "file3.ts"]);

			watcher.destroy();
		});

		it("should support form auto-save pattern", () => {
			class FormAutoSaver extends DebouncedNotifier {
				private formData: Record<string, string> = {};

				constructor() {
					super(500); // 500ms debounce for auto-save
				}

				updateField(field: string, value: string): void {
					this.formData[field] = value;
					this.scheduleRefresh();
				}

				save(): void {
					// Immediate save without waiting for debounce
					this.flushPendingRefresh();
				}

				getFormData(): Record<string, string> {
					return { ...this.formData };
				}
			}

			const autoSaver = new FormAutoSaver();
			const saveHandler = vi.fn();

			autoSaver.subscribe(() => {
				saveHandler(autoSaver.getFormData());
			});

			// Simulate user typing in multiple fields
			autoSaver.updateField("name", "John");
			autoSaver.updateField("email", "john@");
			autoSaver.updateField("email", "john@example");
			autoSaver.updateField("email", "john@example.com");

			// User hits save button
			autoSaver.save();

			expect(saveHandler).toHaveBeenCalledTimes(1);
			expect(saveHandler).toHaveBeenCalledWith({
				name: "John",
				email: "john@example.com",
			});

			// Timer should be cleared, so advancing time shouldn't trigger another save
			vi.advanceTimersByTime(500);
			expect(saveHandler).toHaveBeenCalledTimes(1);

			autoSaver.destroy();
		});
	});

	describe("edge cases", () => {
		it("should handle zero debounce time", () => {
			notifier.destroy();
			notifier = new TestDebouncedNotifier(0);

			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.setValue(1);
			expect(observer).not.toHaveBeenCalled();

			vi.advanceTimersByTime(0);
			expect(observer).toHaveBeenCalledTimes(1);
		});

		it("should handle very long debounce time", () => {
			notifier.destroy();
			notifier = new TestDebouncedNotifier(10000);

			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.setValue(1);
			vi.advanceTimersByTime(9999);
			expect(observer).not.toHaveBeenCalled();

			vi.advanceTimersByTime(1);
			expect(observer).toHaveBeenCalledTimes(1);
		});

		it("should handle multiple flushes without pending refresh", () => {
			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.testFlushPendingRefresh();
			notifier.testFlushPendingRefresh();
			notifier.testFlushPendingRefresh();

			expect(observer).not.toHaveBeenCalled();
		});

		it("should handle rapid schedule and flush cycles", () => {
			const observer = vi.fn();
			notifier.subscribe(observer);

			notifier.testScheduleRefresh();
			notifier.testFlushPendingRefresh();
			expect(observer).toHaveBeenCalledTimes(1);

			notifier.testScheduleRefresh();
			notifier.testFlushPendingRefresh();
			expect(observer).toHaveBeenCalledTimes(2);

			notifier.testScheduleRefresh();
			notifier.testFlushPendingRefresh();
			expect(observer).toHaveBeenCalledTimes(3);
		});
	});
});
