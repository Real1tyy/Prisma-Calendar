/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockContentEl: HTMLElement;
let mockModalEl: HTMLElement;
let mockCloseFn: ReturnType<typeof vi.fn>;

vi.mock("obsidian", () => {
	class MockModal {
		contentEl: HTMLElement;
		modalEl: HTMLElement;
		scope: Record<string, unknown>;
		app: { name: string };

		constructor(app: { name: string }) {
			this.app = app;
			this.contentEl = mockContentEl;
			this.modalEl = mockModalEl;
			this.scope = { register: vi.fn() };
		}

		open(): void {
			void (this as any).onOpen();
		}

		close(): void {
			mockCloseFn();
		}

		setTitle(_title: string): void {}
	}

	return { Modal: MockModal };
});

const { showProgressModal } = await import("../../src/components/primitives/progress-modal");

function createMockEl(): HTMLElement {
	const el = document.createElement("div");
	(el as any).addClass = (cls: string) => el.classList.add(cls);
	(el as any).empty = () => {
		el.innerHTML = "";
	};
	(el as any).createEl = (tag: string, opts?: { text?: string }) => {
		const child = document.createElement(tag);
		if (opts?.text) child.textContent = opts.text;
		el.appendChild(child);
		return child;
	};
	(el as any).createDiv = (cls?: string) => {
		const child = document.createElement("div");
		if (cls) child.className = cls;
		(child as any).setText = (t: string) => {
			child.textContent = t;
		};
		(child as any).setCssProps = (props: Record<string, string>) => {
			for (const [k, v] of Object.entries(props)) {
				child.style.setProperty(k, v);
			}
		};
		(child as any).createDiv = (innerCls?: string) => {
			const inner = document.createElement("div");
			if (innerCls) inner.className = innerCls;
			(inner as any).setText = (t: string) => {
				inner.textContent = t;
			};
			(inner as any).setCssProps = (props: Record<string, string>) => {
				for (const [k, v] of Object.entries(props)) {
					inner.style.setProperty(k, v);
				}
			};
			child.appendChild(inner);
			return inner;
		};
		el.appendChild(child);
		return child;
	};
	return el;
}

const DEFAULT_CONFIG = {
	app: { name: "test" } as any,
	cssPrefix: "test-",
	total: 10,
};

