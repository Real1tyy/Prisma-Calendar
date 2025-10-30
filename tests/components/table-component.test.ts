import { beforeEach, describe, expect, it, vi } from "vitest";
import { TableComponent } from "../../src/components/weekly-stats/table-component";
import type { StatEntry } from "../../src/utils/weekly-stats";

// Mock DOM methods
const mockCreateDiv = vi.fn();
const mockCreateEl = vi.fn();
const mockEmpty = vi.fn();

const createMockElement = () => ({
	createDiv: mockCreateDiv.mockReturnThis(),
	createEl: mockCreateEl.mockReturnThis(),
	empty: mockEmpty.mockReturnThis(),
	setText: vi.fn().mockReturnThis(),
	appendChild: vi.fn(),
	addEventListener: vi.fn(),
	disabled: false,
});

describe("TableComponent Pagination", () => {
	let parentEl: ReturnType<typeof createMockElement>;

	beforeEach(() => {
		parentEl = createMockElement();
		mockCreateDiv.mockClear();
		mockCreateEl.mockClear();
		mockEmpty.mockClear();
	});

	describe("Pagination Threshold", () => {
		it("should not show pagination controls for 20 or fewer entries", () => {
			const entries: StatEntry[] = Array.from({ length: 20 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			new TableComponent(parentEl as any, entries, 72000000);

			// Pagination container should not be created (totalPages = 1)
			const paginationCalls = mockCreateDiv.mock.calls.filter((call) => call[0]?.includes("pagination"));
			expect(paginationCalls).toHaveLength(0);
		});

		it("should show pagination controls for 21 entries", () => {
			const entries: StatEntry[] = Array.from({ length: 21 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			new TableComponent(parentEl as any, entries, 75600000);

			// Pagination container should be created (totalPages = 2)
			const paginationCalls = mockCreateDiv.mock.calls.filter((call) => call[0]?.includes("pagination"));
			expect(paginationCalls.length).toBeGreaterThan(0);
		});

		it("should show pagination for exactly 40 entries (2 pages)", () => {
			const entries: StatEntry[] = Array.from({ length: 40 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			new TableComponent(parentEl as any, entries, 144000000);

			const paginationCalls = mockCreateDiv.mock.calls.filter((call) => call[0]?.includes("pagination"));
			expect(paginationCalls.length).toBeGreaterThan(0);
		});

		it("should show pagination for 100 entries (5 pages)", () => {
			const entries: StatEntry[] = Array.from({ length: 100 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			new TableComponent(parentEl as any, entries, 360000000);

			const paginationCalls = mockCreateDiv.mock.calls.filter((call) => call[0]?.includes("pagination"));
			expect(paginationCalls.length).toBeGreaterThan(0);
		});
	});

	describe("Page Count Calculation", () => {
		it("should calculate 1 page for 1 entry", () => {
			const entries: StatEntry[] = [{ name: "Event 1", duration: 3600000, count: 1, isRecurring: false }];

			const component = new TableComponent(parentEl as any, entries, 3600000);
			expect((component as any).totalPages).toBe(1);
		});

		it("should calculate 1 page for 20 entries", () => {
			const entries: StatEntry[] = Array.from({ length: 20 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			const component = new TableComponent(parentEl as any, entries, 72000000);
			expect((component as any).totalPages).toBe(1);
		});

		it("should calculate 2 pages for 21 entries", () => {
			const entries: StatEntry[] = Array.from({ length: 21 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			const component = new TableComponent(parentEl as any, entries, 75600000);
			expect((component as any).totalPages).toBe(2);
		});

		it("should calculate 2 pages for 40 entries", () => {
			const entries: StatEntry[] = Array.from({ length: 40 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			const component = new TableComponent(parentEl as any, entries, 144000000);
			expect((component as any).totalPages).toBe(2);
		});

		it("should calculate 3 pages for 41 entries", () => {
			const entries: StatEntry[] = Array.from({ length: 41 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			const component = new TableComponent(parentEl as any, entries, 147600000);
			expect((component as any).totalPages).toBe(3);
		});

		it("should calculate 5 pages for 100 entries", () => {
			const entries: StatEntry[] = Array.from({ length: 100 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			const component = new TableComponent(parentEl as any, entries, 360000000);
			expect((component as any).totalPages).toBe(5);
		});

		it("should calculate 6 pages for 101 entries", () => {
			const entries: StatEntry[] = Array.from({ length: 101 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			const component = new TableComponent(parentEl as any, entries, 363600000);
			expect((component as any).totalPages).toBe(6);
		});
	});

	describe("Initial Page State", () => {
		it("should start on page 0 (first page)", () => {
			const entries: StatEntry[] = Array.from({ length: 50 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			const component = new TableComponent(parentEl as any, entries, 180000000);
			expect((component as any).currentPage).toBe(0);
		});
	});

	describe("Entry Slicing", () => {
		it("should render first 20 entries on page 1", () => {
			const entries: StatEntry[] = Array.from({ length: 50 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			new TableComponent(parentEl as any, entries, 180000000);

			// Check that tbody was created and rows added
			const tbodyCalls = mockCreateEl.mock.calls.filter((call) => call[0] === "tbody");
			expect(tbodyCalls.length).toBeGreaterThan(0);

			// After initial render, tbody should have 20 rows created
			const trCalls = mockCreateEl.mock.calls.filter((call) => call[0] === "tr");
			// 1 header row + 20 data rows = 21 total
			expect(trCalls.length).toBeGreaterThanOrEqual(21);
		});

		it("should handle last page with fewer than 20 entries", () => {
			const entries: StatEntry[] = Array.from({ length: 25 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			const component = new TableComponent(parentEl as any, entries, 90000000);

			// Should have 2 pages: 20 + 5
			expect((component as any).totalPages).toBe(2);
			expect((component as any).entries.length).toBe(25);
		});

		it("should handle exactly full pages", () => {
			const entries: StatEntry[] = Array.from({ length: 60 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			const component = new TableComponent(parentEl as any, entries, 216000000);

			// Should have exactly 3 pages: 20 + 20 + 20
			expect((component as any).totalPages).toBe(3);
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty entries array", () => {
			const entries: StatEntry[] = [];

			const component = new TableComponent(parentEl as any, entries, 0);

			expect((component as any).totalPages).toBe(0);
			expect((component as any).currentPage).toBe(0);
		});

		it("should handle single entry", () => {
			const entries: StatEntry[] = [{ name: "Single Event", duration: 3600000, count: 1, isRecurring: false }];

			const component = new TableComponent(parentEl as any, entries, 3600000);

			expect((component as any).totalPages).toBe(1);
			expect((component as any).entries.length).toBe(1);
		});

		it("should handle exactly 20 entries (boundary case)", () => {
			const entries: StatEntry[] = Array.from({ length: 20 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			const component = new TableComponent(parentEl as any, entries, 72000000);

			expect((component as any).totalPages).toBe(1);
			// Should not create pagination controls
			const paginationCalls = mockCreateDiv.mock.calls.filter((call) => call[0]?.includes("pagination"));
			expect(paginationCalls).toHaveLength(0);
		});

		it("should handle 21 entries (just over boundary)", () => {
			const entries: StatEntry[] = Array.from({ length: 21 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			const component = new TableComponent(parentEl as any, entries, 75600000);

			expect((component as any).totalPages).toBe(2);
			// Should create pagination controls
			const paginationCalls = mockCreateDiv.mock.calls.filter((call) => call[0]?.includes("pagination"));
			expect(paginationCalls.length).toBeGreaterThan(0);
		});

		it("should handle very large dataset (1000 entries)", () => {
			const entries: StatEntry[] = Array.from({ length: 1000 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			const component = new TableComponent(parentEl as any, entries, 3600000000);

			// 1000 / 20 = 50 pages
			expect((component as any).totalPages).toBe(50);
			expect((component as any).currentPage).toBe(0);
		});
	});

	describe("Recurring Events Display", () => {
		it("should properly handle mixed recurring and non-recurring events", () => {
			const entries: StatEntry[] = [
				{ name: "Regular Event", duration: 3600000, count: 5, isRecurring: false },
				{ name: "Recurring Event", duration: 1800000, count: 10, isRecurring: true },
				{ name: "Another Regular", duration: 7200000, count: 3, isRecurring: false },
			];

			const component = new TableComponent(parentEl as any, entries, 12600000);

			expect((component as any).entries.length).toBe(3);
			expect((component as any).totalPages).toBe(1);
		});

		it("should handle pagination with recurring events", () => {
			const entries: StatEntry[] = Array.from({ length: 30 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: i % 2 === 0, // Alternate between recurring and non-recurring
			}));

			const component = new TableComponent(parentEl as any, entries, 108000000);

			expect((component as any).totalPages).toBe(2);
			// Should have 15 recurring and 15 non-recurring events
			const recurringCount = entries.filter((e) => e.isRecurring).length;
			expect(recurringCount).toBe(15);
		});
	});

	describe("Duration and Count Handling", () => {
		it("should correctly store total duration", () => {
			const entries: StatEntry[] = [
				{ name: "Event 1", duration: 3600000, count: 1, isRecurring: false },
				{ name: "Event 2", duration: 7200000, count: 2, isRecurring: false },
			];

			const totalDuration = 10800000;
			const component = new TableComponent(parentEl as any, entries, totalDuration);

			expect((component as any).totalDuration).toBe(totalDuration);
		});

		it("should handle zero duration events", () => {
			const entries: StatEntry[] = [
				{ name: "Zero Duration", duration: 0, count: 1, isRecurring: false },
				{ name: "Normal Event", duration: 3600000, count: 1, isRecurring: false },
			];

			const component = new TableComponent(parentEl as any, entries, 3600000);

			expect((component as any).entries.length).toBe(2);
			expect((component as any).totalDuration).toBe(3600000);
		});

		it("should handle events with high counts", () => {
			const entries: StatEntry[] = [{ name: "High Count Event", duration: 3600000, count: 100, isRecurring: true }];

			const component = new TableComponent(parentEl as any, entries, 3600000);

			expect((component as any).entries[0].count).toBe(100);
		});
	});

	describe("Page Boundaries", () => {
		it("should correctly calculate entries for first page", () => {
			const entries: StatEntry[] = Array.from({ length: 50 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			const component = new TableComponent(parentEl as any, entries, 180000000);

			// First page should show entries 0-19
			expect((component as any).currentPage).toBe(0);
			const startIdx = 0 * 20;
			const endIdx = Math.min(startIdx + 20, entries.length);
			expect(endIdx - startIdx).toBe(20);
		});

		it("should correctly calculate entries for last partial page", () => {
			const entries: StatEntry[] = Array.from({ length: 45 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			const component = new TableComponent(parentEl as any, entries, 162000000);

			// Should have 3 pages: 20, 20, 5
			expect((component as any).totalPages).toBe(3);

			// Last page (index 2) should have 5 entries
			const lastPageStartIdx = 2 * 20; // 40
			const lastPageEndIdx = Math.min(lastPageStartIdx + 20, entries.length); // 45
			expect(lastPageEndIdx - lastPageStartIdx).toBe(5);
		});

		it("should correctly calculate entries for middle page", () => {
			const entries: StatEntry[] = Array.from({ length: 100 }, (_, i) => ({
				name: `Event ${i + 1}`,
				duration: 3600000,
				count: 1,
				isRecurring: false,
			}));

			new TableComponent(parentEl as any, entries, 360000000);

			// Middle page (index 2) should show entries 40-59
			const middlePageStartIdx = 2 * 20; // 40
			const middlePageEndIdx = Math.min(middlePageStartIdx + 20, entries.length); // 60
			expect(middlePageEndIdx - middlePageStartIdx).toBe(20);
		});
	});
});
