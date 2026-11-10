import { ensureDirectory, type CodeBlockRepository } from "@real1ty/obsidian-plugins";
import { normalizePath, TFile, type App } from "obsidian";
import { z } from "zod";

import { VIRTUAL_EVENTS_CODE_FENCE } from "../constants";
import { VirtualEventsFileSchema, type VirtualEventData } from "../types/calendar";
import { IntegrationDeletionTombstoneSchema, type IntegrationDeletionTombstone } from "../types/integrations";
import { integrationDeletionKey } from "./integrations/deleted-event-tombstones";

export const DELETED_EVENTS_CODE_FENCE = "prisma-deleted-events";
const DeletionRecordSchema = z.object({
	identity: IntegrationDeletionTombstoneSchema,
	deleted: z.boolean(),
	revision: z.number().int().nonnegative(),
});
type DeletionRecord = z.infer<typeof DeletionRecordSchema>;
type WriteGate = () => void;
const files = new WeakMap<App, Map<string, PrismaDataFile>>();

export function getPrismaDataFile(app: App, directory: string): PrismaDataFile {
	const path = normalizePath(`${directory ? `${directory}/` : ""}Prisma.md`);
	let byPath = files.get(app);
	if (!byPath) {
		byPath = new Map();
		files.set(app, byPath);
	}
	let file = byPath.get(path);
	if (!file) {
		file = new PrismaDataFile(app, path);
		byPath.set(path, file);
	}
	return file;
}

function blockPattern(name: string): RegExp {
	return new RegExp(`^\`\`\`${name}[^\\S\\r\\n]*\\r?\\n([\\s\\S]*?)^\`\`\`[^\\S\\r\\n]*(?=\\r?$)`, "gm");
}

function blockRaw(content: string, name: string): string | null {
	if (/^(?:<<<<<<< |>>>>>>> )/m.test(content))
		throw new Error("Resolve the Prisma data file sync conflict before editing");
	const matches = [...content.matchAll(blockPattern(name))];
	if (content.includes("```" + name) && matches.length === 0) throw new Error(`Malformed ${name} block`);
	if (matches.length > 1)
		throw new Error(`Multiple ${name} blocks in Prisma data; resolve the conflict before syncing`);
	return matches[0]?.[1] ?? null;
}

function replaceBlock(content: string, name: string, entries: readonly unknown[]): string {
	const block = `\`\`\`${name}\n[${entries.length ? `\n${entries.map((entry) => `  ${JSON.stringify(entry)}`).join(",\n")}\n` : ""}]\n\`\`\``;
	return blockRaw(content, name) === null
		? `${content.trimEnd()}\n\n${block}\n`
		: content.replace(blockPattern(name), () => block);
}

export class PrismaDataFile {
	private tail: Promise<unknown> = Promise.resolve();
	private records = new Map<string, DeletionRecord>();
	private cachedRaw: string | null | undefined;
	private cachedRecords: DeletionRecord[] = [];

	constructor(
		private readonly app: App,
		readonly path: string
	) {}

	getDeletedEvents(): IntegrationDeletionTombstone[] {
		return [...this.records.entries()]
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.flatMap(([, record]) => (record.deleted ? [record.identity] : []));
	}

	async ensure(
		legacyPath: string | undefined,
		legacyDeletions: readonly IntegrationDeletionTombstone[],
		gate: WriteGate
	): Promise<void> {
		await this.serial(async () => {
			gate();
			const file = await this.resolveOrCreate();
			const legacy =
				legacyPath && normalizePath(legacyPath) !== this.path
					? this.app.vault.getAbstractFileByPath(normalizePath(legacyPath))
					: null;
			const source = legacy instanceof TFile ? await this.app.vault.read(legacy) : null;
			const raw = source === null ? null : blockRaw(source, VIRTUAL_EVENTS_CODE_FENCE);
			const imported = raw === null ? [] : VirtualEventsFileSchema.parse(JSON.parse(raw));
			const marker = legacyPath ? `<!-- prisma-migrated ${JSON.stringify(normalizePath(legacyPath))} -->` : "";
			const migration = { alreadyComplete: false };
			await this.edit(file, (current) => {
				migration.alreadyComplete ||= marker !== "" && current.includes(marker);
				this.mergeRecords(current);
				for (const identity of legacyDeletions) {
					const key = integrationDeletionKey(identity);
					if (!this.records.has(key)) this.records.set(key, { identity, deleted: true, revision: 0 });
				}
				const existingRaw = blockRaw(current, VIRTUAL_EVENTS_CODE_FENCE);
				const existing = existingRaw === null ? [] : VirtualEventsFileSchema.parse(JSON.parse(existingRaw));
				const byId = new Map(existing.map((event) => [event.id, event]));
				if (raw !== null && !current.includes(marker)) {
					for (const event of imported) if (!byId.has(event.id)) byId.set(event.id, event);
					current = `${current.trimEnd()}\n\n${marker}\n`;
				}
				current = replaceBlock(current, VIRTUAL_EVENTS_CODE_FENCE, [...byId.values()]);
				return this.withRecords(current);
			});
			// The source remains readable until the destination write succeeds. The marker
			// makes a retried cleanup incapable of resurrecting an already-deleted item.
			if (raw !== null && legacy instanceof TFile && !migration.alreadyComplete) {
				gate();
				await this.app.vault.process(legacy, (current) => {
					if (blockRaw(current, VIRTUAL_EVENTS_CODE_FENCE) !== raw) {
						throw new Error("Legacy virtual events changed during migration; their source was retained for recovery");
					}
					return current.replace(
						blockPattern(VIRTUAL_EVENTS_CODE_FENCE),
						() => `Virtual events are stored in [[${this.path}]].`
					);
				});
			}
		});
	}

