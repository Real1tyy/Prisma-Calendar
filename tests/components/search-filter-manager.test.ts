import "@testing-library/jest-dom/vitest";

import { act, fireEvent, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { App } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mountSearchFilter, type ToolbarFilterHandle } from "../../src/components/toolbar-filter-mount";

function makeContainer(): HTMLElement {
	const container = document.createElement("div");
	const toolbarLeft = document.createElement("div");
	toolbarLeft.className = "fc-toolbar-chunk";
	container.appendChild(toolbarLeft);
	document.body.appendChild(container);
	return container;
}

const STUB_APP = {} as App;
const SEARCH_INPUT_SELECTOR = ".prisma-fc-search-input";

describe("mountSearchFilter", () => {
	let container: HTMLElement;
	let handle: ToolbarFilterHandle | null;
	let onFilterChange: ReturnType<typeof vi.fn>;
	let user: ReturnType<typeof userEvent.setup>;

	beforeEach(() => {
		container = makeContainer();
		onFilterChange = vi.fn();
		handle = null;
		user = userEvent.setup();
	});

	afterEach(() => {
		if (handle) {
			act(() => handle?.destroy());
		}
		document.body.replaceChildren();
	});

	function mount(): ToolbarFilterHandle {
		act(() => {
			handle = mountSearchFilter({ app: STUB_APP, container, onFilterChange });
		});
		return handle!;
	}

	describe("initialization", () => {
		it("injects the input inside a prisma-fc-filter-wrapper in the first toolbar chunk", () => {
			mount();
			const wrapper = container.querySelector(".prisma-fc-filter-wrapper");
			expect(wrapper).toBeTruthy();
			const input = wrapper?.querySelector("input");
			expect(input).toBeTruthy();
			expect(input?.placeholder).toBe("Search events...");
			expect(input?.type).toBe("text");
			expect(input?.className).toBe("prisma-fc-search-input");
			expect(input?.getAttribute("data-testid")).toBe("prisma-filter-search");
		});

		it("inserts the wrapper immediately after the zoom button if present", () => {
			const toolbarLeft = container.querySelector(".fc-toolbar-chunk") as HTMLElement;
			const zoomButton = document.createElement("button");
			zoomButton.className = "fc-zoomLevel-button";
			toolbarLeft.appendChild(zoomButton);

			mount();

			const wrapper = container.querySelector(".prisma-fc-filter-wrapper");
			expect(wrapper?.previousElementSibling).toBe(zoomButton);
		});

		it("appends to the toolbar chunk when no zoom button is present", () => {
			mount();
			const wrapper = container.querySelector(".prisma-fc-filter-wrapper");
			expect(wrapper?.parentElement?.classList.contains("fc-toolbar-chunk")).toBe(true);
			expect(wrapper?.previousElementSibling).toBeNull();
		});

		it("renders the wrapper as a direct child of the toolbar chunk so flex layout works", () => {
			mount();
			const wrapper = container.querySelector(".prisma-fc-filter-wrapper")!;
			expect(wrapper.parentElement?.classList.contains("fc-toolbar-chunk")).toBe(true);
			const input = wrapper.querySelector("input")!;
			expect(input.parentElement).toBe(wrapper);
		});

		it("does nothing when the toolbar chunk is absent", () => {
			const empty = document.createElement("div");
			document.body.appendChild(empty);
			handle = mountSearchFilter({ app: STUB_APP, container: empty, onFilterChange });
			expect(empty.querySelector(".prisma-fc-filter-wrapper")).toBeNull();
		});
	});

	describe("focus", () => {
		it("focuses the underlying input when focus() is called", () => {
			mount();
			handle!.focus();
			const input = container.querySelector<HTMLInputElement>(SEARCH_INPUT_SELECTOR);
			expect(document.activeElement).toBe(input);
		});

		it("reports isFocused() based on document.activeElement", () => {
			mount();
			expect(handle!.isFocused()).toBe(false);
			handle!.focus();
			expect(handle!.isFocused()).toBe(true);
		});
	});

	describe("filter behavior", () => {
		it("commits filter changes after the debounce window (exactly one call for a burst of keystrokes)", async () => {
			mount();
			const input = container.querySelector<HTMLInputElement>(SEARCH_INPUT_SELECTOR)!;
			await user.type(input, "meeting");

			await waitFor(() => expect(onFilterChange).toHaveBeenCalledTimes(1));
			expect(handle!.getCurrentFilterValue()).toBe("meeting");
		});

		it("does not re-notify the consumer when the committed value is unchanged", async () => {
			mount();
			const input = container.querySelector<HTMLInputElement>(SEARCH_INPUT_SELECTOR)!;
			await user.type(input, "meeting{Enter}");

			expect(onFilterChange).toHaveBeenCalledTimes(1);
			onFilterChange.mockClear();

			await user.type(input, "{Enter}");
			expect(onFilterChange).not.toHaveBeenCalled();
		});

		it("commits immediately on Enter without waiting for the debounce", async () => {
			mount();
			const input = container.querySelector<HTMLInputElement>(SEARCH_INPUT_SELECTOR)!;
			await user.type(input, "test{Enter}");

			expect(onFilterChange).toHaveBeenCalled();
			expect(handle!.getCurrentFilterValue()).toBe("test");
		});

		it("flushes the pending value on blur when one is queued", () => {
			mount();
			const input = container.querySelector<HTMLInputElement>(SEARCH_INPUT_SELECTOR)!;
			fireEvent.input(input, { target: { value: "queued" } });
			expect(onFilterChange).not.toHaveBeenCalled();

			fireEvent.blur(input);

			expect(onFilterChange).toHaveBeenCalledOnce();
			expect(handle!.getCurrentFilterValue()).toBe("queued");
		});

		it("trims whitespace from committed values", async () => {
			mount();
			const input = container.querySelector<HTMLInputElement>(SEARCH_INPUT_SELECTOR)!;
			await user.type(input, "  test  {Enter}");

			expect(handle!.getCurrentFilterValue()).toBe("test");
		});
	});

	describe("shouldInclude", () => {
		it("returns true when the filter is empty", () => {
			mount();
			expect(handle!.shouldInclude({ title: "Any Event" })).toBe(true);
		});

		it("matches case-insensitively against the event title", async () => {
			mount();
			const input = container.querySelector<HTMLInputElement>(SEARCH_INPUT_SELECTOR)!;
			await user.type(input, "meeting{Enter}");

			expect(handle!.shouldInclude({ title: "Team Meeting" })).toBe(true);
			expect(handle!.shouldInclude({ title: "MEETING NOTES" })).toBe(true);
			expect(handle!.shouldInclude({ title: "Project meeting" })).toBe(true);
			expect(handle!.shouldInclude({ title: "Lunch Break" })).toBe(false);
		});

		it("supports partial matches", async () => {
			mount();
			const input = container.querySelector<HTMLInputElement>(SEARCH_INPUT_SELECTOR)!;
			await user.type(input, "meet{Enter}");

			expect(handle!.shouldInclude({ title: "Meet & Greet" })).toBe(true);
			expect(handle!.shouldInclude({ title: "Meeting" })).toBe(true);
		});
	});

	describe("setFilterValue", () => {
		it("seeds the input value programmatically and triggers an immediate commit", () => {
			mount();
			act(() => handle!.setFilterValue("seeded"));

			expect(handle!.getCurrentFilterValue()).toBe("seeded");
			expect(onFilterChange).toHaveBeenCalled();
			const input = container.querySelector<HTMLInputElement>(SEARCH_INPUT_SELECTOR)!;
			expect(input.value).toBe("seeded");
		});
	});

	describe("destroy", () => {
		it("removes the slot element and cancels pending debounced commits", async () => {
			mount();
			const input = container.querySelector<HTMLInputElement>(SEARCH_INPUT_SELECTOR)!;
			await user.type(input, "abc");

			act(() => handle!.destroy());
			handle = null;

			expect(container.querySelector(".prisma-fc-filter-wrapper")).toBeNull();
			onFilterChange.mockClear();
			await new Promise((r) => setTimeout(r, 200));
			expect(onFilterChange).not.toHaveBeenCalled();
		});

		it("tolerates multiple destroy calls", () => {
			mount();
			expect(() => {
				act(() => handle!.destroy());
				act(() => handle!.destroy());
			}).not.toThrow();
			handle = null;
		});
	});
});
