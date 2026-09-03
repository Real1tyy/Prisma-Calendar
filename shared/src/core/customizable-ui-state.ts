import { z } from "zod";

const optionalStringRecord = z.record(z.string(), z.string()).optional().catch(undefined);

/**
 * Shared base schema for customizable UI component state (page headers, context menus, etc.).
 * Provides common persistence fields: renames, icon overrides, icon-colour overrides,
 * text-colour overrides, and settings button visibility.
 * Extend with `.extend()` to add module-specific fields like `visibleActionIds` or `sectionOverrides`.
 *
 * `colorOverrides` tints the icon; `textColorOverrides` tints the label text. An icon
 * override of the empty string is a deliberate "no icon" — distinct from an absent key,
 * which means "use the item's default icon".
 */
export const CustomizableUIBaseStateSchema = z.object({
	renames: optionalStringRecord,
	iconOverrides: optionalStringRecord,
	colorOverrides: optionalStringRecord,
	textColorOverrides: optionalStringRecord,
	backgroundColorOverrides: optionalStringRecord,
	showSettingsButton: z.boolean().optional().catch(undefined),
});

export type CustomizableUIBaseState = z.infer<typeof CustomizableUIBaseStateSchema>;
