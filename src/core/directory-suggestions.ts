import { classifyDateLikeString, getTopLevelDirectory, type DateLikeKind } from "@real1ty/obsidian-plugins";
import type { App, TFile } from "obsidian";

export interface DirectorySuggestion {
	directory: string;
	fileCount: number;
	dateProps: string[];
	datetimeProps: string[];
}

interface FileFrontmatterLike {
	path: string;
	frontmatter: Record<string, unknown> | null | undefined;
}

const UTC_MIDNIGHT_SUFFIX = "T00:00:00.000Z";

/**
 * Obsidian's frontmatter cache does not hand back a plain string for every date property: a
 * date-typed property can arrive as a `Date`, and a list property wraps its value in an array.
 * Anything not reduced to a string here is invisible to the scan — which is how a vault's actual
 * all-day property could be skipped while a stray quoted one got offered instead.
 */
function toClassifiableString(value: unknown): string | null {
	if (typeof value === "string") return value;
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return null;
		const iso = value.toISOString();
		// A YAML date-only timestamp parses to exact UTC midnight; keeping the full ISO would
		// misclassify every all-day property as datetime.
		return iso.endsWith(UTC_MIDNIGHT_SUFFIX) ? iso.slice(0, 10) : iso;
	}
	if (Array.isArray(value)) return value.length > 0 ? toClassifiableString(value[0]) : null;
	return null;
}

/**
 * The subset of a calendar's configuration the scan ranks by. Structurally satisfied by
 * `SingleCalendarConfig`, so callers pass their config straight through — declaring the shape
 * here rather than importing it keeps the settings module out of `core/`.
 */
export interface ScanPropNames {
	startProp: string;
	endProp: string;
	dateProp: string;
	sortDateProp: string;
	rruleProp: string;
	rruleSpecProp: string;
	rruleUntilProp: string;
	rruleIdProp: string;
	instanceDateProp: string;
}

/**
 * Properties Prisma itself writes. They hold real dates, so the scan sees them, but offering one
 * back as the user's start/end/all-day property points the calendar at its own bookkeeping.
 * Mirrors the `*Prop` defaults in `PropsSettingsSchema` — the defaults still apply when a config
 * is supplied, because a vault that predates a rename still holds notes under the old names.
 */
const DEFAULT_MANAGED_PROPS = ["rrule", "rrulespec", "rruleuntil", "rruleid", "recurring instance date", "sort date"];

/** Vault bookkeeping — genuine dates, but a poor guess whenever a real event property exists. */
const METADATA_PROPS = new Set([
	"created",
	"creation date",
	"date created",
	"date modified",
	"last modified",
	"modified",
	"updated",
]);

/** The plugin's own property defaults — a match is almost certainly what the user means. */
const DEFAULT_CANONICAL_PROPS: Record<DateLikeKind, string[]> = {
	date: ["date"],
	datetime: ["start date", "end date", "start", "end"],
};

function normalizeKey(key: string): string {
	return key.trim().toLowerCase();
}

interface RankingTables {
	managed: Set<string>;
	canonical: Record<DateLikeKind, Set<string>>;
}

/**
 * Defaults and configured names are unioned, never swapped: a vault that predates a rename still
 * holds notes under the old names, so both deserve to rank. The one asymmetry is the subtraction
 * — a name the user configured as their own start/end/date wins over the default managed list,
 * or configuring `dateProp: "Sort Date"` would silently drop the very property they picked.
 */
function buildRankingTables(propNames?: ScanPropNames): RankingTables {
	const canonical: Record<DateLikeKind, Set<string>> = {
		date: new Set(DEFAULT_CANONICAL_PROPS.date),
		datetime: new Set(DEFAULT_CANONICAL_PROPS.datetime),
	};
	const managed = new Set(DEFAULT_MANAGED_PROPS);

	if (propNames) {
		canonical.date.add(normalizeKey(propNames.dateProp));
		canonical.datetime.add(normalizeKey(propNames.startProp));
		canonical.datetime.add(normalizeKey(propNames.endProp));

		for (const name of [
			propNames.sortDateProp,
			propNames.rruleProp,
			propNames.rruleSpecProp,
			propNames.rruleUntilProp,
			propNames.rruleIdProp,
			propNames.instanceDateProp,
		]) {
			managed.add(normalizeKey(name));
		}

		for (const own of [propNames.dateProp, propNames.startProp, propNames.endProp]) {
			managed.delete(normalizeKey(own));
		}
	}

	return { managed, canonical };
}

