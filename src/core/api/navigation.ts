import { CalendarView } from "../../components/calendar-view";
import type CustomCalendarPlugin from "../../main";
import { resolveBundleOrNotice } from "./bundle-resolver";
import type { NavigateInput } from "./types";

export async function navigateToDate(plugin: CustomCalendarPlugin, input: NavigateInput): Promise<boolean> {
	const bundle = resolveBundleOrNotice(plugin, input.calendarId);
	if (!bundle) return false;

	await bundle.activateCalendarView();

	const { workspace } = plugin.app;
	const existingLeaves = workspace.getLeavesOfType(bundle.viewType);
	const calendarLeaf = existingLeaves[0];
	if (!calendarLeaf) return false;

	const calendarView = calendarLeaf.view;
	if (!(calendarView instanceof CalendarView)) return false;

	const date = input.date ? new Date(input.date) : new Date();
	if (isNaN(date.getTime())) return false;

	calendarView.navigateToDate(date, input.view);
	return true;
}
