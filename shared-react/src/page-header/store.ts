import {
	appearanceOverridden,
	loadAppearanceOverrides,
	resolveAppearance,
	setAppearanceOverride,
	writeAppearanceOverrides,
	type Appearance,
	type AppearanceAxis,
	type AppearanceOverridden,
	type AppearanceOverrides,
} from "../utils/appearance";
import { moveItem, reorderList } from "../utils/list-reorder";
import { loadStringRecord, nonEmptyRecord, setOrDelete } from "../utils/string-record";
import type { HeaderActionDefinition, PageHeaderState } from "./types";

export interface PageHeaderSnapshot {
	visibleActions: HeaderActionDefinition[];
	renames: Readonly<Record<string, string>>;
	appearance: AppearanceOverrides;
	showSettingsButton: boolean;
}

interface ResolvedInitial {
	visibleActions: HeaderActionDefinition[];
	renames: Record<string, string>;
	appearance: AppearanceOverrides;
	showSettingsButton: boolean;
}

function resolveState(allActions: HeaderActionDefinition[], state?: PageHeaderState): ResolvedInitial {
	const showSettingsButton = state?.showSettingsButton !== false;

	let visibleActions = allActions;
	if (state?.visibleActionIds) {
		const actionMap = new Map(allActions.map((a) => [a.id, a]));
		const visible = state.visibleActionIds
			.map((id) => actionMap.get(id))
			.filter((a): a is HeaderActionDefinition => a !== undefined);
		if (visible.length > 0) visibleActions = visible;
	}

	return {
		visibleActions: [...visibleActions],
		renames: loadStringRecord(state?.renames),
		appearance: loadAppearanceOverrides(state),
		showSettingsButton,
	};
}

export class PageHeaderStore {
	private snapshot: PageHeaderSnapshot;
	private readonly listeners = new Set<() => void>();
	private readonly defaultOrder: string[];
	private readonly defaults: PageHeaderState | undefined;
	private renames: Record<string, string>;
	private appearance: AppearanceOverrides;
	private visibleActions: HeaderActionDefinition[];
	private showSettingsButton: boolean;

	constructor(
		private readonly allActions: HeaderActionDefinition[],
		currentState?: PageHeaderState,
		defaults?: PageHeaderState
	) {
		const resolved = resolveState(allActions, currentState ?? defaults);
		this.visibleActions = resolved.visibleActions;
		this.renames = resolved.renames;
		this.appearance = resolved.appearance;
		this.showSettingsButton = resolved.showSettingsButton;
		this.defaultOrder = allActions.map((a) => a.id);
		this.defaults = defaults;
		this.snapshot = this.buildSnapshot();
	}

	private buildSnapshot(): PageHeaderSnapshot {
		return {
			visibleActions: this.visibleActions,
			renames: this.renames,
			appearance: this.appearance,
			showSettingsButton: this.showSettingsButton,
		};
	}

	private notify(): void {
		this.snapshot = this.buildSnapshot();
		for (const listener of this.listeners) listener();
	}

	getValue(): PageHeaderSnapshot {
		return this.snapshot;
	}

	subscribe(listener: () => void): { unsubscribe(): void } {
		this.listeners.add(listener);
		return { unsubscribe: () => this.listeners.delete(listener) };
	}

	getAllActions(): readonly HeaderActionDefinition[] {
		return this.allActions;
	}

	get visibleCount(): number {
		return this.visibleActions.length;
	}

	getLabel(action: HeaderActionDefinition): string {
		return this.snapshot.renames[action.id] ?? action.label;
	}

	/** The action as it renders: overrides applied over the definition's own defaults. */
	getAppearance(action: HeaderActionDefinition): Appearance {
		return resolveAppearance(action, this.snapshot.appearance, action.id);
	}

	getOverridden(id: string): AppearanceOverridden {
		return appearanceOverridden(this.snapshot.appearance, id);
	}

	hideAction(id: string): boolean {
		if (this.visibleActions.length <= 1) return false;
		const next = this.visibleActions.filter((a) => a.id !== id);
		if (next.length === this.visibleActions.length) return false;
		this.visibleActions = next;
		this.notify();
		return true;
	}

	restoreAction(id: string): boolean {
		const action = this.allActions.find((a) => a.id === id);
		if (!action || this.visibleActions.find((a) => a.id === id)) return false;
		this.visibleActions = [...this.visibleActions, action];
		this.notify();
		return true;
	}

	moveAction(id: string, direction: -1 | 1): boolean {
		const updated = moveItem(this.visibleActions, id, direction);
		if (updated === this.visibleActions) return false;
		this.visibleActions = updated;
		this.notify();
		return true;
	}

	reorderActions(fromId: string, toId: string): boolean {
		if (fromId === toId) return false;
		const updated = reorderList(this.visibleActions, fromId, toId);
		if (updated === this.visibleActions) return false;
		this.visibleActions = updated;
		this.notify();
		return true;
	}

	setRename(id: string, label: string | undefined): void {
		const action = this.allActions.find((a) => a.id === id);
		const shouldClear = label === undefined || action?.label === label;
		if (shouldClear && !(id in this.renames)) return;
		if (!shouldClear && this.renames[id] === label) return;
		this.renames = setOrDelete(this.renames, id, shouldClear ? undefined : label);
		this.notify();
	}

	setAppearanceOverride(id: string, axis: AppearanceAxis, value: string | undefined): void {
		const action = this.allActions.find((a) => a.id === id);
		const next = setAppearanceOverride(this.appearance, axis, id, value, action);
		if (!next) return;
		this.appearance = next;
		this.notify();
	}

	setShowSettingsButton(visible: boolean): void {
		if (this.showSettingsButton === visible) return;
		this.showSettingsButton = visible;
		this.notify();
	}

	resetToDefaults(): void {
		const resolved = resolveState(this.allActions, this.defaults);
		this.visibleActions = resolved.visibleActions;
		this.renames = resolved.renames;
		this.appearance = resolved.appearance;
		this.showSettingsButton = resolved.showSettingsButton;
		this.notify();
	}

	serialize(): PageHeaderState {
		const state: PageHeaderState = {};

		const renames = nonEmptyRecord(this.renames);
		if (renames) state.renames = renames;
		writeAppearanceOverrides(state, this.appearance);

		const currentOrder = this.visibleActions.map((a) => a.id);
		const orderChanged =
			currentOrder.length !== this.defaultOrder.length || currentOrder.some((id, i) => id !== this.defaultOrder[i]);
		if (orderChanged) state.visibleActionIds = currentOrder;

		if (!this.showSettingsButton) state.showSettingsButton = false;

		return state;
	}
}
