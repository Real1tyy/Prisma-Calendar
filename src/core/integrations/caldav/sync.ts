import { type App, normalizePath, TFile, TFolder } from "obsidian";
import type { SingleCalendarConfig } from "../../../types/settings";
import {
	buildFrontmatterFromImportedEvent,
	type ImportedEvent,
	type ImportFrontmatterSettings,
	parseICSContent,
} from "../../../utils/ics-import";
import { CalDAVClientService, type CalDAVFetchedEvent } from "./client";
import type {
	CalDAVAccount,
	CalDAVCalendarInfo,
	CalDAVSettings,
	CalDAVStoredCalendar,
	CalDAVStoredObject,
	CalDAVSyncMetadata,
	CalDAVSyncResult,
} from "./types";

export interface CalDAVSyncServiceOptions {
	app: App;
	caldavSettings: CalDAVSettings;
	calendarConfig: SingleCalendarConfig;
}

interface SyncState {
	calendars: Map<string, CalDAVStoredCalendar>;
	lastSyncTime: number;
}

export class CalDAVSyncService {
	private app: App;
	private caldavSettings: CalDAVSettings;
	private calendarConfig: SingleCalendarConfig;
	private client: CalDAVClientService;
	private syncState: Map<string, SyncState> = new Map();

	constructor(options: CalDAVSyncServiceOptions) {
		this.app = options.app;
		this.caldavSettings = options.caldavSettings;
		this.calendarConfig = options.calendarConfig;
		this.client = new CalDAVClientService();
	}

	updateSettings(caldavSettings: CalDAVSettings, calendarConfig: SingleCalendarConfig): void {
		this.caldavSettings = caldavSettings;
		this.calendarConfig = calendarConfig;
	}

	async syncAccount(account: CalDAVAccount): Promise<CalDAVSyncResult[]> {
		const results: CalDAVSyncResult[] = [];

		if (!account.enabled) {
			return results;
		}

		try {
			const calendars = await this.client.fetchCalendars(account);

			const selectedCalendars =
				account.selectedCalendars.length > 0
					? calendars.filter((cal) => account.selectedCalendars.includes(cal.url))
					: calendars;

			for (const calendar of selectedCalendars) {
				const result = await this.syncCalendar(account, calendar);
				results.push(result);
			}
		} catch (error) {
			results.push({
				success: false,
				accountId: account.id,
				calendarUrl: "",
				created: 0,
				updated: 0,
				deleted: 0,
				errors: [error instanceof Error ? error.message : String(error)],
			});
		}

		return results;
	}

	async syncAllAccounts(): Promise<CalDAVSyncResult[]> {
		const allResults: CalDAVSyncResult[] = [];

		for (const account of this.caldavSettings.accounts) {
			const results = await this.syncAccount(account);
			allResults.push(...results);
		}

		return allResults;
	}

	private async syncCalendar(account: CalDAVAccount, calendar: CalDAVCalendarInfo): Promise<CalDAVSyncResult> {
		const result: CalDAVSyncResult = {
			success: true,
			accountId: account.id,
			calendarUrl: calendar.url,
			created: 0,
			updated: 0,
			deleted: 0,
			errors: [],
		};

		try {
			const storedCalendar = this.getStoredCalendar(account.id, calendar.url);

			if (storedCalendar && storedCalendar.objects.length > 0) {
				await this.performIncrementalSync(account, calendar, storedCalendar, result);
			} else {
				await this.performFullSync(account, calendar, result);
			}
		} catch (error) {
			result.success = false;
			result.errors.push(error instanceof Error ? error.message : String(error));
		}

		return result;
	}

	private async performFullSync(
		account: CalDAVAccount,
		calendar: CalDAVCalendarInfo,
		result: CalDAVSyncResult
	): Promise<void> {
		const now = new Date();
		const threeMonthsAgo = new Date(now);
		threeMonthsAgo.setMonth(now.getMonth() - 3);
		const oneYearFromNow = new Date(now);
		oneYearFromNow.setFullYear(now.getFullYear() + 1);

		const events = await this.client.fetchCalendarEvents(account, {
			calendar,
			timeRange: {
				start: threeMonthsAgo.toISOString(),
				end: oneYearFromNow.toISOString(),
			},
		});

		const storedObjects: CalDAVStoredObject[] = [];

		for (const event of events) {
			try {
				const filePath = await this.createNoteFromEvent(account, calendar, event);
				if (filePath && event.uid) {
					storedObjects.push({
						url: event.url,
						etag: event.etag,
						uid: event.uid,
						localFilePath: filePath,
					});
					result.created++;
				}
			} catch (error) {
				result.errors.push(`Failed to create event ${event.url}: ${error}`);
			}
		}

		this.updateStoredCalendar(account.id, {
			url: calendar.url,
			displayName: calendar.displayName,
			accountId: account.id,
			ctag: calendar.ctag,
			syncToken: calendar.syncToken,
			objects: storedObjects,
		});
	}

