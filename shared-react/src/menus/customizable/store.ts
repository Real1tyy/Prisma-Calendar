import type { ContextMenuState, CustomizableContextMenuItem } from "./types";

const DEFAULT_SECTION = "";

export interface CustomizableMenuSnapshot {
	visibleItems: CustomizableContextMenuItem[];
	renames: ReadonlyMap<string, string>;
	iconOverrides: ReadonlyMap<string, string>;
	colorOverrides: ReadonlyMap<string, string>;
	sectionOverrides: ReadonlyMap<string, string>;
	showSettingsButton: boolean;
}

export interface CustomizableMenuStoreOptions {
	allItems: CustomizableContextMenuItem[];
	/** Persisted user customizations (from settings). When omitted, the store starts from `defaults`. */
	currentState?: ContextMenuState | undefined;
	/** Factory defaults applied by the item manager's Reset button and used as the initial state when `currentState` is omitted. */
	defaults?: ContextMenuState | undefined;
	onStateChange?: ((state: ContextMenuState) => void) | undefined;
}

/**
 * Pure state store for the customizable context menu. Holds visibility, ordering,
 * and per-item override state for renames, icons, colors, and sections. Emits a
 * serializable {@link ContextMenuState} via `onStateChange` whenever the state
 * mutates — consumers persist this in plugin settings.
 */
export class CustomizableMenuStore {
	private readonly allItems: CustomizableContextMenuItem[];
	private readonly defaultOrder: string[];
	private readonly defaults: ContextMenuState | undefined;
	private readonly onStateChange?: (state: ContextMenuState) => void;
	private readonly listeners = new Set<() => void>();

	private snapshot: CustomizableMenuSnapshot;

	constructor(options: CustomizableMenuStoreOptions) {
		this.allItems = options.allItems;
		this.defaultOrder = options.allItems.map((i) => i.id);
		this.defaults = options.defaults;
		if (options.onStateChange) this.onStateChange = options.onStateChange;
		this.snapshot = this.buildInitialSnapshot(options.currentState ?? options.defaults);
	}

	getSnapshot = (): CustomizableMenuSnapshot => this.snapshot;

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	getAllItems(): readonly CustomizableContextMenuItem[] {
		return this.allItems;
	}

	getSection = (item: CustomizableContextMenuItem): string => {
		return this.snapshot.sectionOverrides.get(item.id) ?? item.section ?? DEFAULT_SECTION;
	};

	getLabel = (item: CustomizableContextMenuItem): string => {
		return this.snapshot.renames.get(item.id) ?? item.label;
	};

	getIcon = (item: CustomizableContextMenuItem): string | undefined => {
		return this.snapshot.iconOverrides.get(item.id) ?? item.icon;
	};

	getColor = (item: CustomizableContextMenuItem): string | undefined => {
		return this.snapshot.colorOverrides.get(item.id) ?? item.color;
	};

	get visibleCount(): number {
		return this.snapshot.visibleItems.length;
	}

	// ─── Serialization ────────────────────────────────────────────

	getState = (): ContextMenuState => {
		const { renames, iconOverrides, colorOverrides, sectionOverrides, showSettingsButton, visibleItems } =
			this.snapshot;
		const state: ContextMenuState = {};

		if (renames.size > 0) state.renames = Object.fromEntries(renames);
		if (iconOverrides.size > 0) state.iconOverrides = Object.fromEntries(iconOverrides);
		if (colorOverrides.size > 0) state.colorOverrides = Object.fromEntries(colorOverrides);
		if (sectionOverrides.size > 0) state.sectionOverrides = Object.fromEntries(sectionOverrides);

		const currentOrder = visibleItems.map((i) => i.id);
		if (currentOrder.length !== this.defaultOrder.length || currentOrder.some((id, i) => id !== this.defaultOrder[i])) {
			state.visibleItemIds = currentOrder;
		}

		if (!showSettingsButton) state.showSettingsButton = false;

		return state;
	};

	// ─── Mutations ────────────────────────────────────────────────

	hideItem = (id: string): void => {
		const { visibleItems } = this.snapshot;
		if (visibleItems.length <= 1) return;
		if (!visibleItems.some((i) => i.id === id)) return;

		this.update({ visibleItems: visibleItems.filter((i) => i.id !== id) });
	};

	restoreItem = (id: string): void => {
		const item = this.allItems.find((i) => i.id === id);
		if (!item) return;
		const { visibleItems } = this.snapshot;
		if (visibleItems.some((i) => i.id === id)) return;

		const section = this.getSection(item);
		const insertIdx = this.findEndOfSectionIndex(visibleItems, section);
		const next =
			insertIdx >= 0
				? [...visibleItems.slice(0, insertIdx), item, ...visibleItems.slice(insertIdx)]
				: [...visibleItems, item];

		this.update({ visibleItems: next });
	};

	moveItem = (id: string, direction: -1 | 1): void => {
		const { visibleItems } = this.snapshot;
		const idx = visibleItems.findIndex((i) => i.id === id);
		if (idx < 0) return;

		const item = visibleItems[idx];
		const section = this.getSection(item);

		const sectionItems = visibleItems.filter((i) => this.getSection(i) === section);
		const posInSection = sectionItems.indexOf(item);
		const newPosInSection = posInSection + direction;
		if (newPosInSection < 0 || newPosInSection >= sectionItems.length) return;

		const swapTarget = sectionItems[newPosInSection];
		const swapIdx = visibleItems.indexOf(swapTarget);

		const next = [...visibleItems];
		[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];

		this.update({ visibleItems: next });
	};

