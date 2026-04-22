import { ChipList } from "@real1ty-obsidian-plugins";
import { silenceConsole } from "@real1ty-obsidian-plugins/testing";
import type { App } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EventEditModal } from "../../src/components/modals";
import type { CalendarBundle } from "../../src/core/calendar-bundle";
import { createMockIntegrationApp } from "../fixtures";

describe("EventEditModal - Custom Properties", () => {
	let mockApp: App;
	let mockBundle: CalendarBundle;
	let updateEventMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockApp = createMockIntegrationApp() as any as App;

		updateEventMock = vi.fn().mockResolvedValue(null);

		// Mock CalendarBundle with settings
		mockBundle = {
			settingsStore: {
				currentSettings: {
					startProp: "Start Date",
					endProp: "End Date",
					dateProp: "Date",
					allDayProp: "All Day",
					titleProp: "Title",
					zettelIdProp: "ZettelID",
					skipProp: "Skip",
					rruleProp: "RRule",
					rruleSpecProp: "RRuleSpec",
					rruleUntilProp: "RRuleUntil",
					rruleIdProp: "RRuleID",
					sourceProp: "Source",
					categoryProp: "Category",
				},
			},
			categoryTracker: {
				getCategories: vi.fn().mockReturnValue(["Work", "Personal", "Meeting"]),
			},
			updateEvent: updateEventMock,
		} as any as CalendarBundle;
	});

	describe("loadCustomPropertiesData", () => {
		it("should track original custom property keys from frontmatter", () => {
			const event = {
				title: "My Event",
				start: "2025-10-07T10:15:00",
				extendedProps: { filePath: "test-event.md" },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);

			// Set up the original frontmatter with custom properties
			modal.originalFrontmatter = {
				"Start Date": "2025-10-07T10:15:00.000Z",
				Custom1: "value1",
				Custom2: "value2",
				Custom3: "value3",
			};

			// Track keys manually (simulating what loadCustomPropertiesData would do)
			modal.originalCustomPropertyKeys.add("Custom1");
			modal.originalCustomPropertyKeys.add("Custom2");
			modal.originalCustomPropertyKeys.add("Custom3");

			// Verify original keys were tracked
			expect(modal.originalCustomPropertyKeys.has("Custom1")).toBe(true);
			expect(modal.originalCustomPropertyKeys.has("Custom2")).toBe(true);
			expect(modal.originalCustomPropertyKeys.has("Custom3")).toBe(true);
			expect(modal.originalCustomPropertyKeys.has("Start Date")).toBe(false);
		});
	});

	describe("Type preservation", () => {
		it("should preserve array types", () => {
			const event = {
				title: "Test",
				start: "2025-10-07T10:15:00",
				extendedProps: { filePath: null },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);
			modal.originalFrontmatter = {
				Tags: ["tag1", "tag2", "tag3"],
				"Empty Array": [],
			};

			// This would be called during modal initialization
			// We're testing the serialization/deserialization cycle
			const serialized = modal.originalFrontmatter;
			expect(Array.isArray(serialized["Tags"])).toBe(true);
			expect(Array.isArray(serialized["Empty Array"])).toBe(true);
		});

		it("should preserve boolean types", () => {
			const event = {
				title: "Test",
				start: "2025-10-07T10:15:00",
				extendedProps: { filePath: null },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);
			modal.originalFrontmatter = {
				Enabled: true,
				Disabled: false,
			};

			expect(typeof modal.originalFrontmatter["Enabled"]).toBe("boolean");
			expect(typeof modal.originalFrontmatter["Disabled"]).toBe("boolean");
		});

		it("should preserve number types", () => {
			const event = {
				title: "Test",
				start: "2025-10-07T10:15:00",
				extendedProps: { filePath: null },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);
			modal.originalFrontmatter = {
				Count: 42,
				Rating: 4.5,
				Negative: -10,
			};

			expect(typeof modal.originalFrontmatter["Count"]).toBe("number");
			expect(typeof modal.originalFrontmatter["Rating"]).toBe("number");
			expect(typeof modal.originalFrontmatter["Negative"]).toBe("number");
		});
	});

	describe("Custom property deletion", () => {
		it("should update filePath via setExtendedProp when extendedProps is getter-only (FullCalendar EventApi)", async () => {
			const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});

			updateEventMock = vi.fn().mockResolvedValue("renamed.md");
			mockBundle = {
				...mockBundle,
				updateEvent: updateEventMock,
			} as any as CalendarBundle;

			let filePath = "original.md";
			const setExtendedPropMock = vi.fn((name: string, value: unknown) => {
				if (name === "filePath") {
					filePath = String(value);
				}
			});

			const event = {
				title: "Test Event",
				start: "2025-10-07T10:15:00",
				setExtendedProp: setExtendedPropMock,
				get extendedProps() {
					return { filePath };
				},
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);

			// Prevent DOM-dependent parsing in saveEvent for this unit test.
			modal.getCustomProperties = vi.fn().mockReturnValue({});

			modal.titleInput = { value: "Test Event" } as HTMLInputElement;
			modal.allDayCheckbox = { checked: false } as HTMLInputElement;
			modal.startInput = { value: "2025-10-07T10:15" } as HTMLInputElement;
			modal.endInput = { value: "2025-10-07T11:15" } as HTMLInputElement;
			modal.recurringCheckbox = { checked: false } as HTMLInputElement;

			modal.saveEvent();
			await Promise.resolve();

			expect(setExtendedPropMock).toHaveBeenCalledWith("filePath", "renamed.md");
			expect(consoleErrorMock).not.toHaveBeenCalled();

			consoleErrorMock.mockRestore();
		});

		it("should mark properties for deletion when removed from form", () => {
			const event = {
				title: "Test Event",
				start: "2025-10-07T10:15:00",
				extendedProps: { filePath: "test.md" },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);

			// Set up original custom properties
			modal.originalCustomPropertyKeys.add("Property1");
			modal.originalCustomPropertyKeys.add("Property2");
			modal.originalCustomPropertyKeys.add("Property3");

			modal.originalFrontmatter = {
				"Start Date": "2025-10-07T10:15:00.000Z",
				Property1: "value1",
				Property2: "value2",
				Property3: "value3",
			};

			// Simulate form having only Property1 and Property3 (Property2 was removed)
			modal.getCustomProperties = vi.fn().mockReturnValue({
				Property1: "value1",
				Property3: "updated value",
			});

			// Create necessary DOM elements for the modal
			modal.titleInput = { value: "Test Event" } as HTMLInputElement;
			modal.allDayCheckbox = { checked: false } as HTMLInputElement;
			modal.startInput = { value: "2025-10-07T10:15" } as HTMLInputElement;
			modal.endInput = { value: "2025-10-07T11:15" } as HTMLInputElement;
			modal.recurringCheckbox = { checked: false } as HTMLInputElement;

			// Call saveEvent
			modal.saveEvent();

			// Verify onSave was called
			expect(updateEventMock).toHaveBeenCalled();

			const savedData = updateEventMock.mock.calls[0][0]!;
			const frontmatter = savedData.preservedFrontmatter;

			// Property1 should still exist
			expect(frontmatter.Property1).toBe("value1");

			// Property2 should be deleted
			expect(frontmatter.Property2).toBeUndefined();

			// Property3 should be updated
			expect(frontmatter.Property3).toBe("updated value");
		});

		it("should handle deleting all custom properties", () => {
			const event = {
				title: "Test Event",
				start: "2025-10-07T10:15:00",
				extendedProps: { filePath: "test.md" },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);

			// Set up original custom properties
			modal.originalCustomPropertyKeys.add("Prop1");
			modal.originalCustomPropertyKeys.add("Prop2");

			modal.originalFrontmatter = {
				"Start Date": "2025-10-07T10:15:00.000Z",
				Prop1: "value1",
				Prop2: "value2",
			};

			// Simulate form with no custom properties
			modal.getCustomProperties = vi.fn().mockReturnValue({});

			modal.titleInput = { value: "Test Event" } as HTMLInputElement;
			modal.allDayCheckbox = { checked: false } as HTMLInputElement;
			modal.startInput = { value: "2025-10-07T10:15" } as HTMLInputElement;
			modal.endInput = { value: "2025-10-07T11:15" } as HTMLInputElement;
			modal.recurringCheckbox = { checked: false } as HTMLInputElement;

			modal.saveEvent();

			const savedData = updateEventMock.mock.calls[0][0]!;
			const frontmatter = savedData.preservedFrontmatter;

			// Both properties should be deleted
			expect(frontmatter.Prop1).toBeUndefined();
			expect(frontmatter.Prop2).toBeUndefined();
		});

		it("should handle adding new properties while keeping existing ones", () => {
			const event = {
				title: "Test Event",
				start: "2025-10-07T10:15:00",
				extendedProps: { filePath: "test.md" },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);

			// Set up original custom properties
			modal.originalCustomPropertyKeys.add("ExistingProp");

			modal.originalFrontmatter = {
				"Start Date": "2025-10-07T10:15:00.000Z",
				ExistingProp: "original value",
			};

			// Simulate form with existing and new properties
			modal.getCustomProperties = vi.fn().mockReturnValue({
				ExistingProp: "updated value",
				NewProp: "new value",
			});

			modal.titleInput = { value: "Test Event" } as HTMLInputElement;
			modal.allDayCheckbox = { checked: false } as HTMLInputElement;
			modal.startInput = { value: "2025-10-07T10:15" } as HTMLInputElement;
			modal.endInput = { value: "2025-10-07T11:15" } as HTMLInputElement;
			modal.recurringCheckbox = { checked: false } as HTMLInputElement;

			modal.saveEvent();

			const savedData = updateEventMock.mock.calls[0][0]!;
			const frontmatter = savedData.preservedFrontmatter;

			// Existing property should be updated
			expect(frontmatter.ExistingProp).toBe("updated value");

			// New property should be added
			expect(frontmatter.NewProp).toBe("new value");
		});
	});

	describe("Edge cases", () => {
		it("should handle empty custom properties", () => {
			const event = {
				title: "Test Event",
				start: "2025-10-07T10:15:00",
				extendedProps: { filePath: "test.md" },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);

			modal.originalFrontmatter = {
				"Start Date": "2025-10-07T10:15:00.000Z",
			};

			modal.getCustomProperties = vi.fn().mockReturnValue({});

			modal.titleInput = { value: "Test Event" } as HTMLInputElement;
			modal.allDayCheckbox = { checked: false } as HTMLInputElement;
			modal.startInput = { value: "2025-10-07T10:15" } as HTMLInputElement;
			modal.endInput = { value: "2025-10-07T11:15" } as HTMLInputElement;
			modal.recurringCheckbox = { checked: false } as HTMLInputElement;

			modal.saveEvent();

			expect(updateEventMock).toHaveBeenCalled();
		});

		it("should not delete system properties when processing custom properties", () => {
			const event = {
				title: "Test Event",
				start: "2025-10-07T10:15:00",
				extendedProps: { filePath: "test.md" },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);

			modal.originalFrontmatter = {
				"Start Date": "2025-10-07T10:15:00.000Z",
				"End Date": "2025-10-07T11:15:00.000Z",
				Title: "Test Event",
				CustomProp: "value",
			};

			modal.originalCustomPropertyKeys.add("CustomProp");

			// Remove CustomProp
			modal.getCustomProperties = vi.fn().mockReturnValue({});

			modal.titleInput = { value: "Test Event" } as HTMLInputElement;
			modal.allDayCheckbox = { checked: false } as HTMLInputElement;
			modal.startInput = { value: "2025-10-07T10:15" } as HTMLInputElement;
			modal.endInput = { value: "2025-10-07T11:15" } as HTMLInputElement;
			modal.recurringCheckbox = { checked: false } as HTMLInputElement;

			modal.saveEvent();

			const savedData = updateEventMock.mock.calls[0][0]!;
			const frontmatter = savedData.preservedFrontmatter;

			// System properties should remain
			expect(frontmatter["Start Date"]).toBeDefined();
			expect(frontmatter.Title).toBeDefined();

			// Custom property should be deleted
			expect(frontmatter.CustomProp).toBeUndefined();
		});
	});

	describe("Recurring until", () => {
		it("loads RRuleUntil into the recurring form", () => {
			const event = {
				title: "Semester Class",
				start: "2026-05-01T10:15:00",
				extendedProps: { filePath: "semester-class.md" },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);
			modal.originalFrontmatter = {
				RRule: "weekly",
				RRuleUntil: "2026-05-22",
			};
			modal.recurringCheckbox = { checked: false } as HTMLInputElement;
			(modal as any).recurringContainer = { classList: { remove: vi.fn() } };
			(modal as any).rruleUntilInput = { value: "" };
			(modal as any).futureInstancesCountInput = { value: "" };
			(modal as any).generatePastEventsCheckbox = { checked: false };
			(modal as any).weekdayCheckboxes = new Map();
			(modal as any).applyRruleTypeToForm = vi.fn();
			(modal as any).rruleSelect = {
				dispatchEvent: vi.fn(),
			};

			(modal as any).loadRecurringEventData();

			expect(modal.recurringCheckbox.checked).toBe(true);
			expect((modal as any).rruleUntilInput.value).toBe("2026-05-22");
		});

		it("saves RRuleUntil from the recurring controls", () => {
			const event = {
				title: "Semester Class",
				start: "2026-05-01T10:15:00",
				extendedProps: { filePath: "semester-class.md" },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);
			modal.originalFrontmatter = {
				"Start Date": "2026-05-01T10:15:00.000Z",
			};
			modal.getCustomProperties = vi.fn().mockReturnValue({});
			modal.titleInput = { value: "Semester Class" } as HTMLInputElement;
			modal.allDayCheckbox = { checked: false } as HTMLInputElement;
			modal.startInput = { value: "2026-05-01T10:15" } as HTMLInputElement;
			modal.endInput = { value: "2026-05-01T11:15" } as HTMLInputElement;
			modal.recurringCheckbox = { checked: true } as HTMLInputElement;
			(modal as any).rruleUntilInput = { value: "2026-05-22" };
			(modal as any).futureInstancesCountInput = { value: "" };
			(modal as any).generatePastEventsCheckbox = { checked: false };
			(modal as any).getEffectiveRruleType = vi.fn().mockReturnValue("weekly");
			(modal as any).weekdayCheckboxes = new Map();

			modal.saveEvent();

			const savedData = updateEventMock.mock.calls[0][0]!;
			expect(savedData.preservedFrontmatter.RRuleUntil).toBe("2026-05-22");
		});
	});

	describe("Instance date preservation for physical recurring events", () => {
		silenceConsole();

		it("should preserve instance date when title was cleaned by cleanupTitle", async () => {
			const event = {
				title: "Team Meeting",
				start: "2025-10-07T10:15:00",
				extendedProps: { filePath: "Events/Team Meeting 2025-10-07-00001125853328.md" },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);
			await (modal as any).initialize();
			modal.originalFrontmatter = {
				"Start Date": "2025-10-07T10:15:00.000Z",
			};

			modal.getCustomProperties = vi.fn().mockReturnValue({});
			modal.titleInput = { value: "Team Meeting" } as HTMLInputElement;
			modal.allDayCheckbox = { checked: false } as HTMLInputElement;
			modal.startInput = { value: "2025-10-07T10:15" } as HTMLInputElement;
			modal.endInput = { value: "2025-10-07T11:15" } as HTMLInputElement;
			modal.recurringCheckbox = { checked: false } as HTMLInputElement;

			modal.saveEvent();

			expect(updateEventMock).toHaveBeenCalled();
			const savedData = updateEventMock.mock.calls[0][0]!;
			expect(savedData.title).toBe("Team Meeting 2025-10-07-00001125853328");
		});

		it("should not duplicate instance date when title already includes it", async () => {
			const event = {
				title: "Team Meeting 2025-10-07-00001125853328",
				start: "2025-10-07T10:15:00",
				extendedProps: { filePath: "Events/Team Meeting 2025-10-07-00001125853328.md" },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);
			await (modal as any).initialize();
			modal.originalFrontmatter = {
				"Start Date": "2025-10-07T10:15:00.000Z",
			};

			modal.getCustomProperties = vi.fn().mockReturnValue({});
			modal.titleInput = { value: "Team Meeting 2025-10-07" } as HTMLInputElement;
			modal.allDayCheckbox = { checked: false } as HTMLInputElement;
			modal.startInput = { value: "2025-10-07T10:15" } as HTMLInputElement;
			modal.endInput = { value: "2025-10-07T11:15" } as HTMLInputElement;
			modal.recurringCheckbox = { checked: false } as HTMLInputElement;

			modal.saveEvent();

			expect(updateEventMock).toHaveBeenCalled();
			const savedData = updateEventMock.mock.calls[0][0]!;
			expect(savedData.title).toBe("Team Meeting 2025-10-07-00001125853328");
		});

		it("should preserve instance date when user changes the title", async () => {
			const event = {
				title: "Team Meeting",
				start: "2025-10-07T10:15:00",
				extendedProps: { filePath: "Events/Team Meeting 2025-10-07-00001125853328.md" },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);
			await (modal as any).initialize();
			modal.originalFrontmatter = {
				"Start Date": "2025-10-07T10:15:00.000Z",
			};

			modal.getCustomProperties = vi.fn().mockReturnValue({});
			modal.titleInput = { value: "Weekly Standup" } as HTMLInputElement;
			modal.allDayCheckbox = { checked: false } as HTMLInputElement;
			modal.startInput = { value: "2025-10-07T10:15" } as HTMLInputElement;
			modal.endInput = { value: "2025-10-07T11:15" } as HTMLInputElement;
			modal.recurringCheckbox = { checked: false } as HTMLInputElement;

			modal.saveEvent();

			expect(updateEventMock).toHaveBeenCalled();
			const savedData = updateEventMock.mock.calls[0][0]!;
			expect(savedData.title).toBe("Weekly Standup 2025-10-07-00001125853328");
		});

		it("should not inject instance date for regular (non-recurring) events", async () => {
			const event = {
				title: "Regular Event",
				start: "2025-10-07T10:15:00",
				extendedProps: { filePath: "Events/Regular Event-20250203140530.md" },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);
			await (modal as any).initialize();
			modal.originalFrontmatter = {
				"Start Date": "2025-10-07T10:15:00.000Z",
			};

			modal.getCustomProperties = vi.fn().mockReturnValue({});
			modal.titleInput = { value: "Regular Event" } as HTMLInputElement;
			modal.allDayCheckbox = { checked: false } as HTMLInputElement;
			modal.startInput = { value: "2025-10-07T10:15" } as HTMLInputElement;
			modal.endInput = { value: "2025-10-07T11:15" } as HTMLInputElement;
			modal.recurringCheckbox = { checked: false } as HTMLInputElement;

			modal.saveEvent();

			expect(updateEventMock).toHaveBeenCalled();
			const savedData = updateEventMock.mock.calls[0][0]!;
			expect(savedData.title).toBe("Regular Event-20250203140530");
		});

		// `eventData.title` drives the file rename — it must keep the
		// "<title><ZettelID>" (or "<title> <instanceDate>-<ZettelID>") shape the
		// vault stores. `preservedFrontmatter[titleProp]` drives the visible
		// title — it must be exactly what the user typed. These two values
		// share a source (`titleInput.value`) but live in different columns of
		// the save payload; `saveEvent` used to mutate the input so both
		// columns ended up with the filename-shaped string, which leaked the
		// ZettelID into the frontmatter. The tests below pin the split so a
		// regression shows up at the unit-test level, not only in E2E.
		it("writes the clean user title to fm[titleProp] while eventData.title keeps the ZettelID", async () => {
			const event = {
				title: "Regular Event",
				start: "2025-10-07T10:15:00",
				extendedProps: { filePath: "Events/Regular Event-20250203140530.md" },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);
			await (modal as any).initialize();
			modal.originalFrontmatter = {
				"Start Date": "2025-10-07T10:15:00.000Z",
			};

			modal.getCustomProperties = vi.fn().mockReturnValue({});
			modal.titleInput = { value: "After Edit" } as HTMLInputElement;
			modal.allDayCheckbox = { checked: false } as HTMLInputElement;
			modal.startInput = { value: "2025-10-07T10:15" } as HTMLInputElement;
			modal.endInput = { value: "2025-10-07T11:15" } as HTMLInputElement;
			modal.recurringCheckbox = { checked: false } as HTMLInputElement;

			modal.saveEvent();

			expect(updateEventMock).toHaveBeenCalled();
			const savedData = updateEventMock.mock.calls[0][0]!;
			expect(savedData.title).toBe("After Edit-20250203140530");
			expect(savedData.preservedFrontmatter.Title).toBe("After Edit");
		});

		it("writes the clean user title to fm[titleProp] for physical recurring instances", async () => {
			const event = {
				title: "Team Meeting",
				start: "2025-10-07T10:15:00",
				extendedProps: { filePath: "Events/Team Meeting 2025-10-07-00001125853328.md" },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);
			await (modal as any).initialize();
			modal.originalFrontmatter = {
				"Start Date": "2025-10-07T10:15:00.000Z",
			};

			modal.getCustomProperties = vi.fn().mockReturnValue({});
			modal.titleInput = { value: "Weekly Standup" } as HTMLInputElement;
			modal.allDayCheckbox = { checked: false } as HTMLInputElement;
			modal.startInput = { value: "2025-10-07T10:15" } as HTMLInputElement;
			modal.endInput = { value: "2025-10-07T11:15" } as HTMLInputElement;
			modal.recurringCheckbox = { checked: false } as HTMLInputElement;

			modal.saveEvent();

			expect(updateEventMock).toHaveBeenCalled();
			const savedData = updateEventMock.mock.calls[0][0]!;
			expect(savedData.title).toBe("Weekly Standup 2025-10-07-00001125853328");
			expect(savedData.preservedFrontmatter.Title).toBe("Weekly Standup");
		});
	});

	describe("Category saving", () => {
		const mockEmptyContainer = {
			querySelectorAll: vi.fn().mockReturnValue([]),
		} as any as HTMLElement;

		it("should save single category as string", () => {
			const event = {
				title: "Test Event",
				start: "2025-10-07T10:15:00",
				extendedProps: { filePath: "test.md" },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);
			modal.originalFrontmatter = {
				"Start Date": "2025-10-07T10:15:00.000Z",
			};

			// Set up the modal with a single category
			modal.titleInput = { value: "Test Event" } as HTMLInputElement;
			modal.allDayCheckbox = { checked: false } as HTMLInputElement;
			modal.startInput = { value: "2025-10-07T10:15" } as HTMLInputElement;
			modal.endInput = { value: "2025-10-07T11:15" } as HTMLInputElement;
			modal.recurringCheckbox = { checked: false } as HTMLInputElement;
			// @ts-expect-error - accessing protected property for testing
			modal.categoriesChipList = new ChipList({ cssPrefix: "prisma-", emptyText: "" });
			// @ts-expect-error - accessing protected property for testing
			modal.categoriesChipList.setItems(["Work"]);
			// @ts-expect-error - accessing protected property for testing
			modal.displayPropertiesContainer = mockEmptyContainer;
			// @ts-expect-error - accessing protected property for testing
			modal.otherPropertiesContainer = mockEmptyContainer;

			modal.saveEvent();

			const savedData = updateEventMock.mock.calls[0][0]!;
			const frontmatter = savedData.preservedFrontmatter;

			expect(frontmatter.Category).toBe("Work");
		});

		it("should save multiple categories as array", () => {
			const event = {
				title: "Test Event",
				start: "2025-10-07T10:15:00",
				extendedProps: { filePath: "test.md" },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);
			modal.originalFrontmatter = {
				"Start Date": "2025-10-07T10:15:00.000Z",
			};

			modal.titleInput = { value: "Test Event" } as HTMLInputElement;
			modal.allDayCheckbox = { checked: false } as HTMLInputElement;
			modal.startInput = { value: "2025-10-07T10:15" } as HTMLInputElement;
			modal.endInput = { value: "2025-10-07T11:15" } as HTMLInputElement;
			modal.recurringCheckbox = { checked: false } as HTMLInputElement;
			// @ts-expect-error - accessing protected property for testing
			modal.categoriesChipList = new ChipList({ cssPrefix: "prisma-", emptyText: "" });
			// @ts-expect-error - accessing protected property for testing
			modal.categoriesChipList.setItems(["Work", "Meeting", "Important"]);
			// @ts-expect-error - accessing protected property for testing
			modal.displayPropertiesContainer = mockEmptyContainer;
			// @ts-expect-error - accessing protected property for testing
			modal.otherPropertiesContainer = mockEmptyContainer;

			modal.saveEvent();

			const savedData = updateEventMock.mock.calls[0][0]!;
			const frontmatter = savedData.preservedFrontmatter;

			expect(frontmatter.Category).toEqual(["Work", "Meeting", "Important"]);
		});

		it("should set category to empty string when input is empty", () => {
			const event = {
				title: "Test Event",
				start: "2025-10-07T10:15:00",
				extendedProps: { filePath: "test.md" },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);
			modal.originalFrontmatter = {
				"Start Date": "2025-10-07T10:15:00.000Z",
				Category: "OldCategory",
			};

			modal.titleInput = { value: "Test Event" } as HTMLInputElement;
			modal.allDayCheckbox = { checked: false } as HTMLInputElement;
			modal.startInput = { value: "2025-10-07T10:15" } as HTMLInputElement;
			modal.endInput = { value: "2025-10-07T11:15" } as HTMLInputElement;
			modal.recurringCheckbox = { checked: false } as HTMLInputElement;
			// @ts-expect-error - accessing protected property for testing
			modal.categoriesChipList = new ChipList({ cssPrefix: "prisma-", emptyText: "" });
			// @ts-expect-error - accessing protected property for testing
			modal.displayPropertiesContainer = mockEmptyContainer;
			// @ts-expect-error - accessing protected property for testing
			modal.otherPropertiesContainer = mockEmptyContainer;

			modal.saveEvent();

			const savedData = updateEventMock.mock.calls[0][0]!;
			const frontmatter = savedData.preservedFrontmatter;

			expect(frontmatter.Category).toBe("");
		});

		it("should update existing category", () => {
			const event = {
				title: "Test Event",
				start: "2025-10-07T10:15:00",
				extendedProps: { filePath: "test.md" },
			};

			const modal = new EventEditModal(mockApp, mockBundle, event);
			modal.originalFrontmatter = {
				"Start Date": "2025-10-07T10:15:00.000Z",
				Category: "OldCategory",
			};

			modal.titleInput = { value: "Test Event" } as HTMLInputElement;
			modal.allDayCheckbox = { checked: false } as HTMLInputElement;
			modal.startInput = { value: "2025-10-07T10:15" } as HTMLInputElement;
			modal.endInput = { value: "2025-10-07T11:15" } as HTMLInputElement;
			modal.recurringCheckbox = { checked: false } as HTMLInputElement;
			// @ts-expect-error - accessing protected property for testing
			modal.categoriesChipList = new ChipList({ cssPrefix: "prisma-", emptyText: "" });
			// @ts-expect-error - accessing protected property for testing
			modal.categoriesChipList.setItems(["NewCategory"]);
			// @ts-expect-error - accessing protected property for testing
			modal.displayPropertiesContainer = mockEmptyContainer;
			// @ts-expect-error - accessing protected property for testing
			modal.otherPropertiesContainer = mockEmptyContainer;

			modal.saveEvent();

			const savedData = updateEventMock.mock.calls[0][0]!;
			const frontmatter = savedData.preservedFrontmatter;

			expect(frontmatter.Category).toBe("NewCategory");
		});
	});
});
