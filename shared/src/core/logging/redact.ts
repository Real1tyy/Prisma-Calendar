import type { LogEntry } from "./types";

/**
 * The one redaction primitive every observability surface runs through before
 * anything is copied, saved, or sent — see [[decision-observability-privacy-posture]].
 *
 * Three independent rules, in decreasing strictness:
 *
 * 1. **Secrets are removed unconditionally.** A key that names a credential
 *    (`token`, `apiKey`, `password`, `authorization`, …) or a string that looks
 *    like one (a bearer header, a JWT, URL userinfo, `key=value` in free text)
 *    is replaced with {@link REDACTED_SECRET} in every mode. No option restores it.
 * 2. **Paths are abbreviated** (default mode). Every path segment collapses to a
 *    stable 6-hex hash so structure and identity survive — the same note maps to
 *    the same token across entries, which is what makes a redacted log still
 *    debuggable — while the user's folder and note names do not. Segments under
 *    `.obsidian` itself remains recognizable as a structural marker, but every
 *    descendant is hashed because plugin data and custom filenames can still be
 *    private.
 * 3. **Frontmatter values are elided** (default mode) — a `frontmatter` /
 *    `properties` object keeps its keys and each value becomes a type descriptor
 *    (`[string]`, `[array:3]`). Plugins name additional keys via `sensitiveKeys`.
 *
 * `fullDetail: true` relaxes rules 2 and 3 for a trusted hand-off. Rule 1 is not
 * an option, on purpose: the cost of a leaked license token is unbounded, the
 * cost of a support thread asking "which key?" is one message.
 *
 * Pure and deterministic: no clock, no randomness, no environment reads. Vault
 * location comes in through `vaultPath`.
 */

export const REDACTED_SECRET = "[redacted:secret]";

export interface RedactOptions {
	/**
	 * Keep real paths, note names and frontmatter values for a trusted recipient.
	 * Secrets are still removed — nothing relaxes rule 1.
	 */
	fullDetail?: boolean;
	/** Absolute vault root; every occurrence collapses to `vault://` before segment hashing. */
	vaultPath?: string;
	/** Extra keys whose values are elided to a type descriptor in default mode (plugin-configured sensitive properties). */
	sensitiveKeys?: readonly string[];
}

/**
 * Words that mark a key as credential-bearing. Keys are split into words
 * (camelCase and snake_case) and matched whole, so `author` never trips on
 * `auth` and `profile` never trips on `file`. A key whose last word is a
 * *reference* tail (`SecretName`, `token_ref`, `apiKeyStorage`) is the label of a
 * secret in Obsidian's keychain, not the secret — redacting it reads as a leak
 * that never happened, so those pass. `hasToken` / `isPasswordSet` are booleans
 * about a secret and pass too.
 */
const SECRET_WORDS = new Set([
	"token",
	"tokens",
	"secret",
	"secrets",
	"password",
	"passwords",
	"passwd",
	"credential",
	"credentials",
	"authorization",
	"bearer",
	"cookie",
	"cookies",
	"jwt",
	"auth",
]);
const SECRET_WORD_PAIRS = new Set(["accesskey", "apikey", "licensekey", "privatekey", "sessionid"]);
const REFERENCE_TAILS = new Set([
	"name",
	"names",
	"ref",
	"refs",
	"storage",
	"label",
	"labels",
	"count",
	"length",
	"type",
	"kind",
	"field",
	"prop",
	"property",
]);
const BOOLEAN_HEADS = new Set(["has", "is", "use", "with", "should", "can", "needs", "requires"]);

const PATH_TAILS = new Set([
	"path",
	"paths",
	"file",
	"files",
	"filename",
	"filenames",
	"filepath",
	"filepaths",
	"folder",
	"folders",
	"dir",
	"dirs",
	"directory",
	"directories",
]);
const FRONTMATTER_KEY = /^(?:frontmatter|front_matter|properties)$/i;

