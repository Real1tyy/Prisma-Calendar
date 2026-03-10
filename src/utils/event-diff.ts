import type { PrismaEventInput } from "../types/calendar";
import type { Frontmatter } from "../types/index";

export interface EventDiff {
	added: PrismaEventInput[];
	removed: string[];
	changed: PrismaEventInput[];
}

/**
 * Computes a fast numeric hash (FNV-1a) from a string.
 */
function fnv1aHash(str: string): number {
	let hash = 0x811c9dc5; // FNV offset basis
	for (let i = 0; i < str.length; i++) {
		hash ^= str.charCodeAt(i);
		hash = (hash * 0x01000193) | 0; // FNV prime, keep 32-bit
	}
	return hash >>> 0; // unsigned
}

/**
 * WeakMap cache for frontmatter hashes. Keyed on the `meta` object reference —
 * unchanged events between refreshes reuse the same object, turning repeated
 * JSON.stringify into an O(1) lookup. New objects from re-parsed files
 * auto-invalidate via GC.
 */
const frontmatterHashCache = new WeakMap<object, number>();

/**
 * Computes a numeric hash of frontmatter data for fast diff comparison.
 * Avoids repeated JSON.stringify in eventFingerprint by pre-computing once.
 * Results are cached per object reference via WeakMap.
 */
export function hashFrontmatter(data: Frontmatter): number {
	let hash = frontmatterHashCache.get(data);
	if (hash !== undefined) return hash;
	hash = fnv1aHash(JSON.stringify(data));
	frontmatterHashCache.set(data, hash);
	return hash;
}

/**
 * Creates a stable fingerprint string from all rendering-relevant fields of an event.
 * Used to detect whether a FullCalendar event needs DOM updates.
 * When frontmatterHash is pre-computed, avoids expensive JSON.stringify per diff cycle.
 */
export function eventFingerprint(ev: PrismaEventInput): string {
	const fmPart =
		ev.extendedProps.frontmatterHash !== undefined
			? String(ev.extendedProps.frontmatterHash)
			: JSON.stringify(ev.extendedProps.frontmatterDisplayData);

	return [
		ev.title ?? "",
		ev.start ?? "",
		ev.end ?? "",
		ev.allDay ? "1" : "0",
		ev.backgroundColor ?? "",
		ev.borderColor ?? "",
		ev.className ?? "",
		fmPart,
		ev.extendedProps.filePath,
		ev.extendedProps.folder,
		ev.extendedProps.originalTitle,
		ev.extendedProps.isVirtual ? "1" : "0",
	].join("\0");
}

/**
 * Compares previously rendered events against the new event list.
 * Returns which events were added, removed, or changed (need in-place property updates).
 */
export function diffEvents(previous: Map<string, string>, next: PrismaEventInput[]): EventDiff {
	const added: PrismaEventInput[] = [];
	const changed: PrismaEventInput[] = [];
	const seen = new Set<string>();

	for (const ev of next) {
		const id = ev.id as string;
		seen.add(id);

		const prevFingerprint = previous.get(id);
		if (prevFingerprint === undefined) {
			added.push(ev);
		} else if (eventFingerprint(ev) !== prevFingerprint) {
			changed.push(ev);
		}
	}

	const removed: string[] = [];
	for (const id of previous.keys()) {
		if (!seen.has(id)) {
			removed.push(id);
		}
	}

	return { added, removed, changed };
}
