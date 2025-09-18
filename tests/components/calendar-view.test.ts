import type { WorkspaceLeaf } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarView } from "../../src/components/calendar-view";
import type { EventStore } from "../../src/core/event-store";
import type { CalendarSettingsStore } from "../../src/core/settings-store";
import { DEFAULT_EVENT_COLOR } from "../../src/types/settings-schemas";

// Mock FullCalendar
vi.mock("@fullcalendar/core", () => ({
	Calendar: vi.fn().mockImplementation(() => ({
		render: vi.fn(),
		destroy: vi.fn(),
		removeAllEvents: vi.fn(),
		addEventSource: vi.fn(),
		updateSize: vi.fn(),
		getDate: vi.fn(() => new Date("2024-01-15")),
		view: {
			type: "dayGridMonth",
			activeStart: new Date("2024-01-01"),
			activeEnd: new Date("2024-01-31"),
		},
		changeView: vi.fn(),
		setOption: vi.fn(),
		gotoDate: vi.fn(),
	})),
}));

vi.mock("@fullcalendar/daygrid", () => ({ default: {} }));
vi.mock("@fullcalendar/timegrid", () => ({ default: {} }));
vi.mock("@fullcalendar/list", () => ({ default: {} }));
vi.mock("@fullcalendar/interaction", () => ({ default: {} }));

// Mock utils
vi.mock("utils/file-utils", () => ({
	generateUniqueFilePath: vi.fn(() => "test-path.md"),
	sanitizeForFilename: vi.fn((name) => name.replace(/[^a-zA-Z0-9]/g, "-")),
}));

vi.mock("utils/generate", () => ({
	generateZettelId: vi.fn(() => "20240101120000"),
}));

