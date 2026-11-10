import type { Frontmatter, SingleCalendarConfig } from "../../types";
import type { IntegrationDeletionTombstone } from "../../types/integrations";
import type { CalendarBundle } from "../calendar-bundle";
import { CalDAVSyncMetadataSchema } from "./caldav/types";
import { ICSSubscriptionSyncMetadataSchema } from "./ics-subscription/types";

export function integrationDeletionKey(identity: IntegrationDeletionTombstone): string {
	return JSON.stringify(
		identity.kind === "caldav"
			? [identity.kind, identity.accountId, identity.calendarHref, identity.uid]
			: [identity.kind, identity.subscriptionId, identity.uid]
	);
}

export class IntegrationDeletionIndex {
	private readonly keys: Set<string>;

	constructor(identities: readonly IntegrationDeletionTombstone[] = []) {
		this.keys = new Set(identities.map(integrationDeletionKey));
	}

	has(identity: IntegrationDeletionTombstone): boolean {
		return this.keys.has(integrationDeletionKey(identity));
	}
}

export function createIntegrationDeletionLifecycle(
	bundle: Pick<CalendarBundle, "prismaDataFile" | "settingsStore" | "fileRepository">
) {
	const settings = bundle.settingsStore.currentSettings;
	const data = bundle.prismaDataFile;
	const gate = () => bundle.fileRepository.assertWritable("integration deletion history");
	return {
		async onDelete(snapshot: { data: Frontmatter }): Promise<void> {
			const identity = getIntegrationDeletionTombstone(snapshot.data, settings);
			if (identity) await data.setDeleted([identity], true, gate);
		},
		async onUndo(snapshot: { data: Frontmatter }): Promise<void> {
			const identity = getIntegrationDeletionTombstone(snapshot.data, settings);
			if (identity) await data.setDeleted([identity], false, gate);
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
