import type { Page } from "@playwright/test";
import { clickButton, setDateTimeInput, setNumberInput, setTextInput } from "@real1ty-obsidian-plugins/testing/e2e";

import type { RecurrenceFreq, RecurrencePreset } from "../../../src/types/recurring-event";
import type { Weekday } from "../../../src/types/weekday";

// Convenience wrapper for filling the Prisma event create/edit modal. Fields
// stamped with stable `data-testid` values are driven through the DOM (title,
// all-day, start/end/date, duration). Fields without testids (ChipLists behind
// the assign modal, schema-form simple fields, custom properties, notifications)
// are driven through a bridge that reaches into `window.__prismaActiveEventModal`
// — a deliberate local coupling until those fields grow testids. The bridge
// lives in this one file so every reach-in is visible at a glance.
//
// Every input field is optional. The modal must already be open on `page`.

const SAVE_BUTTON_SCROLL_TIMEOUT_MS = 5_000;
const MODAL_CLOSE_TIMEOUT_MS = 10_000;

export type RRuleType = RecurrencePreset | "custom";

export interface EventModalInput {
	title?: string;
	allDay?: boolean;
	start?: string;
	end?: string;
	date?: string;
	duration?: number;
	categories?: string[];
	prerequisites?: string[];
	participants?: string[];
	location?: string;
	icon?: string;
	skip?: boolean;
	breakMinutes?: number;
	minutesBefore?: number;
	daysBefore?: number;
	customProperties?: Record<string, string>;
	recurring?: {
		rruleType?: RRuleType;
		weekdays?: Weekday[];
		customFreq?: RecurrenceFreq;
		customInterval?: number;
	};
}

export interface ChipListHandle {
	setItems?: (items: string[]) => void;
	value?: string[];
}

export type ChipField = "categoriesChipList" | "prerequisitesChipList" | "participantsChipList";

export interface ActiveEventModal extends Partial<Record<ChipField, ChipListHandle>> {
	setSimpleFieldValues?: (values: Record<string, unknown>) => void;
	notificationInput?: HTMLInputElement;
	allDayCheckbox?: HTMLInputElement;
	addCustomProperty?: (key: string, value: string, section: "display" | "other") => void;
	recurringCheckbox?: HTMLInputElement;
	rruleSelect?: HTMLSelectElement;
	customFreqSelect?: HTMLSelectElement;
	customIntervalInput?: HTMLInputElement;
	weekdayCheckboxes?: Map<string, HTMLInputElement>;
}

export interface E2EWindow {
	__prismaActiveEventModal?: ActiveEventModal;
}

/**
 * Reject input combinations the plugin cannot represent. Kept minimal on
 * purpose: only rules that map to real constraints, so legitimate tests aren't
 * locked out. Over-validation turns this helper from a convenience into a
 * gatekeeper that fights the suite.
 */
export function validateEventModalInput(data: EventModalInput): void {
	if (data.minutesBefore !== undefined && data.daysBefore !== undefined) {
		throw new Error("fillEventModal: pass either minutesBefore or daysBefore, not both");
	}
	if (data.daysBefore !== undefined && data.allDay === false) {
		throw new Error("fillEventModal: daysBefore requires allDay=true");
	}
	if (data.minutesBefore !== undefined && data.allDay === true) {
		throw new Error("fillEventModal: minutesBefore requires allDay=false");
	}
	if (data.date !== undefined && (data.start !== undefined || data.end !== undefined)) {
		throw new Error("fillEventModal: date is for all-day mode; do not combine with start/end");
	}
}

async function setChipListViaModalInstance(page: Page, chipField: ChipField, values: string[]): Promise<void> {
	await page.evaluate(
		({ field, vals }) => {
			const w = window as unknown as E2EWindow;
			const list = w.__prismaActiveEventModal?.[field];
			if (!list || typeof list.setItems !== "function") {
				throw new Error(`Active event modal has no ${field}`);
			}
			list.setItems(vals);
		},
		{ field: chipField, vals: values }
	);
}

async function setSimpleField(page: Page, key: string, value: unknown): Promise<void> {
	await page.evaluate(
		({ k, v }) => {
			const w = window as unknown as E2EWindow;
			const modal = w.__prismaActiveEventModal;
			if (!modal?.setSimpleFieldValues) throw new Error("Active event modal missing simple field setter");
			modal.setSimpleFieldValues({ [k]: v });
		},
		{ k: key, v: value }
	);
}

async function setNotification(page: Page, value: number, field: "minutesBefore" | "daysBefore"): Promise<void> {
	// The notification input is a single DOM element whose meaning (minutes vs
	// days) flips with the all-day checkbox. Caller decides which one to pass
	// based on the intended mode — validated at top of `fillEventModal`.
	await page.evaluate(
		({ v, f }) => {
			const w = window as unknown as E2EWindow;
			const modal = w.__prismaActiveEventModal;
			if (!modal?.notificationInput) throw new Error("Active event modal has no notification input");
			const isAllDay = modal.allDayCheckbox?.checked ?? false;
			const expectedAllDay = f === "daysBefore";
			if (isAllDay !== expectedAllDay) {
				throw new Error(`Notification field ${f} requires allDay=${expectedAllDay}, got ${isAllDay}`);
			}
			modal.notificationInput.value = String(v);
			modal.notificationInput.dispatchEvent(new Event("input", { bubbles: true }));
			modal.notificationInput.dispatchEvent(new Event("change", { bubbles: true }));
		},
		{ v: value, f: field }
	);
}

