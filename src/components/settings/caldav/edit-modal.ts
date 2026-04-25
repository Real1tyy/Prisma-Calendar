import { cls, showSchemaModal } from "@real1ty-obsidian-plugins";
import { type App, Notice } from "obsidian";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import { CalDAVClientService } from "../../../core/integrations/caldav";
import type CustomCalendarPlugin from "../../../main";
import type { PrismaCalendarSettingsStore } from "../../../types";
import type { CalDAVAccount, CalDAVCalendarInfo } from "../../../types/integrations";
import { getCalendarById } from "../../../utils/calendar-settings";
import { showCalendarIntegrationDeleteEventsModal } from "../../modals";
import { CalDAVEditFormShape, type CalDAVEditFormValues, deleteTrackedIntegrationEvents } from "../integration-shared";
import { renderCalendarCheckboxes } from "./calendar-checkboxes";

export function showEditCalDAVAccountModal(
	app: App,
	settingsStore: PrismaCalendarSettingsStore,
	plugin: CustomCalendarPlugin,
	calendarId: string,
	account: CalDAVAccount,
	onSave: () => void
): void {
	let discoveredCalendars: CalDAVCalendarInfo[] = [];
	let selectedCalendars = [...account.selectedCalendars];
	const originalSelectedCalendars = [...account.selectedCalendars];

	showSchemaModal<CalDAVEditFormValues>({
		app,
		cls: "prisma-caldav-modal",
		title: `Edit: ${account.name}`,
		shape: CalDAVEditFormShape,
		existing: {
			id: account.id,
			data: {
				name: account.name,
				enabled: account.enabled,
				syncIntervalMinutes: account.syncIntervalMinutes,
				timezone: account.timezone,
				icon: account.icon,
			},
		},
		extraFields: (el) => {
			const refreshButton = el.createEl("button", {
				text: "Refresh calendars",
				cls: cls("caldav-refresh-button"),
			});
			refreshButton.addEventListener("click", () => {
				void refreshCalDAVCalendars(app, refreshButton, account, (calendars) => {
					discoveredCalendars = calendars;
					renderCalendarCheckboxes(el, discoveredCalendars, selectedCalendars, (updated) => {
						selectedCalendars = updated;
					});
				});
			});

			renderCalendarCheckboxes(
				el,
				discoveredCalendars.length > 0
					? discoveredCalendars
					: selectedCalendars.map((url) => ({ url, displayName: friendlyCalendarName(url) })),
				selectedCalendars,
				(updated) => {
					selectedCalendars = updated;
				}
			);
		},
		onSubmit: async (_name, values) => {
			const removedCalendars = originalSelectedCalendars.filter((url) => !selectedCalendars.includes(url));

			if (removedCalendars.length > 0) {
				const bundle = plugin.calendarBundles.find((b) => b.calendarId === calendarId);
				if (bundle) {
					for (const calendarUrl of removedCalendars) {
						await handleRemovedCalendarEvents(app, bundle, settingsStore, calendarId, account.id, calendarUrl);
					}
				}
			}

			await settingsStore.updateSettings((s) => ({
				...s,
				caldav: {
					...s.caldav,
					accounts: s.caldav.accounts.map((a) =>
						a.id === account.id
							? {
									...a,
									name: values.name,
									enabled: values.enabled,
									syncIntervalMinutes: values.syncIntervalMinutes,
									timezone: values.timezone,
									selectedCalendars,
									icon: values.icon || undefined,
								}
							: a
					),
				},
			}));

			new Notice(`Updated account: ${values.name}`);
			onSave();
		},
	});
}

async function handleRemovedCalendarEvents(
	app: App,
	bundle: CalendarBundle,
	settingsStore: PrismaCalendarSettingsStore,
	calendarId: string,
	accountId: string,
	calendarUrl: string
): Promise<void> {
	const events = bundle.caldavSyncStateManager.getAllForCalendar(accountId, calendarUrl);
	if (events.length === 0) return;

	const calendarIdentifier = calendarUrl.split("/").pop() || calendarUrl;

	await new Promise<void>((resolve) => {
		showCalendarIntegrationDeleteEventsModal(app, {
			calendarIdentifier,
			eventCount: events.length,
			onConfirm: async () => {
				await deleteTrackedIntegrationEvents(
					app,
					bundle,
					events,
					getCalendarById(settingsStore.currentSettings, calendarId)?.fileConcurrencyLimit,
					"CalDAV",
					`calendar ${calendarUrl}`
				);
				resolve();
			},
			onCancel: () => {
				resolve();
			},
		});
	});
}

function friendlyCalendarName(url: string): string {
	const segment = url.replace(/\/+$/, "").split("/").pop() ?? url;
	return segment.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function refreshCalDAVCalendars(
	app: App,
	button: HTMLButtonElement,
	account: CalDAVAccount,
	onSuccess: (calendars: CalDAVCalendarInfo[]) => void
): Promise<void> {
	button.disabled = true;
	button.setText("Refreshing...");

	try {
		const client = new CalDAVClientService(app, account);
		await client.initialize();
		const calendars = await client.fetchCalendars();
		client.destroy();

		new Notice(`Found ${calendars.length} calendar(s)`);
		onSuccess(calendars);
	} catch (error) {
		new Notice(`Failed to refresh: ${error}`);
	} finally {
		button.disabled = false;
		button.setText("Refresh calendars");
	}
}
