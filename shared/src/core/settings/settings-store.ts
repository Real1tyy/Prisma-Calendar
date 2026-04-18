import type { Plugin } from "obsidian";
import type { Observable } from "rxjs";
import { BehaviorSubject, distinctUntilChanged, map, skip } from "rxjs";
import type { z } from "zod";

import { deepEqualJsonLike } from "../../utils/deep-equal";

export interface WatchOptions<R = unknown> {
	immediate?: boolean;
	compare?: (a: R, b: R) => boolean;
}

export type SettingsWatcher<TSettings> = readonly [
	selector: (settings: TSettings) => unknown,
	callback: (value: never) => void,
	options?: WatchOptions,
];

export class SettingsStore<TSchema extends z.ZodTypeAny> {
	private plugin: Plugin;
	private schema: TSchema;
	public readonly settings$: BehaviorSubject<z.infer<TSchema>>;
	public readonly hasCustomizations$: Observable<boolean>;

	// Defaults are derived from the schema, which is fixed for the lifetime of
	// the store — cache them so `hasCustomizations` isn't paying to re-parse on
	// every call.
	private cachedDefaults: z.infer<TSchema> | null = null;

	constructor(plugin: Plugin, schema: TSchema) {
		this.plugin = plugin;
		this.schema = schema;
		this.settings$ = new BehaviorSubject<z.infer<TSchema>>(this.getDefaults());
		this.hasCustomizations$ = this.settings$.pipe(
			map((settings) => !deepEqualJsonLike(settings, this.getDefaults())),
			distinctUntilChanged()
		);
	}

	get currentSettings(): z.infer<TSchema> {
		return this.settings$.value;
	}

	get validationSchema(): TSchema {
		return this.schema;
	}

	async loadSettings(): Promise<void> {
		try {
			const data = await this.plugin.loadData();
			const sanitized = this.schema.parse(data ?? {});
			this.settings$.next(sanitized);

			if (!deepEqualJsonLike(sanitized, data ?? {})) {
				await this.saveSettings();
			}
		} catch (error) {
			console.error("Failed to load settings, using defaults:", error);
			this.settings$.next(this.getDefaults());
			await this.saveSettings();
		}
	}

	async saveSettings(): Promise<void> {
		await this.plugin.saveData(this.currentSettings);
	}

	async updateSettings(updater: (settings: z.infer<TSchema>) => z.infer<TSchema>): Promise<void> {
		try {
			const newSettings = updater(this.currentSettings);
			const validated = this.schema.parse(newSettings);

			this.settings$.next(validated);
			await this.saveSettings();
		} catch (error) {
			console.error("Failed to update settings:", error);
			throw error;
		}
	}

	async resetSettings(): Promise<void> {
		this.settings$.next(this.getDefaults());
		await this.saveSettings();
	}

	async updateProperty<K extends keyof z.infer<TSchema>>(key: K, value: z.infer<TSchema>[K]): Promise<void> {
		await this.updateSettings((settings) => {
			return {
				...(settings as object),
				[key]: value,
			} as z.infer<TSchema>;
		});
	}

	// No defensive clone of `updates` — `updateSettings` feeds the result
	// through `schema.parse()`, which rebuilds the object tree for strict /
	// default / `.catchall()` schemas, so stored state shares no references
	// with the caller's input. This assumption breaks if a schema uses
	// `.passthrough()`: Zod keeps unknown keys as-is, and a caller that
	// retains `updates` could then mutate stored state through them. No
	// schema in this monorepo uses `.passthrough()` — revisit this if one
	// does.
	async updateProperties(updates: Partial<z.infer<TSchema>>): Promise<void> {
		await this.updateSettings((settings) => {
			return {
				...(settings as object),
				...(updates as object),
			} as z.infer<TSchema>;
		});
	}

	getDefaults(): z.infer<TSchema> {
		if (this.cachedDefaults === null) {
			this.cachedDefaults = this.schema.parse({});
		}
		return this.cachedDefaults;
	}

	hasCustomizations(): boolean {
		return !deepEqualJsonLike(this.currentSettings, this.getDefaults());
	}

	watch<R>(
		selector: (settings: z.infer<TSchema>) => R,
		callback: (value: R) => void,
		options?: WatchOptions<R>
	): () => void;
	watch(watchers: SettingsWatcher<z.infer<TSchema>>[]): () => void;
	watch<R>(
		selectorOrWatchers: ((settings: z.infer<TSchema>) => R) | SettingsWatcher<z.infer<TSchema>>[],
		callback?: (value: R) => void,
		options?: WatchOptions<R>
	): () => void {
		if (Array.isArray(selectorOrWatchers)) {
			const teardowns = selectorOrWatchers.map(([sel, cb, opts]) =>
				this.watchSingle(sel, cb as (value: unknown) => void, opts)
			);
			return () => teardowns.forEach((fn) => fn());
		}
		return this.watchSingle(selectorOrWatchers, callback!, options);
	}

	private watchSingle<R>(
		selector: (settings: z.infer<TSchema>) => R,
		callback: (value: R) => void,
		options?: WatchOptions<R>
	): () => void {
		const source$ = this.settings$.pipe(map(selector), distinctUntilChanged(options?.compare));
		const sub = (options?.immediate ? source$ : source$.pipe(skip(1))).subscribe(callback);
		this.plugin.register(() => sub.unsubscribe());
		return () => sub.unsubscribe();
	}

	getSecret(secretName: string): string {
		return (this.plugin.app as any).secretStorage?.getSecret(secretName) ?? "";
	}
}
