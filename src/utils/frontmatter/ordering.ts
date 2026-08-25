import {
	enforcePropertyOrder,
	mergePropertyOrder,
	resolveOrderedPropertyNames,
	toSafeString,
	withFrontmatter,
} from "@real1ty/obsidian-plugins";
import type { App, TFile } from "obsidian";

import type { Frontmatter, SingleCalendarConfig } from "../../types";
import { DEFAULT_PROPERTY_ORDER } from "../../types/event-metadata";

/**
 * Resolves the calendar's configured property order (settings keys, merged with the
 * semantic default for forward compatibility) to actual frontmatter property names.
 */
export const getOrderedPropertyNames = (settings: SingleCalendarConfig): string[] =>
	resolveOrderedPropertyNames(
		mergePropertyOrder(settings.propertyOrder, DEFAULT_PROPERTY_ORDER),
		(key) => toSafeString(settings[key as keyof SingleCalendarConfig]) ?? undefined
	);

/**
 * Regroups Prisma-owned keys of `fm` into the configured deterministic order
 * (foreign keys untouched). Returns true when the key order changed.
 */
export const enforceEventPropertyOrder = (fm: Frontmatter, settings: SingleCalendarConfig): boolean =>
	enforcePropertyOrder(fm, getOrderedPropertyNames(settings));

/**
 * The frontmatter-write choke point for event files: every Prisma write flows through
 * here (or through the VaultTable `propertyOrder` hook) so each flush also converges
 * the file to the deterministic property order. Writing without ordering is what let
 * replicas diverge and LiveSync conflict — don't call `processFrontMatter` directly
 * for event files. See [[decision-deterministic-property-ordering]].
 */
export const withOrderedFrontmatter = async (
	app: App,
	file: TFile,
	settings: SingleCalendarConfig,
	mutate: (fm: Frontmatter) => void
): Promise<void> =>
	withFrontmatter(app, file, (fm) => {
		mutate(fm);
		enforceEventPropertyOrder(fm, settings);
	});
