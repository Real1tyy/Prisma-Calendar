// ─── Primitives (atoms, controls, filters, layout) ───
export * from "./primitives";

// ─── Widgets (composite, feature-shaped components) ───
export * from "./widgets";

// ─── Contexts ───
export { AppContext, useApp } from "./contexts/app-context";
export type { ScopedTheme, SharedReactTheme, SharedReactThemeProviderProps } from "./contexts/theme-context";
export {
	SharedReactThemeProvider,
	useCls,
	useCssPrefix,
	useResolvedCssPrefix,
	useResolvedTestIdPrefix,
	useScoped,
	useScopedCls,
	useScopedTid,
	useTestId,
	useTestIdPrefix,
	useTheme,
} from "./contexts/theme-context";
export type { ThemedProps, ThemeOverrideProps } from "./contexts/with-theme";
export { useThemed, withTheme } from "./contexts/with-theme";

// ─── Forms ───
export * from "./forms";

// ─── Hooks ───
export { useDomEvent } from "./hooks/dom";
export { type Emitterlike, useObsidianEvent } from "./hooks/dom";
export { useOutsideClick, type UseOutsideClickOptions } from "./hooks/dom";
export { useScrollRestore } from "./hooks/dom";
export { useFocusOnMount, type UseFocusOnMountOptions } from "./hooks/focus";
export { type ActivatableProps, useActivatable } from "./hooks/interaction";
export { useCopyToClipboard, type UseCopyToClipboardOptions } from "./hooks/interaction";
export {
	DEBOUNCED_COMMIT_DEFAULT_MS,
	type DebouncedCommitHandle,
	useDebouncedCommit,
	type UseDebouncedCommitOptions,
} from "./hooks/interaction";
export {
	useArrowDown,
	useArrowKey,
	type UseArrowKeyOptions,
	useArrowLeft,
	useArrowRight,
	useArrowUp,
} from "./hooks/keyboard";
export { useEnterToSubmit } from "./hooks/keyboard";
export { useKeyDown } from "./hooks/keyboard";
export { useEnterKey, type UseEnterKeyOptions, useEscapeKey } from "./hooks/keyboard";
export { type SnapshotSubscribable, useExternalSnapshot } from "./hooks/reactive";
export { useObservable, useSubscription } from "./hooks/reactive";
export { useThrottledObservable } from "./hooks/reactive";
export { useColorEvaluator, useReleaseCheck } from "./hooks/services";
export type { Paths, PathValue } from "./hooks/settings";
export { type SchemaFieldBinding, type SettingsStorelike, useSchemaField } from "./hooks/settings";
export { type SettingsFieldsPatch, type SettingsFieldsUpdater, useSettingsFields } from "./hooks/settings";
export { type SettingsStorelike as SettingsStoreShape, type SettingsUpdater, useSettingsStore } from "./hooks/settings";
export { useInjectedStyles, useScopedStyles } from "./hooks/styles";

// ─── Grid Layout (React wrapper + modal helpers + persisted-state hook + types) ───
export type {
	CellCleanup,
	CellOption,
	CellPickerContentProps,
	CellPlacement,
	CellProps,
	CellRender,
	GridLayoutCommandsConfig,
	GridLayoutConfig,
	GridLayoutHandle,
	GridLayoutProps,
	GridLayoutState,
	GridStateFieldDefaults,
	ImperativeCellHostProps,
	LayoutEditorContentProps,
	OpenCellPickerOptions,
	OpenLayoutEditorOptions,
	PersistedGridState,
	ResizeMode,
} from "./grid-layout";
export {
	Cell,
	CellPickerContent,
	GridLayout,
	GridLayoutStateSchema,
	gridStateField,
	gridStateRecordField,
	ImperativeCellHost,
	LayoutEditorContent,
	openCellPicker,
	openLayoutEditor,
	usePersistedGridState,
	usePersistedGridStateById,
} from "./grid-layout";