const NOTE_EXTENSION = /\.(?:md|canvas|base)$/i;
const FILE_EXTENSION = /\.[A-Za-z0-9]{1,8}$/;
const ABSOLUTE_PATH = /^(?:[A-Za-z]:[\\/]|[\\/]|~[\\/])/;
const HOME_PREFIX = /^(?:\/home\/[^/]+|\/Users\/[^/]+|[A-Za-z]:\/Users\/[^/]+)(?=\/|$)/i;

const MAX_DEPTH = 24;

/** FNV-1a 32-bit, rendered as 6 hex chars — stable, cheap, and collision-tolerant for "same note?" correlation. */
function stableHash(input: string): string {
	// macOS commonly presents decomposed filenames while Windows generally uses
	// composed Unicode. Hash the canonical spelling so the same visible segment
	// keeps the same diagnostic token across platforms.
	input = input.normalize("NFC");
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(16).padStart(8, "0").slice(0, 6);
}

function normalizePath(path: string): string {
	return path.normalize("NFC").replace(/\\/g, "/");
}

function isWithinRoot(path: string, root: string): boolean {
	// Windows and the default macOS filesystem are case-insensitive. Redaction
	// must not depend on the casing a caller or stack trace happened to use. A
	// false-positive collapse on a case-sensitive volume only redacts more data;
	// a false negative could disclose the vault path.
	const foldedPath = path.toLowerCase();
	const foldedRoot = root.toLowerCase();
	return foldedPath === foldedRoot || foldedPath.startsWith(`${foldedRoot}/`);
}

function wordsOf(key: string): string[] {
	return key
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
}

export function isSecretKey(key: string): boolean {
	const words = wordsOf(key);
	const first = words[0];
	const last = words[words.length - 1];
	if (first === undefined || last === undefined) return false;
	if (words.length > 1 && (BOOLEAN_HEADS.has(first) || REFERENCE_TAILS.has(last))) return false;
	if (words.some((word) => SECRET_WORDS.has(word))) return true;
	return words.some((word, i) => i > 0 && SECRET_WORD_PAIRS.has(`${words[i - 1] ?? ""}${word}`));
}

function isPathKey(key: string): boolean {
	const words = wordsOf(key);
	const last = words[words.length - 1];
	return last !== undefined && PATH_TAILS.has(last);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null) return false;
	const proto: unknown = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

function hashSegment(segment: string): string {
	if (segment === "" || segment === "." || segment === "..") return segment;
	// `note.md#Heading` — the heading is content too, hashed separately so the
	// extension stays visible.
	const hashIndex = segment.indexOf("#");
	if (hashIndex > 0) {
		return `${hashSegment(segment.slice(0, hashIndex))}#{${stableHash(segment.slice(hashIndex + 1))}}`;
	}
	const extension = FILE_EXTENSION.exec(segment)?.[0] ?? "";
	const stem = extension ? segment.slice(0, -extension.length) : segment;
	if (stem === "") return segment;
	return `{${stableHash(stem)}}${extension}`;
}

function hashSegments(relative: string): string {
	return relative
		.split("/")
		.map((segment) => {
			if (segment === ".obsidian") return segment;
			return hashSegment(segment);
		})
		.join("/");
}

/**
 * Abbreviate one path. Absolute paths lose their machine-specific prefix
 * (`vault://` when under `vaultPath`, `home://` under a user's home directory);
 * every remaining segment is hashed. Relative paths are treated as
 * vault-relative and hashed in place.
 */
