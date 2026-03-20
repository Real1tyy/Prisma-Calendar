import type { DateTime } from "luxon";

import type { ISO } from "../types";

/** Strip trailing Z/.000Z from an ISO string (entry boundary). */
export function stripZ(iso: string): string {
	return iso.replace(/\.000Z$|Z$/, "");
}

/** Append Z to an ISO string for frontmatter serialization (exit boundary). */
export function appendZ(iso: string): string {
	return iso.endsWith("Z") ? iso : iso + "Z";
}

/** Convert a Luxon DateTime to internal ISO (no Z, no offset, no milliseconds). */
export function toInternalISO(dt: DateTime): ISO {
	return (dt.toISO({ suppressMilliseconds: true, includeOffset: false }) ?? "") as ISO;
}
