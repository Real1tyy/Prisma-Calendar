import type CustomCalendarPlugin from "../../main";
import { resolveBundleOrNotice } from "./bundle-resolver";
import type { NavigateInput } from "./types";

export async function navigateToDate(plugin: CustomCalendarPlugin, input: NavigateInput): Promise<boolean> {
	const bundle = resolveBundleOrNotice(plugin, input.calendarId);
	if (!bundle) return false;

	await bundle.activateCalendarView();

	const calendarComponent = bundle.viewRef.calendarComponent;
	if (!calendarComponent) return false;

	const date = input.date ? new Date(input.date) : new Date();
	if (isNaN(date.getTime())) return false;

	calendarComponent.navigateToDate(date, input.view);
	return true;
}
