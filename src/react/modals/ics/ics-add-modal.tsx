import { cls, tid } from "@real1ty-obsidian-plugins";
import { ModalForm, openReactModal, SchemaForm, useZodForm } from "@real1ty-obsidian-plugins-react";
import { nanoid } from "nanoid";
import type { App } from "obsidian";
import { Notice, requestUrl } from "obsidian";
import { useCallback } from "react";
import { z } from "zod";

import {
	ICSSubscriptionAddFormShape,
	type ICSSubscriptionAddFormValues,
} from "../../../components/settings/integration-shared";
import { parseICSContent } from "../../../core/integrations/ics-import";
import { useConnectionTest } from "../../../react/hooks/use-connection-test";
import type { PrismaCalendarSettingsStore } from "../../../types";
import type { ICSSubscription } from "../../../types/integrations";

const ICSAddSchema = z.object(ICSSubscriptionAddFormShape);

interface ICSAddFormProps {
	app: App;
	settingsStore: PrismaCalendarSettingsStore;
	calendarId: string;
	onSubmit: (subscription: ICSSubscription) => void;
	onCancel: () => void;
}

function ICSAddForm({ app, settingsStore, calendarId, onSubmit, onCancel }: ICSAddFormProps) {
	const form = useZodForm({ schema: ICSAddSchema });

	const { testPassed, testing, runTest } = useConnectionTest(
		useCallback(async () => {
			const secretName = form.getValues().urlSecretName;
			if (!secretName) {
				new Notice("Please select an ICS URL secret");
				return { success: false };
			}

			const url = app.secretStorage.getSecret(secretName) ?? "";
			if (!url) {
				new Notice("Selected secret is empty");
				return { success: false };
			}

			const response = await requestUrl({ url, method: "GET" });
			const parsed = parseICSContent(response.text);

			if (parsed.success) {
				return { success: true, data: parsed.events.length };
			}
			return { success: false, error: parsed.error?.message || "Unknown error" };
		}, [app, form]),
		{ successMessage: (count: number) => `Found ${count} event(s)` }
	);

	const handleSubmit = useCallback(() => {
		void form.handleSubmit(async (values: ICSSubscriptionAddFormValues) => {
			if (!values.urlSecretName) {
				new Notice("Please select a URL secret");
				return;
			}
			if (!testPassed) {
				new Notice("Please test the URL first");
				return;
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
			onSubmit(subscription);
		})();
	}, [form, testPassed, calendarId, settingsStore, onSubmit]);

	return (
		<ModalForm onSubmit={handleSubmit} onCancel={onCancel}>
			<SchemaForm
				form={form}
				schema={ICSAddSchema}
				fieldOverrides={{
					urlSecretName: { label: "ICS URL" },
				}}
				testIdPrefix={tid("ics-add-")}
			/>

			<button
				type="button"
				className={cls("caldav-test-button")}
				onClick={() => void runTest()}
				disabled={testing}
				data-testid={tid("ics-test-url")}
			>
				{testing ? "Testing..." : "Test URL"}
			</button>
		</ModalForm>
	);
}

export function openICSAddModal(
	app: App,
	settingsStore: PrismaCalendarSettingsStore,
	calendarId: string
): Promise<ICSSubscription | null> {
	return openReactModal<ICSSubscription>({
		app,
		title: "Add ICS subscription",
		cls: cls("caldav-modal"),
		testId: tid("modal-ics-add"),
		render: (submit, cancel) => (
			<ICSAddForm app={app} settingsStore={settingsStore} calendarId={calendarId} onSubmit={submit} onCancel={cancel} />
		),
	});
}
