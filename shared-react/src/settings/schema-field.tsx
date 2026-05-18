import { introspectField, type SchemaFieldDescriptor } from "@real1ty-obsidian-plugins";
import { memo, useMemo } from "react";

import { useSchemaField, type SettingsStorelike } from "../hooks/settings/use-schema-field";
import { SettingItem } from "../primitives/layout/setting-item";
import { testIdProp } from "../utils/test-id";
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
	/** When set, stamps `data-testid` on the outer `.setting-item` for E2E. */
	testId?: string | undefined;
	controlTestId?: string;
}

export const SchemaField = memo(function SchemaField({
	store,
	descriptor,
	path,
	override,
	testId,
	controlTestId,
}: SchemaFieldProps) {
	const resolvedPath = path ?? descriptor.key;
	const binding = useSchemaField<unknown>(store, resolvedPath);

	if (override?.hidden) return null;

	const label = override?.label ?? descriptor.label;
	const description = override?.description ?? descriptor.description;

	if (override?.render) {
		return (
			<SettingItem name={label} description={description} {...testIdProp(testId)}>
				{override.render({ value: binding.value, onChange: binding.onChange, descriptor })}
			</SettingItem>
		);
	}

	const widgetKind = resolveWidget(descriptor, override);
	const Widget = BUILTIN_WIDGETS[widgetKind] ?? TextWidget;

	return (
		<SettingItem name={label} description={description} {...testIdProp(testId)}>
			<Widget descriptor={descriptor} override={override} binding={binding} testId={controlTestId} />
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
