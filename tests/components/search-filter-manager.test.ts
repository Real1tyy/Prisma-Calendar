import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchFilterManager } from "../../src/components/search-filter-manager";

describe("SearchFilterManager", () => {
	let searchFilter: SearchFilterManager;
	let onFilterChange: ReturnType<typeof vi.fn>;
	let container: HTMLElement;

	beforeEach(() => {
		onFilterChange = vi.fn();
		searchFilter = new SearchFilterManager(onFilterChange);

		container = document.createElement("div");
		const toolbarLeft = document.createElement("div");
		toolbarLeft.className = "fc-toolbar-chunk";
		container.appendChild(toolbarLeft);

		vi.useFakeTimers();
	});

	afterEach(() => {
		searchFilter.destroy();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	describe("initialization", () => {
		it("should initialize and inject input into toolbar", () => {
			const mockCalendar = {} as any;
			searchFilter.initialize(mockCalendar, container);

			vi.advanceTimersByTime(100);

			const input = container.querySelector(".fc-search-input") as HTMLInputElement;
			expect(input).toBeTruthy();
			expect(input.placeholder).toBe("Search events...");
			expect(input.type).toBe("text");
		});

		it("should inject input after zoom button if present", () => {
			const toolbarLeft = container.querySelector(".fc-toolbar-chunk");
			const zoomButton = document.createElement("button");
			zoomButton.className = "fc-zoomLevel-button";
			toolbarLeft?.appendChild(zoomButton);

			const mockCalendar = {} as any;
			searchFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const wrapper = container.querySelector(".fc-filter-wrapper");
			expect(wrapper?.previousElementSibling).toBe(zoomButton);
		});

		it("should not inject input if toolbar is missing", () => {
			const emptyContainer = document.createElement("div");
			const mockCalendar = {} as any;

			searchFilter.initialize(mockCalendar, emptyContainer);
			vi.advanceTimersByTime(100);

			const input = emptyContainer.querySelector(".fc-search-input");
			expect(input).toBeNull();
		});
	});

	describe("focus", () => {
		it("should focus the input when focus() is called", () => {
			const mockCalendar = {} as any;
			searchFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const input = container.querySelector(".fc-search-input") as HTMLInputElement;
			const focusSpy = vi.spyOn(input, "focus");

			searchFilter.focus();
			expect(focusSpy).toHaveBeenCalled();
		});

		it("should not throw if focus() is called before initialization", () => {
			expect(() => searchFilter.focus()).not.toThrow();
		});
	});

	describe("filter behavior", () => {
		beforeEach(() => {
			const mockCalendar = {} as any;
			searchFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);
		});

		it("should trigger filter change after debounce delay on input", () => {
			const input = container.querySelector(".fc-search-input") as HTMLInputElement;

			input.value = "meeting";
			input.dispatchEvent(new Event("input"));

			expect(onFilterChange).not.toHaveBeenCalled();

			vi.advanceTimersByTime(150);

			expect(onFilterChange).toHaveBeenCalledTimes(1);
		});

		it("should debounce multiple rapid inputs", () => {
			const input = container.querySelector(".fc-search-input") as HTMLInputElement;

			input.value = "m";
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(50);

			input.value = "me";
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(50);

			input.value = "mee";
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(50);

			expect(onFilterChange).not.toHaveBeenCalled();

			vi.advanceTimersByTime(150);

			expect(onFilterChange).toHaveBeenCalledTimes(1);
		});

		it("should trigger immediately on Enter key", () => {
			const input = container.querySelector(".fc-search-input") as HTMLInputElement;

			input.value = "test";
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

			expect(onFilterChange).toHaveBeenCalledTimes(1);
		});

		it("should trigger immediately on blur", () => {
			const input = container.querySelector(".fc-search-input") as HTMLInputElement;

			input.value = "test";
			input.dispatchEvent(new Event("blur"));

			expect(onFilterChange).toHaveBeenCalledTimes(1);
		});

		it("should not trigger if value has not changed", () => {
			const input = container.querySelector(".fc-search-input") as HTMLInputElement;

			input.value = "test";
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(150);

			expect(onFilterChange).toHaveBeenCalledTimes(1);

			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(150);

			expect(onFilterChange).toHaveBeenCalledTimes(1);
		});

		it("should trim whitespace from input value", () => {
			const input = container.querySelector(".fc-search-input") as HTMLInputElement;

			input.value = "  test  ";
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(150);

			expect(searchFilter.getCurrentFilterValue()).toBe("test");
		});
	});

	describe("shouldInclude", () => {
		it("should return true when filter is empty", () => {
			expect(searchFilter.shouldInclude({ title: "Any Event" })).toBe(true);
		});

		it("should return true for matching event title (case insensitive)", () => {
			searchFilter.initialize({} as any, container);
			vi.advanceTimersByTime(100);

			const inputElement = container.querySelector(".fc-search-input") as HTMLInputElement;
			inputElement.value = "meeting";
			inputElement.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(150);

			expect(searchFilter.shouldInclude({ title: "Team Meeting" })).toBe(true);
			expect(searchFilter.shouldInclude({ title: "MEETING NOTES" })).toBe(true);
			expect(searchFilter.shouldInclude({ title: "Project meeting" })).toBe(true);
		});

		it("should return false for non-matching event title", () => {
			const mockCalendar = {} as any;
			searchFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const input = container.querySelector(".fc-search-input") as HTMLInputElement;
			input.value = "meeting";
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(150);

			expect(searchFilter.shouldInclude({ title: "Lunch Break" })).toBe(false);
			expect(searchFilter.shouldInclude({ title: "Code Review" })).toBe(false);
		});

		it("should handle partial matches", () => {
			const mockCalendar = {} as any;
			searchFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const input = container.querySelector(".fc-search-input") as HTMLInputElement;
			input.value = "meet";
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(150);

			expect(searchFilter.shouldInclude({ title: "Meeting" })).toBe(true);
			expect(searchFilter.shouldInclude({ title: "Meet & Greet" })).toBe(true);
		});
	});

	describe("getCurrentFilterValue", () => {
		it("should return empty string initially", () => {
			expect(searchFilter.getCurrentFilterValue()).toBe("");
		});

		it("should return current filter value after input", () => {
			const mockCalendar = {} as any;
			searchFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const input = container.querySelector(".fc-search-input") as HTMLInputElement;
			input.value = "test value";
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(150);

			expect(searchFilter.getCurrentFilterValue()).toBe("test value");
		});
	});

	describe("destroy", () => {
		it("should clear debounce timer", () => {
			const mockCalendar = {} as any;
			searchFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const input = container.querySelector(".fc-search-input") as HTMLInputElement;
			input.value = "test";
			input.dispatchEvent(new Event("input"));

			searchFilter.destroy();
			vi.advanceTimersByTime(150);

			expect(onFilterChange).not.toHaveBeenCalled();
		});

		it("should handle multiple destroy calls", () => {
			expect(() => {
				searchFilter.destroy();
				searchFilter.destroy();
			}).not.toThrow();
		});
	});
});
