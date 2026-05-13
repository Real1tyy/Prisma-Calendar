import { cls, tid } from "@real1ty-obsidian-plugins";
import { ModalForm, openReactModal, SchemaForm, useZodForm } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { Notice } from "obsidian";
import { useCallback, useState } from "react";
import { z } from "zod";

import {
	CalDAVEditFormShape,
	type CalDAVEditFormValues,
	deleteTrackedIntegrationEvents,
} from "../../../components/settings/integration-shared";
import type { CalendarBundle } from "../../../core/calendar-bundle";
import { CalDAVClientService } from "../../../core/integrations/caldav";
import type CustomCalendarPlugin from "../../../main";
import type { PrismaCalendarSettingsStore } from "../../../types";
import type { CalDAVAccount, CalDAVCalendarInfo } from "../../../types/integrations";
import { getCalendarById } from "../../../utils/calendar-settings";
import { friendlyCalendarName } from "../../../utils/calendar-settings";
import { openCalendarIntegrationDeleteEventsModal } from "../event/delete-confirmation-modal";
import { CalendarCheckboxes } from "./calendar-checkboxes";

const CalDAVEditSchema = z.object(CalDAVEditFormShape);

interface CalDAVEditFormProps {
	app: App;
	settingsStore: PrismaCalendarSettingsStore;
	plugin: CustomCalendarPlugin;
	calendarId: string;
	account: CalDAVAccount;
	onSubmit: () => void;
	onCancel: () => void;
}

function CalDAVEditForm({ app, settingsStore, plugin, calendarId, account, onSubmit, onCancel }: CalDAVEditFormProps) {
	const [discoveredCalendars, setDiscoveredCalendars] = useState<CalDAVCalendarInfo[]>([]);
	const [selectedCalendars, setSelectedCalendars] = useState<string[]>([...account.selectedCalendars]);
	const [refreshing, setRefreshing] = useState(false);

	const displayCalendars =
		discoveredCalendars.length > 0
			? discoveredCalendars
			: account.selectedCalendars.map((url) => ({ url, displayName: friendlyCalendarName(url) }));

	const form = useZodForm({
		schema: CalDAVEditSchema,
		defaultValues: {
			name: account.name,
			enabled: account.enabled,
			syncIntervalMinutes: account.syncIntervalMinutes,
			timezone: account.timezone,
			icon: account.icon ?? "",
		},
	});

	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			const client = new CalDAVClientService(app, account);
			await client.initialize();
			const calendars = await client.fetchCalendars();
			client.destroy();

			new Notice(`Found ${calendars.length} calendar(s)`);
			setDiscoveredCalendars(calendars);
		} catch (error) {
			new Notice(`Failed to refresh: ${error}`);
		} finally {
			setRefreshing(false);
		}
	}, [app, account]);

	const handleSubmit = useCallback(() => {
		void form.handleSubmit(async (values: CalDAVEditFormValues) => {
			const removedCalendars = account.selectedCalendars.filter((url) => !selectedCalendars.includes(url));

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
			onSubmit();
		})();
	}, [form, account, selectedCalendars, plugin, calendarId, settingsStore, app, onSubmit]);

	return (
		<ModalForm onSubmit={handleSubmit} onCancel={onCancel}>
			<SchemaForm form={form} schema={CalDAVEditSchema} testIdPrefix={tid("caldav-edit-")} />

			<button
				type="button"
				className={cls("caldav-refresh-button")}
				onClick={() => void handleRefresh()}
				disabled={refreshing}
				data-testid={tid("caldav-refresh")}
			>
				{refreshing ? "Refreshing..." : "Refresh calendars"}
			</button>

			<CalendarCheckboxes calendars={displayCalendars} selected={selectedCalendars} onChange={setSelectedCalendars} />
		</ModalForm>
	);
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

	const calendarIdentifier = friendlyCalendarName(calendarUrl);

	const result = await openCalendarIntegrationDeleteEventsModal(app, {
		calendarIdentifier,
		eventCount: events.length,
	});

	if (result === "confirm") {
		await deleteTrackedIntegrationEvents(
			app,
			bundle,
			events,
			getCalendarById(settingsStore.currentSettings, calendarId)?.fileConcurrencyLimit,
			"CalDAV",
			`calendar ${calendarUrl}`
		);
	}
}

export function openCalDAVEditModal(
	app: App,
	settingsStore: PrismaCalendarSettingsStore,
	plugin: CustomCalendarPlugin,
	calendarId: string,
	account: CalDAVAccount
): Promise<void> {
	return openReactModal<void>({
		app,
		title: `Edit: ${account.name}`,
		cls: cls("caldav-modal"),
		testId: tid("modal-caldav-edit"),
		render: (submit, cancel) => (
			<CalDAVEditForm
				app={app}
				settingsStore={settingsStore}
				plugin={plugin}
				calendarId={calendarId}
				account={account}
				onSubmit={() => submit(undefined)}
				onCancel={cancel}
			/>
		),
	}).then(() => undefined);
}
