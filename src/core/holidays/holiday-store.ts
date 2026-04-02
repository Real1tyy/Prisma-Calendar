import { DateTime } from "luxon";
import type { App } from "obsidian";

import type { CalendarEvent } from "../../types/calendar";
import { eventDefaults } from "../../types/calendar";
import { DateHolidaysProvider } from "./date-holidays-provider";
import type { HolidayConfig, HolidayEvent, HolidayProvider } from "./types";

interface CachedHolidays {
	year: number;
	events: HolidayEvent[];
	timestamp: number;
}

export class HolidayStore {
	private provider: HolidayProvider;
	private cache = new Map<number, CachedHolidays>();
	private readonly CACHE_KEY_PREFIX = "holiday-cache";

	constructor(
		private app: App,
		public config: HolidayConfig
	) {
		this.provider = new DateHolidaysProvider(config);
	}

	updateConfig(config: HolidayConfig): boolean {
		const configChanged =
			this.config.enabled !== config.enabled ||
			this.config.country !== config.country ||
			this.config.state !== config.state ||
			this.config.region !== config.region ||
			JSON.stringify(this.config.types) !== JSON.stringify(config.types);

		this.config = config;
		this.provider = new DateHolidaysProvider(config);

		if (configChanged) {
			this.cache.clear();
		}

		return configChanged;
	}

	async getHolidays(year: number): Promise<HolidayEvent[]> {
		if (!this.config.enabled) {
			return [];
		}

		const cached = this.cache.get(year);
		if (cached) {
			return cached.events;
		}

		const storedCache = await this.loadFromStorage(year);
		if (storedCache) {
			this.cache.set(year, storedCache);
			return storedCache.events;
		}

		const events = await this.provider.list(year);
		const entry: CachedHolidays = {
			year,
			events,
			timestamp: Date.now(),
		};

		this.cache.set(year, entry);
		this.saveToStorage(year, entry);
		return events;
	}

	async getHolidaysForRange(start: DateTime, end: DateTime): Promise<CalendarEvent[]> {
		if (!this.config.enabled) {
			return [];
		}

		const years = Array.from({ length: end.year - start.year + 1 }, (_, i) => start.year + i);
		const allHolidays = (await Promise.all(years.map((year) => this.getHolidays(year)))).flat();

		return allHolidays
			.filter((h) => {
				const holidayDate = DateTime.fromISO(h.date);
				return holidayDate >= start && holidayDate < end;
			})
			.map((h) => this.holidayToCalendarEvent(h));
	}

	private holidayToCalendarEvent(holiday: HolidayEvent): CalendarEvent {
		return {
			...eventDefaults(),
			id: holiday.id,
			title: holiday.name,
			type: "allDay",
			start: holiday.date,
			allDay: true,
			ref: { filePath: `holiday:${holiday.id}` },
			virtualKind: "holiday" as const,
			meta: {
				holidayType: holiday.type,
				holidaySource: "date-holidays",
			},
		};
	}

	private getCacheKey(year: number): string {
		return `${this.CACHE_KEY_PREFIX}:${this.config.country}:${this.config.state ?? ""}:${this.config.region ?? ""}:${year}`;
	}

	private async loadFromStorage(year: number): Promise<CachedHolidays | null> {
		try {
			const key = this.getCacheKey(year);
			const data = await this.app.loadLocalStorage(key);
			if (data) {
				const parsed = JSON.parse(data) as CachedHolidays;
				// Cache for 30 days
				if (Date.now() - parsed.timestamp < 30 * 24 * 60 * 60 * 1000) {
					return parsed;
				}
			}
		} catch (error) {
			console.error("[HolidayStore] Error loading holiday cache:", error);
		}
		return null;
	}

	private saveToStorage(year: number, data: CachedHolidays): void {
		try {
			const key = this.getCacheKey(year);
			this.app.saveLocalStorage(key, JSON.stringify(data));
		} catch (error) {
			console.error("[HolidayStore] Error saving holiday cache:", error);
		}
	}

	clear(): void {
		this.cache.clear();
	}
}
