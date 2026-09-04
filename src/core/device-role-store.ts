import { LocalKV, type KVBackend } from "@real1ty/obsidian-plugins";
import { z } from "zod";

const NAMESPACE = "prisma-calendar:device-role";
const ROLE_SCOPE = "read-only";
const ReadOnlySchema = z.boolean();

interface LegacyAdapter {
	read(path: string): Promise<string>;
	write(path: string, data: string): Promise<void>;
}

export type DeviceRole = "reader" | "writer";

/** Device-local source of truth for whether Prisma may perform automatic writes. */
export class DeviceRoleStore {
	private readonly kv: LocalKV<boolean>;
	private selectedReadOnly: boolean | null = null;

	constructor(
		private readonly adapter: LegacyAdapter,
		pluginDir: string,
		backend?: KVBackend
	) {
		this.legacyPath = `${pluginDir}/sync.json`;
		this.kv = new LocalKV<boolean>({
			namespace: NAMESPACE,
			schema: ReadOnlySchema,
			...(backend ? { backend } : {}),
		});
	}

	private readonly legacyPath: string;

	async load(): Promise<void> {
		this.selectedReadOnly = this.kv.get(ROLE_SCOPE);
		if (this.selectedReadOnly !== null) return;

		await this.migrateLegacyChoice();
	}

	get hasSelectedRole(): boolean {
		return this.selectedReadOnly !== null;
	}

	get role(): DeviceRole | null {
		if (this.selectedReadOnly === null) return null;
		return this.selectedReadOnly ? "reader" : "writer";
	}

	get data(): { readOnly: boolean } {
		return { readOnly: this.selectedReadOnly ?? true };
	}

	select(role: DeviceRole): void {
		this.selectedReadOnly = role === "reader";
		this.kv.set(ROLE_SCOPE, this.selectedReadOnly);
	}

	updateData(updates: { readOnly?: boolean }): Promise<void> {
		if (updates.readOnly !== undefined) {
			this.selectedReadOnly = updates.readOnly;
			this.kv.set(ROLE_SCOPE, updates.readOnly);
		}
		return Promise.resolve();
	}

	private async migrateLegacyChoice(): Promise<void> {
		try {
			const parsed = JSON.parse(await this.adapter.read(this.legacyPath)) as unknown;
			if (!parsed || typeof parsed !== "object" || !("readOnly" in parsed)) return;

			const legacy = parsed as Record<string, unknown>;
			if (typeof legacy["readOnly"] !== "boolean") return;

			this.selectedReadOnly = legacy["readOnly"];
			this.kv.set(ROLE_SCOPE, legacy["readOnly"]);
			delete legacy["readOnly"];
			await this.adapter.write(this.legacyPath, JSON.stringify(legacy, null, 2));
		} catch {
			// Missing or invalid legacy state means the user still needs to choose.
		}
	}
}
