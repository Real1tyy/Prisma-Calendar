import type { DateTime } from "luxon";

import type { ISO } from "../types";

/** Strip trailing Z/.000Z from an ISO string (entry boundary). */
export function stripZ(iso: string): string {
	return iso.replace(/\.000Z$|Z$/, "");
}

/** Append .000Z to an ISO datetime string for frontmatter serialization (exit boundary). Date-only strings pass through unchanged. */
export function appendZ(iso: string): string {
	if (!iso.includes("T")) return iso;
	if (iso.endsWith(".000Z")) return iso;
	if (iso.endsWith("Z")) return iso.slice(0, -1) + ".000Z";
	return iso + ".000Z";
}

/** Convert a Luxon DateTime to internal ISO (no Z, no offset, no milliseconds). */
export function toInternalISO(dt: DateTime): ISO {
	return (dt.toISO({ suppressMilliseconds: true, includeOffset: false }) ?? "") as ISO;
}
