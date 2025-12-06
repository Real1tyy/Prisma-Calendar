import { patchGlobalFetch } from "./obsidian-fetch";

// Patch fetch before we use tsdav
patchGlobalFetch();

import type {
	CalDAVAccount,
	CalDAVBasicCredentials,
	CalDAVCalendarInfo,
	CalDAVOAuthCredentials,
	CalDAVStoredCalendar,
} from "./types";

export interface CalDAVConnectionResult {
	success: boolean;
	error?: string;
	calendars?: CalDAVCalendarInfo[];
}

export interface CalDAVFetchEventsOptions {
	calendar: CalDAVCalendarInfo;
}

export interface CalDAVFetchedEvent {
	url: string;
	etag: string;
	data: string;
	uid?: string;
}

function isOAuthCredentials(
	credentials: CalDAVBasicCredentials | CalDAVOAuthCredentials
): credentials is CalDAVOAuthCredentials {
	return "refreshToken" in credentials;
}

function buildCredentials(account: CalDAVAccount): Record<string, string> {
	if (isOAuthCredentials(account.credentials)) {
		return {
			tokenUrl: account.credentials.tokenUrl,
			username: account.credentials.username,
			refreshToken: account.credentials.refreshToken,
			clientId: account.credentials.clientId,
			clientSecret: account.credentials.clientSecret,
		};
	}
	return {
		username: account.credentials.username,
		password: account.credentials.password,
	};
}

// Use dynamic import to ensure fetch is patched before tsdav loads
async function getTsdav() {
	return await import("tsdav");
}

export class CalDAVClientService {
	private clients: Map<string, InstanceType<typeof import("tsdav").DAVClient>> = new Map();

	private async createClient(account: CalDAVAccount): Promise<InstanceType<typeof import("tsdav").DAVClient>> {
		const { DAVClient } = await getTsdav();

		const client = new DAVClient({
			serverUrl: account.serverUrl,
			credentials: buildCredentials(account),
			authMethod: account.authMethod,
			defaultAccountType: "caldav",
		});

		await client.login();
		return client;
	}

	private async getOrCreateClient(account: CalDAVAccount): Promise<InstanceType<typeof import("tsdav").DAVClient>> {
		const existing = this.clients.get(account.id);
		if (existing) return existing;

		const client = await this.createClient(account);
		this.clients.set(account.id, client);
		return client;
	}

	async testConnection(account: CalDAVAccount): Promise<CalDAVConnectionResult> {
		try {
			const client = await this.createClient(account);
			const calendars = await client.fetchCalendars();

			return {
				success: true,
				calendars: calendars.map((cal) => this.mapCalendarInfo(cal)),
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	async fetchCalendars(account: CalDAVAccount): Promise<CalDAVCalendarInfo[]> {
		const client = await this.getOrCreateClient(account);
		const calendars = await client.fetchCalendars();
		return calendars.map((cal) => this.mapCalendarInfo(cal));
	}

	async fetchCalendarEvents(account: CalDAVAccount, options: CalDAVFetchEventsOptions): Promise<CalDAVFetchedEvent[]> {
		const client = await this.getOrCreateClient(account);

		const calendar = {
			url: options.calendar.url,
			displayName: options.calendar.displayName,
			ctag: options.calendar.ctag,
			syncToken: options.calendar.syncToken,
		};

		const objects = await client.fetchCalendarObjects({
			calendar,
		});
		return objects.map(this.mapCalendarObject);
	}

	async syncCalendar(
		account: CalDAVAccount,
		storedCalendar: CalDAVStoredCalendar
	): Promise<{
		created: CalDAVFetchedEvent[];
		updated: CalDAVFetchedEvent[];
		deleted: string[];
		newSyncToken?: string;
		newCtag?: string;
	}> {
		const client = await this.getOrCreateClient(account);

		const collection = {
			url: storedCalendar.url,
			displayName: storedCalendar.displayName,
			ctag: storedCalendar.ctag,
			syncToken: storedCalendar.syncToken,
			objects: storedCalendar.objects.map((obj) => ({
				url: obj.url,
				etag: obj.etag,
				data: "",
			})),
		};

		const syncResult = await client.smartCollectionSync({
			collection,
			detailedResult: true,
		});

		const created: CalDAVFetchedEvent[] = [];
		const updated: CalDAVFetchedEvent[] = [];
		const deleted: string[] = [];

		if (syncResult.objects && typeof syncResult.objects === "object") {
			const syncObjects = syncResult.objects as {
				created?: Array<{ url: string; etag?: string; data?: string }>;
				updated?: Array<{ url: string; etag?: string; data?: string }>;
				deleted?: Array<{ url: string }>;
			};

			if (syncObjects.created) {
				for (const obj of syncObjects.created) {
					created.push(this.mapCalendarObject(obj));
				}
			}
			if (syncObjects.updated) {
				for (const obj of syncObjects.updated) {
					updated.push(this.mapCalendarObject(obj));
				}
			}
			if (syncObjects.deleted) {
				for (const obj of syncObjects.deleted) {
					deleted.push(obj.url);
				}
			}
		}

		return {
			created,
			updated,
			deleted,
			newSyncToken: typeof syncResult.syncToken === "string" ? syncResult.syncToken : undefined,
			newCtag: syncResult.ctag,
		};
	}

	async isCalendarDirty(account: CalDAVAccount, calendar: CalDAVCalendarInfo): Promise<boolean> {
		const client = await this.getOrCreateClient(account);

		const davCalendar = {
			url: calendar.url,
			displayName: calendar.displayName,
			ctag: calendar.ctag,
			syncToken: calendar.syncToken,
		};

		const result = await client.isCollectionDirty({
			collection: davCalendar,
		});

		return result.isDirty;
	}

	clearClient(accountId: string): void {
		this.clients.delete(accountId);
	}

	clearAllClients(): void {
		this.clients.clear();
	}

	private mapCalendarInfo(cal: {
		url: string;
		displayName?: unknown;
		description?: unknown;
		calendarColor?: unknown;
		ctag?: unknown;
		syncToken?: unknown;
		components?: string[];
	}): CalDAVCalendarInfo {
		const getStringValue = (val: unknown): string | undefined => {
			if (typeof val === "string") return val;
			return undefined;
		};

		return {
			url: cal.url,
			displayName: getStringValue(cal.displayName) ?? "Unnamed Calendar",
			description: getStringValue(cal.description),
			color: getStringValue(cal.calendarColor),
			ctag: getStringValue(cal.ctag),
			syncToken: getStringValue(cal.syncToken),
			components: cal.components,
		};
	}

	private mapCalendarObject(obj: { url: string; etag?: string; data?: string }): CalDAVFetchedEvent {
		let uid: string | undefined;
		const data = typeof obj.data === "string" ? obj.data : "";

		if (data) {
			const uidMatch = data.match(/UID:([^\r\n]+)/i);
			if (uidMatch?.[1]) {
				uid = uidMatch[1].trim();
			}
		}

		return {
			url: obj.url,
			etag: typeof obj.etag === "string" ? obj.etag : "",
			data,
			uid,
		};
	}
}
