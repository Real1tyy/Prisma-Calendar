export { registerTabCommands, type TabCommandUpdater } from "./commands";
export { TabbedContainer } from "./tabbed-container";
export { TabManagerContent, type TabManagerContentProps } from "./tab-manager-modal";
export { useTabbedContainer, type UseTabbedContainerOptions } from "./use-tabbed-container";
export {
	type GroupTabDefinition,
	isGroupTab,
	tabbedContainerField,
	type TabbedContainerHandle,
	type TabbedContainerProps,
	type TabbedContainerState,
	TabbedContainerStateSchema,
	type TabDefinition,
	type TabEntry,
} from "./types";
export type { PersistedTabbedContainerState } from "./use-persisted-tabbed-container-state";
export { usePersistedTabbedContainerState } from "./use-persisted-tabbed-container-state";
