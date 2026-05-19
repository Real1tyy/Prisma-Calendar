import { moveItem, reorderList } from "../utils/list-reorder";
import { loadStringRecord, nonEmptyRecord, setOrDelete } from "../utils/string-record";
import type { HeaderActionDefinition, PageHeaderState } from "./types";

export interface PageHeaderSnapshot {
	visibleActions: HeaderActionDefinition[];
	renames: Readonly<Record<string, string>>;
	iconOverrides: Readonly<Record<string, string>>;
	colorOverrides: Readonly<Record<string, string>>;
	showSettingsButton: boolean;
}

interface ResolvedInitial {
	visibleActions: HeaderActionDefinition[];
	renames: Record<string, string>;
	iconOverrides: Record<string, string>;
	colorOverrides: Record<string, string>;
	showSettingsButton: boolean;
}

function resolveState(allActions: HeaderActionDefinition[], state?: PageHeaderState): ResolvedInitial {
	const renames = loadStringRecord(state?.renames);
	const iconOverrides = loadStringRecord(state?.iconOverrides);
	const colorOverrides = loadStringRecord(state?.colorOverrides);
	const showSettingsButton = state?.showSettingsButton !== false;

	let visibleActions = allActions;
	if (state?.visibleActionIds) {
		const actionMap = new Map(allActions.map((a) => [a.id, a]));
		const visible = state.visibleActionIds
			.map((id) => actionMap.get(id))
			.filter((a): a is HeaderActionDefinition => a !== undefined);
		if (visible.length > 0) visibleActions = visible;
	}

	return { visibleActions: [...visibleActions], renames, iconOverrides, colorOverrides, showSettingsButton };
}

export class PageHeaderStore {
	private snapshot: PageHeaderSnapshot;
	private readonly listeners = new Set<() => void>();
	private readonly defaultOrder: string[];
	private readonly defaults: PageHeaderState | undefined;
	private renames: Record<string, string>;
	private iconOverrides: Record<string, string>;
	private colorOverrides: Record<string, string>;
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
		this.iconOverrides = resolved.iconOverrides;
		this.colorOverrides = resolved.colorOverrides;
		this.showSettingsButton = resolved.showSettingsButton;
		this.defaultOrder = allActions.map((a) => a.id);
		this.defaults = defaults;
		this.snapshot = this.buildSnapshot();
	}

	private buildSnapshot(): PageHeaderSnapshot {
		return {
			visibleActions: this.visibleActions,
			renames: this.renames,
			iconOverrides: this.iconOverrides,
			colorOverrides: this.colorOverrides,
			showSettingsButton: this.showSettingsButton,
		};
	}

	private notify(): void {
		this.snapshot = this.buildSnapshot();
		for (const listener of this.listeners) listener();
	}

	private applyOverride(
		current: Record<string, string>,
		id: string,
		value: string | undefined,
		matchesDefault: (value: string) => boolean
	): Record<string, string> | null {
		const shouldClear = value === undefined || matchesDefault(value);
		if (shouldClear) {
			if (!(id in current)) return null;
			return setOrDelete(current, id, undefined);
		}
		if (current[id] === value) return null;
		return setOrDelete(current, id, value);
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
		const next = this.applyOverride(this.renames, id, label, (v) => action?.label === v);
		if (!next) return;
		this.renames = next;
		this.notify();
	}

	setIconOverride(id: string, icon: string | undefined): void {
		const action = this.allActions.find((a) => a.id === id);
		const next = this.applyOverride(this.iconOverrides, id, icon, (v) => action?.icon === v);
		if (!next) return;
		this.iconOverrides = next;
		this.notify();
	}

	setColorOverride(id: string, color: string | undefined): void {
		const next = this.applyOverride(this.colorOverrides, id, color, () => false);
		if (!next) return;
		this.colorOverrides = next;
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
		this.iconOverrides = resolved.iconOverrides;
		this.colorOverrides = resolved.colorOverrides;
		this.showSettingsButton = resolved.showSettingsButton;
		this.notify();
	}

	serialize(): PageHeaderState {
		const state: PageHeaderState = {};

		const renamesOut = nonEmptyRecord(this.renames);
		if (renamesOut) state.renames = renamesOut;
		const iconsOut = nonEmptyRecord(this.iconOverrides);
		if (iconsOut) state.iconOverrides = iconsOut;
		const colorsOut = nonEmptyRecord(this.colorOverrides);
		if (colorsOut) state.colorOverrides = colorsOut;

		const currentOrder = this.visibleActions.map((a) => a.id);
		const orderChanged =
			currentOrder.length !== this.defaultOrder.length || currentOrder.some((id, i) => id !== this.defaultOrder[i]);
		if (orderChanged) state.visibleActionIds = currentOrder;

		if (!this.showSettingsButton) state.showSettingsButton = false;

		return state;
	}
}
