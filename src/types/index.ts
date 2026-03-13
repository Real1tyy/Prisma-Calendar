export { type ISO } from "../utils/validation";
export { type CalendarEvent, isTimedEvent, type ParsedEvent } from "./calendar";
export {
	type CustomCalendarSettings,
	CustomCalendarSettingsSchema,
	type PrismaCalendarSettingsStore,
	type SingleCalendarConfig,
	SingleCalendarConfigSchema,
} from "./settings";
export { PrismaSyncDataSchema } from "./sync-store";
export {
	CALENDAR_VIEW_OPTIONS,
	type CalendarViewType,
	type ContextMenuItem,
	DAY_CELL_COLORING_OPTIONS,
	DENSITY_OPTIONS,
	FIRST_DAY_OPTIONS,
} from "./view";

export type Frontmatter = Record<string, unknown>;
