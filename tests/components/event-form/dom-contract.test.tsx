import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { createDefaultState, type EventFormState } from "../../../src/components/modals/event/event-form-state";
import { RecurrenceSection } from "../../../src/react/event-form/sections/recurrence-section";
import { TimingSection } from "../../../src/react/event-form/sections/timing-section";

/**
 * Locks the DOM contract emitted by the imperative `BaseEventModal`, so the React
 * port can never silently regress to an Obsidian sliding-pill `<Toggle>` or
 * drop the Fill prev/Fill next buttons again. Every assertion here mirrors a
 * specific line in `src/components/modals/event/base-event-modal.ts`.
 */

function TimingWrapper({
	initial,
	showDuration = false,
	withFill = false,
}: {
	initial?: Partial<EventFormState>;
	showDuration?: boolean;
	withFill?: boolean;
}) {
	const defaults = { ...createDefaultState(), ...initial };
	const form = useForm<EventFormState>({ defaultValues: defaults });
	return (
		<TimingSection
			form={form}
			showDurationField={showDuration}
			onFillPrevious={withFill ? () => new Date("2026-04-25T08:00") : undefined}
			onFillNext={withFill ? () => new Date("2026-04-25T11:00") : undefined}
		/>
	);
}

function RecurrenceWrapper({ initial }: { initial?: Partial<EventFormState> }) {
	const defaults = { ...createDefaultState(), ...initial };
	const form = useForm<EventFormState>({ defaultValues: defaults });
	return <RecurrenceSection form={form} />;
}

describe("Imperative DOM contract — TimingSection layout", () => {
	it("All day row is wrapped in .prisma-setting-item (NOT Obsidian's .setting-item)", () => {
		// The Prisma form layout CSS in `styles/_modals.scss:297-347` only fires on
		// `.prisma-setting-item` / `.prisma-setting-item-name` / `.prisma-setting-item-control`.
		// The shared-react `<SettingItem>` emits unprefixed Obsidian classes, which fall back
		// to Obsidian's default layout and break the modal's spacing/alignment.
		render(<TimingWrapper />);
		const allDayCb = screen.getByTestId("prisma-event-control-allDay");
		const row = allDayCb.closest(".prisma-setting-item");
		expect(row).not.toBeNull();
		const label = row!.querySelector(".prisma-setting-item-name");
		expect(label).not.toBeNull();
		expect(label!.textContent).toBe("All day");
	});

	it("Setting-item rows do NOT use Obsidian's .setting-item-info wrapper", () => {
		// Imperative emits a flat row: <div class="prisma-setting-item"> direct-child
		// <div class="prisma-setting-item-name"> + control. Obsidian wraps the name in
		// a <div class="setting-item-info"> — that wrapper changes flex layout.
		render(<TimingWrapper />);
		expect(document.querySelector(".setting-item-info")).toBeNull();
	});
});

describe("Imperative DOM contract — TimingSection", () => {
	it("All day control is a native <input type=checkbox class=prisma-setting-item-control>", () => {
		// Mirrors base-event-modal.ts:408-412 — All-day was a plain HTML checkbox
		// styled via .prisma-setting-item-control, NOT an Obsidian sliding-pill Toggle.
		render(<TimingWrapper />);
		const cb = screen.getByTestId("prisma-event-control-allDay") as HTMLInputElement;
		expect(cb.tagName).toBe("INPUT");
		expect(cb.type).toBe("checkbox");
		expect(cb.className).toBe("prisma-setting-item-control");
	});

	it("All day control is NOT wrapped in an Obsidian .checkbox-container", () => {
		render(<TimingWrapper />);
		expect(document.querySelector(".checkbox-container")).toBeNull();
	});

	it("Renders a 'Fill prev' button inside .prisma-datetime-input-wrapper when onFillPrevious is provided", () => {
		// Mirrors base-event-modal.ts:1047-1061 — both Now AND Fill buttons live
		// inside the datetime wrapper.
		render(<TimingWrapper withFill={true} />);
		const fillPrev = screen.getByText("Fill prev");
		expect(fillPrev.tagName).toBe("BUTTON");
		expect(fillPrev.className).toBe("prisma-fill-button");
		expect(fillPrev.closest(".prisma-datetime-input-wrapper")).not.toBeNull();
	});

	it("Renders a 'Fill next' button inside .prisma-datetime-input-wrapper when onFillNext is provided", () => {
		render(<TimingWrapper withFill={true} />);
		const fillNext = screen.getByText("Fill next");
		expect(fillNext.tagName).toBe("BUTTON");
		expect(fillNext.className).toBe("prisma-fill-button");
		expect(fillNext.closest(".prisma-datetime-input-wrapper")).not.toBeNull();
	});

	it("Renders 'Now' buttons with the prisma-now-button class", () => {
		render(<TimingWrapper />);
		const nowButtons = screen.getAllByText("Now");
		expect(nowButtons.length).toBeGreaterThan(0);
		for (const btn of nowButtons) {
			expect(btn.tagName).toBe("BUTTON");
			expect(btn.className).toBe("prisma-now-button");
		}
	});

	it("Datetime inputs carry class prisma-setting-item-control", () => {
		// Mirrors base-event-modal.ts:1063-1068
		render(<TimingWrapper />);
		const start = screen.getByTestId("prisma-event-control-start") as HTMLInputElement;
		const end = screen.getByTestId("prisma-event-control-end") as HTMLInputElement;
		expect(start.className).toBe("prisma-setting-item-control");
		expect(end.className).toBe("prisma-setting-item-control");
		expect(start.type).toBe("datetime-local");
		expect(end.type).toBe("datetime-local");
	});

	it("Date input (all-day mode) carries class prisma-setting-item-control", () => {
		// Mirrors base-event-modal.ts:471-476
		render(<TimingWrapper initial={{ allDay: true, date: "2026-04-25" }} />);
		const date = screen.getByTestId("prisma-event-control-date") as HTMLInputElement;
		expect(date.tagName).toBe("INPUT");
		expect(date.type).toBe("date");
		expect(date.className).toBe("prisma-setting-item-control");
	});

	it("Duration input (when enabled) carries class prisma-setting-item-control", () => {
		// Mirrors base-event-modal.ts:443-451
		render(<TimingWrapper showDuration={true} />);
		const dur = screen.getByTestId("prisma-event-control-duration") as HTMLInputElement;
		expect(dur.tagName).toBe("INPUT");
		expect(dur.type).toBe("number");
		expect(dur.className).toBe("prisma-setting-item-control");
	});

	it("Timed and all-day field groups use class prisma-timed-event-fields / prisma-allday-event-fields", () => {
		// Mirrors base-event-modal.ts:415, 459
		render(<TimingWrapper />);
		expect(document.querySelector(".prisma-timed-event-fields")).not.toBeNull();

		render(<TimingWrapper initial={{ allDay: true, date: "2026-04-25" }} />);
		expect(document.querySelector(".prisma-allday-event-fields")).not.toBeNull();
	});
});

