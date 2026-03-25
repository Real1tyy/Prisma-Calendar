import { showSchemaModal } from "@real1ty-obsidian-plugins";
import { type App, Notice } from "obsidian";

import { ICS_SUBSCRIPTION_DEFAULTS } from "../../../constants";
import type { PrismaCalendarSettingsStore } from "../../../types";
import type { ICSSubscription } from "../../../types/integrations";
import { ICSSubscriptionEditFormShape, type ICSSubscriptionEditFormValues } from "../integration-shared";

export function showEditICSSubscriptionModal(
	app: App,
	settingsStore: PrismaCalendarSettingsStore,
	subscription: ICSSubscription,
	onSave: () => void
): void {
	showSchemaModal<ICSSubscriptionEditFormValues>({
		app,
		cls: "prisma-caldav-modal",
		title: `Edit: ${subscription.name}`,
		shape: ICSSubscriptionEditFormShape,
		existing: {
			id: subscription.id,
			data: {
				name: subscription.name,
				enabled: subscription.enabled,
				syncIntervalMinutes: subscription.syncIntervalMinutes ?? ICS_SUBSCRIPTION_DEFAULTS.SYNC_INTERVAL_MINUTES,
				timezone: subscription.timezone ?? "UTC",
				icon: subscription.icon ?? "",
			},
		},
		onSubmit: async (_name, values) => {
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
			onSave();
		},
	});
}