	private async performIncrementalSync(
		account: CalDAVAccount,
		calendar: CalDAVCalendarInfo,
		storedCalendar: CalDAVStoredCalendar,
		result: CalDAVSyncResult
	): Promise<void> {
		const syncResult = await this.client.syncCalendar(account, storedCalendar);

		for (const event of syncResult.created) {
			try {
				const filePath = await this.createNoteFromEvent(account, calendar, event);
				if (filePath && event.uid) {
					storedCalendar.objects.push({
						url: event.url,
						etag: event.etag,
						uid: event.uid,
						localFilePath: filePath,
					});
					result.created++;
				}
			} catch (error) {
				result.errors.push(`Failed to create event ${event.url}: ${error}`);
			}
		}

		for (const event of syncResult.updated) {
			try {
				const storedObj = storedCalendar.objects.find((o) => o.url === event.url);
				if (storedObj?.localFilePath) {
					await this.updateNoteFromEvent(account, calendar, event, storedObj.localFilePath);
					storedObj.etag = event.etag;
					result.updated++;
				}
			} catch (error) {
				result.errors.push(`Failed to update event ${event.url}: ${error}`);
			}
		}

		for (const deletedUrl of syncResult.deleted) {
			try {
				const storedObj = storedCalendar.objects.find((o) => o.url === deletedUrl);
				if (storedObj?.localFilePath) {
					await this.deleteNote(storedObj.localFilePath);
					result.deleted++;
				}
				storedCalendar.objects = storedCalendar.objects.filter((o) => o.url !== deletedUrl);
			} catch (error) {
				result.errors.push(`Failed to delete event ${deletedUrl}: ${error}`);
			}
		}

		storedCalendar.ctag = syncResult.newCtag;
		storedCalendar.syncToken = syncResult.newSyncToken;
		this.updateStoredCalendar(account.id, storedCalendar);
	}

	private async createNoteFromEvent(
		account: CalDAVAccount,
		calendar: CalDAVCalendarInfo,
		event: CalDAVFetchedEvent
	): Promise<string | null> {
		const parsed = parseICSContent(event.data);
		if (!parsed.success || parsed.events.length === 0) {
			return null;
		}

		const importedEvent = parsed.events[0];
		const folderPath = this.getSyncFolderPath(account, calendar);
		await this.ensureFolderExists(folderPath);

		const fileName = this.generateFileName(importedEvent);
		const filePath = normalizePath(`${folderPath}/${fileName}.md`);

		const frontmatter = this.buildFrontmatter(importedEvent, account, calendar, event);
		const content = this.buildNoteContent(importedEvent, frontmatter);

		await this.app.vault.create(filePath, content);

		return filePath;
	}

