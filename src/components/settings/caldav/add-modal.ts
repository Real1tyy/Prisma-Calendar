import { cls, showSchemaModal } from "@real1ty-obsidian-plugins";
import { nanoid } from "nanoid";
import { type App, Notice, Setting } from "obsidian";

import { CALDAV_DEFAULTS } from "../../../constants";
import { CalDAVClientService } from "../../../core/integrations/caldav";
import type { PrismaCalendarSettingsStore } from "../../../types";
import {
	CALDAV_PRESETS,
	type CalDAVAccount,
	type CalDAVCalendarInfo,
	type CalDAVPresetKey,
} from "../../../types/integrations";
import { CalDAVAddFormShape, type CalDAVAddFormValues } from "../integration-form-shapes";
import { renderCalendarCheckboxes } from "./calendar-checkboxes";

export function showAddCalDAVAccountModal(
	app: App,
	settingsStore: PrismaCalendarSettingsStore,
	calendarId: string,
	onSave: () => void
): void {
	let authMethod: "Basic" | "Oauth" = "Basic";
	let testPassed = false;
	let discoveredCalendars: CalDAVCalendarInfo[] = [];
	let selectedCalendars: string[] = [];

	showSchemaModal<CalDAVAddFormValues>({
		app,
		cls: "prisma-caldav-modal",
		title: "Add account",
		shape: CalDAVAddFormShape,
		fieldOverrides: {
			passwordSecretName: { label: "Password / app password" },
		},
		extraFields: (el, values, _ctx, setValues) => {
			renderPresetSelector(el, values, setValues, (preset) => {
				authMethod = preset.authMethod;
			});

			const testButton = el.createEl("button", {
				text: "Test connection & discover calendars",
				cls: cls("caldav-test-button"),
			});
			testButton.addEventListener("click", () => {
				void testCalDAVConnection(app, testButton, calendarId, values, authMethod, (calendars) => {
					discoveredCalendars = calendars;
					selectedCalendars = calendars.map((c) => c.url);
					testPassed = true;
					renderCalendarCheckboxes(el, discoveredCalendars, selectedCalendars, (updated) => {
						selectedCalendars = updated;
					});
				});
			});

			el.createDiv(cls("caldav-calendar-selector"));
		},
		onSubmit: async (_name, values) => {
			if (!values.passwordSecretName) {
				new Notice("Please select a password secret");
				return false;
			}
			if (!testPassed) {
				new Notice("Please test the connection first");
				return false;
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
			onSave();
		},
	});
}

function renderPresetSelector(
	container: HTMLElement,
	_values: Record<string, unknown>,
	setValues: (partial: Partial<Record<string, unknown>>) => void,
	onPresetApplied: (preset: (typeof CALDAV_PRESETS)[CalDAVPresetKey]) => void
): void {
	new Setting(container)
		.setName("Provider preset")
		.setDesc("Select a provider to pre-fill the server address")
		.addDropdown((dropdown) => {
			dropdown.addOption("", "Custom");
			for (const [key, preset] of Object.entries(CALDAV_PRESETS)) {
				dropdown.addOption(key, preset.name);
			}
			dropdown.onChange((value) => {
				if (value && value in CALDAV_PRESETS) {
					const preset = CALDAV_PRESETS[value as CalDAVPresetKey];
					setValues({ name: preset.name, serverUrl: preset.serverUrl });
					onPresetApplied(preset);
				}
			});
		});
}

async function testCalDAVConnection(
	app: App,
	button: HTMLButtonElement,
	calendarId: string,
	values: Record<string, unknown>,
	authMethod: "Basic" | "Oauth",
	onSuccess: (calendars: CalDAVCalendarInfo[]) => void
): Promise<void> {
	const serverUrl = String(values["serverUrl"] ?? "");
	const username = String(values["username"] ?? "");
	const passwordSecretName = String(values["passwordSecretName"] ?? "");

	if (!serverUrl || !username || !passwordSecretName) {
		new Notice("Please fill in server address, username, and select a password secret");
		return;
	}

	button.disabled = true;
	button.setText("Testing...");

	try {
		const result = await CalDAVClientService.testConnection(app, {
			id: "test",
			name: String(values["name"] ?? "Test"),
			serverUrl,
			authMethod,
			credentials: { username, passwordSecretName },
			enabled: true,
			calendarId,
			selectedCalendars: [],
			syncIntervalMinutes: Number(values["syncIntervalMinutes"] ?? CALDAV_DEFAULTS.SYNC_INTERVAL_MINUTES),
			timezone: String(values["timezone"] ?? "UTC"),
			createdAt: Date.now(),
		});

		if (result.success && result.calendars) {
			new Notice(`Found ${result.calendars.length} calendar(s)`);
			onSuccess(result.calendars);
		} else {
			new Notice(`Connection failed: ${result.error || "Unknown error"}`);
		}
	} catch (error) {
		new Notice(`Connection failed: ${error}`);
	} finally {
		button.disabled = false;
		button.setText("Test connection & discover calendars");
	}
}
