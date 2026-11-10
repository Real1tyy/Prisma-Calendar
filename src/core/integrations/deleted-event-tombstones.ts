import type { Frontmatter, PrismaCalendarSettingsStore, SingleCalendarConfig } from "../../types";
import type { IntegrationDeletionTombstone } from "../../types/integrations";
import { CalDAVSyncMetadataSchema } from "./caldav/types";
import { ICSSubscriptionSyncMetadataSchema } from "./ics-subscription/types";

export function createIntegrationDeletionLifecycle(
	settingsStore: PrismaCalendarSettingsStore,
	settings: SingleCalendarConfig
) {
	return {
		async onDelete(snapshot: { data: Frontmatter }): Promise<void> {
			const tombstone = getIntegrationDeletionTombstone(snapshot.data, settings);
			if (tombstone) await addIntegrationDeletionTombstone(settingsStore, tombstone);
		},
		async onUndo(snapshot: { data: Frontmatter }): Promise<void> {
			const tombstone = getIntegrationDeletionTombstone(snapshot.data, settings);
			if (tombstone) await removeIntegrationDeletionTombstone(settingsStore, tombstone);
		},
	};
}

export function getIntegrationDeletionTombstone(
	frontmatter: Frontmatter,
	settings: SingleCalendarConfig
): IntegrationDeletionTombstone | null {
	const caldav = CalDAVSyncMetadataSchema.safeParse(frontmatter[settings.caldavProp]);
	if (caldav.success) {
		return {
			kind: "caldav",
			accountId: caldav.data.accountId,
			calendarHref: caldav.data.calendarHref,
			uid: caldav.data.uid,
		};
	}

	const subscription = ICSSubscriptionSyncMetadataSchema.safeParse(frontmatter[settings.icsSubscriptionProp]);
	if (subscription.success) {
		return { kind: "ics-subscription", subscriptionId: subscription.data.subscriptionId, uid: subscription.data.uid };
	}

	return null;
}

export function sameIntegrationDeletionTombstone(
	left: IntegrationDeletionTombstone,
	right: IntegrationDeletionTombstone
): boolean {
	if (left.kind !== right.kind || left.uid !== right.uid) return false;
	switch (left.kind) {
		case "caldav":
			return right.kind === "caldav" && left.accountId === right.accountId && left.calendarHref === right.calendarHref;
		case "ics-subscription":
			return right.kind === "ics-subscription" && left.subscriptionId === right.subscriptionId;
	}
}

export async function addIntegrationDeletionTombstone(
	settingsStore: PrismaCalendarSettingsStore,
	tombstone: IntegrationDeletionTombstone
): Promise<void> {
	await settingsStore.updateSettings((settings) => {
		if (
			settings.integrationDeletionTombstones.some((existing) => sameIntegrationDeletionTombstone(existing, tombstone))
		) {
			return settings;
		}
		return { ...settings, integrationDeletionTombstones: [...settings.integrationDeletionTombstones, tombstone] };
	});
}

export async function removeIntegrationDeletionTombstone(
	settingsStore: PrismaCalendarSettingsStore,
	tombstone: IntegrationDeletionTombstone
): Promise<void> {
	await settingsStore.updateSettings((settings) => ({
		...settings,
		integrationDeletionTombstones: settings.integrationDeletionTombstones.filter(
			(existing) => !sameIntegrationDeletionTombstone(existing, tombstone)
		),
	}));
}

export function isIntegrationEventDeleted(
	tombstones: readonly IntegrationDeletionTombstone[],
	tombstone: IntegrationDeletionTombstone
): boolean {
	return tombstones.some((existing) => sameIntegrationDeletionTombstone(existing, tombstone));
}
