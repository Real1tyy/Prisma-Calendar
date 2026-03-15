export interface TabDefinition {
	id: string;
	label: string;
	render: (container: HTMLElement) => void | Promise<void>;
	cleanup?: () => void;
}

export interface TabbedContainerConfig {
	tabs: TabDefinition[];
	cssPrefix: string;
	initialTab?: number;
	lazy?: boolean;
	onTabChange?: (tabId: string, index: number) => void;
	/**
	 * When provided, the tab bar buttons are rendered into this element
	 * instead of inside the main container. The content panels are still
	 * placed inside the main container passed to `createTabbedContainer`.
	 */
	tabBarContainer?: HTMLElement;
	/**
	 * When provided alongside `tabBarContainer`, the tab bar is inserted
	 * before this sibling element instead of being appended at the end.
	 */
	tabBarInsertBefore?: Element;
}

export interface TabbedContainerHandle {
	switchTo(indexOrId: number | string): void;
	next(): void;
	previous(): void;
	readonly activeIndex: number;
	readonly activeId: string;
	readonly tabCount: number;
	destroy(): void;
}
