import type { App, Plugin } from "obsidian";
import type { z } from "zod";

/**
 * Manages local-only settings that should not be synced across devices.
 * Stores data in .obsidian/plugins/{plugin-id}/sync.json
 *
 * Users can add this file to .gitignore to prevent syncing state across devices.
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   readOnly: z.boolean().catch(false),
 *   theme: z.string().catch("default"),
 * }).strip();
 *
 * const syncStore = new SyncStore(app, plugin, schema);
 * await syncStore.loadData();
 *
 * // Access data
 * const isReadOnly = syncStore.data.readOnly;
 *
 * // Update data
 * await syncStore.updateData({ readOnly: true });
 * ```
 */
export class SyncStore<TSchema extends z.ZodTypeAny> {
	private _data: z.infer<TSchema>;
	private readonly syncFilePath: string;

	constructor(
		private app: App,
		private plugin: Plugin,
		private schema: TSchema
	) {
		this._data = this.schema.parse({});
		const pluginDir = this.plugin.manifest.dir!;
		this.syncFilePath = `${pluginDir}/sync.json`;
	}

	async loadData(): Promise<void> {
		try {
			const content = await this.app.vault.adapter.read(this.syncFilePath);
			const parsed = JSON.parse(content);
			this._data = this.schema.parse(parsed);
		} catch {
			// File doesn't exist or is invalid - use defaults
			this._data = this.schema.parse({});
		}
	}

	async saveData(): Promise<void> {
		try {
			await this.app.vault.adapter.write(this.syncFilePath, JSON.stringify(this._data, null, 2));
		} catch (error) {
			console.error("Error saving sync data:", error);
		}
	}

	get data(): z.infer<TSchema> {
		return this._data;
	}

	async updateData(updates: Partial<z.infer<TSchema>>): Promise<void> {
		this._data = Object.assign({}, this._data, updates) as z.infer<TSchema>;
		await this.saveData();
	}
}
