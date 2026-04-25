// ─── Components ───
export type { ButtonProps, ButtonVariant } from "./components/button";
export { Button } from "./components/button";
export type { ChipProps } from "./components/chip";
export { Chip } from "./components/chip";
export type { ChipListProps } from "./components/chip-list";
export { ChipList } from "./components/chip-list";
export type { CollapsibleSectionProps, SectionBodyProps, SectionHeaderProps } from "./components/collapsible-section";
export { CollapsibleSection, SectionBody, SectionHeader } from "./components/collapsible-section";
export type { EmptyHintProps } from "./components/empty-hint";
export { EmptyHint } from "./components/empty-hint";
export type { FilterInputProps } from "./components/filter-input";
export { FilterInput, useFilteredItems } from "./components/filter-input";
export type { IconPickerButtonProps } from "./components/icon-picker-button";
export { IconPickerButton, useIconPicker } from "./components/icon-picker-button";
export { LicenseSection } from "./components/license-section";
export type { EditableItem as ManagerEditableItem, ManagerEditFormProps } from "./components/manager-edit-form";
export { ManagerEditForm } from "./components/manager-edit-form";
export type { ManagerRowAction, ManagerRowProps } from "./components/manager-row";
export type { EditableItem } from "./components/manager-row";
export { ManagerRow } from "./components/manager-row";
export { ObsidianIcon } from "./components/obsidian-icon";
export type { ChartJSCtor, ChartTitleProps, PieCanvasProps, PieChartData, PieChartProps } from "./components/pie-chart";
export { ChartTitle, PieCanvas, PieChart } from "./components/pie-chart";
export { SecretField } from "./components/secret-field";
export {
	ColorInput,
	DateInput,
	DatetimeLocalInput,
	Dropdown,
	NumberInput,
	Slider,
	TextareaInput,
	TextInput,
	Toggle,
} from "./components/setting-controls";
export { SettingCard, SettingHeading, SettingItem } from "./components/setting-item";
export type { TextareaProps } from "./components/textarea";
export { Textarea } from "./components/textarea";

// ─── Contexts ───
export { AppContext, useApp } from "./contexts/app-context";

// ─── Forms ───
export * from "./forms";

// ─── Hooks ───
export type { ActivatableProps } from "./hooks/use-activatable";
export { useActivatable } from "./hooks/use-activatable";
export type { DebouncedCommitHandle, UseDebouncedCommitOptions } from "./hooks/use-debounced-commit";
export { DEBOUNCED_COMMIT_DEFAULT_MS, useDebouncedCommit } from "./hooks/use-debounced-commit";
export { useDomEvent } from "./hooks/use-dom-event";
export { useEnterKey, type UseEnterKeyOptions } from "./hooks/use-enter-key";
export { useEscapeKey } from "./hooks/use-escape-key";
export type { SnapshotSubscribable } from "./hooks/use-external-snapshot";
export { useExternalSnapshot } from "./hooks/use-external-snapshot";
export { useInjectedStyles } from "./hooks/use-injected-styles";
export { useKeyDown } from "./hooks/use-key-down";
export type { Emitterlike } from "./hooks/use-obsidian-event";
export { useObsidianEvent } from "./hooks/use-obsidian-event";
export type { SchemaFieldBinding, SettingsStorelike } from "./hooks/use-schema-field";
export { useSchemaField } from "./hooks/use-schema-field";
export type { SettingsStorelike as SettingsStoreShape, SettingsUpdater } from "./hooks/use-settings-store";
export { useSettingsStore } from "./hooks/use-settings-store";

// ─── Menus ───
export type {
	ContextMenuCheckboxDef,
	ContextMenuEntryDef,
	ContextMenuItemDef,
	ContextMenuProps,
	ContextMenuSeparatorDef,
	ContextMenuSubmenuDef,
} from "./menus";
export { ContextMenu } from "./menus";

// ─── Modals ───
export type { ConfirmationModalProps, OpenConfirmationOptions } from "./modals/confirmation-modal";
export { ConfirmationModalContent, openConfirmation } from "./modals/confirmation-modal";
export type {
	FrontmatterPropagationModalProps,
	OpenFrontmatterPropagationOptions,
} from "./modals/frontmatter-propagation-modal";
export {
	FrontmatterPropagationModalContent,
	openFrontmatterPropagationModal,
} from "./modals/frontmatter-propagation-modal";
export type { ProgressModalConfig, ProgressModalHandle } from "./modals/progress-modal";
export { openProgressModal } from "./modals/progress-modal";
export type { OpenRenameOptions, RenameModalProps } from "./modals/rename-modal";
export { openRenameModal, RenameModalContent } from "./modals/rename-modal";
export type { WhatsNewModalConfig } from "./modals/whats-new-modal";
export { DEFAULT_WHATS_NEW_LINKS, showWhatsNewReactModal } from "./modals/whats-new-modal";

// ─── Onboarding ───
export * from "./onboarding";

// ─── Mount bridges ───
export { renderReactInline } from "./react-inline";
export type { ReactViewConfig, ReactViewHandle } from "./react-view";
export { registerReactView } from "./react-view";
export type { OpenReactModalConfig, ReactModalBaseConfig, ShowReactModalConfig } from "./show-react-modal";
export { openReactModal, showReactModal } from "./show-react-modal";

// ─── Settings ───
export * from "./settings";
export type { SettingsFooterLink, SettingsNavProps, SettingsNavTab } from "./settings/settings-nav";
export { SettingsNav } from "./settings/settings-nav";

// ─── Views ───
export type {
	ActionBarProps,
	BackButtonProps,
	BreadcrumbItem,
	PageHeaderAction,
	PageHeaderProps,
} from "./views/page-header";
export { ActionBar, BackButton, PageHeader } from "./views/page-header";
export type { ReactTabDefinition, TabbedContainerProps } from "./views/tabbed-container";
export { TabbedContainer } from "./views/tabbed-container";

// ─── Virtual ───
export * from "./virtual";
