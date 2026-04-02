import type { DateTime } from "luxon";
import type { App, EventRef, TFile } from "obsidian";
import { TFolder } from "obsidian";
import { BehaviorSubject, type Subscription } from "rxjs";
import { v4 as uuidv4 } from "uuid";

import { VIRTUAL_EVENTS_CODE_FENCE } from "../constants";
import type { EventSaveData } from "../types/event-save";
import type { SingleCalendarConfig } from "../types/settings";
import { type VirtualEventData, VirtualEventsFileSchema } from "../types/virtual-event";

const FENCE_REGEX = new RegExp(`\`\`\`${VIRTUAL_EVENTS_CODE_FENCE}\\n([\\s\\S]*?)\`\`\``);

export class VirtualEventStore {
	private events$ = new BehaviorSubject<VirtualEventData[]>([]);
	private vaultEventRef: EventRef | null = null;
	private settingsSubscription: Subscription | null = null;
	private directory: string;
	private fileName: string;

	constructor(
		private app: App,
		settingsStore: BehaviorSubject<SingleCalendarConfig>
	) {
		const settings = settingsStore.value;
		this.directory = settings.directory;
		this.fileName = settings.virtualEventsFileName;

		this.settingsSubscription = settingsStore.subscribe((newSettings) => {
			const dirChanged = this.directory !== newSettings.directory;
			const nameChanged = this.fileName !== newSettings.virtualEventsFileName;
			this.directory = newSettings.directory;
			this.fileName = newSettings.virtualEventsFileName;
			if (dirChanged || nameChanged) {
				void this.load();
			}
		});
	}

	get changes$(): BehaviorSubject<VirtualEventData[]> {
		return this.events$;
	}

	async initialize(): Promise<void> {
		this.vaultEventRef = this.app.vault.on("modify", (file) => {
			if (file.path === this.getFilePath()) {
				void this.load();
			}
		});
		await this.load();
	}

	destroy(): void {
		if (this.vaultEventRef) {
			this.app.vault.offref(this.vaultEventRef);
			this.vaultEventRef = null;
		}
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.events$.complete();
	}

	// ─── CRUD ─────────────────────────────────────────────────────

	getAll(): VirtualEventData[] {
		return this.events$.value;
	}

	getById(id: string): VirtualEventData | undefined {
		return this.events$.value.find((e) => e.id === id);
	}

	getInRange(start: DateTime, end: DateTime): VirtualEventData[] {
		const startStr = start.toISO({ suppressMilliseconds: true, includeOffset: false }) ?? "";
		const endStr = end.toISO({ suppressMilliseconds: true, includeOffset: false }) ?? "";

		return this.events$.value.filter((event) => {
			const eventEnd = event.end ?? event.start;
			return eventEnd >= startStr && event.start < endStr;
		});
	}

	async add(data: Omit<VirtualEventData, "id">): Promise<VirtualEventData> {
		const event: VirtualEventData = { ...data, id: uuidv4() };
		const events = [...this.events$.value, event];
		await this.save(events);
		return event;
	}

	async addFromEventData(data: EventSaveData): Promise<VirtualEventData> {
		return this.add(toVirtualInput(data));
	}

	async update(id: string, patch: Partial<Omit<VirtualEventData, "id">>): Promise<void> {
		const events = this.events$.value.map((e) => (e.id === id ? { ...e, ...patch } : e));
		await this.save(events);
	}

	async updateFromEventData(id: string, data: EventSaveData): Promise<void> {
		return this.update(id, toVirtualInput(data));
	}

	async remove(id: string): Promise<void> {
		const events = this.events$.value.filter((e) => e.id !== id);
		await this.save(events);
	}

	// ─── File I/O ─────────────────────────────────────────────────

	getFilePath(): string {
		return this.directory ? `${this.directory}/${this.fileName}.md` : `${this.fileName}.md`;
	}

	private async load(): Promise<void> {
		const filePath = this.getFilePath();
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFolder) && file) {
			const content = await this.app.vault.read(file as TFile);
			const parsed = this.parseCodeFence(content);
			this.events$.next(parsed);
		} else {
			this.events$.next([]);
		}
	}

	private async save(events: VirtualEventData[]): Promise<void> {
		const filePath = this.getFilePath();
		const json = JSON.stringify(events, null, 2);
		const fenceContent = `\`\`\`${VIRTUAL_EVENTS_CODE_FENCE}\n${json}\n\`\`\``;

		const existingFile = this.app.vault.getAbstractFileByPath(filePath);
		if (existingFile && !(existingFile instanceof TFolder)) {
			const content = await this.app.vault.read(existingFile as TFile);
			if (FENCE_REGEX.test(content)) {
				const updated = content.replace(FENCE_REGEX, fenceContent);
				await this.app.vault.modify(existingFile as TFile, updated);
			} else {
				await this.app.vault.modify(existingFile as TFile, `${content}\n\n${fenceContent}\n`);
			}
		} else {
			await this.ensureFolderExists();
			await this.app.vault.create(filePath, `${fenceContent}\n`);
		}

		this.events$.next(events);
	}

	private parseCodeFence(content: string): VirtualEventData[] {
		const match = content.match(FENCE_REGEX);
		if (!match?.[1]) return [];

		try {
			const data = JSON.parse(match[1]);
			const result = VirtualEventsFileSchema.safeParse(data);
			return result.success ? result.data : [];
		} catch {
			return [];
		}
	}

	private async ensureFolderExists(): Promise<void> {
		if (!this.directory) return;
		const exists = await this.app.vault.adapter.exists(this.directory);
		if (!exists) {
			await this.app.vault.createFolder(this.directory);
		}
	}
}

function toVirtualInput(data: EventSaveData): Omit<VirtualEventData, "id"> {
	return {
		title: data.title,
		start: data.start,
		end: data.end,
		allDay: data.allDay,
		properties: data.preservedFrontmatter,
	};
}
