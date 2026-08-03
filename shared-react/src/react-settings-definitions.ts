import type { SettingDefinitionItem } from "obsidian";

/**
 * Build the `getSettingDefinitions()` payload for a settings tab whose body is a
 * React tree rather than a list of individually bindable controls.
 *
 * Obsidian 1.13 calls `getSettingDefinitions()` and skips `display()` entirely,
 * so a tab that only implements `display()` renders blank there. Our settings are
 * a single React root — there are no per-key controls for Obsidian to bind — so
 * the whole tree rides in one imperative `render` row: the placeholder row
 * Obsidian created is dropped and the tree mounts into the group's list element
 * instead, which is the full width of the tab. The unmount function becomes the
 * row's cleanup, which Obsidian invokes before tearing the row down.
 *
 * `searchable: false` is deliberate rather than an oversight. The entry carries
 * no per-setting text, so indexing it would put one opaque hit in settings search
 * instead of anything a user could act on. Field-level search needs the settings
 * to be expressed as `control` definitions, which is a separate migration.
 */
export function reactSettingDefinitions(
	name: string,
	mount: (containerEl: HTMLElement) => () => void
): SettingDefinitionItem[] {
	return [
		{
			name,
			searchable: false,
			render: (setting, group) => {
				setting.settingEl.remove();
				return mount(group.listEl.createDiv());
			},
		},
	];
}