export function abbreviatePath(path: string, vaultPath?: string): string {
	const normalized = normalizePath(path);
	// Already collapsed by an earlier pass over surrounding text — keep the marker.
	const marker = PATH_MARKER.exec(normalized);
	if (marker) return `${marker[0]}${hashSegments(normalized.slice(marker[0].length))}`;
	if (vaultPath) {
		const root = normalizePath(vaultPath).replace(/\/+$/, "");
		if (root && isWithinRoot(normalized, root)) {
			const rest = normalized.slice(root.length).replace(/^\/+/, "");
			return `vault://${hashSegments(rest)}`;
		}
	}
	const home = HOME_PREFIX.exec(normalized);
	if (home) {
		const rest = normalized.slice(home[0].length).replace(/^\/+/, "");
		return `home://${hashSegments(rest)}`;
	}
	if (normalized.startsWith("//")) return `unc://${hashSegments(normalized.slice(2))}`;
	const drive = /^[A-Za-z]:\//.exec(normalized);
	if (drive) return `${drive[0]}${hashSegments(normalized.slice(drive[0].length))}`;
	if (normalized.startsWith("/")) return `/${hashSegments(normalized.slice(1))}`;
	if (normalized.startsWith("~/")) return `~/${hashSegments(normalized.slice(2))}`;
	return hashSegments(normalized);
}

function looksLikePath(value: string): boolean {
	return ABSOLUTE_PATH.test(value) || NOTE_EXTENSION.test(value);
}

// ─── Free text ───────────────────────────────────────────────────────────────

