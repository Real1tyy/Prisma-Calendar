import { classifyDateLikeString, optionalDateTimeTransform, optionalDateTransform } from "@real1ty-obsidian-plugins";

import type { Frontmatter, SingleCalendarConfig } from "../types";

/**
 * How a single indexed note resolved against the active property mapping.
 * `dropped` means the note *looks* like it wanted to be an event but couldn't
 * be read — the silent-drop case this module exists to make legible.
 */
export type IndexedRowKind = "timed" | "allDay" | "untracked" | "dropped";

export type DropReasonCategory = "unparseable-date" | "unmapped-date-prop" | "trailing-space-key";

export interface RowClassification {
	kind: IndexedRowKind;
	/** Human-readable explanation, present only when `kind === "dropped"`. */
	reason?: string;
	reasonCategory?: DropReasonCategory;
}

export interface IndexingTally {
	total: number;
	timed: number;
	allDay: number;
	untracked: number;
	dropped: number;
	dropReasons: Record<DropReasonCategory, number>;
}

const MAX_VALUE_PREVIEW = 40;

function isPresent(value: unknown): boolean {
	if (value == null) return false;
	if (typeof value === "string") return value.trim().length > 0;
	return true;
}

function parsesAsDateTime(value: unknown): boolean {
	const result = optionalDateTimeTransform.safeParse(value);
	return result.success && result.data !== undefined;
}

function parsesAsDate(value: unknown): boolean {
	const result = optionalDateTransform.safeParse(value);
	return result.success && result.data !== undefined;
}

function parsesAsAnyDate(value: unknown): boolean {
	return parsesAsDateTime(value) || parsesAsDate(value);
}

function previewValue(value: unknown): string {
	const str = String(value);
	return str.length > MAX_VALUE_PREVIEW ? `${str.slice(0, MAX_VALUE_PREVIEW - 1)}…` : str;
}

function dropped(reasonCategory: DropReasonCategory, reason: string): RowClassification {
	return { kind: "dropped", reason, reasonCategory };
}

/**
 * Classifies one note's frontmatter against the calendar's property mapping.
 * Pure — the same input always yields the same classification, so it drives both
 * the settings tally and the (future) Doctor without any I/O.
 */
export function classifyRow(frontmatter: Frontmatter, settings: SingleCalendarConfig): RowClassification {
	const { startProp, dateProp } = settings;
	const startVal = frontmatter[startProp];
	const dateVal = frontmatter[dateProp];

	if (isPresent(startVal)) {
		return parsesAsAnyDate(startVal)
			? { kind: "timed" }
			: dropped(
					"unparseable-date",
					`\`${startProp}: ${previewValue(startVal)}\` isn't a recognised date format — expected YYYY-MM-DD or YYYY-MM-DDThh:mm.`
				);
	}

	if (isPresent(dateVal)) {
		return parsesAsAnyDate(dateVal)
			? { kind: "allDay" }
			: dropped(
					"unparseable-date",
					`\`${dateProp}: ${previewValue(dateVal)}\` isn't a recognised date format — expected YYYY-MM-DD.`
				);
	}

	// Neither mapped property is set. Before calling the note "untracked", check
	// for the two near-miss shapes that read as silent drops to the user.
	const trailingSpaceKey = Object.entries(frontmatter).find(
		([key, value]) =>
			key !== key.trim() &&
			(key.trim() === startProp ||
				key.trim() === dateProp ||
				(typeof value === "string" && classifyDateLikeString(value) !== null))
	);
	if (trailingSpaceKey) {
		return dropped("trailing-space-key", `Property name has a trailing space (\`${trailingSpaceKey[0]}\`).`);
	}

	const unmappedDateKey = Object.entries(frontmatter).find(
		([key, value]) =>
			key !== startProp && key !== dateProp && typeof value === "string" && classifyDateLikeString(value) !== null
	);
	if (unmappedDateKey) {
		return dropped(
			"unmapped-date-prop",
			`No \`${startProp}\` or \`${dateProp}\` property found — your note uses \`${unmappedDateKey[0]}\`. Map it?`
		);
	}

	return { kind: "untracked" };
}

/**
 * The reason a note silently dropped, or `null` if it resolved fine (including
 * legitimately untracked notes). Convenience wrapper over {@link classifyRow}.
 */
export function classifyDropReason(frontmatter: Frontmatter, settings: SingleCalendarConfig): string | null {
	return classifyRow(frontmatter, settings).reason ?? null;
}

function emptyDropReasons(): Record<DropReasonCategory, number> {
	return { "unparseable-date": 0, "unmapped-date-prop": 0, "trailing-space-key": 0 };
}

/**
 * Tallies how a set of indexed rows resolved. Operates on the in-memory row
 * frontmatter — no disk reads, no parser dependency — so it is cheap enough to
 * recompute on every settings change.
 */
export function tallyIndexedRows(
	rows: ReadonlyArray<{ data: Frontmatter }>,
	settings: SingleCalendarConfig
): IndexingTally {
	const tally: IndexingTally = {
		total: rows.length,
		timed: 0,
		allDay: 0,
		untracked: 0,
		dropped: 0,
		dropReasons: emptyDropReasons(),
	};

	for (const row of rows) {
		const classification = classifyRow(row.data, settings);
		if (classification.kind === "dropped") {
			tally.dropped += 1;
			if (classification.reasonCategory) tally.dropReasons[classification.reasonCategory] += 1;
		} else {
			tally[classification.kind] += 1;
		}
	}

	return tally;
}

/** Compact settings line: `9 timed · 14 all-day · 3 untracked · 3 couldn't be read`. */
export function formatIndexingTally(tally: IndexingTally): string {
	const parts = [`${tally.timed} timed`, `${tally.allDay} all-day`, `${tally.untracked} untracked`];
	if (tally.dropped > 0) parts.push(`${tally.dropped} couldn't be read`);
	return parts.join(" · ");
}

/** Dev-console summary emitted on every (re)index. */
export function formatIndexingSummary(planningSystemName: string, tally: IndexingTally): string {
	const noteWord = tally.total === 1 ? "note" : "notes";
	let line = `[Prisma Calendar] Indexed "${planningSystemName}": ${tally.total} ${noteWord} · ${formatIndexingTally(tally)}`;
	if (tally.dropped > 0) {
		const breakdown = (Object.entries(tally.dropReasons) as [DropReasonCategory, number][])
			.filter(([, count]) => count > 0)
			.map(([category, count]) => `${category}: ${count}`)
			.join(", ");
		line += ` (${breakdown})`;
	}
	return line;
}

/** One-shot first-index notice: `12 notes in Calendar/ · 9 on the calendar · 3 couldn't be read`. */
export function formatFirstIndexNotice(directory: string, tally: IndexingTally): string {
	const noteWord = tally.total === 1 ? "note" : "notes";
	const onCalendar = tally.timed + tally.allDay;
	const parts = [`${tally.total} ${noteWord} in ${directory || "your vault"}`, `${onCalendar} on the calendar`];
	if (tally.dropped > 0) parts.push(`${tally.dropped} couldn't be read`);
	return parts.join(" · ");
}