describe("showProgressModal", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		mockCloseFn = vi.fn();
		mockContentEl = createMockEl();
		mockModalEl = createMockEl();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function getStatusText(): string {
		return mockContentEl.querySelector(".test-progress-status")?.textContent ?? "";
	}

	function getDetailsText(): string {
		return mockContentEl.querySelector(".test-progress-details")?.textContent ?? "";
	}

	function getBarWidth(): string {
		const bar = mockContentEl.querySelector(".test-progress-bar") as HTMLElement | null;
		return bar?.style.getPropertyValue("width") ?? "";
	}

	function getBarClasses(): DOMTokenList | undefined {
		return (mockContentEl.querySelector(".test-progress-bar") as HTMLElement | null)?.classList;
	}

	describe("initial state", () => {
		it("should render with default title and status", () => {
			showProgressModal(DEFAULT_CONFIG);

			expect(mockContentEl.querySelector("h2")?.textContent).toBe("Processing...");
			expect(getStatusText()).toBe("Processing 0 of 10...");
			expect(getDetailsText()).toBe("Starting...");
		});

		it("should use custom title and status template", () => {
			showProgressModal({
				...DEFAULT_CONFIG,
				title: "Importing events",
				statusTemplate: "Importing {current} of {total} events...",
				initialDetails: "Preparing...",
			});

			expect(mockContentEl.querySelector("h2")?.textContent).toBe("Importing events");
			expect(getStatusText()).toBe("Importing 0 of 10 events...");
			expect(getDetailsText()).toBe("Preparing...");
		});
	});

	describe("updateProgress", () => {
		it("should update status text and bar width", () => {
			const handle = showProgressModal(DEFAULT_CONFIG);

			handle.updateProgress(5);

			expect(getStatusText()).toBe("Processing 5 of 10...");
			expect(getBarWidth()).toBe("50%");
		});

		it("should update detail text when provided", () => {
			const handle = showProgressModal(DEFAULT_CONFIG);

			handle.updateProgress(3, "Processing file.md");

			expect(getDetailsText()).toBe("Processing file.md");
		});

		it("should not change detail text when detail is omitted", () => {
			const handle = showProgressModal(DEFAULT_CONFIG);

			handle.updateProgress(3, "First detail");
			handle.updateProgress(4);

			expect(getDetailsText()).toBe("First detail");
		});

		it("should clamp current below zero to zero", () => {
			const handle = showProgressModal(DEFAULT_CONFIG);

			handle.updateProgress(-5);

			expect(getBarWidth()).toBe("0%");
			expect(getStatusText()).toBe("Processing 0 of 10...");
		});

		it("should clamp current above total to total", () => {
			const handle = showProgressModal(DEFAULT_CONFIG);

			handle.updateProgress(99);

			expect(getBarWidth()).toBe("100%");
			expect(getStatusText()).toBe("Processing 10 of 10...");
		});

		it("should be a no-op after showComplete", () => {
			const handle = showProgressModal(DEFAULT_CONFIG);

			handle.showComplete(["Done"]);
			handle.updateProgress(5, "Should not appear");

			expect(getStatusText()).toBe("Processing complete");
			expect(getDetailsText()).toBe("Done");
		});

		it("should be a no-op after showError", () => {
			const handle = showProgressModal(DEFAULT_CONFIG);

			handle.showError("Something broke");
			handle.updateProgress(5, "Should not appear");

			expect(getStatusText()).toBe("Processing failed");
			expect(getDetailsText()).toBe("Something broke");
		});
	});

	describe("showComplete", () => {
		it("should set bar to 100% with complete class", () => {
			const handle = showProgressModal(DEFAULT_CONFIG);

			handle.showComplete(["5 imported"]);

			expect(getBarWidth()).toBe("100%");
			expect(getBarClasses()?.contains("test-progress-complete")).toBe(true);
		});

		it("should show completion status and join summary lines", () => {
			const handle = showProgressModal(DEFAULT_CONFIG);

			handle.showComplete(["5 imported", "3 skipped", "2 failed"]);

			expect(getStatusText()).toBe("Processing complete");
			expect(getDetailsText()).toBe("5 imported  •  3 skipped  •  2 failed");
		});

		it("should strip trailing ellipsis from title in completion text", () => {
			const handle = showProgressModal({ ...DEFAULT_CONFIG, title: "Syncing..." });

			handle.showComplete(["Done"]);

			expect(getStatusText()).toBe("Syncing complete");
		});

		it("should auto-close after success delay", () => {
			const handle = showProgressModal(DEFAULT_CONFIG);

			handle.showComplete(["Done"]);
			expect(mockCloseFn).not.toHaveBeenCalled();

			vi.advanceTimersByTime(2000);
			expect(mockCloseFn).toHaveBeenCalledOnce();
		});

		it("should respect custom successCloseDelay", () => {
			const handle = showProgressModal({ ...DEFAULT_CONFIG, successCloseDelay: 5000 });

			handle.showComplete(["Done"]);

			vi.advanceTimersByTime(2000);
			expect(mockCloseFn).not.toHaveBeenCalled();

			vi.advanceTimersByTime(3000);
			expect(mockCloseFn).toHaveBeenCalledOnce();
		});

		it("should ignore second call after already complete", () => {
			const handle = showProgressModal(DEFAULT_CONFIG);

			handle.showComplete(["First"]);
			handle.showComplete(["Second"]);

			expect(getDetailsText()).toBe("First");
		});
	});

	describe("showError", () => {
		it("should set bar error class", () => {
			const handle = showProgressModal(DEFAULT_CONFIG);

			handle.showError("Import failed");

			expect(getBarClasses()?.contains("test-progress-error")).toBe(true);
		});

		it("should show failure status and error message", () => {
			const handle = showProgressModal({ ...DEFAULT_CONFIG, title: "Importing..." });

			handle.showError("Network timeout");

			expect(getStatusText()).toBe("Importing failed");
			expect(getDetailsText()).toBe("Network timeout");
		});

		it("should auto-close after error delay", () => {
			const handle = showProgressModal(DEFAULT_CONFIG);

			handle.showError("Oops");
			expect(mockCloseFn).not.toHaveBeenCalled();

			vi.advanceTimersByTime(3000);
			expect(mockCloseFn).toHaveBeenCalledOnce();
		});

		it("should respect custom errorCloseDelay", () => {
			const handle = showProgressModal({ ...DEFAULT_CONFIG, errorCloseDelay: 1000 });

			handle.showError("Oops");

			vi.advanceTimersByTime(1000);
			expect(mockCloseFn).toHaveBeenCalledOnce();
		});

		it("should ignore second call after already complete", () => {
			const handle = showProgressModal(DEFAULT_CONFIG);

			handle.showError("First error");
			handle.showError("Second error");

			expect(getDetailsText()).toBe("First error");
		});
	});

	describe("close", () => {
		it("should close the modal immediately", () => {
			const handle = showProgressModal(DEFAULT_CONFIG);

			handle.close();

			expect(mockCloseFn).toHaveBeenCalledOnce();
		});

		it("should clear pending auto-close timer", () => {
			const handle = showProgressModal(DEFAULT_CONFIG);

			handle.showComplete(["Done"]);
			handle.close();

			expect(mockCloseFn).toHaveBeenCalledOnce();

			vi.advanceTimersByTime(5000);
			expect(mockCloseFn).toHaveBeenCalledOnce();
		});
	});

	describe("edge cases", () => {
		it("should handle total of 0 by using safeTotal of 1", () => {
			const handle = showProgressModal({ ...DEFAULT_CONFIG, total: 0 });

			handle.updateProgress(0);

			expect(getBarWidth()).toBe("0%");
			expect(getStatusText()).toBe("Processing 0 of 1...");
		});

		it("should handle negative total by using safeTotal of 1", () => {
			const handle = showProgressModal({ ...DEFAULT_CONFIG, total: -5 });

			handle.updateProgress(1);

			expect(getBarWidth()).toBe("100%");
		});

		it("should not allow showComplete after showError", () => {
			const handle = showProgressModal(DEFAULT_CONFIG);

			handle.showError("Failed");
			handle.showComplete(["Should not appear"]);

			expect(getStatusText()).toBe("Processing failed");
		});

		it("should not allow showError after showComplete", () => {
			const handle = showProgressModal(DEFAULT_CONFIG);

			handle.showComplete(["Done"]);
			handle.showError("Should not appear");

			expect(getStatusText()).toBe("Processing complete");
		});

		it("should handle title without trailing ellipsis", () => {
			const handle = showProgressModal({ ...DEFAULT_CONFIG, title: "Import" });

			handle.showComplete(["Done"]);
			expect(getStatusText()).toBe("Import complete");
		});
	});

	describe("backdrop dismissal", () => {
		it("should block backdrop clicks during progress by default", () => {
			showProgressModal(DEFAULT_CONFIG);

			const event = new MouseEvent("click", { bubbles: true });
			Object.defineProperty(event, "target", { value: mockModalEl });
			const stopSpy = vi.spyOn(event, "stopPropagation");

			mockModalEl.dispatchEvent(event);

			expect(stopSpy).toHaveBeenCalled();
		});

		it("should allow backdrop clicks when dismissibleDuringProgress is true", () => {
			showProgressModal({ ...DEFAULT_CONFIG, dismissibleDuringProgress: true });

			const event = new MouseEvent("click", { bubbles: true });
			Object.defineProperty(event, "target", { value: mockModalEl });
			const stopSpy = vi.spyOn(event, "stopPropagation");

			mockModalEl.dispatchEvent(event);

			expect(stopSpy).not.toHaveBeenCalled();
		});
	});
});
