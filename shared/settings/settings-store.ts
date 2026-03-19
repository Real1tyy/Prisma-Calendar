import type { Plugin } from "obsidian";
import { BehaviorSubject, distinctUntilChanged, map, skip } from "rxjs";
import type { z } from "zod";

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

	constructor(plugin: Plugin, schema: TSchema) {
		this.plugin = plugin;
		this.schema = schema;
		this.settings$ = new BehaviorSubject<z.infer<TSchema>>(schema.parse({}));
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

			// Save back if data was sanitized/normalized
			if (JSON.stringify(sanitized) !== JSON.stringify(data ?? {})) {
				await this.saveSettings();
			}
		} catch (error) {
			console.error("Failed to load settings, using defaults:", error);
			this.settings$.next(this.schema.parse({}));
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
		this.settings$.next(this.schema.parse({}));
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

	async updateProperties(updates: Partial<z.infer<TSchema>>): Promise<void> {
		await this.updateSettings((settings) => {
			return {
				...(structuredClone(settings) as Record<string, unknown>),
				...(structuredClone(updates) as Record<string, unknown>),
			} as z.infer<TSchema>;
		});
	}

	getDefaults(): z.infer<TSchema> {
		return this.schema.parse({});
	}

	hasCustomizations(): boolean {
		const defaults = this.getDefaults();
		return JSON.stringify(this.currentSettings) !== JSON.stringify(defaults);
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
