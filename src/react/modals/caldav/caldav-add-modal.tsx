import { ModalForm, openReactModal, SchemaForm, SettingItem, useZodForm } from "@real1ty-obsidian-plugins-react";
import { nanoid } from "nanoid";
import { Notice, type App } from "obsidian";
import { useCallback, useMemo, useState } from "react";
import { z } from "zod";

import { CalDAVAddFormShape, type CalDAVAddFormValues } from "../../../components/settings/integration-shared";
import { cls, tid } from "../../../constants";
import { CalDAVClientService } from "../../../core/integrations/caldav";
import { useConnectionTest } from "../../../react/hooks/use-connection-test";
import type { PrismaCalendarSettingsStore } from "../../../types";
import {
	CALDAV_PRESETS,
	type CalDAVAccount,
	type CalDAVCalendarInfo,
	type CalDAVPresetKey,
} from "../../../types/integrations";
import { CalendarCheckboxes } from "./calendar-checkboxes";

const CalDAVAddSchema = z.object(CalDAVAddFormShape);

interface CalDAVAddFormProps {
	app: App;
	settingsStore: PrismaCalendarSettingsStore;
	calendarId: string;
	onSubmit: (account: CalDAVAccount) => void;
	onCancel: () => void;
}

function CalDAVAddForm({ app, settingsStore, calendarId, onSubmit, onCancel }: CalDAVAddFormProps) {
	const [authMethod, setAuthMethod] = useState<"Basic" | "Oauth">("Basic");
	const [discoveredCalendars, setDiscoveredCalendars] = useState<CalDAVCalendarInfo[]>([]);
	const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);

	const form = useZodForm({ schema: CalDAVAddSchema });

	const { testPassed, testing, runTest } = useConnectionTest(
		useCallback(async () => {
			const values = form.getValues();
			if (!values.serverUrl || !values.username || !values.passwordSecretName) {
				new Notice("Please fill in server address, username, and select a password secret");
				return { success: false };
			}

			const result = await CalDAVClientService.testConnection(app, {
				id: "test",
				name: values.name || "Test",
				serverUrl: values.serverUrl,
				authMethod,
				credentials: { username: values.username, passwordSecretName: values.passwordSecretName },
				enabled: true,
				calendarId,
				selectedCalendars: [],
				syncIntervalMinutes: values.syncIntervalMinutes,
				timezone: values.timezone,
				createdAt: Date.now(),
			});

			if (result.success && result.calendars) {
				setDiscoveredCalendars(result.calendars);
				setSelectedCalendars(result.calendars.map((c) => c.url));
				return { success: true, data: result.calendars };
			}
			return { success: false, error: result.error || "Unknown error" };
		}, [app, form, authMethod, calendarId]),
		{ successMessage: (calendars: CalDAVCalendarInfo[]) => `Found ${calendars.length} calendar(s)` }
	);

	const presetOptions = useMemo(() => {
		const opts: Record<string, string> = { "": "Custom" };
		for (const [key, preset] of Object.entries(CALDAV_PRESETS)) {
			opts[key] = preset.name;
		}
		return opts;
	}, []);

	const handlePresetChange = useCallback(
		(value: string) => {
			if (value && value in CALDAV_PRESETS) {
				const preset = CALDAV_PRESETS[value as CalDAVPresetKey];
				form.setValue("name", preset.name);
				form.setValue("serverUrl", preset.serverUrl);
				setAuthMethod(preset.authMethod);
			}
		},
		[form]
	);

	const handleSubmit = useCallback(() => {
		void form.handleSubmit(async (values: CalDAVAddFormValues) => {
			if (!values.passwordSecretName) {
				new Notice("Please select a password secret");
				return;
			}
			if (!testPassed) {
				new Notice("Please test the connection first");
				return;
			}

			const account: CalDAVAccount = {
				id: nanoid(),
				name: values.name,
				serverUrl: values.serverUrl,
				authMethod,
				credentials: {
					username: values.username,
					passwordSecretName: values.passwordSecretName,
				},
				enabled: true,
				calendarId,
				selectedCalendars,
				syncIntervalMinutes: values.syncIntervalMinutes,
				timezone: values.timezone,
				createdAt: Date.now(),
				icon: values.icon || undefined,
			};

			await settingsStore.updateSettings((s) => ({
				...s,
				caldav: {
					...s.caldav,
					accounts: [...s.caldav.accounts, account],
				},
			}));

			new Notice(`Added account: ${values.name}`);
			onSubmit(account);
		})();
	}, [form, testPassed, authMethod, calendarId, selectedCalendars, settingsStore, onSubmit]);

	return (
		<ModalForm onSubmit={handleSubmit} onCancel={onCancel}>
			<SettingItem name="Provider preset" description="Select a provider to pre-fill the server address">
				<select
					className="dropdown"
					onChange={(e) => handlePresetChange(e.target.value)}
					data-testid={tid("caldav-preset")}
				>
					{Object.entries(presetOptions).map(([value, label]) => (
						<option key={value} value={value}>
							{label}
						</option>
					))}
				</select>
			</SettingItem>

			<SchemaForm
				form={form}
				schema={CalDAVAddSchema}
				fieldOverrides={{
					passwordSecretName: { label: "Password / app password" },
				}}
				testIdPrefix={tid("caldav-add-")}
			/>

			<button
				type="button"
				className={cls("caldav-test-button")}
				onClick={() => void runTest()}
				disabled={testing}
				data-testid={tid("caldav-test-connection")}
			>
				{testing ? "Testing..." : "Test connection & discover calendars"}
			</button>

			<CalendarCheckboxes
				calendars={discoveredCalendars}
				selected={selectedCalendars}
				onChange={setSelectedCalendars}
			/>
		</ModalForm>
	);
}

export function openCalDAVAddModal(
	app: App,
	settingsStore: PrismaCalendarSettingsStore,
	calendarId: string
): Promise<CalDAVAccount | null> {
	return openReactModal<CalDAVAccount>({
		app,
		title: "Add account",
		cls: cls("caldav-modal"),
		testId: tid("modal-caldav-add"),
		render: (submit, cancel) => (
			<CalDAVAddForm
				app={app}
				settingsStore={settingsStore}
				calendarId={calendarId}
				onSubmit={submit}
				onCancel={cancel}
			/>
		),
	});
}
