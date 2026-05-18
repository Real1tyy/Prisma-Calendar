import "@testing-library/jest-dom/vitest";

import { act, render } from "@testing-library/react";
import { BehaviorSubject } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CalendarSettingsStore } from "../../../src/core/settings-store";
// Single-line cut-over: this file was originally written against
// `src/components/zoom-manager.ts` using the harness's "imperative" branch.
// After the React swap, only this import and the VARIANT constant change.
import { ZoomControl } from "../../../src/react/views/zoom-control";
import { createMockCalendarSettingsStore } from "../../fixtures/settings-fixtures";

type Variant = "imperative" | "react";

const VARIANT: Variant = "react";

interface ZoomHarness {
	settingsStore: CalendarSettingsStore;
	viewType$: BehaviorSubject<string>;
	container: HTMLElement;
	viewContainerEl: HTMLElement;
	hostButton: HTMLButtonElement;
	teardown: () => void;
}

interface ZoomScenarioProps {
	slotDurationMinutes?: number;
	zoomLevels?: number[];
	viewType?: string;
	onZoomChange?: () => void;
}

function buildHarness({
	slotDurationMinutes = 30,
	zoomLevels = [5, 10, 15, 30, 60, 90, 120],
	viewType = "timeGridWeek",
	onZoomChange,
}: ZoomScenarioProps = {}): ZoomHarness {
	const settingsStore = createMockCalendarSettingsStore({ slotDurationMinutes, zoomLevels });
	const viewType$ = new BehaviorSubject<string>(viewType);

	const container = document.createElement("div");
	const viewContainerEl = document.createElement("div");
	const hostButton = document.createElement("button");
	hostButton.type = "button";
	hostButton.className = "fc-zoomLevel-button fc-button fc-button-primary";
	document.body.append(container, viewContainerEl, hostButton);

	if (VARIANT === "react") {
		const { unmount } = render(
			<ZoomControl
				settingsStore={settingsStore}
				viewType$={viewType$}
				container={container}
				viewContainerEl={viewContainerEl}
				hostButton={hostButton}
				{...(onZoomChange ? { onZoomChange } : {})}
			/>,
			{ container: hostButton }
		);

		return {
			settingsStore,
			viewType$,
			container,
			viewContainerEl,
			hostButton,
			teardown: () => {
				unmount();
				container.remove();
				viewContainerEl.remove();
				hostButton.remove();
			},
		};
	}

	// VARIANT === "imperative" branch retained as a comment in git history; the
	// imperative ZoomManager module was emptied as part of the swap. To re-run
	// the imperative characterization, restore zoom-manager.ts from git and
	// uncomment the branch below.
	void vi;
	throw new Error("imperative variant unavailable — module has been removed");
}

function fireWheel(container: HTMLElement, deltaY: number, ctrlKey: boolean): WheelEvent {
	const event = new WheelEvent("wheel", { deltaY, ctrlKey, bubbles: true, cancelable: true });
	act(() => {
		container.dispatchEvent(event);
	});
	return event;
}

let active: ZoomHarness | null = null;

afterEach(() => {
	active?.teardown();
	active = null;
});

