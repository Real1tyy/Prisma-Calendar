import { type CodeBlockBinding, CodeBlockRepository } from "@real1ty-obsidian-plugins";
import type { DateTime } from "luxon";
import type { App } from "obsidian";
import { BehaviorSubject, type Subscription } from "rxjs";
import { v4 as uuidv4 } from "uuid";

import { VIRTUAL_EVENTS_CODE_FENCE } from "../constants";
import { type VirtualEventData, VirtualEventDataSchema } from "../types/calendar";
import type { EventSaveData } from "../types/event-boundaries";
import type { SingleCalendarConfig } from "../types/settings";

export class VirtualEventStore {
	private readonly repo = new CodeBlockRepository<VirtualEventData>({
		codeFence: VIRTUAL_EVENTS_CODE_FENCE,
		itemSchema: VirtualEventDataSchema,
		idField: "id",
	});
	private events$ = new BehaviorSubject<VirtualEventData[]>([]);
	private binding: CodeBlockBinding | null = null;
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
			if ((dirChanged || nameChanged) && this.binding) {
				void this.repo
					.rebind(this.binding, this.app, this.getFilePath(), {
						onChange: () => this.emit(),
						createIfMissing: true,
					})
					.then((b) => {
						this.binding = b;
					});
			}
		});
	}

	get changes$(): BehaviorSubject<VirtualEventData[]> {
		return this.events$;
	}

	async initialize(): Promise<void> {
		this.binding = await this.repo.bind(this.app, this.getFilePath(), {
			onChange: () => this.emit(),
			createIfMissing: true,
		});
	}

	destroy(): void {
		this.binding?.unsubscribe();
		this.binding = null;
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.events$.complete();
	}

	// ─── CRUD ─────────────────────────────────────────────────────

	getAll(): VirtualEventData[] {
		return this.events$.value;
	}

	getById(id: string): VirtualEventData | undefined {
		return this.repo.get(id)?.data;
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
		await this.repo.create(event);
		this.emit();
		return event;
	}

	async addWithId(data: VirtualEventData): Promise<void> {
		await this.repo.create(data);
		this.emit();
	}

	async addFromEventData(data: EventSaveData): Promise<VirtualEventData> {
		return this.add(toVirtualInput(data));
	}

	async update(id: string, patch: Partial<Omit<VirtualEventData, "id">>): Promise<void> {
		await this.repo.update(id, patch);
		this.emit();
	}

	async updateFromEventData(id: string, data: EventSaveData): Promise<void> {
		return this.update(id, toVirtualInput(data));
	}

	async remove(id: string): Promise<void> {
		await this.repo.delete(id);
		this.emit();
	}

	// ─── Query ────────────────────────────────────────────────────

	getFilePath(): string {
		return this.directory ? `${this.directory}/${this.fileName}.md` : `${this.fileName}.md`;
	}

	private emit(): void {
		this.events$.next(this.repo.toArray().map((r) => r.data));
	}
}

export function toVirtualInput(data: EventSaveData): Omit<VirtualEventData, "id"> {
	return {
		title: data.title,
		start: data.start,
		end: data.end,
		allDay: data.allDay,
		properties: data.preservedFrontmatter,
	};
}
