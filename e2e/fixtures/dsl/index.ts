export { type BatchHandle, openBatch } from "./batch";
export {
	expectAllColors,
	expectAllExist,
	expectAllFrontmatter,
	expectAllHidden,
	expectAllTitleCount,
	expectAllVisible,
} from "./bulk";
export {
	type CalendarHandle,
	createCalendarHandle,
	type EventCreate,
	type EventOnDisk,
	type SeedOptions,
} from "./calendar";
export {
	type BoundingBox,
	boundingBoxOrThrow,
	centerOf,
	drag,
	dragByDelta,
	dragLocatorToLocator,
	type DragOptions,
	type Point,
} from "./drag";
export { createEventHandle, type EventHandle } from "./event";
export {
	type ActionManagerHandle,
	type AssignmentModalHandle,
	collapsibleSection,
	type CollapsibleSectionHandle,
	type ConfirmationModalHandle,
	expectAssignmentModal,
	expectConfirmationModal,
	expectItemManagerOpen,
	expectProgressModal,
	type ItemManagerHandle,
	openActionManager,
	openTabManager,
	type ProgressModalHandle,
	type TabManagerHandle,
} from "./shared";
export { batchActionRoundTrip, type BatchRoundTripHooks, type UndoRedoHooks, undoRedoRoundTrip } from "./templates";
