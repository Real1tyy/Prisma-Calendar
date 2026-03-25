import { zSecret } from "@real1ty-obsidian-plugins";
import { z } from "zod";

import { CALDAV_DEFAULTS, ICS_SUBSCRIPTION_DEFAULTS } from "../../../constants";
import { COMMON_TIMEZONES } from "../../../core/integrations/ics-export";

const TIMEZONE_IDS = COMMON_TIMEZONES.map((tz) => tz.id) as [string, ...string[]];
const TIMEZONE_LABELS: Record<string, string> = Object.fromEntries(COMMON_TIMEZONES.map((tz) => [tz.id, tz.label]));

const SharedIntegrationFields = {
	name: z.string().min(1).describe("Display name").meta({ placeholder: "My calendar" }),
	syncIntervalMinutes: z
		.number()
		.min(1)
		.max(1440)
		.default(CALDAV_DEFAULTS.SYNC_INTERVAL_MINUTES)
		.describe("How often to automatically sync (1-1440 minutes)"),
	timezone: z
		.enum(TIMEZONE_IDS)
		.default("UTC")
		.describe("Timezone for event times")
		.meta({ enumLabels: TIMEZONE_LABELS }),
	icon: z.string().optional().describe("Optional icon/emoji to display on synced events").meta({ placeholder: "📅" }),
};

// ─── CalDAV ─────────────────────────────────────────────────

export const CalDAVAddFormShape = {
	...SharedIntegrationFields,
	serverUrl: z
		.string()
		.min(1)
		.describe("The calendar server address")
		.meta({ placeholder: "https://caldav.example.com/dav/" }),
	username: z.string().min(1).describe("Username").meta({ placeholder: "Your username" }),
	passwordSecretName: zSecret.describe(
		"Select a secret from SecretStorage. Use an app-specific password for cloud providers."
	),
};

export const CalDAVEditFormShape = {
	...SharedIntegrationFields,
	enabled: z.boolean().describe("Enable or disable syncing for this account"),
};

export type CalDAVAddFormValues = z.infer<z.ZodObject<typeof CalDAVAddFormShape>>;
export type CalDAVEditFormValues = z.infer<z.ZodObject<typeof CalDAVEditFormShape>>;

// ─── ICS Subscription ───────────────────────────────────────

export const ICSSubscriptionAddFormShape = {
	...SharedIntegrationFields,
	syncIntervalMinutes: z
		.number()
		.min(1)
		.max(1440)
		.default(ICS_SUBSCRIPTION_DEFAULTS.SYNC_INTERVAL_MINUTES)
		.describe("How often to automatically sync (1-1440 minutes)"),
	urlSecretName: zSecret.describe("Select a secret from SecretStorage containing the ICS calendar URL"),
};

export const ICSSubscriptionEditFormShape = {
	...SharedIntegrationFields,
	syncIntervalMinutes: z
		.number()
		.min(1)
		.max(1440)
		.default(ICS_SUBSCRIPTION_DEFAULTS.SYNC_INTERVAL_MINUTES)
		.describe("How often to automatically sync (1-1440 minutes)"),
	enabled: z.boolean().describe("Enable or disable syncing for this subscription"),
};

export type ICSSubscriptionAddFormValues = z.infer<z.ZodObject<typeof ICSSubscriptionAddFormShape>>;
export type ICSSubscriptionEditFormValues = z.infer<z.ZodObject<typeof ICSSubscriptionEditFormShape>>;
