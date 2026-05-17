import { cls, tid } from "../../../constants";
import { ModalForm, openReactModal, SchemaForm, useZodForm } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { Notice } from "obsidian";
import { useCallback } from "react";
import { z } from "zod";

import {
	ICSSubscriptionEditFormShape,
	type ICSSubscriptionEditFormValues,
} from "../../../components/settings/integration-shared";
import type { PrismaCalendarSettingsStore } from "../../../types";
import type { ICSSubscription } from "../../../types/integrations";

const ICSEditSchema = z.object(ICSSubscriptionEditFormShape);

interface ICSEditFormProps {
	settingsStore: PrismaCalendarSettingsStore;
	subscription: ICSSubscription;
	onSubmit: () => void;
	onCancel: () => void;
}

function ICSEditForm({ settingsStore, subscription, onSubmit, onCancel }: ICSEditFormProps) {
	const form = useZodForm({
		schema: ICSEditSchema,
		defaultValues: {
			name: subscription.name,
			enabled: subscription.enabled,
			syncIntervalMinutes: subscription.syncIntervalMinutes,
			timezone: subscription.timezone,
			icon: subscription.icon ?? "",
		},
	});

	const handleSubmit = useCallback(() => {
		void form.handleSubmit(async (values: ICSSubscriptionEditFormValues) => {
			await settingsStore.updateSettings((s) => ({
				...s,
				icsSubscriptions: {
					...s.icsSubscriptions,
					subscriptions: s.icsSubscriptions.subscriptions.map((sub) =>
						sub.id === subscription.id
							? {
									...sub,
									name: values.name,
									enabled: values.enabled,
									syncIntervalMinutes: values.syncIntervalMinutes,
									timezone: values.timezone,
									icon: values.icon || undefined,
								}
							: sub
					),
				},
			}));

			new Notice(`Updated subscription: ${values.name}`);
			onSubmit();
		})();
	}, [form, subscription.id, settingsStore, onSubmit]);

	return (
		<ModalForm onSubmit={handleSubmit} onCancel={onCancel}>
			<SchemaForm form={form} schema={ICSEditSchema} testIdPrefix={tid("ics-edit-")} />
		</ModalForm>
	);
}

export function openICSEditModal(
	app: App,
	settingsStore: PrismaCalendarSettingsStore,
	subscription: ICSSubscription
): Promise<void> {
	return openReactModal<void>({
		app,
		title: `Edit: ${subscription.name}`,
		cls: cls("caldav-modal"),
		testId: tid("modal-ics-edit"),
		render: (submit, cancel) => (
			<ICSEditForm
				settingsStore={settingsStore}
				subscription={subscription}
				onSubmit={() => submit(undefined)}
				onCancel={cancel}
			/>
		),
	}).then(() => undefined);
}
