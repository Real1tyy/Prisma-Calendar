import type { HolidaysTypes } from "date-holidays";

export type HolidayType = HolidaysTypes.HolidayType;

export interface HolidayEvent {
	date: string; // YYYY-MM-DD (local to calendar TZ)
	name: string;
	type: HolidayType;
	id: string; // stable id (provider+date+name)
}

export interface HolidayProvider {
	list(year: number): Promise<HolidayEvent[]>;
}

export interface HolidayConfig {
	enabled: boolean;
	country: string;
	state?: string;
	region?: string;
	languages?: string | string[];
	timezone?: string;
	types?: HolidayType[];
}
