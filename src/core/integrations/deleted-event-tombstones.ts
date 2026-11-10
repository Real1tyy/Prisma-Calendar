import { CodeBlockRepository, debounceMsForEnv, type CodeBlockBinding } from "@real1ty/obsidian-plugins";
import type { App } from "obsidian";
import { debounceTime, type BehaviorSubject, type Subscription } from "rxjs";
import { z } from "zod";

import { DELETED_EVENTS_CODE_FENCE } from "../../constants";
import type { Frontmatter, SingleCalendarConfig } from "../../types";
import type { IntegrationDeletionTombstone } from "../../types/integrations";
import type { CalendarBundle } from "../calendar-bundle";
import { log } from "../logging";
import { VIRTUAL_EVENT_SETTINGS_DEBOUNCE_MS } from "../virtual-event-store";
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

export const IntegrationDeletionRecordSchema = z.object({
	id: z.string(),
	kind: z.enum(["caldav", "ics-subscription"]),
	accountId: z.string().optional(),
	calendarHref: z.string().optional(),
	subscriptionId: z.string().optional(),
	uid: z.string(),
});

export type IntegrationDeletionRecord = z.infer<typeof IntegrationDeletionRecordSchema>;

export class IntegrationDeletionStore {
	private readonly repo = new CodeBlockRepository<IntegrationDeletionRecord>({
		codeFence: DELETED_EVENTS_CODE_FENCE,
		itemSchema: IntegrationDeletionRecordSchema,
		idField: "id",
	});
	private binding: CodeBlockBinding | null = null;
	private settingsSubscription: Subscription | null = null;
	private directory: string;
	private bindEpoch = 0;
	private destroyed = false;

	constructor(
		private readonly app: App,
		settingsStore: BehaviorSubject<SingleCalendarConfig>
	) {
		this.directory = settingsStore.value.directory;

		this.settingsSubscription = settingsStore
			.pipe(debounceTime(debounceMsForEnv(VIRTUAL_EVENT_SETTINGS_DEBOUNCE_MS)))
			.subscribe((newSettings) => {
				const dirChanged = this.directory !== newSettings.directory;
				this.directory = newSettings.directory;
				if (!dirChanged) return;

				if (!this.directory) {
					if (this.binding) {
						this.binding.unsubscribe();
						this.binding = null;
					}
					return;
				}

				if (this.binding) {
					const epoch = ++this.bindEpoch;
					this.repo
						.rebind(this.binding, this.app, this.getFilePath(), {
							createIfMissing: true,
						})
						.then((b) => {
							if (this.destroyed || epoch !== this.bindEpoch) {
								b.unsubscribe();
								return;
							}
							this.binding = b;
						})
						.catch((error: unknown) => log.error("indexing", "Integration deletion store rebind failed", { error }));
				} else {
					void this.initialize();
				}
			});
	}

	getFilePath(): string {
		return this.directory ? `${this.directory}/Prisma.md` : "Prisma.md";
	}

	async initialize(): Promise<void> {
		if (!this.directory) return;
		this.binding = await this.repo.bind(this.app, this.getFilePath(), {
			createIfMissing: true,
		});
	}

	destroy(): void {
		this.destroyed = true;
		this.bindEpoch++;
		this.binding?.unsubscribe();
		this.binding = null;
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
	}

	getDeletedEvents(): IntegrationDeletionTombstone[] {
		return this.repo.toArray().map((r) => {
			const { kind, uid, accountId, calendarHref, subscriptionId } = r.data;
			if (kind === "caldav") {
				return { kind: "caldav", accountId: accountId ?? "", calendarHref: calendarHref ?? "", uid };
			}
			return { kind: "ics-subscription", subscriptionId: subscriptionId ?? "", uid };
		});
	}

	has(identity: IntegrationDeletionTombstone): boolean {
		const key = integrationDeletionKey(identity);
		return this.repo.get(key) !== undefined;
	}

	async add(identity: IntegrationDeletionTombstone): Promise<void> {
		const id = integrationDeletionKey(identity);
		if (this.repo.get(id)) return;
		await this.repo.create({ id, ...identity });
	}

	async addBatch(identities: readonly IntegrationDeletionTombstone[]): Promise<void> {
		const toAdd = identities
			.filter((i) => !this.repo.get(integrationDeletionKey(i)))
			.map((i) => ({ id: integrationDeletionKey(i), ...i }));
		if (toAdd.length === 0) return;
		await this.repo.createMany(toAdd);
	}

	async remove(identity: IntegrationDeletionTombstone): Promise<void> {
		const id = integrationDeletionKey(identity);
		if (!this.repo.get(id)) return;
		await this.repo.delete(id);
	}

	async removeBatch(identities: readonly IntegrationDeletionTombstone[]): Promise<void> {
		const ids = identities.map(integrationDeletionKey).filter((id) => this.repo.get(id) !== undefined);
		if (ids.length === 0) return;
		await this.repo.deleteMany(ids);
	}
}

export function createIntegrationDeletionLifecycle(
	bundle: Pick<CalendarBundle, "integrationDeletionStore" | "settingsStore">
) {
	const settings = bundle.settingsStore.currentSettings;
	const store = bundle.integrationDeletionStore;
	return {
		async onDelete(snapshot: { data: Frontmatter }): Promise<void> {
			const identity = getIntegrationDeletionTombstone(snapshot.data, settings);
			if (identity) await store.add(identity);
		},
		async onUndo(snapshot: { data: Frontmatter }): Promise<void> {
			const identity = getIntegrationDeletionTombstone(snapshot.data, settings);
			if (identity) await store.remove(identity);
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