describe("Imperative DOM contract — RecurrenceSection", () => {
	it("Recurring control is a native <input type=checkbox class=prisma-setting-item-control>", () => {
		// Mirrors base-event-modal.ts:582-586 — recurring was a plain HTML checkbox.
		render(<RecurrenceWrapper />);
		const cb = screen.getByTestId("prisma-event-control-rrule") as HTMLInputElement;
		expect(cb.tagName).toBe("INPUT");
		expect(cb.type).toBe("checkbox");
		expect(cb.className).toBe("prisma-setting-item-control");
	});

	it("Generate-past control is a native <input type=checkbox class=prisma-setting-item-control>", () => {
		// Mirrors base-event-modal.ts:733-737
		render(
			<RecurrenceWrapper
				initial={{ recurring: { ...createDefaultState().recurring, enabled: true, rruleType: "daily" } }}
			/>
		);
		const cb = screen.getByTestId("prisma-event-control-generate-past-events") as HTMLInputElement;
		expect(cb.tagName).toBe("INPUT");
		expect(cb.type).toBe("checkbox");
		expect(cb.className).toBe("prisma-setting-item-control");
	});

	it("Rrule type select carries class prisma-setting-item-control (with .dropdown helper)", () => {
		// Mirrors base-event-modal.ts:597-600
		render(
			<RecurrenceWrapper
				initial={{ recurring: { ...createDefaultState().recurring, enabled: true, rruleType: "daily" } }}
			/>
		);
		const sel = screen.getByTestId("prisma-event-control-rrule-type") as HTMLSelectElement;
		expect(sel.tagName).toBe("SELECT");
		expect(sel.className).toContain("prisma-setting-item-control");
	});

	it("End-date input carries class prisma-setting-item-control", () => {
		// Mirrors base-event-modal.ts:696-702
		render(
			<RecurrenceWrapper
				initial={{ recurring: { ...createDefaultState().recurring, enabled: true, rruleType: "daily" } }}
			/>
		);
		const until = screen.getByTestId("prisma-event-control-rrule-until") as HTMLInputElement;
		expect(until.tagName).toBe("INPUT");
		expect(until.type).toBe("date");
		expect(until.className).toBe("prisma-setting-item-control");
	});

	it("Recurrence wrapper uses class prisma-recurring-event-fields", () => {
		// Mirrors base-event-modal.ts:588
		render(
			<RecurrenceWrapper
				initial={{ recurring: { ...createDefaultState().recurring, enabled: true, rruleType: "daily" } }}
			/>
		);
		expect(document.querySelector(".prisma-recurring-event-fields")).not.toBeNull();
	});

	it("No Obsidian sliding-pill .checkbox-container is rendered anywhere in the recurrence section", () => {
		render(
			<RecurrenceWrapper
				initial={{ recurring: { ...createDefaultState().recurring, enabled: true, rruleType: "daily" } }}
			/>
		);
		expect(document.querySelector(".checkbox-container")).toBeNull();
	});
});
