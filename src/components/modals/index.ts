// Series modals
export type { EventSeriesBasesViewConfig } from "./series/bases-view";
export { showCategoryEventsModal, showEventSeriesBasesViewModal, showIntervalEventsModal } from "./series/bases-view";
export type { EventSeriesHeatmapConfig, HeatmapHandle, HeatmapMode, HeatmapNavigationState } from "./series/heatmap";
export { renderHeatmapInto, showHeatmapModal } from "./series/heatmap";
export type { EventSeriesTimelineConfig, TimelineHandle } from "./series/timeline";
export { renderTimelineInto, showTimelineModal } from "./series/timeline";

// Import/export modals
export type { ICSImportProgressHandle } from "./import-export/ics-import-progress";
export { showICSImportProgressModal } from "./import-export/ics-import-progress";

// Preview modals (React)
export type { PreviewEventData } from "../../react/modals/preview/event-preview-modal";
export { showEventPreviewModal } from "../../react/modals/preview/event-preview-modal";
export type { NotificationEventData } from "../../react/modals/preview/notification-modal";
export { showNotificationModal } from "../../react/modals/preview/notification-modal";
