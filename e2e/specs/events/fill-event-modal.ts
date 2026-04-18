import type { Page } from "@playwright/test";

import type { RecurrenceFreq, RecurrencePreset } from "../../../src/types/recurring-event";
import type { Weekday } from "../../../src/types/weekday";
import { ASSIGN_MODAL_ROOT, sel, sharedTID, TID } from "../../fixtures/testids";

// UI-driven event-modal helpers. Every field is interacted with the same way
// a real user would — click the stamped testid, type, press Enter. No reach-ins
// through `window.app` or internal plugin state. Fields added here must have
// a `data-testid` stamped on the source; if one is missing, add it in the
// plugin first rather than falling back to a DOM-walking shortcut.

const SAVE_BUTTON_SCROLL_TIMEOUT_MS = 5_000;
const MODAL_CLOSE_TIMEOUT_MS = 15_000;
const ASSIGN_MODAL_SELECTOR = ASSIGN_MODAL_ROOT;

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

/**
 * Reject input combinations the UI cannot represent. Kept narrow on purpose:
 * only rules that map to actual plugin constraints — overreach here locks out
 * legitimate test combinations.
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

async function fillTestIdInput(page: Page, testId: string, value: string): Promise<void> {
	const locator = page.locator(`[data-testid="${testId}"]`);
	await locator.waitFor({ state: "visible", timeout: 10_000 });
	await locator.scrollIntoViewIfNeeded().catch(() => {});
	await locator.fill(value);
	await locator.blur();
}

async function setTestIdCheckbox(page: Page, testId: string, on: boolean): Promise<void> {
	const cb = page.locator(`[data-testid="${testId}"]`);
	await cb.waitFor({ state: "visible", timeout: 10_000 });
	await cb.scrollIntoViewIfNeeded().catch(() => {});
	const checked = await cb.isChecked();
	if (checked !== on) await cb.click();
}

async function selectTestIdOption(page: Page, testId: string, value: string): Promise<void> {
	const select = page.locator(`[data-testid="${testId}"]`);
	await select.waitFor({ state: "visible", timeout: 10_000 });
	await select.scrollIntoViewIfNeeded().catch(() => {});
	await select.selectOption(value);
}

async function openAssignModal(page: Page, buttonTestId: string): Promise<void> {
	await page.locator(sel(buttonTestId)).click();
	await page.locator(`${ASSIGN_MODAL_SELECTOR} ${sel(sharedTID.assignSearch())}`).waitFor({
		state: "visible",
		timeout: 10_000,
	});
}

/**
 * Drive the assign modal as a user does: type each value into the search,
 * press Enter (picks an existing item or creates new), then click the submit
 * button. Same routine for categories / prerequisites / any future
 * assign-modal-backed chip list.
 */
async function driveAssignModal(
	page: Page,
	buttonTestId: string,
	values: string[],
	options: { allowCreateNew?: boolean } = {}
): Promise<void> {
	const allowCreateNew = options.allowCreateNew ?? true;
	await openAssignModal(page, buttonTestId);
	const search = page.locator(`${ASSIGN_MODAL_SELECTOR} ${sel(sharedTID.assignSearch())}`);

	for (const value of values) {
		await search.fill(value);
		const existing = page.locator(
			`${ASSIGN_MODAL_SELECTOR} ${sel(sharedTID.assignItem())}[data-assign-name="${value}"]`
		);
		const existingCount = await existing.count();
		if (existingCount > 0) {
			await existing.first().click();
		} else if (allowCreateNew) {
			const create = page.locator(`${ASSIGN_MODAL_SELECTOR} ${sel(sharedTID.assignCreateNew())}`);
			await create.waitFor({ state: "visible", timeout: 5_000 });
			await create.click();
		} else {
			throw new Error(`Assign modal: "${value}" not found and createNew is disabled`);
		}
		await search.fill("");
	}
	await page.locator(`${ASSIGN_MODAL_SELECTOR} ${sel(sharedTID.assignSubmit())}`).click();
	await page.locator(ASSIGN_MODAL_SELECTOR).waitFor({ state: "hidden", timeout: 5_000 });

	// Sanity: the parent event modal must still be open after assign modal
	// closes. If it's gone, something in the interaction tore it down — fail
	// loudly here with the DOM state rather than propagating into a confusing
	// "field not visible" timeout on the next step.
	const eventModalStillOpen = await page.locator(sel(TID.event.field("title"))).count();
	if (eventModalStillOpen === 0) {
		throw new Error(
			`Event modal closed unexpectedly after driveAssignModal(${buttonTestId}). ` +
				`Values attempted: ${JSON.stringify(values)}.`
		);
	}
}