	async refresh(gate: WriteGate): Promise<void> {
		await this.serial(async () => {
			gate();
			const existing = this.app.vault.getAbstractFileByPath(this.path);
			if (!(existing instanceof TFile) && this.records.size === 0) return;
			const file = existing instanceof TFile ? existing : await this.resolveOrCreate();
			await this.edit(file, (current) => {
				this.mergeRecords(current);
				return this.withRecords(current);
			});
		});
	}

	async setDeleted(
		identities: readonly IntegrationDeletionTombstone[],
		deleted: boolean,
		gate: WriteGate
	): Promise<void> {
		if (identities.length === 0) return;
		await this.serial(async () => {
			gate();
			const file = await this.resolveOrCreate();
			await this.edit(file, (current) => {
				this.mergeRecords(current);
				for (const identity of identities) {
					const key = integrationDeletionKey(identity);
					const previous = this.records.get(key);
					if (previous?.deleted === deleted || (!previous && !deleted)) continue;
					this.records.set(key, { identity, deleted, revision: (previous?.revision ?? 0) + 1 });
				}
				return this.withRecords(current);
			});
		});
	}

	async mutateVirtual(
		repo: CodeBlockRepository<VirtualEventData>,
		gate: WriteGate,
		update: (events: VirtualEventData[]) => VirtualEventData[]
	): Promise<void> {
		await this.serial(async () => {
			gate();
			const file = this.app.vault.getAbstractFileByPath(this.path);
			if (!(file instanceof TFile)) throw new Error(`Prisma data file missing: ${this.path}`);
			// Transform the latest file inside vault.process so an intervening sync
			// cannot make a virtual edit overwrite another section or stale events.
			await this.edit(file, (current) => {
				const raw = blockRaw(current, VIRTUAL_EVENTS_CODE_FENCE);
				if (raw === null) throw new Error("Virtual events block missing; restore it before editing");
				const events = VirtualEventsFileSchema.parse(JSON.parse(raw));
				return replaceBlock(current, VIRTUAL_EVENTS_CODE_FENCE, update(events));
			});
			await repo.load(this.app, file);
		});
	}

	private serial<T>(operation: () => Promise<T>): Promise<T> {
		const result = this.tail.catch(() => {}).then(operation);
		this.tail = result.catch(() => {});
		return result;
	}

	private async resolveOrCreate(): Promise<TFile> {
		const existing = this.app.vault.getAbstractFileByPath(this.path);
		if (existing instanceof TFile) return existing;
		const slash = this.path.lastIndexOf("/");
		if (slash > 0) await ensureDirectory(this.app, this.path.slice(0, slash));
		try {
			return await this.app.vault.create(
				this.path,
				replaceBlock(
					`${replaceBlock("## Virtual events", VIRTUAL_EVENTS_CODE_FENCE, [])}\n## Deleted integration events`,
					DELETED_EVENTS_CODE_FENCE,
					[]
				)
			);
		} catch (error) {
			const peer = this.app.vault.getAbstractFileByPath(this.path);
			if (peer instanceof TFile) return peer;
			throw error;
		}
	}

	private mergeRecords(content: string): void {
		const raw = blockRaw(content, DELETED_EVENTS_CODE_FENCE);
		if (raw !== this.cachedRaw) {
			this.cachedRecords = raw === null ? [] : z.array(DeletionRecordSchema).parse(JSON.parse(raw));
			this.cachedRaw = raw;
		}
		for (const record of this.cachedRecords) {
			const key = integrationDeletionKey(record.identity);
			const previous = this.records.get(key);
			// Undo is retained as a newer record, not an absence a stale peer can fill.
			// Concurrent equal revisions prefer deletion, independently of arrival order.
			if (!previous || record.revision > previous.revision || (record.revision === previous.revision && record.deleted))
				this.records.set(key, record);
		}
	}

	private withRecords(content: string): string {
		const records = [...this.records.entries()]
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.map(([, value]) => value);
		return replaceBlock(content, DELETED_EVENTS_CODE_FENCE, records);
	}

	private async edit(file: TFile, update: (content: string) => string): Promise<void> {
		const before = new Map(this.records);
		try {
			const current = await this.app.vault.read(file);
			const updated = update(current);
			if (updated === current) return;
			await this.app.vault.process(file, (latest) => (latest === current ? updated : update(latest)));
		} catch (error) {
			this.records = before;
			throw error;
		}
	}
}
