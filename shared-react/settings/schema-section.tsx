import type { SchemaFieldDescriptor } from "@real1ty-obsidian-plugins";
import { introspectShape } from "@real1ty-obsidian-plugins";
import { memo, useMemo } from "react";
import type { ZodRawShape } from "zod";

import { SettingHeading } from "../components/setting-item";
import type { SettingsStorelike } from "../hooks/use-schema-field";
import type { SchemaFieldOverride } from "./override";
import { SchemaField } from "./schema-field";

interface SchemaSectionProps {
	store: SettingsStorelike;
	shape: ZodRawShape;
	/** Heading rendered above the fields. Omit for no heading. */
	heading?: string;
	/**
	 * Explicit field order / subset. Defaults to every key in `shape`.
	 * Fields listed here that aren't in the shape are ignored silently.
	 */
	fields?: string[];
	/** Per-field overrides, keyed by field name. */
	overrides?: Record<string, SchemaFieldOverride>;
	/**
	 * Dotted path prefix when the shape lives under a nested key in the store
	 * (e.g. "basesView" when `shape` is `BasesViewSchema.shape` under the
	 * `basesView` key of the root settings object).
	 */
	pathPrefix?: string;
	/**
	 * Bulk-transform auto-derived labels. Applied when the explicit override
	 * doesn't supply a label.
	 */
	labelTransform?: (descriptor: SchemaFieldDescriptor) => string;
}

export const SchemaSection = memo(function SchemaSection({
	store,
	shape,
	heading,
	fields,
	overrides,
	pathPrefix,
	labelTransform,
}: SchemaSectionProps) {
	const descriptors = useMemo(() => {
		const all = introspectShape(shape);
		if (!fields) return all;
		const byKey = new Map(all.map((d) => [d.key, d]));
		return fields.map((k) => byKey.get(k)).filter((d): d is SchemaFieldDescriptor => d !== undefined);
	}, [shape, fields]);

	return (
		<>
			{heading && <SettingHeading name={heading} />}
			{descriptors.map((descriptor) => {
				const explicit = overrides?.[descriptor.key];
				if (explicit?.hidden) return null;

				const wantsTransform = explicit?.label === undefined && labelTransform !== undefined;
				const finalOverride: SchemaFieldOverride | undefined = wantsTransform
					? { ...explicit, label: labelTransform(descriptor) }
					: explicit;

				const path = pathPrefix ? `${pathPrefix}.${descriptor.key}` : descriptor.key;
				return (
					<SchemaField
						key={descriptor.key}
						store={store}
						descriptor={descriptor}
						path={path}
						{...(finalOverride ? { override: finalOverride } : {})}
					/>
				);
			})}
		</>
	);
});
