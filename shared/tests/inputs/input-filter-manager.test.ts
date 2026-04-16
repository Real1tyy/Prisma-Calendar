import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InputFilterManager, type InputFilterManagerOptions } from "../../src/components/inputs/input-filter-manager";

class TestFilterManager extends InputFilterManager<{ name: string }> {
	shouldInclude(data: { name: string }): boolean {
		const filter = this.getCurrentValue().toLowerCase();
		if (!filter) return true;
		return data.name.toLowerCase().includes(filter);
	}
}

function createOptions(overrides?: Partial<InputFilterManagerOptions>): InputFilterManagerOptions {
	return {
		placeholder: "Filter items...",
		cssClass: "test-filter",
		cssPrefix: "test",
		onFilterChange: vi.fn(),
		...overrides,
	};
}

describe("InputFilterManager", () => {
	let parentEl: HTMLElement;

	beforeEach(() => {
		parentEl = document.createElement("div");
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe("constructor", () => {
		it("should create a hidden container by default", () => {
			const manager = new TestFilterManager(parentEl, createOptions());

			expect(manager["containerEl"].classList.contains("test-hidden")).toBe(true);

			manager.destroy();
		});

		it("should create a visible container when initiallyVisible is true", () => {
			const manager = new TestFilterManager(parentEl, createOptions({ initiallyVisible: true }));

			expect(manager["containerEl"].classList.contains("test-hidden")).toBe(false);

			manager.destroy();
		});

		it("should render an input element with the correct placeholder", () => {
			const manager = new TestFilterManager(parentEl, createOptions({ placeholder: "Search..." }));

			expect(manager["inputEl"]?.placeholder).toBe("Search...");

			manager.destroy();
		});

		it("should apply the css class to the input", () => {
			const manager = new TestFilterManager(parentEl, createOptions({ cssClass: "my-filter" }));

			expect(manager["inputEl"]?.classList.contains("my-filter")).toBe(true);

			manager.destroy();
		});
	});

	describe("filter application", () => {
		it("should call onFilterChange after debounce on input", () => {
			const onFilterChange = vi.fn();
			const manager = new TestFilterManager(parentEl, createOptions({ onFilterChange }));

			manager["inputEl"]!.value = "test";
			manager["inputEl"]!.dispatchEvent(new Event("input"));

			expect(onFilterChange).not.toHaveBeenCalled();

			vi.advanceTimersByTime(150);

			expect(onFilterChange).toHaveBeenCalledWith("test");

			manager.destroy();
		});

		it("should use custom debounce time", () => {
			const onFilterChange = vi.fn();
			const manager = new TestFilterManager(parentEl, createOptions({ onFilterChange, debounceMs: 500 }));

			manager["inputEl"]!.value = "query";
			manager["inputEl"]!.dispatchEvent(new Event("input"));

			vi.advanceTimersByTime(300);
			expect(onFilterChange).not.toHaveBeenCalled();

			vi.advanceTimersByTime(200);
			expect(onFilterChange).toHaveBeenCalledWith("query");

			manager.destroy();
		});

		it("should apply filter immediately on Enter key", () => {
			const onFilterChange = vi.fn();
			const manager = new TestFilterManager(parentEl, createOptions({ onFilterChange }));

			manager["inputEl"]!.value = "immediate";
			manager["inputEl"]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

			expect(onFilterChange).toHaveBeenCalledWith("immediate");

			manager.destroy();
		});

		it("should trim input value", () => {
			const onFilterChange = vi.fn();
			const manager = new TestFilterManager(parentEl, createOptions({ onFilterChange }));

			manager["inputEl"]!.value = "  padded  ";
			manager["inputEl"]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

			expect(onFilterChange).toHaveBeenCalledWith("padded");

			manager.destroy();
		});

		it("should not call onFilterChange when value has not changed", () => {
			const onFilterChange = vi.fn();
			const manager = new TestFilterManager(parentEl, createOptions({ onFilterChange }));

			manager["inputEl"]!.value = "same";
			manager["inputEl"]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

			onFilterChange.mockClear();

			manager["inputEl"]!.value = "same";
			manager["inputEl"]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

			expect(onFilterChange).not.toHaveBeenCalled();

			manager.destroy();
		});
	});

	describe("getCurrentValue", () => {
		it("should return empty string initially", () => {
			const manager = new TestFilterManager(parentEl, createOptions());

			expect(manager.getCurrentValue()).toBe("");

			manager.destroy();
		});

		it("should return the current filter value after applying", () => {
			const manager = new TestFilterManager(parentEl, createOptions());

			manager["inputEl"]!.value = "active";
			manager["inputEl"]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

			expect(manager.getCurrentValue()).toBe("active");

			manager.destroy();
		});
	});

	describe("show / hide", () => {
		it("should show the container", () => {
			const manager = new TestFilterManager(parentEl, createOptions());

			manager.show();

			expect(manager.isVisible()).toBe(true);

			manager.destroy();
		});

		it("should hide the container and clear the filter", () => {
			const onFilterChange = vi.fn();
			const manager = new TestFilterManager(parentEl, createOptions({ onFilterChange, initiallyVisible: true }));

			manager["inputEl"]!.value = "something";
			manager["inputEl"]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
			onFilterChange.mockClear();

			manager.hide();

			expect(manager.isVisible()).toBe(false);
			expect(manager["inputEl"]!.value).toBe("");
			expect(onFilterChange).toHaveBeenCalledWith("");

			manager.destroy();
		});

		it("should call onHide callback when hiding", () => {
			const onHide = vi.fn();
			const manager = new TestFilterManager(parentEl, createOptions({ onHide, initiallyVisible: true }));

			manager.hide();

			expect(onHide).toHaveBeenCalledOnce();

			manager.destroy();
		});

		it("should hide on Escape key when not persistently visible", () => {
			const manager = new TestFilterManager(parentEl, createOptions({ initiallyVisible: true }));

			manager["inputEl"]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

			expect(manager.isVisible()).toBe(false);

			manager.destroy();
		});
	});

	describe("isVisible", () => {
		it("should return false when hidden", () => {
			const manager = new TestFilterManager(parentEl, createOptions());

			expect(manager.isVisible()).toBe(false);

			manager.destroy();
		});

		it("should return true when visible", () => {
			const manager = new TestFilterManager(parentEl, createOptions({ initiallyVisible: true }));

			expect(manager.isVisible()).toBe(true);

			manager.destroy();
		});
	});

	describe("setPersistentlyVisible", () => {
		it("should show and prevent hiding when set to true", () => {
			const manager = new TestFilterManager(parentEl, createOptions());

			manager.setPersistentlyVisible(true);

			expect(manager.isVisible()).toBe(true);

			manager.hide();

			expect(manager.isVisible()).toBe(true);

			manager.destroy();
		});

		it("should blur input on Escape when persistently visible", () => {
			const manager = new TestFilterManager(parentEl, createOptions());
			manager.setPersistentlyVisible(true);

			const blurSpy = vi.spyOn(manager["inputEl"]!, "blur");
			manager["inputEl"]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

			expect(blurSpy).toHaveBeenCalled();
			expect(manager.isVisible()).toBe(true);

			manager.destroy();
		});

		it("should allow hiding again when set back to false", () => {
			const manager = new TestFilterManager(parentEl, createOptions());

			manager.setPersistentlyVisible(true);
			manager.setPersistentlyVisible(false);

			expect(manager.isVisible()).toBe(false);

			manager.destroy();
		});
	});

	describe("shouldInclude", () => {
		it("should include all items when filter is empty", () => {
			const manager = new TestFilterManager(parentEl, createOptions());

			expect(manager.shouldInclude({ name: "Anything" })).toBe(true);

			manager.destroy();
		});

		it("should filter items based on current value", () => {
			const manager = new TestFilterManager(parentEl, createOptions());

			manager["inputEl"]!.value = "task";
			manager["inputEl"]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

			expect(manager.shouldInclude({ name: "My Task" })).toBe(true);
			expect(manager.shouldInclude({ name: "Meeting" })).toBe(false);

			manager.destroy();
		});
	});

	describe("destroy", () => {
		it("should remove the container from the DOM", () => {
			const manager = new TestFilterManager(parentEl, createOptions());

			expect(parentEl.children.length).toBe(1);

			manager.destroy();

			expect(parentEl.children.length).toBe(0);
		});

		it("should clear debounce timer", () => {
			const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
			const manager = new TestFilterManager(parentEl, createOptions());

			manager["inputEl"]!.value = "pending";
			manager["inputEl"]!.dispatchEvent(new Event("input"));

			manager.destroy();

			expect(clearTimeoutSpy).toHaveBeenCalled();
		});

		it("should set inputEl to null", () => {
			const manager = new TestFilterManager(parentEl, createOptions());

			manager.destroy();

			expect(manager["inputEl"]).toBeNull();
		});
	});
});
