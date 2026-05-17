import type { Command } from "@real1ty-obsidian-plugins";

import type { SingleCalendarConfig } from "../../types";
import type { CalendarSettingsStore } from "../settings-store";

type ColorRules = SingleCalendarConfig["colorRules"];

/**
 * Undoable mutation of the `colorRules` settings slice.
 *
 * Snapshots the rules array on first {@link execute} so {@link undo} can
 * restore the exact pre-mutation list (id order included). Wrapped into the
 * category rename / delete macros so the color rule that targets a category
 * stays coherent with the on-disk frontmatter through undo / redo: renaming
 * `"Work"` → `"Office"` also rewrites the matching `Category.includes('Work')`
 * rule, and undoing the file rewrites puts the original rule back.
 */
export class UpdateColorRulesCommand implements Command {
	private snapshot: ColorRules | null = null;

	constructor(
		private settingsStore: CalendarSettingsStore,
		private transform: (rules: ColorRules) => ColorRules,
		private type: string
	) {}

	async execute(): Promise<void> {
		if (this.snapshot === null) {
			this.snapshot = [...this.settingsStore.currentSettings.colorRules];
		}
		await this.settingsStore.updateSettings((s) => ({ ...s, colorRules: this.transform(s.colorRules) }));
	}

	async undo(): Promise<void> {
		if (this.snapshot === null) return;
		const restored = this.snapshot;
		await this.settingsStore.updateSettings((s) => ({ ...s, colorRules: restored }));
	}

	getType(): string {
		return this.type;
	}

	canUndo(): boolean {
		return this.snapshot !== null;
	}
}
