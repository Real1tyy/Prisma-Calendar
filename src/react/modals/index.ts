// Event modals
export type { CalendarIntegrationDeleteEventsOptions } from "./event/delete-confirmation-modal";
export {
	openCalendarIntegrationDeleteEventsModal,
	openConfirmDeleteModal,
	openDeleteRecurringEventsModal,
} from "./event/delete-confirmation-modal";
export { openMoveByModal } from "./event/move-by-modal";
export type { SavePresetResult } from "./event/save-preset-modal";
export { openSavePresetModal } from "./event/save-preset-modal";
export { openUntrackedEventCreateModal } from "./event/untracked-event-create-modal";

// Batch modals
export { openBatchFrontmatterModal } from "./batch/batch-frontmatter-modal";

// Category modals
export type { AssignmentItem, AssignmentModalConfig } from "./category/assignment-modal";
export { openAssignmentModal, openCategoryAssignModal, openPrerequisiteAssignModal } from "./category/assignment-modal";
export { openCategoryDeleteModal, openCategoryRenameModal } from "./category/category-operation-modal";
export { openCategorySelectModal } from "./category/category-select-modal";

// CalDAV modals
export { openCalDAVAddModal } from "./caldav/caldav-add-modal";
export { openCalDAVEditModal } from "./caldav/caldav-edit-modal";

// ICS modals
export { openICSAddModal } from "./ics/ics-add-modal";
export { openICSEditModal } from "./ics/ics-edit-modal";

// Import/export modals
export { openCalendarSelectModal } from "./import-export/calendar-select-modal";
export type { ICSImportSelection } from "./import-export/ics-import-modal";
export { openICSImportModal } from "./import-export/ics-import-modal";
