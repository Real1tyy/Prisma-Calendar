import type { EventMetadata } from "./event";
import type { SingleCalendarConfig } from "./settings";

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
// If you add a field to EventMetadataSchema without a registry entry (or vice versa),
// TypeScript will produce a compile error on the corresponding line below.

type RegistryMetadataKeys = (typeof METADATA_FIELD_MAP)[number]["metadataKey"];

// Utility: resolves to `never` if A is not a subtype of B
type Assert<A, B> = [A] extends [B] ? A : never;

// Every EventMetadata key must appear in the registry
type _SchemaFullyCovered = Assert<MetadataKey, RegistryMetadataKeys>;
// Every registry key must exist in EventMetadata
type _RegistryFullyValid = Assert<RegistryMetadataKeys, MetadataKey>;

// These functions force TypeScript to evaluate the assertions.
// If the types diverge, the parameter type becomes `never` and no value satisfies it.
export function checkSchemaKeys(_k: _SchemaFullyCovered): void {}
export function checkRegistryKeys(_k: _RegistryFullyValid): void {}
checkSchemaKeys("skip" as MetadataKey);
checkRegistryKeys("skip" as RegistryMetadataKeys);

// ─── Settings Prop Classification ────────────────────────────────────
// Tags for each settings prop key that controls how it's treated during
// recurring event propagation and edit modal rendering.

interface PropClassification {
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

// ─── Derived Arrays ──────────────────────────────────────────────────
// These replace the hand-maintained arrays in settings.ts.

export function computeSystemPropKeys(): SettingsPropKey[] {
	return PROP_CLASSIFICATIONS.filter((c) => c.system).map((c) => c.settingsProp);
}

export function computeDedicatedUIPropKeys(): SettingsPropKey[] {
	return PROP_CLASSIFICATIONS.filter((c) => c.dedicatedUI).map((c) => c.settingsProp);
}

export function computeNotificationSystemPropKeys(): SettingsPropKey[] {
	return PROP_CLASSIFICATIONS.filter((c) => c.notificationSystem).map((c) => c.settingsProp);
}

export function computeNotificationDedicatedUIPropKeys(): SettingsPropKey[] {
	return PROP_CLASSIFICATIONS.filter((c) => c.notificationDedicatedUI).map((c) => c.settingsProp);
}
