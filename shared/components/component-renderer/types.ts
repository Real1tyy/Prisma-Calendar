import type { App, Scope, WorkspaceLeaf } from "obsidian";

import type { LeafPlacement } from "../../utils/activate-view";

export type RenderTarget = "modal" | LeafPlacement;

export interface ModalContext {
	type: "modal";
	app: App;
	close: () => void;
	modalEl: HTMLElement;
	scope: Scope;
	searchQuery: string;
}

export interface ModalSearchConfig {
	cssPrefix: string;
	placeholder?: string;
}

export interface ViewContext {
	type: "view";
	app: App;
	close: () => void;
	leaf: WorkspaceLeaf;
	headerEl: HTMLElement;
}

export interface InlineContext {
	type: "inline";
	app: App;
	close: () => void;
}

export type ComponentContext = ModalContext | ViewContext | InlineContext;

export type ComponentRender = (el: HTMLElement, ctx: ComponentContext) => void | Promise<void>;
export type ComponentCleanup = () => void;

export interface ModalComponentConfig {
	app: App;
	cls: string;
	render: ComponentRender;
	cleanup?: ComponentCleanup;
	title?: string;
	search?: ModalSearchConfig;
}

export interface ViewComponentConfig {
	viewType: string;
	displayText: string;
	cls: string;
	render: ComponentRender;
	cleanup?: ComponentCleanup;
	icon?: string;
}

export type ViewActivator = (placement?: LeafPlacement) => Promise<WorkspaceLeaf | null>;