// ─── Menus ───
export type {
	ContextMenuCheckboxDef,
	ContextMenuEntryDef,
	ContextMenuItemDef,
	ContextMenuProps,
	ContextMenuSeparatorDef,
	ContextMenuState,
	ContextMenuSubmenuDef,
	CustomizableContextMenuConfig,
	CustomizableContextMenuHandle,
	CustomizableContextMenuItem,
	CustomizableMenuSnapshot,
	CustomizableMenuStoreOptions,
	ItemManagerContentProps,
	OpenItemManagerOptions,
} from "./menus";
export {
	ContextMenu,
	ContextMenuStateSchema,
	createCustomizableContextMenu,
	CustomizableMenuStore,
	ItemManagerContent,
	openItemManagerModal,
	registerCustomizableContextMenuCommand,
} from "./menus";

// ─── Modals ───
export type { ConfirmationModalProps, ConfirmationResult, OpenConfirmationOptions } from "./modals/confirmation-modal";
export { ConfirmationModalContent, openConfirmation } from "./modals/confirmation-modal";
export type {
	FrontmatterPropagationModalProps,
	OpenFrontmatterPropagationOptions,
} from "./modals/frontmatter-propagation-modal";
export {
	FrontmatterPropagationModalContent,
	openFrontmatterPropagationModal,
} from "./modals/frontmatter-propagation-modal";
export type { ShowReactIconPickerOptions } from "./modals/icon-picker-modal";
export { showReactIconPicker } from "./modals/icon-picker-modal";
export type { ProgressModalConfig, ProgressModalHandle } from "./modals/progress-modal";
export { openProgressModal } from "./modals/progress-modal";
export type { OpenRenameOptions, RenameModalProps, RenameModalResult } from "./modals/rename-modal";
export { openRenameModal, RenameModalContent } from "./modals/rename-modal";
export type { WhatsNewModalConfig } from "./modals/whats-new-modal";
export { DEFAULT_WHATS_NEW_LINKS, showWhatsNewReactModal } from "./modals/whats-new-modal";

// ─── Onboarding ───
export * from "./onboarding";

// ─── Page Header (leaf toolbar manager) ───
export type {
	HeaderActionDefinition,
	PageHeaderConfig,
	PageHeaderHandle,
	PageHeaderMode,
	PageHeaderSnapshot,
	PageHeaderState,
	PersistedPageHeaderState,
} from "./page-header";
export {
	createPageHeader,
	openPageHeaderActionManager,
	PageHeaderActionBar,
	pageHeaderField,
	PageHeaderStateSchema,
	PageHeaderStore,
	registerPageHeaderCommands,
	usePersistedPageHeaderState,
} from "./page-header";

// ─── Mount bridges ───
export type { RenderReactInlineOptions } from "./react-inline";
export { renderReactInline } from "./react-inline";
export type { ReactViewConfig, ReactViewHandle } from "./react-view";
export { registerReactView } from "./react-view";
export type {
	OpenReactModalConfig,
	ReactModalBaseConfig,
	ShelledModalConfig,
	ShowReactModalConfig,
} from "./show-react-modal";
export { openReactModal, showReactModal, showShelledModal } from "./show-react-modal";

// ─── Settings ───
export * from "./settings";
export type { SettingsFooterLink, SettingsNavProps, SettingsNavTab } from "./settings/settings-nav";
export { SettingsNav } from "./settings/settings-nav";

// ─── Views ───
export type {
	ActionBarProps,
	BackButtonProps,
	BreadcrumbItem,
	PageBannerAction,
	PageBannerProps,
} from "./views/page-banner";
export { ActionBar, BackButton, PageBanner } from "./views/page-banner";
export type { PersistedTabbedContainerState, TabCommandUpdater } from "./views/tabbed-container";
export {
	type GroupTabDefinition,
	isGroupTab,
	registerTabCommands,
	TabbedContainer,
	tabbedContainerField,
	type TabbedContainerHandle,
	type TabbedContainerProps,
	type TabbedContainerState,
	TabbedContainerStateSchema,
	type TabDefinition,
	type TabEntry,
	usePersistedTabbedContainerState,
} from "./views/tabbed-container";

// ─── Virtual ───
export * from "./virtual";
