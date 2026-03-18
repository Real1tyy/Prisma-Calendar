import type { App } from "obsidian";
import type { BehaviorSubject, Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import type { z } from "zod";

import type { Frontmatter } from "../../types";
import type { SingleCalendarConfig } from "../../types/settings";
import type { Indexer, IndexerEvent } from "../indexer";

export interface TrackedSyncEvent<TMetadata> {
	filePath: string;
	metadata: TMetadata;
}

export abstract class BaseSyncStateManager<TMetadata> {
	private indexerSubscription: Subscription | null = null;
	private settingsSubscription: Subscription | null = null;
	protected frontmatterProp: string;

	constructor(
		protected app: App,
		indexer: Indexer,
		settings$: BehaviorSubject<SingleCalendarConfig>,
		getPropFromSettings: (settings: SingleCalendarConfig) => string,
		private schema: z.ZodType<TMetadata>
	) {
		this.frontmatterProp = getPropFromSettings(settings$.value);

		this.settingsSubscription = settings$.subscribe((settings) => {
			this.frontmatterProp = getPropFromSettings(settings);
		});

		this.indexerSubscription = indexer.events$
			.pipe(filter((event: IndexerEvent) => event.type === "file-changed" || event.type === "file-deleted"))
			.subscribe((event: IndexerEvent) => {
				this.handleIndexerEvent(event);
			});
	}

	destroy(): void {
		this.indexerSubscription?.unsubscribe();
		this.indexerSubscription = null;
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.clearState();
	}

	protected abstract clearState(): void;
	protected abstract trackEvent(filePath: string, metadata: TMetadata): void;
	protected abstract untrackByPath(filePath: string): boolean;

	private handleIndexerEvent(event: IndexerEvent): void {
		switch (event.type) {
			case "file-changed":
				if (event.source) {
					this.processFileChange(event.filePath, event.source.frontmatter);
				}
				break;
			case "file-deleted":
				this.untrackByPath(event.filePath);
				break;
		}
	}

	private processFileChange(filePath: string, frontmatter: Frontmatter): void {
		const data = frontmatter[this.frontmatterProp] as Frontmatter | undefined;

		if (data && typeof data === "object") {
			const result = this.schema.safeParse(data);
			if (result.success) {
				this.trackEvent(filePath, result.data);
				return;
			}
		}

		this.untrackByPath(filePath);
	}
}
