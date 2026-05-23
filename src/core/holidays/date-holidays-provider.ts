import Holidays, { type HolidaysTypes } from "date-holidays";

import type { HolidayConfig, HolidayEvent, HolidayProvider } from "./types";

export class DateHolidaysProvider implements HolidayProvider {
	private readonly hd: Holidays;

	constructor(config: HolidayConfig) {
		const { country, state, region, timezone, types } = config;
		const options: HolidaysTypes.Options = {
			...(timezone !== undefined && { timezone }),
			...(types !== undefined && { types }),
		};

		// Initialize based on what's provided
		if (region && state) {
			this.hd = new Holidays(country, state, region, options);
		} else if (state) {
			this.hd = new Holidays(country, state, options);
		} else {
			this.hd = new Holidays(country, options);
		}
	}

	list(year: number): Promise<HolidayEvent[]> {
		const holidays = this.hd.getHolidays(year);
		return Promise.resolve(
			holidays.map((h) => ({
				date: h.date.slice(0, 10),
				name: h.name,
				type: h.type,
				id: `date-holidays:${h.date.slice(0, 10)}:${h.name}`,
			}))
		);
	}
}
