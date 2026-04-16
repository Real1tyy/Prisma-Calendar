/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

function polyfillObsidianDOM(): void {
	const proto = HTMLElement.prototype as any;
	if (proto._polyfilled) return;
	proto._polyfilled = true;

	proto.empty = function (this: HTMLElement) {
		this.innerHTML = "";
	};

	proto.createDiv = function (this: HTMLElement, classNameOrOptions?: string | Record<string, any>) {
		const div = document.createElement("div");
		if (typeof classNameOrOptions === "string") {
			div.className = classNameOrOptions;
		}
		this.appendChild(div);
		return div;
	};

	proto.createEl = function (
		this: HTMLElement,
		tag: string,
		options?: { text?: string; cls?: string; attr?: Record<string, string> }
	) {
		const el = document.createElement(tag);
		if (options?.text) el.textContent = options.text;
		if (options?.cls) el.className = options.cls;
		if (options?.attr) {
			for (const [k, v] of Object.entries(options.attr)) {
				el.setAttribute(k, v);
			}
		}
		this.appendChild(el);
		return el;
	};

	(globalThis as any).createDiv = function (classNameOrOptions?: string | Record<string, any>) {
		const div = document.createElement("div");
		if (typeof classNameOrOptions === "string") {
			div.className = classNameOrOptions;
		}
		return div;
	};
}

polyfillObsidianDOM();

import { ChipList } from "../../src/components/primitives/chip-list";

const PREFIX = "test-";

function createChipList(overrides?: Partial<Parameters<typeof ChipList.prototype.setItems>[0]>) {
	return new ChipList({ cssPrefix: PREFIX, ...overrides } as any);
}