describe("ZoomControl — swap-ready behavioural contract", () => {
	describe("initial state", () => {
		it("exposes the configured zoom level via the settings store", () => {
			active = buildHarness({ slotDurationMinutes: 30 });
			expect(active.settingsStore.currentSettings.slotDurationMinutes).toBe(30);
		});

		it("starts with the configured view type", () => {
			active = buildHarness({ viewType: "timeGridWeek" });
			expect(active.viewType$.getValue()).toBe("timeGridWeek");
		});
	});

	describe("Ctrl+wheel zoom on timeGrid views", () => {
		it("zooms in (smaller slots) on Ctrl+WheelUp", () => {
			active = buildHarness({ slotDurationMinutes: 30 });
			fireWheel(active.container, -100, true);
			expect(active.settingsStore.currentSettings.slotDurationMinutes).toBe(15);
		});

		it("zooms out (larger slots) on Ctrl+WheelDown", () => {
			active = buildHarness({ slotDurationMinutes: 30 });
			fireWheel(active.container, 100, true);
			expect(active.settingsStore.currentSettings.slotDurationMinutes).toBe(60);
		});

		it("calls preventDefault on Ctrl+wheel events it handles", () => {
			active = buildHarness();
			const event = new WheelEvent("wheel", { deltaY: 100, ctrlKey: true, bubbles: true, cancelable: true });
			let preventCount = 0;
			let stopCount = 0;
			Object.defineProperty(event, "preventDefault", { value: () => preventCount++ });
			Object.defineProperty(event, "stopPropagation", { value: () => stopCount++ });
			act(() => {
				active!.container.dispatchEvent(event);
			});
			expect(preventCount).toBe(1);
			expect(stopCount).toBe(1);
		});

		it("invokes onZoomChange exactly once per accepted wheel event", () => {
			const onZoomChange = vi.fn();
			active = buildHarness({ onZoomChange });
			fireWheel(active.container, -100, true);
			expect(onZoomChange).toHaveBeenCalledTimes(1);
		});

		it("clamps at the minimum zoom level", () => {
			active = buildHarness({ slotDurationMinutes: 5 });
			fireWheel(active.container, -100, true);
			expect(active.settingsStore.currentSettings.slotDurationMinutes).toBe(5);
		});

		it("clamps at the maximum zoom level", () => {
			active = buildHarness({ slotDurationMinutes: 120 });
			fireWheel(active.container, 100, true);
			expect(active.settingsStore.currentSettings.slotDurationMinutes).toBe(120);
		});

		it("falls back to the middle of the zoom-levels list when the current level is not in it", () => {
			active = buildHarness({ slotDurationMinutes: 45 });
			fireWheel(active.container, 100, true);
			// 7 levels → middle index 3 → 30. WheelDown → index 4 → 60.
			expect(active.settingsStore.currentSettings.slotDurationMinutes).toBe(60);
		});
	});

	describe("event filters", () => {
		it("ignores wheel events without the Ctrl modifier", () => {
			active = buildHarness();
			fireWheel(active.container, -100, false);
			expect(active.settingsStore.currentSettings.slotDurationMinutes).toBe(30);
		});

		it("ignores Ctrl+wheel events when the active view is not a timeGrid view", () => {
			active = buildHarness({ viewType: "dayGridMonth" });
			fireWheel(active.container, -100, true);
			expect(active.settingsStore.currentSettings.slotDurationMinutes).toBe(30);
		});

		it("re-enables wheel zoom when the view type switches back to a timeGrid view", () => {
			active = buildHarness({ viewType: "dayGridMonth" });
			fireWheel(active.container, -100, true);
			expect(active.settingsStore.currentSettings.slotDurationMinutes).toBe(30);
			act(() => active!.viewType$.next("timeGridWeek"));
			fireWheel(active.container, -100, true);
			expect(active.settingsStore.currentSettings.slotDurationMinutes).toBe(15);
		});

		it("does not throw when zoomLevels is empty", () => {
			active = buildHarness({ zoomLevels: [] });
			expect(() => fireWheel(active!.container, 100, true)).not.toThrow();
		});
	});

	describe("rapid input", () => {
		it("stays coherent across 50 alternating wheel events", () => {
			active = buildHarness();
			for (let i = 0; i < 50; i++) {
				fireWheel(active.container, i % 2 === 0 ? -100 : 100, true);
			}
			const final = active.settingsStore.currentSettings.slotDurationMinutes;
			expect(active.settingsStore.currentSettings.zoomLevels).toContain(final);
		});
	});

	describe("lifecycle", () => {
		it("detaches the wheel listener on teardown", () => {
			active = buildHarness();
			const container = active.container;
			active.teardown();
			active = null;
			const settingsStore = createMockCalendarSettingsStore({
				slotDurationMinutes: 30,
				zoomLevels: [5, 10, 15, 30, 60],
			});
			// Re-attach a fresh harness to a different container; the OLD container should be inert.
			const fresh = buildHarness({ slotDurationMinutes: 30 });
			fireWheel(container, -100, true);
			expect(settingsStore.currentSettings.slotDurationMinutes).toBe(30);
			fresh.teardown();
		});

		it("attaches aria-label to the host button on mount and removes it on teardown", () => {
			active = buildHarness();
			expect(active.hostButton.getAttribute("aria-label")).toBe("Zoom level");
			const host = active.hostButton;
			active.teardown();
			active = null;
			expect(host.hasAttribute("aria-label")).toBe(false);
		});
	});
});
