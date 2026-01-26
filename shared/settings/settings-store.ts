import type { Plugin } from "obsidian";
import { BehaviorSubject } from "rxjs";
import type { z } from "zod";

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
			return Object.assign({}, settings, updates);
		});
	}

	getDefaults(): z.infer<TSchema> {
		return this.schema.parse({});
	}

	hasCustomizations(): boolean {
		const defaults = this.getDefaults();
		return JSON.stringify(this.currentSettings) !== JSON.stringify(defaults);
	}
}
