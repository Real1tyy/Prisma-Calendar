export type ContextMenuItemKind = "item" | "separator" | "submenu" | "checkbox";

export interface ContextMenuItemDef {
	kind: "item";
	id: string;
	label: string;
	icon?: string;
	shortcut?: string;
	disabled?: boolean;
	onSelect: () => void;
}

export interface ContextMenuSeparatorDef {
	kind: "separator";
}

export interface ContextMenuSubmenuDef {
	kind: "submenu";
	id: string;
	label: string;
	items: ContextMenuEntryDef[];
}

export interface ContextMenuCheckboxDef {
	kind: "checkbox";
	id: string;
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}

export type ContextMenuEntryDef =
	| ContextMenuItemDef
	| ContextMenuSeparatorDef
	| ContextMenuSubmenuDef
	| ContextMenuCheckboxDef;