	private async updateNoteFromEvent(
		account: CalDAVAccount,
		calendar: CalDAVCalendarInfo,
		event: CalDAVFetchedEvent,
		existingFilePath: string
	): Promise<void> {
		const parsed = parseICSContent(event.data);
		if (!parsed.success || parsed.events.length === 0) {
			return;
		}

		const importedEvent = parsed.events[0];
		const file = this.app.vault.getAbstractFileByPath(existingFilePath);

		if (!(file instanceof TFile)) {
			return;
		}

		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const settings = this.getImportFrontmatterSettings();
			const eventFm = buildFrontmatterFromImportedEvent(importedEvent, settings);

			for (const [key, value] of Object.entries(eventFm)) {
				fm[key] = value;
			}

			const syncMeta: CalDAVSyncMetadata = {
				href: event.url,
				etag: event.etag,
				accountId: account.id,
				calendarUrl: calendar.url,
				uid: event.uid ?? "",
			};
			fm[this.caldavSettings.caldavProp] = syncMeta;
		});
	}

	private async deleteNote(filePath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) {
			await this.app.fileManager.trashFile(file);
		}
	}

	private getSyncFolderPath(account: CalDAVAccount, _calendar: CalDAVCalendarInfo): string {
		return normalizePath(account.syncDirectory);
	}

	private async ensureFolderExists(folderPath: string): Promise<void> {
		const parts = folderPath.split("/");
		let currentPath = "";

		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			const existing = this.app.vault.getAbstractFileByPath(currentPath);
			if (!existing) {
				await this.app.vault.createFolder(currentPath);
			} else if (!(existing instanceof TFolder)) {
				throw new Error(`Path ${currentPath} exists but is not a folder`);
			}
		}
	}

	private generateFileName(event: ImportedEvent): string {
		const title = event.title.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 100);
		const dateStr = event.start.toISOString().slice(0, 10);
		return `${dateStr} ${title}`;
	}

	private getImportFrontmatterSettings(): ImportFrontmatterSettings {
		return {
			startProp: this.calendarConfig.startProp,
			endProp: this.calendarConfig.endProp,
			dateProp: this.calendarConfig.dateProp,
			allDayProp: this.calendarConfig.allDayProp,
			titleProp: this.calendarConfig.titleProp,
			minutesBeforeProp: this.calendarConfig.minutesBeforeProp,
			daysBeforeProp: this.calendarConfig.daysBeforeProp,
			categoryProp: this.calendarConfig.categoryProp,
		};
	}

	private buildFrontmatter(
		event: ImportedEvent,
		account: CalDAVAccount,
		calendar: CalDAVCalendarInfo,
		rawEvent: CalDAVFetchedEvent
	): Record<string, unknown> {
		const settings = this.getImportFrontmatterSettings();
		const fm = buildFrontmatterFromImportedEvent(event, settings);

		const syncMeta: CalDAVSyncMetadata = {
			href: rawEvent.url,
			etag: rawEvent.etag,
			accountId: account.id,
			calendarUrl: calendar.url,
			uid: rawEvent.uid ?? event.uid,
		};
		fm[this.caldavSettings.caldavProp] = syncMeta;

		return fm;
	}

	private buildNoteContent(event: ImportedEvent, frontmatter: Record<string, unknown>): string {
		const yamlLines = ["---"];
		for (const [key, value] of Object.entries(frontmatter)) {
			yamlLines.push(`${key}: ${this.formatYamlValue(value)}`);
		}
		yamlLines.push("---", "");

		if (event.description) {
			yamlLines.push(event.description);
		}

		return yamlLines.join("\n");
	}

	private formatYamlValue(value: unknown): string {
		if (value === null || value === undefined) return "null";
		if (typeof value === "string") {
			if (value.includes("\n") || value.includes(":") || value.includes("#")) {
				return `"${value.replace(/"/g, '\\"')}"`;
			}
			return value;
		}
		if (typeof value === "boolean" || typeof value === "number") return String(value);
		if (Array.isArray(value)) {
			return `[${value.map((v) => this.formatYamlValue(v)).join(", ")}]`;
		}
		if (typeof value === "object" && value !== null) {
			return JSON.stringify(value);
		}
		return JSON.stringify(value);
	}

	private getStoredCalendar(accountId: string, calendarUrl: string): CalDAVStoredCalendar | undefined {
		const state = this.syncState.get(accountId);
		return state?.calendars.get(calendarUrl);
	}

	private updateStoredCalendar(accountId: string, calendar: CalDAVStoredCalendar): void {
		let state = this.syncState.get(accountId);
		if (!state) {
			state = {
				calendars: new Map(),
				lastSyncTime: Date.now(),
			};
			this.syncState.set(accountId, state);
		}
		state.calendars.set(calendar.url, calendar);
		state.lastSyncTime = Date.now();
	}

	getSyncState(): Map<string, SyncState> {
		return this.syncState;
	}

	loadSyncState(data: Record<string, { calendars: CalDAVStoredCalendar[]; lastSyncTime: number }>): void {
		this.syncState.clear();
		for (const [accountId, state] of Object.entries(data)) {
			const calendarsMap = new Map<string, CalDAVStoredCalendar>();
			for (const cal of state.calendars) {
				calendarsMap.set(cal.url, cal);
			}
			this.syncState.set(accountId, {
				calendars: calendarsMap,
				lastSyncTime: state.lastSyncTime,
			});
		}
	}

	serializeSyncState(): Record<string, { calendars: CalDAVStoredCalendar[]; lastSyncTime: number }> {
		const result: Record<string, { calendars: CalDAVStoredCalendar[]; lastSyncTime: number }> = {};
		for (const [accountId, state] of this.syncState.entries()) {
			result[accountId] = {
				calendars: Array.from(state.calendars.values()),
				lastSyncTime: state.lastSyncTime,
			};
		}
		return result;
	}

	destroy(): void {
		this.client.clearAllClients();
		this.syncState.clear();
	}
}