describe("ChipList", () => {
	beforeEach(() => {
		document.head.innerHTML = "";
	});

	describe("constructor", () => {
		it("should create an element with the prefixed chip-list class", () => {
			const chip = createChipList();
			expect(chip.el.className).toBe("test-chip-list");
		});

		it("should render empty state by default", () => {
			const chip = createChipList({ emptyText: "Nothing here" });
			expect(chip.el.textContent).toBe("Nothing here");
		});

		it("should use default empty text when none provided", () => {
			const chip = createChipList();
			expect(chip.el.textContent).toBe("No items");
		});

		it("should apply prefixed CSS classes to rendered chips", () => {
			const chip = createChipList();
			chip.setItems(["alice"]);
			expect(chip.el.querySelector(`.${PREFIX}chip-item`)).toBeTruthy();
			expect(chip.el.querySelector(`.${PREFIX}chip-name`)).toBeTruthy();
			expect(chip.el.querySelector(`.${PREFIX}chip-remove`)).toBeTruthy();
		});
	});

	describe("value", () => {
		it("should return empty array initially", () => {
			const chip = createChipList();
			expect(chip.value).toEqual([]);
		});

		it("should return a copy of items", () => {
			const chip = createChipList();
			chip.setItems(["Alice", "Bob"]);
			const value = chip.value;
			value.push("Charlie");
			expect(chip.value).toEqual(["Alice", "Bob"]);
		});
	});

	describe("setItems", () => {
		it("should replace all items and render chips", () => {
			const chip = createChipList();
			chip.setItems(["Alice", "Bob", "Charlie"]);
			expect(chip.value).toEqual(["Alice", "Bob", "Charlie"]);

			const items = chip.el.querySelectorAll(`.${PREFIX}chip-item`);
			expect(items.length).toBe(3);
		});

		it("should not share reference with the passed array", () => {
			const chip = createChipList();
			const arr = ["Alice"];
			chip.setItems(arr);
			arr.push("Bob");
			expect(chip.value).toEqual(["Alice"]);
		});

		it("should clear previous items when called again", () => {
			const chip = createChipList();
			chip.setItems(["Alice", "Bob"]);
			chip.setItems(["Charlie"]);
			expect(chip.value).toEqual(["Charlie"]);
			expect(chip.el.querySelectorAll(`.${PREFIX}chip-item`).length).toBe(1);
		});

		it("should render empty state when set to empty array", () => {
			const chip = createChipList({ emptyText: "Empty" });
			chip.setItems(["Alice"]);
			chip.setItems([]);
			expect(chip.el.textContent).toBe("Empty");
		});
	});

	describe("add", () => {
		it("should append a new item", () => {
			const chip = createChipList();
			chip.add("Alice");
			chip.add("Bob");
			expect(chip.value).toEqual(["Alice", "Bob"]);
		});

		it("should deduplicate items", () => {
			const chip = createChipList();
			chip.add("Alice");
			chip.add("Alice");
			expect(chip.value).toEqual(["Alice"]);
		});

		it("should call onChange callback", () => {
			const onChange = vi.fn();
			const chip = new ChipList({ cssPrefix: PREFIX, onChange });
			chip.add("Alice");
			expect(onChange).toHaveBeenCalledOnce();
		});

		it("should not call onChange when item already exists", () => {
			const onChange = vi.fn();
			const chip = new ChipList({ cssPrefix: PREFIX, onChange });
			chip.add("Alice");
			onChange.mockClear();
			chip.add("Alice");
			expect(onChange).not.toHaveBeenCalled();
		});
	});

	describe("remove", () => {
		it("should remove an item", () => {
			const chip = createChipList();
			chip.setItems(["Alice", "Bob", "Charlie"]);
			chip.remove("Bob");
			expect(chip.value).toEqual(["Alice", "Charlie"]);
		});

		it("should call onChange callback", () => {
			const onChange = vi.fn();
			const chip = new ChipList({ cssPrefix: PREFIX, onChange });
			chip.setItems(["Alice"]);
			chip.remove("Alice");
			expect(onChange).toHaveBeenCalledOnce();
		});

		it("should handle removing non-existent item gracefully", () => {
			const chip = createChipList();
			chip.setItems(["Alice"]);
			chip.remove("Bob");
			expect(chip.value).toEqual(["Alice"]);
		});
	});

	describe("updateConfig", () => {
		it("should update config and re-render", () => {
			const chip = createChipList({ emptyText: "Empty" });
			expect(chip.el.textContent).toBe("Empty");
			chip.updateConfig({ emptyText: "Nothing" });
			expect(chip.el.textContent).toBe("Nothing");
		});
	});

	describe("rendering", () => {
		it("should render chip labels with display names", () => {
			const chip = new ChipList({
				cssPrefix: PREFIX,
				getDisplayName: (item) => item.toUpperCase(),
			});
			chip.setItems(["alice", "bob"]);

			const names = chip.el.querySelectorAll(`.${PREFIX}chip-name`);
			expect(names[0]!.textContent).toBe("ALICE");
			expect(names[1]!.textContent).toBe("BOB");
		});

		it("should render raw item value when no getDisplayName provided", () => {
			const chip = createChipList();
			chip.setItems(["alice"]);

			const name = chip.el.querySelector(`.${PREFIX}chip-name`);
			expect(name!.textContent).toBe("alice");
		});

		it("should set tooltip when getTooltip returns value", () => {
			const chip = new ChipList({
				cssPrefix: PREFIX,
				getTooltip: (item) => `Tooltip: ${item}`,
			});
			chip.setItems(["alice"]);

			const name = chip.el.querySelector(`.${PREFIX}chip-name`);
			expect(name!.getAttribute("title")).toBe("Tooltip: alice");
		});

		it("should not set tooltip when getTooltip returns empty string", () => {
			const chip = new ChipList({
				cssPrefix: PREFIX,
				getTooltip: () => "",
			});
			chip.setItems(["alice"]);

			const name = chip.el.querySelector(`.${PREFIX}chip-name`);
			expect(name!.getAttribute("title")).toBeNull();
		});

		it("should call renderPrefix for each chip", () => {
			const renderPrefix = vi.fn();
			const chip = new ChipList({ cssPrefix: PREFIX, renderPrefix });
			chip.setItems(["alice", "bob"]);
			expect(renderPrefix).toHaveBeenCalledTimes(2);
			expect(renderPrefix).toHaveBeenCalledWith(expect.any(HTMLElement), "alice");
			expect(renderPrefix).toHaveBeenCalledWith(expect.any(HTMLElement), "bob");
		});

		it("should render remove button with × symbol", () => {
			const chip = createChipList();
			chip.setItems(["alice"]);

			const removeBtn = chip.el.querySelector(`.${PREFIX}chip-remove`);
			expect(removeBtn).toBeTruthy();
			expect(removeBtn!.textContent).toBe("\u00D7");
		});

		it("should remove item when remove button is clicked", () => {
			const chip = createChipList();
			chip.setItems(["alice", "bob"]);

			const removeBtn = chip.el.querySelector(`.${PREFIX}chip-remove`);
			removeBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

			expect(chip.value).toEqual(["bob"]);
		});

		it("should call onNameClick when chip label is clicked", () => {
			const onNameClick = vi.fn();
			const chip = new ChipList({ cssPrefix: PREFIX, onNameClick });
			chip.setItems(["alice"]);

			const name = chip.el.querySelector(`.${PREFIX}chip-name`);
			name!.dispatchEvent(new MouseEvent("click"));

			expect(onNameClick).toHaveBeenCalledWith("alice");
		});
	});

	describe("CSS prefix isolation", () => {
		it("should use different prefixes for different instances", () => {
			const chip1 = new ChipList({ cssPrefix: "alpha-" });
			const chip2 = new ChipList({ cssPrefix: "beta-" });

			expect(chip1.el.className).toBe("alpha-chip-list");
			expect(chip2.el.className).toBe("beta-chip-list");
		});
	});
});