// Auth schemes only, and a credential-length value — "Bearer token expired" is a
// sentence, not a header, and must survive.
const BEARER_IN_TEXT = /\b(Bearer|Basic)\s+[A-Za-z0-9\-._~+/]{8,}=*/g;
const JWT_IN_TEXT = /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g;
const CREDENTIAL_SHAPE_IN_TEXT =
	/\b(?:sk-[A-Za-z0-9_-]{12,}|(?:sk|rk)_(?:live|test)_[A-Za-z0-9_-]{12,}|lic_[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{12,}|glpat-[A-Za-z0-9_-]{12,}|npm_[A-Za-z0-9]{24,}|xox[baprs]-[A-Za-z0-9-]{12,}|(?:AKIA|ASIA)[A-Z0-9]{16}|AIza[A-Za-z0-9_-]{30,})\b/g;
const PRIVATE_KEY_IN_TEXT = /-----BEGIN ((?:RSA |EC |OPENSSH )?PRIVATE KEY)-----[\s\S]*?-----END \1-----/g;
const URL_USERINFO_IN_TEXT = /(:\/\/)[^\s/@]+:[^\s/@]+@/g;
const AUTHORIZATION_IN_TEXT = /\b(authorization)(\s*[:=]\s*)(?:(Bearer|Basic)\s+)?("[^"]*"|'[^']*'|[^\s,;)}\]]+)/gi;
const KEY_VALUE_IN_TEXT =
	/\b(token|secret|password|passwd|api[_-]?key|license[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret)\b(\s*[:=]\s*)(?!\[redacted)("[^"]*"|'[^']*'|[^\s,;)}\]]+)/gi;
// The lookbehind refuses a path that starts right after `:` or `/`, so a URL's
// `//host/…` tail and `app://obsidian.md/…` are left alone.
const ABSOLUTE_PATH_IN_TEXT = /(?<![\w:/.])(?:[A-Za-z]:)?(?:[\\/][^\s"'`<>|*?,;()[\]{}]+)+/g;
// A note reference in prose. Two shapes: a token with a `/`, where a space may
// continue the path only if the next word still looks like one (`Client X/meeting.md`
// — the lookahead is what stops "data.json and Notes/a.md" being swallowed as one
// path), and a bare `Note.md`. Known limit: a top-level folder with a space in its
// name (`My Folder/note.md`) leaks the words before the last one — free text cannot
// tell a folder from a verb. Callers put paths in structured `data`, which is exact.
const PATH_CHAR = "[^\\s\"'`<>|*?,;()[\\]{}]";
const NOTE_REF_IN_TEXT = new RegExp(
	`(?<![\\w/{])(?:${PATH_CHAR}*\\/(?:${PATH_CHAR}|\\s(?=${PATH_CHAR}*[/.]))*?|${PATH_CHAR}+)\\.(?:md|canvas|base)\\b(?:#[^\\s\\]|)]+)?`,
	"gi"
);
const MARKED_PATH_IN_TEXT = new RegExp(
	`\\b(?:vault|home|unc):\\/\\/(?:${PATH_CHAR}|\\s(?=${PATH_CHAR}*[/.]))*?\\.[A-Za-z0-9]{1,8}\\b(?![\\\\/])(?::\\d+(?::\\d+)?)?(?:#[^\\s\\]|)]+)?`,
	"gi"
);
const WIKILINK_IN_TEXT = /\[\[([^\]|#]+)(#[^\]|]+)?(\|[^\]]*)?\]\]/g;
const PATH_MARKER = /^(?:vault|home|unc):\/\//;

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Collapse every literal occurrence of the vault root to `vault://` before any
 * token matching runs — the one substitution that must not depend on where a
 * path stops, because a vault root with a space in it (`~/My Vault`) has no
 * token boundary a regex could find.
 */
function collapseVaultRoot(text: string, vaultPath: string | undefined): string {
	if (!vaultPath) return text;
	const root = normalizePath(vaultPath).replace(/\/+$/, "");
	if (!root) return text;
	// Match either separator at every boundary, including mixed-separator stack
	// traces. Case-folding is deliberately privacy-biased; see isWithinRoot().
	const rootPattern = escapeRegExp(root).replace(/\//g, "[\\\\/]+");
	return text.normalize("NFC").replace(new RegExp(`(?:${rootPattern})(?=[\\\\/]|$|[^\\w])[\\\\/]*`, "gi"), "vault://");
}

function stripSecretsFromText(text: string): string {
	return text
		.replace(PRIVATE_KEY_IN_TEXT, REDACTED_SECRET)
		.replace(URL_USERINFO_IN_TEXT, `$1${REDACTED_SECRET}@`)
		.replace(JWT_IN_TEXT, REDACTED_SECRET)
		.replace(
			AUTHORIZATION_IN_TEXT,
			(_match, key: string, separator: string, scheme: string | undefined) =>
				`${key}${separator}${scheme ? `${scheme} ` : ""}${REDACTED_SECRET}`
		)
		.replace(BEARER_IN_TEXT, `$1 ${REDACTED_SECRET}`)
		.replace(KEY_VALUE_IN_TEXT, `$1$2${REDACTED_SECRET}`)
		.replace(CREDENTIAL_SHAPE_IN_TEXT, REDACTED_SECRET);
}

function abbreviatePathsInText(text: string, vaultPath: string | undefined): string {
	return collapseVaultRoot(text, vaultPath)
		.replace(MARKED_PATH_IN_TEXT, (match) => {
			const location = /:\d+(?::\d+)?$/.exec(match)?.[0] ?? "";
			const path = location ? match.slice(0, -location.length) : match;
			return `${abbreviatePath(path, vaultPath)}${location}`;
		})
		.replace(WIKILINK_IN_TEXT, (_match, target: string, heading: string | undefined, alias: string | undefined) => {
			const headingPart = heading ? `#{${stableHash(heading.slice(1))}}` : "";
			const aliasPart = alias ? `|{${stableHash(alias.slice(1))}}` : "";
			return `[[${hashSegments(target)}${headingPart}${aliasPart}]]`;
		})
		.replace(ABSOLUTE_PATH_IN_TEXT, (match) => abbreviatePath(match, vaultPath))
		.replace(NOTE_REF_IN_TEXT, (match) =>
			match.includes("://") && !PATH_MARKER.test(match) ? match : abbreviatePath(match, vaultPath)
		);
}

/** Redact free text — a log message, an error message, a stack trace. */
export function redactText(text: string, options: RedactOptions = {}): string {
	const stripped = stripSecretsFromText(text);
	return options.fullDetail ? stripped : abbreviatePathsInText(stripped, options.vaultPath);
}

// ─── Structured values ───────────────────────────────────────────────────────

function typeDescriptor(value: unknown): string {
	if (value === null) return "[null]";
	if (Array.isArray(value)) return `[array:${value.length}]`;
	if (value instanceof Date) return "[date]";
	if (isPlainObject(value)) return `[object:${Object.keys(value).length}]`;
	return `[${typeof value}]`;
}

interface Walk {
	readonly options: RedactOptions;
	readonly sensitive: ReadonlySet<string>;
	/** Ancestors of the value being walked — cycle detection, not shared-reference detection. */
	readonly ancestors: WeakSet<object>;
}

function redactString(value: string, key: string | undefined, walk: Walk): string {
	const stripped = stripSecretsFromText(value);
	if (walk.options.fullDetail) return stripped;
	if ((key !== undefined && isPathKey(key)) || looksLikePath(stripped)) {
		return abbreviatePath(stripped, walk.options.vaultPath);
	}
	return abbreviatePathsInText(stripped, walk.options.vaultPath);
}

function redactFrontmatter(record: Record<string, unknown>, walk: Walk, depth: number): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(record)) {
		if (isSecretKey(key)) out[key] = REDACTED_SECRET;
		else if (walk.options.fullDetail) out[key] = redactValue(value, key, walk, depth + 1);
		else out[key] = typeDescriptor(value);
	}
	return out;
}

function redactObject(value: object, key: string | undefined, walk: Walk, depth: number): unknown {
	if (value instanceof Error) {
		return {
			name: value.name,
			message: redactText(value.message, walk.options),
			...(value.stack === undefined ? {} : { stack: redactText(value.stack, walk.options) }),
		};
	}
	if (Array.isArray(value)) return value.map((item) => redactValue(item, undefined, walk, depth + 1));
	if (value instanceof Map) return `[map:${value.size}]`;
	if (value instanceof Set) return `[set:${value.size}]`;
	if (!isPlainObject(value)) return `[${Object.prototype.toString.call(value).slice(8, -1)}]`;

	if (key !== undefined && FRONTMATTER_KEY.test(key)) return redactFrontmatter(value, walk, depth);

	const out: Record<string, unknown> = {};
	for (const [childKey, childValue] of Object.entries(value)) {
		out[childKey] = redactValue(childValue, childKey, walk, depth + 1);
	}
	return out;
}

function redactValue(value: unknown, key: string | undefined, walk: Walk, depth: number): unknown {
	if (key !== undefined && isSecretKey(key)) return REDACTED_SECRET;
	if (key !== undefined && !walk.options.fullDetail && walk.sensitive.has(key)) return typeDescriptor(value);

	switch (typeof value) {
		case "string":
			return redactString(value, key, walk);
		case "number":
		case "boolean":
		case "undefined":
			return value;
		case "bigint":
			return value.toString();
		case "function":
			return `[function ${value.name || "anonymous"}]`;
		case "symbol":
			return value.toString();
		default:
			break;
	}
	if (value === null) return null;
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? "[invalid date]" : value.toISOString();
	if (depth > MAX_DEPTH) return "[depth exceeded]";

	const object = value as object;
	if (walk.ancestors.has(object)) return "[circular]";
	walk.ancestors.add(object);
	try {
		return redactObject(object, key, walk, depth);
	} finally {
		walk.ancestors.delete(object);
	}
}

/**
 * Deep-redact any JSON-ish value: log `data`, a debug bundle, a bug-report
 * payload. Returns a new structure — the input is never mutated — shaped for
 * `JSON.stringify` (Errors become `{name, message, stack}`, Dates ISO strings,
 * cycles `"[circular]"`).
 */
export function redact(value: unknown, options: RedactOptions = {}): unknown {
	const walk: Walk = { options, sensitive: new Set(options.sensitiveKeys ?? []), ancestors: new WeakSet() };
	return redactValue(value, undefined, walk, 0);
}

export function redactLogEntry(entry: LogEntry, options: RedactOptions = {}): LogEntry {
	return {
		seq: entry.seq,
		ts: entry.ts,
		level: entry.level,
		scope: entry.scope,
		message: redactText(entry.message, options),
		...(entry.data === undefined ? {} : { data: redact(entry.data, options) }),
	};
}

export function redactLogEntries(entries: readonly LogEntry[], options: RedactOptions = {}): LogEntry[] {
	return entries.map((entry) => redactLogEntry(entry, options));
}

/**
 * The single serializer for content that leaves the process — clipboard, a
 * saved file, a bug-report body. There is deliberately no way to call it
 * without redaction: a surface that wants full detail passes the option, and
 * secrets are still gone. Consumers route every export through this (or
 * {@link redact}) rather than `JSON.stringify`; the contract tests in
 * `shared/tests/core/logging/redact.test.ts` pin the invariants every surface
 * inherits.
 */
export function serializeForExport(value: unknown, options: RedactOptions = {}): string {
	const json: string | undefined = JSON.stringify(redact(value, options), null, 2);
	return json ?? "";
}

/**
 * Emission-time guard used by `LogService` on every append. It traverses
 * JSON-like data for secret keys and credential-shaped string values, but only
 * clones when it finds one; clean log payloads keep the buffer's by-reference
 * fast path. Cycles and shared references are preserved in the scrubbed clone.
 */
export function scrubSecrets<T>(data: T): T {
	const seen = new WeakSet<object>();
	const containsSecret = (value: unknown): boolean => {
		if (typeof value === "string") return stripSecretsFromText(value) !== value;
		if (typeof value !== "object" || value === null) return false;
		if (seen.has(value)) return false;
		seen.add(value);
		if (value instanceof Error) {
			return (
				containsSecret(value.message) ||
				containsSecret(value.stack) ||
				Object.entries(value).some(([key, child]) => isSecretKey(key) || containsSecret(child))
			);
		}
		if (Array.isArray(value)) return value.some(containsSecret);
		if (value instanceof Map) {
			return Array.from(value, ([key, child]) =>
				typeof key === "string" && isSecretKey(key) ? true : containsSecret(key) || containsSecret(child)
			).some(Boolean);
		}
		if (value instanceof Set) return Array.from(value).some(containsSecret);
		if (!isPlainObject(value)) return false;
		return Object.entries(value).some(([key, child]) => isSecretKey(key) || containsSecret(child));
	};

	if (!containsSecret(data)) return data;

	const clones = new WeakMap<object, unknown>();
	const cloneAndScrub = (value: unknown): unknown => {
		if (typeof value === "string") return stripSecretsFromText(value);
		if (typeof value !== "object" || value === null) return value;
		const existing = clones.get(value);
		if (existing !== undefined) return existing;
		if (value instanceof Error) {
			const copy = new Error(stripSecretsFromText(value.message));
			clones.set(value, copy);
			copy.name = value.name;
			if (value.stack !== undefined) copy.stack = stripSecretsFromText(value.stack);
			for (const [key, child] of Object.entries(value)) {
				(copy as unknown as Record<string, unknown>)[key] = isSecretKey(key) ? REDACTED_SECRET : cloneAndScrub(child);
			}
			return copy;
		}
		if (Array.isArray(value)) {
			const copy: unknown[] = [];
			clones.set(value, copy);
			for (const child of value) copy.push(cloneAndScrub(child));
			return copy;
		}
		if (value instanceof Map) {
			const copy = new Map<unknown, unknown>();
			clones.set(value, copy);
			for (const [key, child] of value) {
				copy.set(
					cloneAndScrub(key),
					typeof key === "string" && isSecretKey(key) ? REDACTED_SECRET : cloneAndScrub(child)
				);
			}
			return copy;
		}
		if (value instanceof Set) {
			const copy = new Set<unknown>();
			clones.set(value, copy);
			for (const child of value) copy.add(cloneAndScrub(child));
			return copy;
		}
		if (!isPlainObject(value)) return value;
		const copy: Record<string, unknown> = {};
		clones.set(value, copy);
		for (const [key, child] of Object.entries(value)) {
			copy[key] = isSecretKey(key) ? REDACTED_SECRET : cloneAndScrub(child);
		}
		return copy;
	};

	return cloneAndScrub(data) as T;
}
