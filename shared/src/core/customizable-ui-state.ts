import { z } from "zod";

const optionalStringRecord = z.record(z.string(), z.string()).optional().catch(undefined);

/**
 * Shared base schema for customizable UI component state (page headers, context menus, etc.).
 * Provides common persistence fields: renames, icon/color overrides, and settings button visibility.
 * Extend with `.extend()` to add module-specific fields like `visibleActionIds` or `sectionOverrides`.
 */
export const CustomizableUIBaseStateSchema = z.object({
	renames: optionalStringRecord,
	iconOverrides: optionalStringRecord,
	colorOverrides: optionalStringRecord,
	showSettingsButton: z.boolean().optional().catch(undefined),
});

export type CustomizableUIBaseState = z.infer<typeof CustomizableUIBaseStateSchema>;
