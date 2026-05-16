export { registerTabCommands, type TabCommandUpdater } from "./commands";
export { TabbedContainer } from "./tabbed-container";
export {
	type GroupTabDefinition,
	isGroupTab,
	type TabbedContainerHandle,
	type TabbedContainerProps,
	type TabbedContainerState,
	tabbedContainerField,
	TabbedContainerStateSchema,
	type TabDefinition,
	type TabEntry,
} from "./types";
export type { PersistedTabbedContainerState } from "./use-persisted-tabbed-container-state";
export { usePersistedTabbedContainerState } from "./use-persisted-tabbed-container-state";
