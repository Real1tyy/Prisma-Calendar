import {
	optionalListTransform,
	optionalNumber,
	optionalPositiveNumber,
	optionalTrimmedString,
	strictBooleanOptional,
} from "@real1ty-obsidian-plugins";
import { z } from "zod";

import type { SingleCalendarConfig } from "./settings";

// ─── Event Metadata Schema ───────────────────────────────────────────
// Structured fields extracted from frontmatter via settings-based property names.
// Parsed through Zod at the boundary so consumers get clean, validated data.

export const EventMetadataSchema = z.object({
	skip: strictBooleanOptional.optional().describe("Hide event from calendar"),
	location: optionalTrimmedString.describe("Event location"),
	participants: optionalListTransform.describe("Comma-separated list of participants"),
	categories: optionalListTransform.describe("Event categories"),
	breakMinutes: optionalPositiveNumber.describe("Time to subtract from duration in statistics"),
	icon: optionalTrimmedString.describe("Event icon (emoji or text)"),
	status: optionalTrimmedString.describe("Event status"),
	minutesBefore: optionalNumber.describe("Notify minutes before"),
	daysBefore: optionalNumber.describe("Notify days before"),
	alreadyNotified: strictBooleanOptional.optional(),
	rruleType: optionalTrimmedString,
	rruleSpec: optionalTrimmedString,
	rruleId: optionalTrimmedString,
	instanceDate: optionalTrimmedString,
	source: optionalTrimmedString,
	futureInstancesCount: optionalPositiveNumber,
	generatePastEvents: strictBooleanOptional.optional(),
	caldav: z.unknown().optional(),
	icsSubscription: z.unknown().optional(),
});

export type EventMetadata = z.infer<typeof EventMetadataSchema>;

// ─── Metadata Field Registry ─────────────────────────────────────────
// Maps EventMetadata keys to their corresponding settings prop keys.
// Used by parseEventMetadata() to build the candidate object from frontmatter.

type MetadataKey = keyof EventMetadata;
type SettingsPropKey = keyof SingleCalendarConfig;

interface MetadataFieldEntry<M extends MetadataKey = MetadataKey, S extends SettingsPropKey = SettingsPropKey> {
	metadataKey: M;
	settingsProp: S;
}

// Helper: validates shape while preserving literal types from `as const`
function defineMetadataFieldMap<const T extends readonly MetadataFieldEntry[]>(map: T): T {
	return map;
}

export const METADATA_FIELD_MAP = defineMetadataFieldMap([
	{ metadataKey: "skip", settingsProp: "skipProp" },
	{ metadataKey: "location", settingsProp: "locationProp" },
	{ metadataKey: "participants", settingsProp: "participantsProp" },
	{ metadataKey: "categories", settingsProp: "categoryProp" },
	{ metadataKey: "breakMinutes", settingsProp: "breakProp" },
	{ metadataKey: "icon", settingsProp: "iconProp" },
	{ metadataKey: "status", settingsProp: "statusProperty" },
	{ metadataKey: "minutesBefore", settingsProp: "minutesBeforeProp" },
	{ metadataKey: "daysBefore", settingsProp: "daysBeforeProp" },
	{ metadataKey: "alreadyNotified", settingsProp: "alreadyNotifiedProp" },
	{ metadataKey: "rruleType", settingsProp: "rruleProp" },
	{ metadataKey: "rruleSpec", settingsProp: "rruleSpecProp" },
	{ metadataKey: "rruleId", settingsProp: "rruleIdProp" },
	{ metadataKey: "instanceDate", settingsProp: "instanceDateProp" },
	{ metadataKey: "source", settingsProp: "sourceProp" },
	{ metadataKey: "futureInstancesCount", settingsProp: "futureInstancesCountProp" },
	{ metadataKey: "generatePastEvents", settingsProp: "generatePastEventsProp" },
	{ metadataKey: "caldav", settingsProp: "caldavProp" },
	{ metadataKey: "icsSubscription", settingsProp: "icsSubscriptionProp" },
]);

// ─── Compile-Time Assertions ─────────────────────────────────────────
// If you add a field to EventMetadataSchema without a registry entry (or vice
// versa), TypeScript raises a compile error on the line below.

type RegistryMetadataKeys = (typeof METADATA_FIELD_MAP)[number]["metadataKey"];

// Resolves to `never` if A is not a subtype of B, breaking the compile
type Assert<A, B> = [A] extends [B] ? A : never;

type _SchemaFullyCovered = Assert<MetadataKey, RegistryMetadataKeys>;
type _RegistryFullyValid = Assert<RegistryMetadataKeys, MetadataKey>;

// These calls force TypeScript to evaluate the assertions — if the types
// diverge the parameter type becomes `never` and no value satisfies it.
export function checkSchemaKeys(_k: _SchemaFullyCovered): void {}
export function checkRegistryKeys(_k: _RegistryFullyValid): void {}
checkSchemaKeys("skip" as MetadataKey);
checkRegistryKeys("skip" as RegistryMetadataKeys);

// ─── Settings Prop Classification ────────────────────────────────────
// Tags each settings prop key for how it's treated during recurring event
// propagation and edit modal rendering.

export interface PropClassification {
	settingsProp: SettingsPropKey;
	system: boolean;
	dedicatedUI: boolean;
	notificationSystem: boolean;
	notificationDedicatedUI: boolean;
}

export const PROP_CLASSIFICATIONS: readonly PropClassification[] = [
	// ── Datetime & Identity (system-only, no metadata key) ──
	{
		settingsProp: "startProp",
		system: true,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "endProp",
		system: true,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "dateProp",
		system: true,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "allDayProp",
		system: true,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "titleProp",
		system: true,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "calendarTitleProp",
		system: true,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "zettelIdProp",
		system: true,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "sortDateProp",
		system: true,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "prerequisiteProp",
		system: true,
		dedicatedUI: true,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},

	// ── Metadata fields that are system props ──
	{
		settingsProp: "skipProp",
		system: true,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "breakProp",
		system: true,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "rruleProp",
		system: true,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "rruleSpecProp",
		system: true,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "rruleIdProp",
		system: true,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "sourceProp",
		system: true,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "instanceDateProp",
		system: true,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "futureInstancesCountProp",
		system: true,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "generatePastEventsProp",
		system: true,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "caldavProp",
		system: true,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "icsSubscriptionProp",
		system: true,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "statusProperty",
		system: true,
		dedicatedUI: true,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},

	// ── Metadata fields with dedicated UI ──
	{
		settingsProp: "categoryProp",
		system: false,
		dedicatedUI: true,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "iconProp",
		system: false,
		dedicatedUI: true,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "locationProp",
		system: false,
		dedicatedUI: true,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "participantsProp",
		system: false,
		dedicatedUI: true,
		notificationSystem: false,
		notificationDedicatedUI: false,
	},

	// ── Notification props ──
	{
		settingsProp: "alreadyNotifiedProp",
		system: false,
		dedicatedUI: false,
		notificationSystem: true,
		notificationDedicatedUI: false,
	},
	{
		settingsProp: "minutesBeforeProp",
		system: false,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: true,
	},
	{
		settingsProp: "daysBeforeProp",
		system: false,
		dedicatedUI: false,
		notificationSystem: false,
		notificationDedicatedUI: true,
	},
] as const;
