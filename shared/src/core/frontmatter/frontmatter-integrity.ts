import { isMap, isNode, isScalar, parseDocument, type Document } from "yaml";

import type { Frontmatter } from "./frontmatter-diff";
import { stringifyFrontmatterYaml } from "./frontmatter-serialization";
import { enforcePropertyOrder } from "./property-order";

/**
 * Duplicate-key repair for a note's frontmatter. A note is a row and its
 * properties are columns, so a key appearing twice is a corrupt row: Obsidian's
 * metadata cache drops the whole block and every `processFrontMatter` throws
 * "Map keys must be unique". External text merges (editor reloads, sync tools)
 * produce it; nothing here can prevent them, so the table repairs on contact.
 * See [[decision-vaulttable-frontmatter-integrity]].
 */

const FRONTMATTER_BLOCK = /^---(\r?\n)([\s\S]*?)\r?\n---[^\S\r\n]*(?=\r?\n|$)/;

export interface DuplicateKeyReport {
	key: string;
	occurrences: number;
	/** Non-empty values that lost to a later non-empty one — real data the repair discarded. */
	droppedValues: unknown[];
}

export interface FrontmatterRepairResult {
	content: string;
	repaired: boolean;
	duplicates: DuplicateKeyReport[];
}

export interface FrontmatterRepairOptions {
	/** Owned property names, in canonical order — applied to the repaired block. */
	propertyOrder?: readonly string[];
}

interface ParsedPairs {
	pairs: Array<{ key: string; value: unknown }>;
	hasDuplicates: boolean;
}

function isEmptyValue(value: unknown): boolean {
	if (value === null || value === undefined) return true;
	if (typeof value === "string") return value.trim() === "";
	if (Array.isArray(value)) return value.length === 0;
	return false;
}

function readPairs(yamlBlock: string): ParsedPairs | null {
	const doc: Document = parseDocument(yamlBlock, { uniqueKeys: false });
	if (doc.errors.length > 0 || !isMap(doc.contents)) return null;

	const pairs: ParsedPairs["pairs"] = [];
	const seen = new Set<string>();
	let hasDuplicates = false;
	for (const pair of doc.contents.items) {
		const key = String(isScalar(pair.key) ? pair.key.value : pair.key);
		const value: unknown = isNode(pair.value) ? pair.value.toJS(doc) : pair.value;
		if (seen.has(key)) hasDuplicates = true;
		seen.add(key);
		pairs.push({ key, value });
	}
	return { pairs, hasDuplicates };
}

function collapse(pairs: ParsedPairs["pairs"]): { frontmatter: Frontmatter; duplicates: DuplicateKeyReport[] } {
	const byKey = new Map<string, unknown[]>();
	for (const { key, value } of pairs) {
		const values = byKey.get(key);
		if (values) values.push(value);
		else byKey.set(key, [value]);
	}

	const frontmatter: Frontmatter = {};
	const duplicates: DuplicateKeyReport[] = [];
	for (const [key, values] of byKey) {
		const nonEmpty = values.filter((value) => !isEmptyValue(value));
		if (nonEmpty.length > 0) {
			frontmatter[key] = nonEmpty[nonEmpty.length - 1];
		} else {
			// Prefer an explicit "" over null so a property the user cleared stays visible as one.
			frontmatter[key] = values.some((value) => value === "") ? "" : (values[values.length - 1] ?? null);
		}
		if (values.length > 1) {
			duplicates.push({ key, occurrences: values.length, droppedValues: nonEmpty.slice(0, -1) });
		}
	}
	return { frontmatter, duplicates };
}

/** Cheap check for whether {@link repairDuplicateFrontmatterKeys} would change `content`. */
export function hasDuplicateFrontmatterKeys(content: string): boolean {
	const match = FRONTMATTER_BLOCK.exec(content);
	if (!match) return false;
	return readPairs(match[2])?.hasDuplicates ?? false;
}

/**
 * Collapses every duplicated frontmatter key to its last non-empty value (an
 * empty value when every copy is empty), keeping each key at its first position
 * and then applying `propertyOrder`. Only the frontmatter block is rewritten; the
 * body is kept byte for byte. Input with no duplicates — clean, absent, or broken
 * by some other YAML error — is returned unchanged.
 *
 * A pure function of the bytes, so two synced devices that repair the same note
 * independently write identical content
 * ([[decision-deterministic-automatic-writes-across-synced-devices]]).
 */
export function repairDuplicateFrontmatterKeys(
	content: string,
	options: FrontmatterRepairOptions = {}
): FrontmatterRepairResult {
	const unchanged: FrontmatterRepairResult = { content, repaired: false, duplicates: [] };
	const match = FRONTMATTER_BLOCK.exec(content);
	if (!match) return unchanged;

	const parsed = readPairs(match[2]);
	if (!parsed?.hasDuplicates) return unchanged;

	const { frontmatter, duplicates } = collapse(parsed.pairs);
	if (options.propertyOrder && options.propertyOrder.length > 0) {
		enforcePropertyOrder(frontmatter, options.propertyOrder);
	}

	const newline = match[1];
	const yaml = stringifyFrontmatterYaml(frontmatter).split("\n").join(newline);
	const block = `---${newline}${yaml}${newline}---`;
	return { content: block + content.slice(match[0].length), repaired: true, duplicates };
}
