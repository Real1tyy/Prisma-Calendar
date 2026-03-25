import { showSchemaModal } from "@real1ty-obsidian-plugins";
import { nanoid } from "nanoid";
import { type App, Notice, requestUrl } from "obsidian";

import { parseICSContent } from "../../../core/integrations/ics-import";
import type { PrismaCalendarSettingsStore } from "../../../types";
import type { ICSSubscription } from "../../../types/integrations";
import { ICSSubscriptionAddFormShape, type ICSSubscriptionAddFormValues } from "../integration-shared";

export function showAddICSSubscriptionModal(
	app: App,
	settingsStore: PrismaCalendarSettingsStore,
	calendarId: string,
	onSave: () => void
): void {
	let testPassed = false;

	showSchemaModal<ICSSubscriptionAddFormValues>({
		app,
		cls: "prisma-caldav-modal",
		title: "Add ICS subscription",
		shape: ICSSubscriptionAddFormShape,
		fieldOverrides: {
			urlSecretName: { label: "ICS URL" },
		},
		extraFields: (el, values) => {
			const testButton = el.createEl("button", {
				text: "Test URL",
				cls: "prisma-caldav-test-button",
			});
			testButton.addEventListener("click", () => {
				void testUrl(app, testButton, values, (passed) => {
					testPassed = passed;
				});
			});
		},
		onSubmit: async (_name, values) => {
			if (!values.urlSecretName) {
				new Notice("Please select a URL secret");
				return false;
			}
			if (!testPassed) {
				new Notice("Please test the URL first");
				return false;
			}

			const subscription: ICSSubscription = {
				id: nanoid(),
				name: values.name,
				urlSecretName: values.urlSecretName,
				enabled: true,
				calendarId,
				syncIntervalMinutes: values.syncIntervalMinutes,
				timezone: values.timezone,
				createdAt: Date.now(),
				icon: values.icon || undefined,
			};

			await settingsStore.updateSettings((s) => ({
				...s,
				icsSubscriptions: {
					...s.icsSubscriptions,
					subscriptions: [...s.icsSubscriptions.subscriptions, subscription],
				},
			}));

			new Notice(`Added subscription: ${values.name}`);
			onSave();
		},
	});
}

async function testUrl(
	app: App,
	button: HTMLButtonElement,
	values: Record<string, unknown>,
	setTestPassed: (v: boolean) => void
): Promise<void> {
	const secretName = String(values["urlSecretName"] ?? "");
	if (!secretName) {
		new Notice("Please select an ICS URL secret");
		return;
	}

	const url = app.secretStorage.getSecret(secretName) ?? "";
	if (!url) {
		new Notice("Selected secret is empty");
		return;
	}

	button.disabled = true;
	button.setText("Testing...");

	try {
		const response = await requestUrl({ url, method: "GET" });
		const parsed = parseICSContent(response.text);

		if (parsed.success) {
			setTestPassed(true);
			new Notice(`Found ${parsed.events.length} event(s)`);
		} else {
			new Notice(`Failed to parse ICS: ${parsed.error?.message || "Unknown error"}`);
			setTestPassed(false);
		}
	} catch (error) {
		new Notice(`Failed to fetch URL: ${error}`);
		setTestPassed(false);
	} finally {
		button.disabled = false;
		button.setText("Test URL");
	}
}
