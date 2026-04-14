import type { SchemaFieldDescriptor } from "@real1ty-obsidian-plugins";
import { introspectField } from "@real1ty-obsidian-plugins";
import { memo, useMemo } from "react";

import { SettingItem } from "../components/setting-item";
import type { SettingsStorelike } from "../hooks/use-schema-field";
import { useSchemaField } from "../hooks/use-schema-field";
import type { SchemaFieldOverride } from "./override";
import { resolveWidget } from "./resolve-widget";
import { BUILTIN_WIDGETS, TextWidget } from "./widgets";

export type { SchemaFieldOverride } from "./override";

interface SchemaFieldProps {
	store: SettingsStorelike;
	descriptor: SchemaFieldDescriptor;
	/** Dotted path into the store root. Defaults to descriptor.key. */
	path?: string;
	override?: SchemaFieldOverride;
}

export const SchemaField = memo(function SchemaField({ store, descriptor, path, override }: SchemaFieldProps) {
	const resolvedPath = path ?? descriptor.key;
	const binding = useSchemaField<unknown>(store, resolvedPath);

	if (override?.hidden) return null;

	const label = override?.label ?? descriptor.label;
	const description = override?.description ?? descriptor.description;

	if (override?.render) {
		return (
			<SettingItem name={label} description={description}>
				{override.render({ ...binding, descriptor })}
			</SettingItem>
		);
	}

	const widgetKind = resolveWidget(descriptor, override);
	const Widget = BUILTIN_WIDGETS[widgetKind] ?? TextWidget;

	return (
		<SettingItem name={label} description={description}>
			<Widget descriptor={descriptor} override={override} binding={binding} />
		</SettingItem>
	);
});

/**
 * Headless helper: introspect a single Zod field and memoize its descriptor.
 * Use when you want to render a field explicitly without a section wrapper.
 */
export function useSchemaFieldDescriptor(key: string, field: unknown): SchemaFieldDescriptor {
	return useMemo(() => introspectField(key, field as never), [key, field]);
}