async function addParticipant(page: Page, value: string): Promise<void> {
	const input = page.locator(sel(TID.event.control("participants")));
	const count = await input.count();
	if (count === 0) {
		const modalCount = await page.locator(sel(TID.event.field("title"))).count();
		const allParticipantsFields = await page.locator(sel(TID.event.field("participants"))).count();
		throw new Error(
			`addParticipant("${value}"): input not in DOM. ` +
				`event-modal-title count=${modalCount}, participants-field count=${allParticipantsFields}. ` +
				`Either the event modal closed, or participantsProp is unset.`
		);
	}
	await input.scrollIntoViewIfNeeded().catch(() => {});
	await input.waitFor({ state: "visible", timeout: 10_000 });
	await input.fill(value);
	await input.press("Enter");
}

async function addCustomProperty(page: Page, key: string, value: string): Promise<void> {
	await page.locator(sel(TID.event.btn("add-custom-prop-other"))).click();
	// The new row is appended — find the last key/value inputs in the "other" section.
	const keyInputs = page.locator('[data-testid="prisma-event-custom-prop-key-other"]');
	const valueInputs = page.locator('[data-testid="prisma-event-custom-prop-value-other"]');
	const idx = (await keyInputs.count()) - 1;
	await keyInputs.nth(idx).fill(key);
	await valueInputs.nth(idx).fill(value);
	await valueInputs.nth(idx).blur();
}

async function setRecurring(page: Page, recurring: NonNullable<EventModalInput["recurring"]>): Promise<void> {
	await setTestIdCheckbox(page, "prisma-event-control-rrule", true);

	const type = recurring.rruleType ?? "weekly";
	await selectTestIdOption(page, "prisma-event-control-rrule-type", type);

	if (type === "custom") {
		if (recurring.customFreq !== undefined) {
			await selectTestIdOption(page, "prisma-event-control-custom-freq", recurring.customFreq);
		}
		if (recurring.customInterval !== undefined) {
			await fillTestIdInput(page, "prisma-event-control-custom-interval", String(recurring.customInterval));
		}
	}

	if (recurring.weekdays) {
		for (const day of recurring.weekdays) {
			await setTestIdCheckbox(page, `prisma-event-control-weekday-${day}`, true);
		}
	}
}

export async function fillEventModal(page: Page, data: EventModalInput): Promise<void> {
	validateEventModalInput(data);

	if (data.title !== undefined) await fillTestIdInput(page, "prisma-event-control-title", data.title);
	if (data.allDay !== undefined) await setTestIdCheckbox(page, "prisma-event-control-allDay", data.allDay);
	if (data.start !== undefined) await fillTestIdInput(page, "prisma-event-control-start", data.start);
	if (data.end !== undefined) await fillTestIdInput(page, "prisma-event-control-end", data.end);
	if (data.date !== undefined) await fillTestIdInput(page, "prisma-event-control-date", data.date);
	if (data.duration !== undefined) await fillTestIdInput(page, "prisma-event-control-duration", String(data.duration));

	if (data.categories && data.categories.length > 0) {
		await driveAssignModal(page, "prisma-event-btn-assign-categories", data.categories);
	}
	if (data.prerequisites && data.prerequisites.length > 0) {
		await driveAssignModal(page, "prisma-event-btn-assign-prerequisites", data.prerequisites, {
			allowCreateNew: false,
		});
	}
	if (data.participants && data.participants.length > 0) {
		for (const value of data.participants) {
			await addParticipant(page, value);
		}
	}

	if (data.location !== undefined) await fillTestIdInput(page, "prisma-event-control-location", data.location);
	if (data.icon !== undefined) await fillTestIdInput(page, "prisma-event-control-icon", data.icon);
	if (data.skip !== undefined) await setTestIdCheckbox(page, "prisma-event-control-skip", data.skip);
	if (data.breakMinutes !== undefined) {
		await fillTestIdInput(page, "prisma-event-control-breakMinutes", String(data.breakMinutes));
	}

	if (data.minutesBefore !== undefined) {
		await fillTestIdInput(page, "prisma-event-control-notify-before", String(data.minutesBefore));
	}
	if (data.daysBefore !== undefined) {
		await fillTestIdInput(page, "prisma-event-control-notify-before", String(data.daysBefore));
	}

	if (data.customProperties) {
		for (const [key, value] of Object.entries(data.customProperties)) {
			await addCustomProperty(page, key, value);
		}
	}

	if (data.recurring) await setRecurring(page, data.recurring);
}

/**
 * Click save. Default: wait for the event modal to tear down so callers don't
 * need a follow-up `waitForModalClosed`. Pass `{ waitForClose: false }` when
 * a test needs to inspect mid-close state.
 */
export async function saveEventModal(page: Page, options: { waitForClose?: boolean } = {}): Promise<void> {
	const { waitForClose = true } = options;
	const saveBtn = page.locator(sel(TID.event.btn("save"))).first();
	await saveBtn.scrollIntoViewIfNeeded({ timeout: SAVE_BUTTON_SCROLL_TIMEOUT_MS }).catch(() => {});
	await saveBtn.click();
	if (waitForClose) {
		await page.waitForFunction(
			(selector) => document.querySelectorAll(selector).length === 0,
			sel(TID.event.field("title")),
			{ timeout: MODAL_CLOSE_TIMEOUT_MS }
		);
	}
}