	moveItemToSection = (id: string, targetSection: string, insertBeforeId?: string): void => {
		const { visibleItems, sectionOverrides } = this.snapshot;
		const itemIdx = visibleItems.findIndex((i) => i.id === id);
		if (itemIdx < 0) return;

		const item = visibleItems[itemIdx];
		const currentSection = this.getSection(item);
		if (currentSection === targetSection && !insertBeforeId) return;

		const nextOverrides = new Map(sectionOverrides);
		const defaultSection = item.section ?? DEFAULT_SECTION;
		if (targetSection !== defaultSection) {
			nextOverrides.set(id, targetSection);
		} else {
			nextOverrides.delete(id);
		}

		const withoutItem = visibleItems.filter((i) => i.id !== id);
		let nextVisibleItems: CustomizableContextMenuItem[];

		if (insertBeforeId) {
			const insertIdx = withoutItem.findIndex((i) => i.id === insertBeforeId);
			nextVisibleItems =
				insertIdx >= 0
					? [...withoutItem.slice(0, insertIdx), item, ...withoutItem.slice(insertIdx)]
					: [...withoutItem, item];
		} else {
			const tempSnapshot = { ...this.snapshot, sectionOverrides: nextOverrides };
			const insertIdx = this.findEndOfSectionIndex(withoutItem, targetSection, tempSnapshot.sectionOverrides);
			nextVisibleItems =
				insertIdx >= 0
					? [...withoutItem.slice(0, insertIdx), item, ...withoutItem.slice(insertIdx)]
					: [...withoutItem, item];
		}

		this.update({ visibleItems: nextVisibleItems, sectionOverrides: nextOverrides });
	};

	setRename = (id: string, label: string | undefined): void => {
		const item = this.allItems.find((i) => i.id === id);
		if (!item) return;

		const next = new Map(this.snapshot.renames);
		if (label && label !== item.label) {
			next.set(id, label);
		} else {
			next.delete(id);
		}

		this.update({ renames: next });
	};

	setIcon = (id: string, icon: string | undefined): void => {
		const item = this.allItems.find((i) => i.id === id);
		if (!item) return;

		const next = new Map(this.snapshot.iconOverrides);
		if (icon && icon !== item.icon) {
			next.set(id, icon);
		} else {
			next.delete(id);
		}

		this.update({ iconOverrides: next });
	};

	setColor = (id: string, color: string | undefined): void => {
		const next = new Map(this.snapshot.colorOverrides);
		if (color) {
			next.set(id, color);
		} else {
			next.delete(id);
		}

		this.update({ colorOverrides: next });
	};

	setShowSettingsButton = (visible: boolean): void => {
		if (this.snapshot.showSettingsButton === visible) return;
		this.update({ showSettingsButton: visible });
	};

	resetToDefaults = (): void => {
		this.update(this.buildInitialSnapshot(this.defaults));
	};

	// ─── Internals ────────────────────────────────────────────────

	private buildInitialSnapshot(initialState?: ContextMenuState): CustomizableMenuSnapshot {
		const renames = new Map(initialState?.renames ? Object.entries(initialState.renames) : []);
		const iconOverrides = new Map(initialState?.iconOverrides ? Object.entries(initialState.iconOverrides) : []);
		const colorOverrides = new Map(initialState?.colorOverrides ? Object.entries(initialState.colorOverrides) : []);
		const sectionOverrides = new Map(
			initialState?.sectionOverrides ? Object.entries(initialState.sectionOverrides) : []
		);
		const showSettingsButton = initialState?.showSettingsButton !== false;

		let visibleItems: CustomizableContextMenuItem[];
		if (initialState?.visibleItemIds) {
			const itemMap = new Map(this.allItems.map((i) => [i.id, i]));
			const resolved = initialState.visibleItemIds
				.map((id) => itemMap.get(id))
				.filter((i): i is CustomizableContextMenuItem => i !== undefined);
			visibleItems = resolved.length > 0 ? resolved : [...this.allItems];
		} else {
			visibleItems = [...this.allItems];
		}

		return {
			visibleItems,
			renames,
			iconOverrides,
			colorOverrides,
			sectionOverrides,
			showSettingsButton,
		};
	}

	private findEndOfSectionIndex(
		items: CustomizableContextMenuItem[],
		section: string,
		overrides: ReadonlyMap<string, string> = this.snapshot.sectionOverrides
	): number {
		const sectionOf = (item: CustomizableContextMenuItem): string =>
			overrides.get(item.id) ?? item.section ?? DEFAULT_SECTION;

		let lastIdx = -1;
		for (let i = 0; i < items.length; i++) {
			if (sectionOf(items[i]) === section) lastIdx = i;
		}
		return lastIdx >= 0 ? lastIdx + 1 : -1;
	}

	private update(patch: Partial<CustomizableMenuSnapshot>): void {
		this.snapshot = { ...this.snapshot, ...patch };
		this.onStateChange?.(this.getState());
		this.notify();
	}

	private notify(): void {
		for (const listener of this.listeners) listener();
	}
}