async function addCustomProperty(page: Page, key: string, value: string): Promise<void> {
	await page.evaluate(
		({ k, v }) => {
			const w = window as unknown as E2EWindow;
			const modal = w.__prismaActiveEventModal;
			if (!modal?.addCustomProperty) throw new Error("Active event modal missing addCustomProperty");
			modal.addCustomProperty(k, v, "other");
		},
		{ k: key, v: value }
	);
}

async function setAllDay(page: Page, on: boolean): Promise<void> {
	await page.evaluate((target) => {
		const w = window as unknown as E2EWindow;
		const cb = w.__prismaActiveEventModal?.allDayCheckbox;
		if (!cb) throw new Error("Active event modal has no allDayCheckbox");
		if (cb.checked === target) return;
		cb.checked = target;
		cb.dispatchEvent(new Event("input", { bubbles: true }));
		cb.dispatchEvent(new Event("change", { bubbles: true }));
	}, on);
}

async function setRecurring(page: Page, recurring: NonNullable<EventModalInput["recurring"]>): Promise<void> {
	await page.evaluate((r) => {
		const w = window as unknown as E2EWindow;
		const modal = w.__prismaActiveEventModal;
		if (!modal?.recurringCheckbox || !modal.rruleSelect) {
			throw new Error("Active event modal missing recurring UI");
		}
		const fire = (el: HTMLElement): void => {
			el.dispatchEvent(new Event("input", { bubbles: true }));
			el.dispatchEvent(new Event("change", { bubbles: true }));
		};

		modal.recurringCheckbox.checked = true;
		fire(modal.recurringCheckbox);

		const type = r.rruleType ?? "weekly";
		modal.rruleSelect.value = type;
		fire(modal.rruleSelect);

		if (type === "custom") {
			if (modal.customFreqSelect) {
				modal.customFreqSelect.value = r.customFreq ?? "DAILY";
				fire(modal.customFreqSelect);
			}
			if (modal.customIntervalInput) {
				modal.customIntervalInput.value = String(r.customInterval ?? 1);
				fire(modal.customIntervalInput);
			}
		}

		if (r.weekdays && modal.weekdayCheckboxes) {
			const wanted = new Set<string>(r.weekdays);
			for (const [day, cb] of modal.weekdayCheckboxes.entries()) {
				const shouldBeChecked = wanted.has(day);
				if (cb.checked !== shouldBeChecked) {
					cb.checked = shouldBeChecked;
					fire(cb);
				}
			}
		}
	}, recurring);
}

export async function fillEventModal(page: Page, data: EventModalInput): Promise<void> {
	validateEventModalInput(data);

	if (data.title !== undefined) await setTextInput(page, "prisma-event-control-title", data.title);
	if (data.allDay !== undefined) await setAllDay(page, data.allDay);
	if (data.start !== undefined) await setDateTimeInput(page, "prisma-event-control-start", data.start);
	if (data.end !== undefined) await setDateTimeInput(page, "prisma-event-control-end", data.end);
	if (data.date !== undefined) await setDateTimeInput(page, "prisma-event-control-date", data.date);
	if (data.duration !== undefined) await setNumberInput(page, "prisma-event-control-duration", data.duration);

	if (data.categories) await setChipListViaModalInstance(page, "categoriesChipList", data.categories);
	if (data.prerequisites) await setChipListViaModalInstance(page, "prerequisitesChipList", data.prerequisites);
	if (data.participants) await setChipListViaModalInstance(page, "participantsChipList", data.participants);

	if (data.location !== undefined) await setSimpleField(page, "location", data.location);
	if (data.icon !== undefined) await setSimpleField(page, "icon", data.icon);
	if (data.skip !== undefined) await setSimpleField(page, "skip", data.skip);
	// breakMinutes is backed by a text input in the schema form; the form
	// reads values as strings, so pass the string representation even though
	// the input type is number.
	if (data.breakMinutes !== undefined) await setSimpleField(page, "breakMinutes", String(data.breakMinutes));

	if (data.minutesBefore !== undefined) await setNotification(page, data.minutesBefore, "minutesBefore");
	if (data.daysBefore !== undefined) await setNotification(page, data.daysBefore, "daysBefore");

	if (data.customProperties) {
		for (const [key, value] of Object.entries(data.customProperties)) {
			await addCustomProperty(page, key, value);
		}
	}

	if (data.recurring) await setRecurring(page, data.recurring);
}

/**
 * Click save. Default: wait for the event modal to tear down before returning,
 * so callers don't have to remember a follow-up `waitForModalClosed` every
 * time. Pass `{ waitForClose: false }` when a test needs to inspect post-save
 * state while the modal is still disappearing.
 */
export async function saveEventModal(page: Page, options: { waitForClose?: boolean } = {}): Promise<void> {
	const { waitForClose = true } = options;
	// The save button lives in a sticky footer; in a tall modal the content
	// scroll position can leave the footer outside the viewport bounds that
	// Playwright's visibility check honours. Force it into view first.
	await page
		.locator('[data-testid="prisma-event-btn-save"]')
		.first()
		.scrollIntoViewIfNeeded({ timeout: SAVE_BUTTON_SCROLL_TIMEOUT_MS })
		.catch(() => {});
	await clickButton(page, "prisma-event-btn-save");
	if (waitForClose) {
		await page.waitForFunction(
			() => document.querySelectorAll('[data-testid="prisma-event-field-title"]').length === 0,
			undefined,
			{ timeout: MODAL_CLOSE_TIMEOUT_MS }
		);
	}
}
