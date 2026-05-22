import { buildUtmUrl } from "@real1ty-obsidian-plugins";
import { startTour, waitForElement, type TourStep } from "@real1ty-obsidian-plugins-react";
import { DateTime } from "luxon";

import type { CalendarComponent } from "../../components/calendar-view";
import { CSS_PREFIX } from "../../constants";
import { createEvent } from "../../core/api/event-crud";
import type CustomCalendarPlugin from "../../main";

const SAMPLE_EVENT_TITLE = "Your first event";

// Production runtime selectors — kept in sync with the data-testids stamped by
// calendar-view.ts (`prisma-cal-event` + `data-event-title`) and the FullCalendar
// toolbar mapping (`prisma-cal-toolbar-*`). The e2e TID registry mirrors these.
const SAMPLE_EVENT_SELECTOR = `[data-testid="prisma-cal-event"][data-event-title="${SAMPLE_EVENT_TITLE}"]`;
const CREATE_BUTTON_SELECTOR = '[data-testid="prisma-cal-toolbar-create"]';
const MONTH_VIEW_SELECTOR = '[data-testid="prisma-cal-toolbar-view-month"]';

const docsUrl = (path: string, content: string): string =>
	buildUtmUrl(
		`https://real1tyy.github.io/Prisma-Calendar${path}`,
		"prisma-calendar",
		"plugin",
		"onboarding_tour",
		content
	);

async function ensureCalendarReady(plugin: CustomCalendarPlugin): Promise<CalendarComponent | null> {
	let component = plugin.getActiveCalendarComponent();
	if (!component) {
		const bundle = plugin.calendarBundles[0];
		await bundle?.activateCalendarView();
		component = plugin.getActiveCalendarComponent();
	}
	component?.goToToday();
	await waitForElement(CREATE_BUTTON_SELECTOR, { timeout: 4000 });
	return component;
}

/**
 * Guarantee a "Your first event" tile is visible on today's view: reuse one if
 * it is already on screen (idempotent on replay within the same day), otherwise
 * create it via the public event API and wait for the calendar to render it.
 */
async function ensureSampleEvent(plugin: CustomCalendarPlugin): Promise<void> {
	const component = await ensureCalendarReady(plugin);

	if (await waitForElement(SAMPLE_EVENT_SELECTOR, { timeout: 600 })) return;

	const start = DateTime.now().set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
	const end = start.plus({ hours: 1 });
	await createEvent(plugin, {
		title: SAMPLE_EVENT_TITLE,
		start: start.toISO() ?? "",
		end: end.toISO() ?? "",
		allDay: false,
	});

	plugin.getActiveBundleFromLeaf()?.refreshCalendar();
	component?.goToToday();
	await waitForElement(SAMPLE_EVENT_SELECTOR, { timeout: 5000 });
}

/** The Prisma Calendar onboarding journey — welcome → first event → create → views → done. */
export function buildPrismaTourSteps(plugin: CustomCalendarPlugin): TourStep[] {
	return [
		{
			id: "welcome",
			placement: "center",
			title: "Welcome to Prisma Calendar 👋",
			content: (
				<p>
					Let's take a quick tour. In under a minute you'll create your first event and learn how to move, resize, and
					open it — everything you need to start planning.
				</p>
			),
			before: () => ensureCalendarReady(plugin),
		},
		{
			id: "first-event",
			target: SAMPLE_EVENT_SELECTOR,
			placement: "auto",
			disableScroll: true,
			title: "This is your first event",
			content: (
				<p>
					Every event is just a note with a date in its frontmatter. Prisma reads those notes and lays them out here —
					edit the note and the calendar updates, and the other way around.
				</p>
			),
			before: () => ensureSampleEvent(plugin),
		},
		{
			id: "drag-and-drop",
			target: SAMPLE_EVENT_SELECTOR,
			placement: "auto",
			disableScroll: true,
			interaction: "page",
			title: "Move it around",
			content: (
				<p>
					Drag the event to reschedule it, or drag its top or bottom edge to change how long it lasts. Every change
					writes straight back to the note — go ahead and try it.
				</p>
			),
		},
		{
			id: "open-event",
			target: SAMPLE_EVENT_SELECTOR,
			placement: "auto",
			disableScroll: true,
			interaction: "page",
			title: "Open the editor",
			content: (
				<p>
					Double-click any event to open a rich editor for its title, time, categories, recurrence, and more — no
					frontmatter wrangling required.
				</p>
			),
		},
		{
			id: "create-event",
			target: CREATE_BUTTON_SELECTOR,
			placement: "bottom",
			interaction: "page",
			title: "Create new events",
			content: <p>Use this Create button — or just click any empty slot on the grid — to add a new event.</p>,
			before: () => ensureCalendarReady(plugin),
		},
		{
			id: "switch-views",
			target: MONTH_VIEW_SELECTOR,
			placement: "bottom",
			title: "Switch how you see things",
			content: (
				<p>
					Jump between year, month, week, and day from the toolbar. The tabs above also unlock timeline, heatmap, and
					dashboard views as your planning grows.
				</p>
			),
			before: () => ensureCalendarReady(plugin),
		},
		{
			id: "finish",
			placement: "center",
			title: "You're all set 🎉",
			content: (
				<p>
					Replay this tour anytime from <strong>Settings → General</strong> or the <em>"Start onboarding tutorial"</em>{" "}
					command. Dive deeper in the{" "}
					<a href={docsUrl("/", "documentation")} target="_blank" rel="noopener noreferrer">
						documentation
					</a>
					. Happy planning!
				</p>
			),
		},
	];
}

/** Launch the Prisma onboarding tour and remember that the user has seen it. */
export function startPrismaTour(plugin: CustomCalendarPlugin): void {
	startTour({
		app: plugin.app,
		cssPrefix: CSS_PREFIX,
		testIdPrefix: CSS_PREFIX,
		steps: buildPrismaTourSteps(plugin),
		onClose: () => {
			if (plugin.settingsStore.currentSettings.tutorialCompleted) return;
			void plugin.settingsStore.updateSettings((settings) => ({ ...settings, tutorialCompleted: true }));
		},
	});
}
