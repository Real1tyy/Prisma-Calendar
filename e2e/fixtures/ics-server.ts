import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import ICAL from "ical.js";

// Local HTTP server that mimics a remote ICS feed. Binds to 127.0.0.1 on an
// OS-assigned port, serves whatever body the spec last `setBody`'d, records
// every request for assertion, and lets the spec swap the status code to
// exercise error paths (403 for auth failures, 500 for server errors, etc.).
// Obsidian's `requestUrl` API (used by ics-subscription/sync.ts) hits this
// over plain HTTP on the loopback interface — no CORS, no cert trust, no
// docker required.

const DEFAULT_CONTENT_TYPE = "text/calendar; charset=utf-8";
const OK = 200;

export interface RecordedRequest {
	method: string;
	path: string;
	headers: Readonly<Record<string, string | string[] | undefined>>;
}

export interface IcsServerState {
	body: string;
	status: number;
	contentType: string;
}

export interface IcsServer {
	/** Full URL the plugin should subscribe to. */
	readonly url: string;
	/** All requests observed since start(). Cleared by `resetRequests()`. */
	readonly requests: readonly RecordedRequest[];
	/** Replace the served body; takes effect on the next request. */
	setBody(ics: string): void;
	/** Swap the HTTP status code. Handy for 403/500 error-path specs. */
	setStatus(status: number): void;
	resetRequests(): void;
	close(): Promise<void>;
}

/**
 * Start a mock ICS server. Call `close()` in a `test.afterEach` /
 * `test.afterAll` hook to release the port — Playwright's serial runner will
 * otherwise leak a listener per spec.
 */
export async function startIcsServer(initialBody: string): Promise<IcsServer> {
	const state: IcsServerState = {
		body: initialBody,
		status: OK,
		contentType: DEFAULT_CONTENT_TYPE,
	};
	const recorded: RecordedRequest[] = [];

	const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
		recorded.push({
			method: req.method ?? "GET",
			path: req.url ?? "/",
			headers: req.headers,
		});
		res.writeHead(state.status, { "Content-Type": state.contentType });
		res.end(state.body);
	});

	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			server.off("error", reject);
			resolve();
		});
	});

	const addr = server.address() as AddressInfo;
	const url = `http://127.0.0.1:${addr.port}/calendar.ics`;

	return {
		url,
		get requests() {
			return recorded;
		},
		setBody(ics) {
			state.body = ics;
		},
		setStatus(status) {
			state.status = status;
		},
		resetRequests() {
			recorded.length = 0;
		},
		close: () =>
			new Promise<void>((resolve, reject) => {
				server.close((err) => (err ? reject(err) : resolve()));
			}),
	};
}

// ── ICS body builders ───────────────────────────────────────────────────
// Delegate RFC 5545 serialization to `ical.js` — the same library the plugin
// uses for export/import. Hand-rolling line protocol in tests would just
// duplicate that library's edge cases (line folding, value escaping, TZID
// emission) and eventually drift from what real clients produce.

export interface VEventInput {
	uid: string;
	summary: string;
	/** Timed events: `YYYYMMDDTHHmmssZ`. All-day events: `YYYYMMDD`. */
	dtstart: string;
	dtend?: string;
	/** Emit `DTSTART;VALUE=DATE` instead of a timestamp. `dtstart` should be `YYYYMMDD`. */
	allDay?: boolean;
	categories?: string;
	location?: string;
	description?: string;
}

function toICALTime(stamp: string, allDay: boolean): ICAL.Time {
	// `YYYYMMDD[THHmmss[Z]]` — the compact form used in ICS wire output.
	const year = Number(stamp.slice(0, 4));
	const month = Number(stamp.slice(4, 6));
	const day = Number(stamp.slice(6, 8));
	if (allDay) {
		return new ICAL.Time({ year, month, day, isDate: true }, ICAL.Timezone.utcTimezone);
	}
	const hour = Number(stamp.slice(9, 11));
	const minute = Number(stamp.slice(11, 13));
	const second = Number(stamp.slice(13, 15));
	return new ICAL.Time({ year, month, day, hour, minute, second, isDate: false }, ICAL.Timezone.utcTimezone);
}

function buildVEvent(v: VEventInput): ICAL.Component {
	const vevent = new ICAL.Component("vevent");
	vevent.addPropertyWithValue("uid", v.uid);
	vevent.addPropertyWithValue("summary", v.summary);
	vevent.addPropertyWithValue("dtstart", toICALTime(v.dtstart, Boolean(v.allDay)));
	if (v.dtend) {
		vevent.addPropertyWithValue("dtend", toICALTime(v.dtend, Boolean(v.allDay)));
	}
	if (v.categories) vevent.addPropertyWithValue("categories", v.categories);
	if (v.location) vevent.addPropertyWithValue("location", v.location);
	if (v.description) vevent.addPropertyWithValue("description", v.description);
	return vevent;
}

/**
 * Wrap VEVENTs in a minimal VCALENDAR envelope. `ICAL.Component#toString()`
 * produces byte-for-byte-correct RFC 5545 output (folded lines, escaped
 * commas/semicolons, canonical property order) — the same output path the
 * plugin's own exporter uses.
 */
export function buildIcs(events: readonly VEventInput[]): string {
	const vcalendar = new ICAL.Component("vcalendar");
	vcalendar.addPropertyWithValue("version", "2.0");
	vcalendar.addPropertyWithValue("prodid", "-//Prisma-Calendar-E2E//EN");
	vcalendar.addPropertyWithValue("calscale", "GREGORIAN");
	for (const event of events) {
		vcalendar.addSubcomponent(buildVEvent(event));
	}
	return vcalendar.toString() + "\r\n";
}
