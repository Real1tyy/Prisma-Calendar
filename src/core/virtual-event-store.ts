import { CodeBlockRepository, debounceMsForEnv, type CodeBlockBinding } from "@real1ty/obsidian-plugins";
import type { DateTime } from "luxon";
import { normalizePath, type App } from "obsidian";
import { BehaviorSubject, debounceTime, type Subscription } from "rxjs";
import { v4 as uuidv4 } from "uuid";

import { VIRTUAL_EVENTS_CODE_FENCE } from "../constants";
import { VirtualEventDataSchema, type VirtualEventData } from "../types/calendar";
import type { EventSaveData } from "../types/event-boundaries";
import type { IntegrationDeletionTombstone } from "../types/integrations";
import type { SingleCalendarConfig } from "../types/settings";
import { allDayEnd } from "../utils/dates/all-day";
import { log } from "./logging";
import { getPrismaDataFile } from "./prisma-data-file";

// Wait for the user to stop typing the directory in settings before binding
// (and creating) the virtual events file. Without this, every intermediate
// keystroke that the schema-field commits creates a stray code-fence file at
// a half-typed path.
export const VIRTUAL_EVENT_SETTINGS_DEBOUNCE_MS = 3000;

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
	private bindEpoch = 0;
	private destroyed = false;

	constructor(
		private app: App,
		settingsStore: BehaviorSubject<SingleCalendarConfig>,
		private readonly dataOptions: {
			assertWritable: () => void;
			whenReady?: () => Promise<void>;
			isReadOnly?: () => boolean;
			legacyDeletions?: () => readonly IntegrationDeletionTombstone[];
		} = { assertWritable: () => {} }
	) {
		const settings = settingsStore.value;
		this.directory = settings.directory;
		this.fileName = settings.virtualEventsFileName;

		this.settingsSubscription = settingsStore
			.pipe(debounceTime(debounceMsForEnv(VIRTUAL_EVENT_SETTINGS_DEBOUNCE_MS)))
			.subscribe((newSettings) => {
				const dirChanged = this.directory !== newSettings.directory;
				const nameChanged = this.fileName !== newSettings.virtualEventsFileName;
				this.directory = newSettings.directory;
				this.fileName = newSettings.virtualEventsFileName;
				if (!dirChanged && !nameChanged) return;

				if (!this.directory) {
					if (this.binding) {
						this.binding.unsubscribe();
						this.binding = null;
						this.events$.next([]);
					}
					return;
				}

				if (this.binding) {
					const epoch = ++this.bindEpoch;
					const previous = this.binding;
					const target = this.getFilePath();
					this.prepareDataFile()
						.then(() =>
							this.repo.rebind(previous, this.app, target, {
								onChange: () => this.emit(),
								createIfMissing: false,
							})
						)
						.then((b) => {
							// Drop stale rebinds: if another rebind (or destroy) ran after us,
							// unsubscribe this fresh binding rather than let it leak or shadow
							// the newer one.
							if (this.destroyed || epoch !== this.bindEpoch) {
								b.unsubscribe();
								return;
							}
							this.binding = b;
						})
						.catch((error: unknown) => log.error("indexing", "Virtual event store rebind failed", { error }));
				} else {
					void this.initialize();
				}
			});
	}

	get changes$(): BehaviorSubject<VirtualEventData[]> {
		return this.events$;
	}

	async initialize(): Promise<void> {
		if (!this.directory) return;
		await this.prepareDataFile();
		if (this.destroyed) return;
		this.binding = await this.repo.bind(this.app, this.getFilePath(), {
			onChange: () => this.emit(),
			createIfMissing: false,
		});
	}

	detachSettingsSubscription(): void {
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
	}

	destroy(): void {
		this.destroyed = true;
		this.bindEpoch++;
		this.binding?.unsubscribe();
		this.binding = null;
		this.detachSettingsSubscription();
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
			const eventEnd = event.allDay ? allDayEnd(event.start, event.end) : (event.end ?? event.start);
			const eventStart = event.allDay ? `${event.start.slice(0, 10)}T00:00:00` : event.start;
			return (event.allDay ? eventEnd > startStr : eventEnd >= startStr) && eventStart < endStr;
		});
	}

	async add(data: Omit<VirtualEventData, "id">): Promise<VirtualEventData> {
		const event: VirtualEventData = { ...data, id: uuidv4() };
		await this.insert(event);
		this.emit();
		return event;
	}

	async addWithId(data: VirtualEventData): Promise<void> {
		await this.insert(data);
		this.emit();
	}

	async addFromEventData(data: EventSaveData): Promise<VirtualEventData> {
		return this.add(toVirtualInput(data));
	}

	async update(id: string, patch: Partial<Omit<VirtualEventData, "id">>): Promise<void> {
		await this.mutate((events) => {
			if (!events.some((event) => event.id === id)) throw new Error(`Item with ID "${id}" not found`);
			return events.map((event) => (event.id === id ? { ...event, ...patch } : event));
		});
		this.emit();
	}

	async updateFromEventData(id: string, data: EventSaveData): Promise<void> {
		return this.update(id, toVirtualInput(data));
	}

	async remove(id: string): Promise<void> {
		await this.mutate((events) => events.filter((event) => event.id !== id));
		this.emit();
	}

	// ─── Query ────────────────────────────────────────────────────

	getFilePath(): string {
		return getPrismaDataFile(this.app, this.directory).path;
	}

	private async prepareDataFile(): Promise<void> {
		await this.dataOptions.whenReady?.();
		if (this.destroyed || this.dataOptions.isReadOnly?.()) return;
		return getPrismaDataFile(this.app, this.directory).ensure(
			normalizePath(`${this.directory}/${this.fileName}.md`),
			this.dataOptions.legacyDeletions?.() ?? [],
			this.dataOptions.assertWritable
		);
	}

	private insert(event: VirtualEventData): Promise<void> {
		return this.mutate((events) => {
			if (events.some((existing) => existing.id === event.id))
				throw new Error(`Item with ID "${event.id}" already exists`);
			return [...events, event];
		});
	}

	private mutate(update: (events: VirtualEventData[]) => VirtualEventData[]): Promise<void> {
		return getPrismaDataFile(this.app, this.directory).mutateVirtual(
			this.repo,
			this.dataOptions.assertWritable,
			update
		);
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
