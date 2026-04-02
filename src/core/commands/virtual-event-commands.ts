import type { Command } from "@real1ty-obsidian-plugins";
import { getTFileOrThrow } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { TFile } from "obsidian";

import type { EventSaveData } from "../../types/event-save";
import type { VirtualEventData } from "../../types/virtual-event";
import type { CalendarBundle } from "../calendar-bundle";
import { toVirtualInput } from "../virtual-event-store";

export class CreateVirtualEventCommand implements Command {
	private createdId: string | null = null;

	constructor(
		private bundle: CalendarBundle,
		private eventData: Omit<VirtualEventData, "id">
	) {}

	async execute(): Promise<void> {
		const result = await this.bundle.virtualEventStore.add(this.eventData);
		this.createdId = result.id;
	}

	async undo(): Promise<void> {
		if (this.createdId) {
			await this.bundle.virtualEventStore.remove(this.createdId);
		}
	}

	canUndo(): boolean {
		return this.createdId !== null && this.bundle.virtualEventStore.getById(this.createdId) !== undefined;
	}

	getType(): string {
		return "create-virtual-event";
	}
}

export class DeleteVirtualEventCommand implements Command {
	private storedData: VirtualEventData | null = null;

	constructor(
		private bundle: CalendarBundle,
		private virtualEventId: string
	) {}

	async execute(): Promise<void> {
		this.storedData = this.bundle.virtualEventStore.getById(this.virtualEventId) ?? null;
		if (!this.storedData) throw new Error("Virtual event not found");
		await this.bundle.virtualEventStore.remove(this.virtualEventId);
	}

	async undo(): Promise<void> {
		if (!this.storedData) throw new Error("Cannot undo: no stored data");
		await this.bundle.virtualEventStore.addWithId(this.storedData);
	}

	canUndo(): boolean {
		return this.storedData !== null && this.bundle.virtualEventStore.getById(this.virtualEventId) === undefined;
	}

	getType(): string {
		return "delete-virtual-event";
	}
}

export class ConvertToVirtualCommand implements Command {
	private originalFileContent: string | null = null;
	private createdVirtualId: string | null = null;

	constructor(
		private app: App,
		private bundle: CalendarBundle,
		private filePath: string,
		private eventData: EventSaveData
	) {}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);
		this.originalFileContent = await this.app.vault.read(file);
		const result = await this.bundle.virtualEventStore.add(toVirtualInput(this.eventData));
		this.createdVirtualId = result.id;
		await this.app.fileManager.trashFile(file);
	}

	async undo(): Promise<void> {
		if (this.createdVirtualId) {
			await this.bundle.virtualEventStore.remove(this.createdVirtualId);
		}
		if (this.originalFileContent !== null) {
			await this.app.vault.create(this.filePath, this.originalFileContent);
		}
	}

	canUndo(): boolean {
		return (
			this.originalFileContent !== null &&
			this.createdVirtualId !== null &&
			!(this.app.vault.getAbstractFileByPath(this.filePath) instanceof TFile)
		);
	}

	getType(): string {
		return "convert-to-virtual";
	}
}

export class ConvertToRealCommand implements Command {
	private storedVirtualData: VirtualEventData | null = null;
	private createdFilePath: string | null = null;

	constructor(
		private app: App,
		private bundle: CalendarBundle,
		private virtualEventId: string
	) {}

	async execute(): Promise<void> {
		this.storedVirtualData = this.bundle.virtualEventStore.getById(this.virtualEventId) ?? null;
		if (!this.storedVirtualData) throw new Error("Virtual event not found");
		await this.bundle.virtualEventStore.remove(this.virtualEventId);
		this.createdFilePath = await this.bundle.createEventFile({
			title: this.storedVirtualData.title,
			start: this.storedVirtualData.start,
			end: this.storedVirtualData.end,
			allDay: this.storedVirtualData.allDay,
			preservedFrontmatter: this.storedVirtualData.properties as Record<string, unknown>,
		});
	}

	async undo(): Promise<void> {
		if (this.createdFilePath) {
			const file = this.app.vault.getAbstractFileByPath(this.createdFilePath);
			if (file instanceof TFile) {
				await this.app.fileManager.trashFile(file);
			}
		}
		if (this.storedVirtualData) {
			await this.bundle.virtualEventStore.addWithId(this.storedVirtualData);
		}
	}

	canUndo(): boolean {
		return this.storedVirtualData !== null && this.createdFilePath !== null;
	}

	getType(): string {
		return "convert-to-real";
	}
}
