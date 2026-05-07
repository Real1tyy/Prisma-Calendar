import { describe, expect, it } from "vitest";

import {
	formatLocaleLongDate,
	formatLocaleLongDateTime,
	formatLocaleMonthDay,
	formatLocaleShortDate,
	formatLocaleShortDateTime,
	formatLocaleTimeHm,
	formatLocaleYearMonth,
} from "../../src/utils/date/date";

const SAMPLE = new Date(2026, 4, 6, 14, 7); // 2026-05-06 14:07 local

describe("formatLocaleShortDate", () => {
	it("renders year, short month, and day in en-US", () => {
		expect(formatLocaleShortDate(SAMPLE, "en-US")).toBe("May 6, 2026");
	});

	it("renders the locale-specific shape for a non-English locale", () => {
		expect(formatLocaleShortDate(SAMPLE, "de-DE")).toBe("6. Mai 2026");
	});
});

describe("formatLocaleLongDate", () => {
	it("uses the full month name", () => {
		expect(formatLocaleLongDate(SAMPLE, "en-US")).toBe("May 6, 2026");
	});

	it("differs from short date for months with longer names", () => {
		const sept = new Date(2026, 8, 6); // September
		expect(formatLocaleLongDate(sept, "en-US")).toBe("September 6, 2026");
		expect(formatLocaleShortDate(sept, "en-US")).toBe("Sep 6, 2026");
	});
});

describe("formatLocaleMonthDay", () => {
	it("omits the year by default", () => {
		expect(formatLocaleMonthDay(SAMPLE, "en-US")).toBe("May 6");
	});

	it("includes the year when withYear is true", () => {
		expect(formatLocaleMonthDay(SAMPLE, "en-US", { withYear: true })).toBe("May 6, 2026");
	});
});

describe("formatLocaleYearMonth", () => {
	it("renders long month and year only", () => {
		expect(formatLocaleYearMonth(SAMPLE, "en-US")).toBe("May 2026");
	});
});

describe("formatLocaleTimeHm", () => {
	it("renders hour:minute in 24h when hour12 is false", () => {
		expect(formatLocaleTimeHm(SAMPLE, "en-GB", { hour12: false })).toBe("14:07");
	});

	it("renders hour:minute in 12h when hour12 is true", () => {
		expect(formatLocaleTimeHm(SAMPLE, "en-US", { hour12: true })).toBe("02:07 PM");
	});
});

describe("formatLocaleShortDateTime", () => {
	it("combines short date and time", () => {
		const out = formatLocaleShortDateTime(SAMPLE, "en-GB");
		expect(out).toContain("6 May 2026");
		expect(out).toContain("14:07");
	});
});

describe("formatLocaleLongDateTime", () => {
	it("combines long date and time", () => {
		const out = formatLocaleLongDateTime(SAMPLE, "en-GB");
		expect(out).toContain("6 May 2026");
		expect(out).toContain("14:07");
	});
});

describe("formatter caching", () => {
	it("returns identical output on repeated calls (cache safe)", () => {
		const a = formatLocaleShortDate(SAMPLE, "en-US");
		const b = formatLocaleShortDate(SAMPLE, "en-US");
		expect(a).toBe(b);
	});

	it("does not collide between locales", () => {
		const us = formatLocaleShortDate(SAMPLE, "en-US");
		const de = formatLocaleShortDate(SAMPLE, "de-DE");
		expect(us).not.toBe(de);
	});

	it("does not collide between option variants", () => {
		const withYear = formatLocaleMonthDay(SAMPLE, "en-US", { withYear: true });
		const noYear = formatLocaleMonthDay(SAMPLE, "en-US");
		expect(withYear).not.toBe(noYear);
	});
});
