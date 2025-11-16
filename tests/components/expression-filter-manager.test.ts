import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExpressionFilterManager } from "../../src/components/expression-filter-manager";

describe("ExpressionFilterManager", () => {
	let expressionFilter: ExpressionFilterManager;
	let onFilterChange: ReturnType<typeof vi.fn>;
	let container: HTMLElement;

	beforeEach(() => {
		onFilterChange = vi.fn();
		expressionFilter = new ExpressionFilterManager(onFilterChange);

		container = document.createElement("div");
		const toolbarLeft = document.createElement("div");
		toolbarLeft.className = "fc-toolbar-chunk";
		container.appendChild(toolbarLeft);

		vi.useFakeTimers();
	});

	afterEach(() => {
		expressionFilter.destroy();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	describe("initialization", () => {
		it("should initialize with correct placeholder", () => {
			const mockCalendar = {} as any;
			expressionFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const input = container.querySelector(".prisma-fc-expression-input") as HTMLInputElement;
			expect(input).toBeTruthy();
			expect(input.placeholder).toBe("Status === 'Done'");
		});

		it("should use correct CSS class", () => {
			const mockCalendar = {} as any;
			expressionFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const input = container.querySelector(".prisma-fc-expression-input");
			expect(input).toBeTruthy();
			expect(input?.className).toBe("prisma-fc-expression-input");
		});
	});

	describe("shouldInclude with expressions", () => {
		it("should return true when no filter is set", () => {
			const event = {
				meta: { Status: "Done", Priority: "High" },
			};

			expect(expressionFilter.shouldInclude(event)).toBe(true);
		});

		it("should evaluate simple equality expressions", () => {
			const mockCalendar = {} as any;
			expressionFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const input = container.querySelector(".prisma-fc-expression-input") as HTMLInputElement;
			input.value = 'Status === "Done"';
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(50);

			expect(expressionFilter.shouldInclude({ meta: { Status: "Done" } })).toBe(true);
			expect(expressionFilter.shouldInclude({ meta: { Status: "Pending" } })).toBe(false);
		});

		it("should evaluate inequality expressions", () => {
			const mockCalendar = {} as any;
			expressionFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const input = container.querySelector(".prisma-fc-expression-input") as HTMLInputElement;
			input.value = 'Status !== "Done"';
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(50);

			expect(expressionFilter.shouldInclude({ meta: { Status: "Pending" } })).toBe(true);
			expect(expressionFilter.shouldInclude({ meta: { Status: "Done" } })).toBe(false);
		});

		it("should evaluate numeric comparisons", () => {
			const mockCalendar = {} as any;
			expressionFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const input = container.querySelector(".prisma-fc-expression-input") as HTMLInputElement;
			input.value = "Priority > 5";
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(50);

			expect(expressionFilter.shouldInclude({ meta: { Priority: 8 } })).toBe(true);
			expect(expressionFilter.shouldInclude({ meta: { Priority: 3 } })).toBe(false);
			expect(expressionFilter.shouldInclude({ meta: { Priority: 5 } })).toBe(false);
		});

		it("should evaluate boolean properties", () => {
			const mockCalendar = {} as any;
			expressionFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const input = container.querySelector(".prisma-fc-expression-input") as HTMLInputElement;
			input.value = "Important === true";
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(50);

			expect(expressionFilter.shouldInclude({ meta: { Important: true } })).toBe(true);
			expect(expressionFilter.shouldInclude({ meta: { Important: false } })).toBe(false);
		});

		it("should handle logical AND", () => {
			const mockCalendar = {} as any;
			expressionFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const input = container.querySelector(".prisma-fc-expression-input") as HTMLInputElement;
			input.value = 'Status === "Done" && Priority > 5';
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(50);

			expect(expressionFilter.shouldInclude({ meta: { Status: "Done", Priority: 8 } })).toBe(true);
			expect(expressionFilter.shouldInclude({ meta: { Status: "Done", Priority: 3 } })).toBe(false);
			expect(expressionFilter.shouldInclude({ meta: { Status: "Pending", Priority: 8 } })).toBe(false);
		});

		it("should handle logical OR", () => {
			const mockCalendar = {} as any;
			expressionFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const input = container.querySelector(".prisma-fc-expression-input") as HTMLInputElement;
			input.value = 'Status === "Done" || Status === "Archived"';
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(50);

			expect(expressionFilter.shouldInclude({ meta: { Status: "Done" } })).toBe(true);
			expect(expressionFilter.shouldInclude({ meta: { Status: "Archived" } })).toBe(true);
			expect(expressionFilter.shouldInclude({ meta: { Status: "Pending" } })).toBe(false);
		});

		it("should handle array contains check", () => {
			const mockCalendar = {} as any;
			expressionFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const input = container.querySelector(".prisma-fc-expression-input") as HTMLInputElement;
			input.value = 'Tags.includes("important")';
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(50);

			expect(expressionFilter.shouldInclude({ meta: { Tags: ["important", "urgent"] } })).toBe(true);
			expect(expressionFilter.shouldInclude({ meta: { Tags: ["normal", "routine"] } })).toBe(false);
		});

		it("should handle nested property access", () => {
			const mockCalendar = {} as any;
			expressionFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const input = container.querySelector(".prisma-fc-expression-input") as HTMLInputElement;
			input.value = 'User.Name === "Alice"';
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(50);

			expect(expressionFilter.shouldInclude({ meta: { User: { Name: "Alice" } } })).toBe(true);
			expect(expressionFilter.shouldInclude({ meta: { User: { Name: "Bob" } } })).toBe(false);
		});

		it("should handle undefined properties gracefully", () => {
			const mockCalendar = {} as any;
			expressionFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const input = container.querySelector(".prisma-fc-expression-input") as HTMLInputElement;
			input.value = 'Status === "Done"';
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(50);

			expect(expressionFilter.shouldInclude({ meta: {} })).toBe(true);
			expect(expressionFilter.shouldInclude({ meta: { OtherProp: "value" } })).toBe(true);
			expect(consoleWarnSpy).toHaveBeenCalled();

			consoleWarnSpy.mockRestore();
		});

		it("should handle events with no meta", () => {
			const mockCalendar = {} as any;
			expressionFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const input = container.querySelector(".prisma-fc-expression-input") as HTMLInputElement;
			input.value = 'Status === "Done"';
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(50);

			expect(expressionFilter.shouldInclude({})).toBe(true);
			expect(consoleWarnSpy).toHaveBeenCalled();

			consoleWarnSpy.mockRestore();
		});
	});

	describe("error handling", () => {
		it("should return true for invalid expressions", () => {
			const mockCalendar = {} as any;
			expressionFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const input = container.querySelector(".prisma-fc-expression-input") as HTMLInputElement;
			input.value = "Status === ";
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(50);

			expect(expressionFilter.shouldInclude({ meta: { Status: "Done" } })).toBe(true);
			expect(consoleWarnSpy).toHaveBeenCalled();

			consoleWarnSpy.mockRestore();
		});

		it("should handle syntax errors gracefully", () => {
			const mockCalendar = {} as any;
			expressionFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const input = container.querySelector(".prisma-fc-expression-input") as HTMLInputElement;
			input.value = "Status === 'unclosed string";
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(50);

			expect(expressionFilter.shouldInclude({ meta: { Status: "Done" } })).toBe(true);
			expect(consoleWarnSpy).toHaveBeenCalled();

			consoleWarnSpy.mockRestore();
		});

		it("should handle runtime errors in expression", () => {
			const mockCalendar = {} as any;
			expressionFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const input = container.querySelector(".prisma-fc-expression-input") as HTMLInputElement;
			input.value = "NonExistentProperty.toString()";
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(50);

			expect(expressionFilter.shouldInclude({ meta: {} })).toBe(true);
			expect(consoleWarnSpy).toHaveBeenCalled();

			consoleWarnSpy.mockRestore();
		});
	});

	describe("property access", () => {
		it("should allow direct property access without fm. prefix", () => {
			const mockCalendar = {} as any;
			expressionFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const input = container.querySelector(".prisma-fc-expression-input") as HTMLInputElement;
			input.value = 'Status === "Done"';
			input.dispatchEvent(new Event("input"));
			vi.advanceTimersByTime(50);

			expect(expressionFilter.shouldInclude({ meta: { Status: "Done" } })).toBe(true);
		});
	});

	describe("focus", () => {
		it("should focus the expression input", () => {
			const mockCalendar = {} as any;
			expressionFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const input = container.querySelector(".prisma-fc-expression-input") as HTMLInputElement;
			const focusSpy = vi.spyOn(input, "focus");

			expressionFilter.focus();
			expect(focusSpy).toHaveBeenCalled();
		});
	});

	describe("integration with debouncing", () => {
		it("should debounce expression changes", () => {
			const mockCalendar = {} as any;
			expressionFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const input = container.querySelector(".prisma-fc-expression-input") as HTMLInputElement;

			input.value = 'Status === "Done"';
			input.dispatchEvent(new Event("input"));

			expect(onFilterChange).not.toHaveBeenCalled();

			vi.advanceTimersByTime(150);

			expect(onFilterChange).toHaveBeenCalledTimes(1);
		});

		it("should trigger immediately on Enter for expressions", () => {
			const mockCalendar = {} as any;
			expressionFilter.initialize(mockCalendar, container);
			vi.advanceTimersByTime(100);

			const input = container.querySelector(".prisma-fc-expression-input") as HTMLInputElement;

			input.value = 'Status === "Done"';
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

			expect(onFilterChange).toHaveBeenCalledTimes(1);
		});
	});
});