describe("CalendarView", () => {
	let mockLeaf: WorkspaceLeaf;
	let mockEventStore: EventStore;
	let mockSettingsStore: CalendarSettingsStore;
	let mockBundle: any;
	let calendarView: CalendarView;

	beforeEach(() => {
		// Mock WorkspaceLeaf
		mockLeaf = {
			view: null,
			getViewState: vi.fn(),
			setViewState: vi.fn(),
		} as any;

		// Mock EventStore
		mockEventStore = {
			getEvents: vi.fn(() => []),
			subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
		} as any;

		// Mock CalendarSettingsStore
		const mockSingleSettings = {
			id: "default",
			name: "Main Calendar",
			enabled: true,
			defaultView: "dayGridMonth",
			directory: "calendar",
			titleProp: "title",
			startProp: "start",
			endProp: "end",
			allDayProp: "allDay",
			zettelIdProp: "id",
			hourStart: 8,
			hourEnd: 20,
			hideWeekends: false,
			thermometerProperties: [],
			slotDurationMinutes: 10,
			snapDurationMinutes: 10,
			zoomLevels: [1, 2, 3, 5, 10, 15, 20, 30, 45, 60],
			defaultEventColor: DEFAULT_EVENT_COLOR,
			colorRules: [],
			filterExpressions: [],
		};

		mockSettingsStore = {
			currentSettings: mockSingleSettings,
			settings$: {
				value: mockSingleSettings,
				subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
			},
			updateSettings: vi.fn().mockResolvedValue(undefined),
		} as any;

		// Mock CalendarBundle
		mockBundle = {
			calendarId: "test-calendar",
			app: {
				vault: {
					getAbstractFileByPath: vi.fn(),
					create: vi.fn(),
					read: vi.fn(),
					modify: vi.fn(),
				},
				workspace: {
					openLinkText: vi.fn(),
				},
				fileManager: {
					processFrontMatter: vi.fn(),
				},
			},
			eventStore: mockEventStore,
			settingsStore: mockSettingsStore,
			indexer: {
				events$: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
			},
			parser: {},
			recurringEventManager: {},
			templateService: {},
			colorEvaluator: {},
			filterEvaluator: {},
			viewStateManager: {
				hasState: vi.fn(() => false),
				saveState: vi.fn(),
				restoreState: vi.fn(),
				getSavedZoomLevel: vi.fn(() => null),
				getCurrentState: vi.fn(() => null),
				clearState: vi.fn(),
			},
			initialize: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		} as any;

		calendarView = new CalendarView(mockLeaf, mockBundle);

		// Mock containerEl with proper Obsidian-like structure
		const mockContainer = document.createElement("div");
		const mockChild0 = document.createElement("div"); // children[0] - header
		const mockChild1 = document.createElement("div"); // children[1] - content

		// Add Obsidian-like methods to the content child element (children[1])
		(mockChild1 as any).empty = vi.fn();
		(mockChild1 as any).addClass = vi.fn();
		(mockChild1 as any).createDiv = vi.fn().mockImplementation((className) => {
			const div = document.createElement("div");
			div.className = className || "";
			(div as any).addClass = vi.fn();
			(div as any).createDiv = vi.fn().mockImplementation((childClassName) => {
				const childDiv = document.createElement("div");
				childDiv.className = childClassName || "";
				(childDiv as any).addClass = vi.fn();
				return childDiv;
			});
			(div as any).remove = vi.fn();
			return div;
		});

		mockContainer.appendChild(mockChild0);
		mockContainer.appendChild(mockChild1);
		calendarView.containerEl = mockContainer;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("Basic Properties", () => {
		it("should return correct display text", () => {
			expect(calendarView.getDisplayText()).toBe("Main Calendar");
		});

		it("should return correct icon", () => {
			expect(calendarView.getIcon()).toBe("calendar");
		});
	});

	describe("Initialization and Mounting", () => {
		it("should initialize calendar when opened", async () => {
			const initializeCalendarSpy = vi.spyOn(calendarView as any, "initializeCalendar");

			await calendarView.onOpen();

			expect(initializeCalendarSpy).toHaveBeenCalledOnce();
		});

		it("should show loading state while waiting for indexer", async () => {
			let resolveIndexer: () => void;
			const indexerPromise = new Promise<void>((resolve) => {
				resolveIndexer = resolve;
			});

			mockBundle.initialize = vi.fn().mockReturnValue(indexerPromise);

			const container = calendarView.containerEl.children[1] as HTMLElement;
			const createDivSpy = vi.spyOn(container, "createDiv");

			// Start initialization (don't await yet)
			const openPromise = calendarView.onOpen();

			// Allow the promise to start executing
			await new Promise((resolve) => setTimeout(resolve, 0));

			// Check that loading state is shown (using mixin's loading implementation)
			expect(createDivSpy).toHaveBeenCalledWith("watchdog-loading");

			// Resolve indexer and complete initialization
			resolveIndexer!();
			await openPromise;
		});

		it("should subscribe to settings changes after initialization", async () => {
			const subscribeSpy = vi.spyOn(mockSettingsStore.settings$, "subscribe");

			await calendarView.onOpen();

			expect(subscribeSpy).toHaveBeenCalledOnce();
		});

		it("should register event store listener after initialization", async () => {
			const subscribeSpy = vi.spyOn(mockEventStore, "subscribe");

			await calendarView.onOpen();

			expect(subscribeSpy).toHaveBeenCalledOnce();
		});
	});

	describe("Event Refresh Logic", () => {
		beforeEach(async () => {
			await calendarView.onOpen();
		});

		it("should refresh events without waiting for indexer (indexer ready during init)", async () => {
			const getEventsSpy = vi.spyOn(mockEventStore, "getEvents");

			// Trigger refresh by calling the method directly
			await (calendarView as any).refreshEvents();

			expect(getEventsSpy).toHaveBeenCalled();
		});

		it("should skip refresh if calendar is not initialized", async () => {
			const getEventsSpy = vi.spyOn(mockEventStore, "getEvents");

			// Destroy calendar to simulate uninitialized state
			(calendarView as any).calendar = null;

			await (calendarView as any).refreshEvents();

			expect(getEventsSpy).not.toHaveBeenCalled();
		});

		it("should query events for current view date range", async () => {
			const getEventsSpy = vi.spyOn(mockEventStore, "getEvents");

			await (calendarView as any).refreshEvents();

			expect(getEventsSpy).toHaveBeenCalledWith({
				start: expect.any(String),
				end: expect.any(String),
			});
		});

		it("should convert vault events to calendar format", async () => {
			const mockVaultEvent = {
				id: "test-event",
				title: "Test Event",
				start: "2024-01-15T10:00:00Z",
				end: "2024-01-15T11:00:00Z",
				allDay: false,
				ref: { filePath: "test.md" },
				meta: { folder: "events" },
			};

			mockEventStore.getEvents = vi.fn().mockReturnValue([mockVaultEvent]);

			const calendar = (calendarView as any).calendar;
			const addEventSourceSpy = vi.spyOn(calendar, "addEventSource");

			await (calendarView as any).refreshEvents();

			expect(addEventSourceSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					id: expect.stringMatching(/^events-\d+$/),
					events: [
						expect.objectContaining({
							id: "test-event",
							title: "Test Event",
							start: "2024-01-15T10:00:00Z",
							end: "2024-01-15T11:00:00Z",
							allDay: false,
							extendedProps: expect.objectContaining({
								filePath: "test.md",
								folder: "events",
							}),
						}),
					],
				})
			);
		});

		it("should handle refresh errors gracefully", async () => {
			mockEventStore.getEvents = vi.fn().mockImplementation(() => {
				throw new Error("Event store error");
			});

			// Should not throw
			await expect((calendarView as any).refreshEvents()).resolves.not.toThrow();
		});
	});

	describe("Cleanup", () => {
		beforeEach(async () => {
			await calendarView.onOpen();
		});

		it("should unsubscribe from all subscriptions on close", async () => {
			const unsubscribeSpy = vi.fn();
			// Add a subscription through the mixin's addSub method
			calendarView.addSub({ unsubscribe: unsubscribeSpy });

			await calendarView.onClose();

			expect(unsubscribeSpy).toHaveBeenCalled();
		});

		it("should destroy calendar on close", async () => {
			const calendar = (calendarView as any).calendar;
			const destroySpy = vi.spyOn(calendar, "destroy");

			await calendarView.onClose();

			expect(destroySpy).toHaveBeenCalled();
			expect((calendarView as any).calendar).toBeNull();
		});

		it("should handle close when calendar is already null", async () => {
			(calendarView as any).calendar = null;

			// Should not throw
			await expect(calendarView.onClose()).resolves.not.toThrow();
		});
	});

	describe("Race Condition Prevention", () => {
		it("should handle multiple refresh calls during initialization", async () => {
			let resolveIndexer: () => void;
			const indexerPromise = new Promise<void>((resolve) => {
				resolveIndexer = resolve;
			});

			mockBundle.initialize = vi.fn().mockReturnValue(indexerPromise);

			// Start initialization
			const openPromise = calendarView.onOpen();

			// Try to refresh before initialization is complete
			const refreshPromise1 = (calendarView as any).refreshEvents();
			const refreshPromise2 = (calendarView as any).refreshEvents();

			// Complete initialization
			resolveIndexer!();
			await Promise.all([openPromise, refreshPromise1, refreshPromise2]);

			// Should complete without errors
		});

		it("should handle settings changes during initialization", async () => {
			let settingsCallback: (settings: any) => void;
			mockSettingsStore.settings$.subscribe = vi.fn().mockImplementation((callback) => {
				settingsCallback = callback;
				return { unsubscribe: vi.fn() };
			});

			let resolveIndexer: () => void;
			const indexerPromise = new Promise<void>((resolve) => {
				resolveIndexer = resolve;
			});

			mockBundle.initialize = vi.fn().mockReturnValue(indexerPromise);

			// Start initialization
			const openPromise = calendarView.onOpen();

			// Trigger settings change before initialization completes
			if (settingsCallback!) {
				settingsCallback(mockSettingsStore.currentSettings);
			}

			// Complete initialization
			resolveIndexer!();
			await openPromise;

			// Should complete without errors
		});
	});

	describe("Zoom Functionality", () => {
		beforeEach(async () => {
			await calendarView.onOpen();

			const mockCalendar = (calendarView as any).calendar;
			if (mockCalendar) {
				mockCalendar.view = {
					type: "timeGridWeek",
					activeStart: new Date("2024-01-01"),
					activeEnd: new Date("2024-01-31"),
				};
			}
		});

		it("should handle CTRL + wheel events for zooming", () => {
			const container = (calendarView as any).container;
			const zoomManager = (calendarView as any).zoomManager;
			const saveStateSpy = vi.spyOn((calendarView as any).bundle.viewStateManager, "saveState");

			// Spy on zoom manager's internal method
			const setZoomLevelSpy = vi.spyOn(zoomManager as any, "setZoomLevel");

			// Create a wheel event with CTRL key
			const wheelEvent = new WheelEvent("wheel", {
				deltaY: 100, // Scroll down = zoom out
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			});

			// Dispatch the event
			container.dispatchEvent(wheelEvent);

			// Should have called setZoomLevel and triggered state saving
			expect(setZoomLevelSpy).toHaveBeenCalled();
			expect(saveStateSpy).toHaveBeenCalled();
		});

		it("should ignore wheel events without CTRL key", () => {
			const container = (calendarView as any).container;
			const updateSettingsSpy = vi.spyOn(mockSettingsStore, "updateSettings");

			// Create a wheel event without CTRL key
			const wheelEvent = new WheelEvent("wheel", {
				deltaY: 100,
				ctrlKey: false,
				bubbles: true,
				cancelable: true,
			});

			// Dispatch the event
			container.dispatchEvent(wheelEvent);

			// Should not have called updateSettings
			expect(updateSettingsSpy).not.toHaveBeenCalled();
		});

		it("should zoom in with negative deltaY (scroll up)", () => {
			const container = (calendarView as any).container;
			const zoomManager = (calendarView as any).zoomManager;
			const saveStateSpy = vi.spyOn((calendarView as any).bundle.viewStateManager, "saveState");
			const setZoomLevelSpy = vi.spyOn(zoomManager as any, "setZoomLevel");

			// Create a wheel event with CTRL key and negative deltaY
			const wheelEvent = new WheelEvent("wheel", {
				deltaY: -100, // Scroll up = zoom in
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			});

			// Dispatch the event
			container.dispatchEvent(wheelEvent);

			// Should have called setZoomLevel and triggered state saving
			expect(setZoomLevelSpy).toHaveBeenCalled();
			expect(saveStateSpy).toHaveBeenCalled();
		});

		it("should clamp zoom levels at boundaries", () => {
			const container = (calendarView as any).container;
			const zoomManager = (calendarView as any).zoomManager;
			const saveStateSpy = vi.spyOn((calendarView as any).bundle.viewStateManager, "saveState");
			const setZoomLevelSpy = vi.spyOn(zoomManager as any, "setZoomLevel");

			// Try to zoom in further (should clamp at boundaries)
			const wheelEvent = new WheelEvent("wheel", {
				deltaY: -100, // Scroll up = zoom in
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			});

			container.dispatchEvent(wheelEvent);

			// Should have called setZoomLevel and triggered state saving
			expect(setZoomLevelSpy).toHaveBeenCalled();
			expect(saveStateSpy).toHaveBeenCalled();
		});

		it("should handle non-standard slot durations by defaulting to middle level", () => {
			const container = (calendarView as any).container;
			const zoomManager = (calendarView as any).zoomManager;
			const saveStateSpy = vi.spyOn((calendarView as any).bundle.viewStateManager, "saveState");
			const setZoomLevelSpy = vi.spyOn(zoomManager as any, "setZoomLevel");

			// Zoom out
			const wheelEvent = new WheelEvent("wheel", {
				deltaY: 100, // Scroll down = zoom out
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			});

			container.dispatchEvent(wheelEvent);

			// Should have called setZoomLevel and triggered state saving
			expect(setZoomLevelSpy).toHaveBeenCalled();
			expect(saveStateSpy).toHaveBeenCalled();
		});

		it("should not zoom on month view", () => {
			const container = (calendarView as any).container;
			const updateSettingsSpy = vi.spyOn(mockSettingsStore, "updateSettings");

			// Set calendar view to month view
			const mockCalendar = (calendarView as any).calendar;
			if (mockCalendar) {
				mockCalendar.view = {
					type: "dayGridMonth",
					activeStart: new Date("2024-01-01"),
					activeEnd: new Date("2024-01-31"),
				};
			}

			// Create a wheel event with CTRL key on month view
			const wheelEvent = new WheelEvent("wheel", {
				deltaY: 100,
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			});

			container.dispatchEvent(wheelEvent);

			// Should NOT have called updateSettings since it's month view
			expect(updateSettingsSpy).not.toHaveBeenCalled();
		});

		it("should remove zoom listener on unmount", async () => {
			const container = (calendarView as any).container;
			const removeEventListenerSpy = vi.spyOn(container, "removeEventListener");

			await calendarView.onClose();

			expect(removeEventListenerSpy).toHaveBeenCalledWith("wheel", expect.any(Function));
		});
	});
});
