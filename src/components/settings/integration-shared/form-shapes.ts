import { zSecret } from "@real1ty-obsidian-plugins";
import { z } from "zod";

import { CALDAV_DEFAULTS, ICS_SUBSCRIPTION_DEFAULTS } from "../../../constants";
import { COMMON_TIMEZONES } from "../../../core/integrations/ics-export";

const TIMEZONE_IDS = COMMON_TIMEZONES.map((tz) => tz.id) as [string, ...string[]];
export const TIMEZONE_LABELS: Record<string, string> = Object.fromEntries(
	COMMON_TIMEZONES.map((tz) => [tz.id, tz.label])
);

const syncIntervalField = (defaultMinutes: number) =>
	z.number().min(1).max(1440).default(defaultMinutes).describe("How often to automatically sync (1-1440 minutes)");

const SharedIntegrationFields = {
	name: z.string().min(1).default("").describe("Display name").meta({ placeholder: "My calendar" }),
	syncIntervalMinutes: syncIntervalField(CALDAV_DEFAULTS.SYNC_INTERVAL_MINUTES),
	timezone: z
		.enum(TIMEZONE_IDS)
		.default("UTC")
		.describe("Timezone for event times")
		.meta({ enumLabels: TIMEZONE_LABELS }),
	icon: z
		.string()
		.optional()
		.default("")
		.describe("Optional icon/emoji to display on synced events")
		.meta({ placeholder: "📅" }),
};

// ─── CalDAV ─────────────────────────────────────────────────

export const CalDAVAddFormShape = {
	...SharedIntegrationFields,
	serverUrl: z
		.string()
		.min(1)
		.default("")
		.describe("The calendar server address")
		.meta({ placeholder: "https://caldav.example.com/dav/" }),
	username: z.string().min(1).default("").describe("Username").meta({ placeholder: "Your username" }),
	passwordSecretName: zSecret
		.default("")
		.describe("Select a secret from SecretStorage. Use an app-specific password for cloud providers."),
};

export const CalDAVEditFormShape = {
	...SharedIntegrationFields,
	enabled: z.boolean().default(true).describe("Enable or disable syncing for this account"),
};

export type CalDAVAddFormValues = z.infer<z.ZodObject<typeof CalDAVAddFormShape>>;
export type CalDAVEditFormValues = z.infer<z.ZodObject<typeof CalDAVEditFormShape>>;

// ─── ICS Subscription ───────────────────────────────────────

export const ICSSubscriptionAddFormShape = {
	...SharedIntegrationFields,
	syncIntervalMinutes: syncIntervalField(ICS_SUBSCRIPTION_DEFAULTS.SYNC_INTERVAL_MINUTES),
	urlSecretName: zSecret.default("").describe("Select a secret from SecretStorage containing the ICS calendar URL"),
};

export const ICSSubscriptionEditFormShape = {
	...SharedIntegrationFields,
	syncIntervalMinutes: syncIntervalField(ICS_SUBSCRIPTION_DEFAULTS.SYNC_INTERVAL_MINUTES),
	enabled: z.boolean().default(true).describe("Enable or disable syncing for this subscription"),
};

export type ICSSubscriptionAddFormValues = z.infer<z.ZodObject<typeof ICSSubscriptionAddFormShape>>;
export type ICSSubscriptionEditFormValues = z.infer<z.ZodObject<typeof ICSSubscriptionEditFormShape>>;
