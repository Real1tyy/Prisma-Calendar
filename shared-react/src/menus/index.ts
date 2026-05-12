import { ContextMenu as ContextMenuBase } from "./context-menu";
import {
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuRoot,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from "./context-menu-composable";

export type { ContextMenuProps } from "./context-menu";
export {
	type ContextMenuState,
	ContextMenuStateSchema,
	createCustomizableContextMenu,
	type CustomizableContextMenuConfig,
	type CustomizableContextMenuHandle,
	type CustomizableContextMenuItem,
	type CustomizableMenuSnapshot,
	CustomizableMenuStore,
	type CustomizableMenuStoreOptions,
	ItemManagerContent,
	type ItemManagerContentProps,
	openItemManagerModal,
	type OpenItemManagerOptions,
	registerCustomizableContextMenuCommand,
} from "./customizable";
export type {
	ContextMenuCheckboxDef,
	ContextMenuEntryDef,
	ContextMenuItemDef,
	ContextMenuItemKind,
	ContextMenuSeparatorDef,
	ContextMenuSubmenuDef,
} from "./types";

const ContextMenu = ContextMenuBase as typeof ContextMenuBase & {
	Root: typeof ContextMenuRoot;
	Trigger: typeof ContextMenuTrigger;
	Content: typeof ContextMenuContent;
	Item: typeof ContextMenuItem;
	Separator: typeof ContextMenuSeparator;
	Sub: typeof ContextMenuSub;
	SubTrigger: typeof ContextMenuSubTrigger;
	SubContent: typeof ContextMenuSubContent;
};

ContextMenu.Root = ContextMenuRoot;
ContextMenu.Trigger = ContextMenuTrigger;
ContextMenu.Content = ContextMenuContent;
ContextMenu.Item = ContextMenuItem;
ContextMenu.Separator = ContextMenuSeparator;
ContextMenu.Sub = ContextMenuSub;
ContextMenu.SubTrigger = ContextMenuSubTrigger;
ContextMenu.SubContent = ContextMenuSubContent;

export { ContextMenu };
