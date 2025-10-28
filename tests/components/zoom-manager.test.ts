import type { Calendar } from "@fullcalendar/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZoomManager } from "../../src/components/zoom-manager";
import type { CalendarSettingsStore } from "../../src/core/settings-store";

describe("ZoomManager", () => {
	let zoomManager: ZoomManager;
	let mockSettingsStore: CalendarSettingsStore;
	let mockCalendar: Calendar;
	let mockContainer: HTMLElement;
	let mockButton: HTMLElement;

	beforeEach(() => {
		// Reset DOM
		document.body.innerHTML = "";

		// Create mock button element
		mockButton = document.createElement("button");
		mockButton.className = "fc-zoomLevel-button";
		document.body.appendChild(mockButton);

		// Create mock container
		mockContainer = document.createElement("div");
		mockContainer.className = "calendar-container";
		document.body.appendChild(mockContainer);

		// Create mock settings store
		mockSettingsStore = {
			currentSettings: {
				slotDurationMinutes: 30,
				zoomLevels: [5, 10, 15, 30, 60, 90, 120],
			},
		} as CalendarSettingsStore;

		// Create mock calendar
		mockCalendar = {
			el: document.body,
			view: {
				type: "timeGridWeek",
			},
			setOption: vi.fn(),
		} as unknown as Calendar;

		zoomManager = new ZoomManager(mockSettingsStore);
	});

	describe("initialization", () => {
		it("should initialize with settings store zoom level", () => {
			expect(zoomManager.getCurrentZoomLevel()).toBe(30);
		});

		it("should set up zoom listener on initialize", () => {
			const addEventListenerSpy = vi.spyOn(mockContainer, "addEventListener");

			zoomManager.initialize(mockCalendar, mockContainer);

			expect(addEventListenerSpy).toHaveBeenCalledWith("wheel", expect.any(Function), {
				passive: false,
			});
		});

		it("should update zoom level button on initialize", () => {
			zoomManager.initialize(mockCalendar, mockContainer);

			expect(mockButton.textContent).toBe("Zoom: 30min");
		});
	});

	describe("destroy", () => {
		it("should remove zoom listener on destroy", () => {
			const removeEventListenerSpy = vi.spyOn(mockContainer, "removeEventListener");

			zoomManager.initialize(mockCalendar, mockContainer);
			zoomManager.destroy();

			expect(removeEventListenerSpy).toHaveBeenCalledWith("wheel", expect.any(Function));
		});

		it("should clear calendar and container references", () => {
			zoomManager.initialize(mockCalendar, mockContainer);
			zoomManager.destroy();

			// Button should not be updated after destroy
			mockButton.textContent = "Old Text";
			zoomManager.updateZoomLevelButton();
			expect(mockButton.textContent).toBe("Old Text");
		});
	});

	describe("updateZoomLevelButton", () => {
		beforeEach(() => {
			zoomManager.initialize(mockCalendar, mockContainer);
		});

		it("should update button text correctly", () => {
			zoomManager.updateZoomLevelButton();
			expect(mockButton.textContent).toBe("Zoom: 30min");
		});

		it("should completely clear previous content before setting new text", () => {
			// Add some garbage content to button
			mockButton.innerHTML = "<span>Old</span> Text";
			mockButton.appendChild(document.createTextNode(" More"));

			zoomManager.updateZoomLevelButton();

			expect(mockButton.textContent).toBe("Zoom: 30min");
			expect(mockButton.innerHTML).toBe("Zoom: 30min");
			expect(mockButton.childNodes.length).toBe(1);
		});

		it("should handle multiple rapid updates without duplicating text", () => {
			// Simulate rapid updates
			for (let i = 0; i < 10; i++) {
				zoomManager.updateZoomLevelButton();
			}

			expect(mockButton.textContent).toBe("Zoom: 30min");
			expect(mockButton.innerHTML).toBe("Zoom: 30min");
		});

		it("should update when zoom level changes", () => {
			zoomManager.updateZoomLevelButton();
			expect(mockButton.textContent).toBe("Zoom: 30min");

			zoomManager.setCurrentZoomLevel(15);
			expect(mockButton.textContent).toBe("Zoom: 15min");
		});

		it("should show button for timeGrid views", () => {
			// Create calendar with timeGrid view
			const timeGridCalendar = {
				el: document.body,
				view: { type: "timeGridWeek" },
				setOption: vi.fn(),
			} as unknown as Calendar;

			const manager = new ZoomManager(mockSettingsStore);
			manager.initialize(timeGridCalendar, mockContainer);
			manager.updateZoomLevelButton();

			expect(mockButton.classList.contains("zoom-button-visible")).toBe(true);
			expect(mockButton.classList.contains("zoom-button-hidden")).toBe(false);
		});

		it("should hide button for non-timeGrid views", () => {
			// Create calendar with month view
			const monthViewCalendar = {
				el: document.body,
				view: { type: "dayGridMonth" },
				setOption: vi.fn(),
			} as unknown as Calendar;

			const manager = new ZoomManager(mockSettingsStore);
			manager.initialize(monthViewCalendar, mockContainer);
			manager.updateZoomLevelButton();

			expect(mockButton.classList.contains("zoom-button-hidden")).toBe(true);
			expect(mockButton.classList.contains("zoom-button-visible")).toBe(false);
		});

		it("should handle button not found gracefully", () => {
			// Remove button from DOM
			mockButton.remove();

			expect(() => zoomManager.updateZoomLevelButton()).not.toThrow();
		});

		it("should not update if text hasn't changed", () => {
			zoomManager.updateZoomLevelButton();
			const initialHTML = mockButton.innerHTML;

			// Update again with same zoom level
			zoomManager.updateZoomLevelButton();

			expect(mockButton.innerHTML).toBe(initialHTML);
		});

		it("should handle button with existing child elements", () => {
			// Simulate FullCalendar adding icon or other elements
			const icon = document.createElement("span");
			icon.className = "fc-icon";
			mockButton.appendChild(icon);
			mockButton.appendChild(document.createTextNode("Old Text"));

			zoomManager.updateZoomLevelButton();

			// Should completely replace all content
			expect(mockButton.textContent).toBe("Zoom: 30min");
			expect(mockButton.querySelector(".fc-icon")).toBeNull();
		});
	});

	describe("zoom level management", () => {
		beforeEach(() => {
			zoomManager.initialize(mockCalendar, mockContainer);
		});

		it("should get current zoom level", () => {
			expect(zoomManager.getCurrentZoomLevel()).toBe(30);
		});

		it("should set zoom level and update calendar", () => {
			zoomManager.setCurrentZoomLevel(15);

			expect(zoomManager.getCurrentZoomLevel()).toBe(15);
			expect(mockCalendar.setOption).toHaveBeenCalledWith("slotDuration", "00:15:00");
			expect(mockCalendar.setOption).toHaveBeenCalledWith("snapDuration", "00:15:00");
		});

		it("should update button when zoom level changes", () => {
			zoomManager.setCurrentZoomLevel(60);

			expect(mockButton.textContent).toBe("Zoom: 60min");
		});

		it("should call zoom change callback when zoom level changes", () => {
			const callback = vi.fn();
			zoomManager.setOnZoomChangeCallback(callback);

			zoomManager.setCurrentZoomLevel(15);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it("should handle zoom levels not in predefined list", () => {
			// Set a zoom level that doesn't exist in zoomLevels array
			zoomManager.setCurrentZoomLevel(45);

			expect(zoomManager.getCurrentZoomLevel()).toBe(45);
			expect(mockButton.textContent).toBe("Zoom: 45min");
		});
	});

	describe("wheel zoom", () => {
		beforeEach(() => {
			zoomManager.initialize(mockCalendar, mockContainer);
		});

		it("should zoom in on Ctrl+WheelUp", () => {
			const wheelEvent = new WheelEvent("wheel", {
				deltaY: -100,
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			});

			mockContainer.dispatchEvent(wheelEvent);

			// Should zoom to 15min (previous level from 30)
			expect(zoomManager.getCurrentZoomLevel()).toBe(15);
		});

		it("should zoom out on Ctrl+WheelDown", () => {
			const wheelEvent = new WheelEvent("wheel", {
				deltaY: 100,
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			});

			mockContainer.dispatchEvent(wheelEvent);

			// Should zoom to 60min (next level from 30)
			expect(zoomManager.getCurrentZoomLevel()).toBe(60);
		});

		it("should not zoom without Ctrl key", () => {
			const wheelEvent = new WheelEvent("wheel", {
				deltaY: 100,
				bubbles: true,
				cancelable: true,
			});

			mockContainer.dispatchEvent(wheelEvent);

			// Should stay at 30min
			expect(zoomManager.getCurrentZoomLevel()).toBe(30);
		});

		it("should not zoom on non-timeGrid views", () => {
			// Create calendar with month view
			const monthViewCalendar = {
				el: document.body,
				view: { type: "dayGridMonth" },
				setOption: vi.fn(),
			} as unknown as Calendar;

			const manager = new ZoomManager(mockSettingsStore);
			manager.initialize(monthViewCalendar, mockContainer);

			const wheelEvent = new WheelEvent("wheel", {
				deltaY: 100,
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			});

			mockContainer.dispatchEvent(wheelEvent);

			// Should stay at 30min
			expect(manager.getCurrentZoomLevel()).toBe(30);
		});

		it("should prevent default browser zoom", () => {
			const wheelEvent = new WheelEvent("wheel", {
				deltaY: 100,
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			});

			const preventDefaultSpy = vi.spyOn(wheelEvent, "preventDefault");
			const stopPropagationSpy = vi.spyOn(wheelEvent, "stopPropagation");

			mockContainer.dispatchEvent(wheelEvent);

			expect(preventDefaultSpy).toHaveBeenCalled();
			expect(stopPropagationSpy).toHaveBeenCalled();
		});

		it("should clamp zoom to minimum level", () => {
			// Set to minimum zoom level
			zoomManager.setCurrentZoomLevel(5);

			const wheelEvent = new WheelEvent("wheel", {
				deltaY: -100, // Try to zoom in further
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			});

			mockContainer.dispatchEvent(wheelEvent);

			// Should stay at 5min
			expect(zoomManager.getCurrentZoomLevel()).toBe(5);
		});

		it("should clamp zoom to maximum level", () => {
			// Set to maximum zoom level
			zoomManager.setCurrentZoomLevel(120);

			const wheelEvent = new WheelEvent("wheel", {
				deltaY: 100, // Try to zoom out further
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			});

			mockContainer.dispatchEvent(wheelEvent);

			// Should stay at 120min
			expect(zoomManager.getCurrentZoomLevel()).toBe(120);
		});

		it("should update button after wheel zoom", () => {
			const wheelEvent = new WheelEvent("wheel", {
				deltaY: -100,
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			});

			mockContainer.dispatchEvent(wheelEvent);

			expect(mockButton.textContent).toBe("Zoom: 15min");
		});
	});

	describe("createZoomLevelButton", () => {
		it("should return button config with current zoom level", () => {
			const buttonConfig = zoomManager.createZoomLevelButton();

			expect(buttonConfig.text).toBe("Zoom: 30min");
			expect(buttonConfig.click).toBeInstanceOf(Function);
		});

		it("should return updated text after zoom change", () => {
			zoomManager.setCurrentZoomLevel(15);

			const buttonConfig = zoomManager.createZoomLevelButton();

			expect(buttonConfig.text).toBe("Zoom: 15min");
		});
	});

	describe("stress test - rapid updates", () => {
		beforeEach(() => {
			zoomManager.initialize(mockCalendar, mockContainer);
		});

		it("should handle 100 rapid button updates without text duplication", () => {
			for (let i = 0; i < 100; i++) {
				zoomManager.updateZoomLevelButton();
			}

			const text = mockButton.textContent || "";
			// Count occurrences of "Zoom:"
			const zoomCount = (text.match(/Zoom:/g) || []).length;

			expect(zoomCount).toBe(1);
			expect(text).toBe("Zoom: 30min");
		});

		it("should handle rapid zoom level changes", () => {
			const levels = [5, 10, 15, 30, 60, 90, 120];

			for (let i = 0; i < 50; i++) {
				const randomLevel = levels[Math.floor(Math.random() * levels.length)];
				zoomManager.setCurrentZoomLevel(randomLevel);
			}

			// Final level check
			const currentLevel = zoomManager.getCurrentZoomLevel();
			expect(mockButton.textContent).toBe(`Zoom: ${currentLevel}min`);

			// Verify no text duplication
			const text = mockButton.textContent || "";
			const zoomCount = (text.match(/Zoom:/g) || []).length;
			expect(zoomCount).toBe(1);
		});

		it("should handle concurrent button updates and DOM mutations", async () => {
			// Simulate external DOM mutations while we update
			const updatePromises = [];

			for (let i = 0; i < 20; i++) {
				// Update zoom level
				updatePromises.push(
					new Promise<void>((resolve) => {
						setTimeout(() => {
							zoomManager.setCurrentZoomLevel([15, 30, 60][i % 3]);
							resolve();
						}, Math.random() * 10);
					})
				);

				// Simulate external DOM mutation
				updatePromises.push(
					new Promise<void>((resolve) => {
						setTimeout(() => {
							// External code trying to modify button
							mockButton.appendChild(document.createTextNode(" External"));
							zoomManager.updateZoomLevelButton();
							resolve();
						}, Math.random() * 10);
					})
				);
			}

			await Promise.all(updatePromises);

			// After all updates, verify button has correct format
			const text = mockButton.textContent || "";
			expect(text).toMatch(/^Zoom: \d+min$/);

			// Verify exactly one "Zoom:" prefix
			const zoomCount = (text.match(/Zoom:/g) || []).length;
			expect(zoomCount).toBe(1);
		});
	});

	describe("edge cases", () => {
		it("should never duplicate text like 'Zoom: 30 min 30min 15 min'", () => {
			zoomManager.initialize(mockCalendar, mockContainer);

			// Simulate the exact scenario where text gets duplicated
			// Initial update
			zoomManager.updateZoomLevelButton();
			expect(mockButton.textContent).toBe("Zoom: 30min");

			// Simulate FullCalendar or external code adding text
			mockButton.appendChild(document.createTextNode(" 30min"));

			// Update again - should completely replace, not append
			zoomManager.updateZoomLevelButton();

			// Should NOT have duplicated text
			expect(mockButton.textContent).toBe("Zoom: 30min");
			expect(mockButton.textContent).not.toContain("30 min 30min");

			// Change zoom level and simulate more interference
			zoomManager.setCurrentZoomLevel(15);
			mockButton.appendChild(document.createTextNode(" 15 min"));

			// Update again
			zoomManager.updateZoomLevelButton();

			// Should still be clean
			expect(mockButton.textContent).toBe("Zoom: 15min");
			expect(mockButton.textContent).not.toMatch(/.*\d+min.*\d+min.*/);
		});

		it("should handle calendar with no view", () => {
			// Create a new mock calendar without view property
			const calendarWithoutView = {
				el: document.body,
				view: undefined,
				setOption: vi.fn(),
			} as unknown as Calendar;

			const managerWithoutView = new ZoomManager(mockSettingsStore);
			managerWithoutView.initialize(calendarWithoutView, mockContainer);

			expect(() => managerWithoutView.updateZoomLevelButton()).not.toThrow();
		});

		it("should handle button with complex nested structure", () => {
			// Simulate complex button structure
			mockButton.innerHTML = `
				<span class="icon"></span>
				<span class="text">Old Text</span>
				<span class="badge">5</span>
			`;

			zoomManager.initialize(mockCalendar, mockContainer);
			zoomManager.updateZoomLevelButton();

			// Should completely replace all content
			expect(mockButton.textContent).toBe("Zoom: 30min");
			expect(mockButton.children.length).toBe(0);
		});

		it("should handle empty zoom levels array gracefully", () => {
			mockSettingsStore.currentSettings.zoomLevels = [];

			zoomManager = new ZoomManager(mockSettingsStore);
			zoomManager.initialize(mockCalendar, mockContainer);

			expect(() => {
				const wheelEvent = new WheelEvent("wheel", {
					deltaY: 100,
					ctrlKey: true,
					bubbles: true,
					cancelable: true,
				});
				mockContainer.dispatchEvent(wheelEvent);
			}).not.toThrow();
		});
	});
});