function classifyFrontmatterProps(frontmatter: Record<string, unknown>, tables: RankingTables) {
	return Object.entries(frontmatter).flatMap(([key, value]) => {
		if (tables.managed.has(normalizeKey(key))) return [];
		const raw = toClassifiableString(value);
		if (raw === null) return [];
		const kind = classifyDateLikeString(raw);
		return kind ? [{ key, kind }] : [];
	});
}

interface PropTally {
	count: number;
	datetimeCount: number;
}

const MAX_PROPS_PER_KIND = 4;
const MAX_SUGGESTIONS = 6;

/** Lower sorts first: a property Prisma would have picked by default beats one that merely occurs often. */
function propRank(key: string, kind: DateLikeKind, tables: RankingTables): number {
	const normalized = normalizeKey(key);
	if (tables.canonical[kind].has(normalized)) return 0;
	if (METADATA_PROPS.has(normalized)) return 2;
	return 1;
}

function topPropsByCount(tally: Map<string, PropTally>, kind: DateLikeKind, tables: RankingTables): string[] {
	return Array.from(tally.entries())
		.filter(([, t]) => (kind === "datetime" ? t.datetimeCount > 0 : t.datetimeCount === 0))
		.sort(
			(a, b) =>
				propRank(a[0], kind, tables) - propRank(b[0], kind, tables) ||
				b[1].count - a[1].count ||
				a[0].localeCompare(b[0])
		)
		.map(([key]) => key)
		.slice(0, MAX_PROPS_PER_KIND);
}

export function buildDirectorySuggestions(
	files: FileFrontmatterLike[],
	propNames?: ScanPropNames
): DirectorySuggestion[] {
	const tables = buildRankingTables(propNames);
	const buckets = new Map<
		string,
		{
			fileCount: number;
			propCounts: Map<string, PropTally>;
		}
	>();

	for (const file of files) {
		if (!file.frontmatter) continue;
		const directory = getTopLevelDirectory(file.path);
		if (!directory) continue;

		const classified = classifyFrontmatterProps(file.frontmatter, tables);
		if (classified.length === 0) continue;

		const bucket = buckets.get(directory) ?? {
			fileCount: 0,
			propCounts: new Map<string, PropTally>(),
		};

		bucket.fileCount += 1;

		for (const { key, kind } of classified) {
			const existing = bucket.propCounts.get(key) ?? { count: 0, datetimeCount: 0 };
			existing.count += 1;
			if (kind === "datetime") existing.datetimeCount += 1;
			bucket.propCounts.set(key, existing);
		}

		buckets.set(directory, bucket);
	}

	return Array.from(buckets.entries())
		.map(([directory, bucket]) => ({
			directory,
			fileCount: bucket.fileCount,
			dateProps: topPropsByCount(bucket.propCounts, "date", tables),
			datetimeProps: topPropsByCount(bucket.propCounts, "datetime", tables),
		}))
		.filter((entry) => entry.fileCount > 0)
		.sort((a, b) => b.fileCount - a.fileCount || a.directory.localeCompare(b.directory))
		.slice(0, MAX_SUGGESTIONS);
}

export function scanVaultForDirectorySuggestions(app: App, propNames?: ScanPropNames): Promise<DirectorySuggestion[]> {
	const files = app.vault.getMarkdownFiles();
	const materialized = files.map((file: TFile) => ({
		path: file.path,
		frontmatter: app.metadataCache.getFileCache(file)?.frontmatter ?? null,
	}));
	return Promise.resolve(buildDirectorySuggestions(materialized, propNames));
}

export function formatDirectorySuggestionMeta(suggestion: DirectorySuggestion): string {
	const parts: string[] = [];
	if (suggestion.datetimeProps.length > 0) parts.push(`datetime: ${suggestion.datetimeProps.join(", ")}`);
	if (suggestion.dateProps.length > 0) parts.push(`date: ${suggestion.dateProps.join(", ")}`);
	const props = parts.length > 0 ? `Found properties — ${parts.join(" · ")}` : "Found date-like properties";
	return `${suggestion.fileCount} note${suggestion.fileCount === 1 ? "" : "s"} · ${props}`;
}

export function formatDirectorySuggestionDescription(suggestion: DirectorySuggestion): string {
	return suggestion.fileCount === 1
		? "Contains a note with date-like frontmatter properties."
		: "Contains notes with date-like frontmatter properties.";
}
