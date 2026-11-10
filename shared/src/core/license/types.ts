import { z } from "zod";

import type {
	LicenseErrorCode,
	LicenseVerifySuccessCode,
	LicenseVerifySuccessEntitlementStatus,
} from "../../generated/billing-api/model";
import type { ShowLinkNotice } from "../../utils/notice";

// The request and response shapes are the billing API's generated model
// (`LicenseVerifyRequest`, `LicenseVerifySuccess`, `LicenseError`,
// `LicenseDeactivateResult`) — never re-declared here
// ([[spec-typed-billing-api-client-generated-from-the-published-openapi-spec]]).

/**
 * Stable machine-readable result code on every verify/deactivate response.
 * Clients switch on `code`, never on the human `error` string, which is for
 * logs and support only.
 */
export type LicenseCode = LicenseVerifySuccessCode | LicenseErrorCode;

/**
 * The subscription states the client treats as entitled. The server's enum is
 * wider (it also reports lapsed states); a verify only succeeds for these four.
 */
export const ENTITLEMENT_STATUSES = [
	"active",
	"trialing",
	"active_canceled",
	"trialing_canceled",
] as const satisfies readonly LicenseVerifySuccessEntitlementStatus[];
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

const ENTITLED: ReadonlySet<string> = new Set(ENTITLEMENT_STATUSES);

export function toEntitlementStatus(status: LicenseVerifySuccessEntitlementStatus): EntitlementStatus | null {
	return ENTITLED.has(status) ? (status as EntitlementStatus) : null;
}

export const LicenseStatusSchema = z.object({
	state: z
		.enum(["none", "valid", "expired", "invalid", "entitlement_inactive", "device_limit", "deactivated", "error"])
		.default("none"),
	activationsCurrent: z.number().default(0),
	activationsLimit: z.number().default(5),
	expiresAt: z.string().nullable().default(null),
	entitlementStatus: z.enum(ENTITLEMENT_STATUSES).nullable().default(null),
	currentPeriodEnd: z.string().nullable().default(null),
	cancelAt: z.string().nullable().default(null),
	trialEndsAt: z.string().nullable().default(null),
	errorMessage: z.string().nullable().default(null),
});

export type LicenseStatus = z.infer<typeof LicenseStatusSchema>;

export interface CachedLicenseData {
	token: string;
	expiresAt: string;
	activationsCurrent: number;
	activationsLimit: number;
	entitlementStatus?: EntitlementStatus | null;
	currentPeriodEnd?: string | null;
	cancelAt?: string | null;
	trialEndsAt?: string | null;
}

export interface LicenseManagerConfig {
	productName: string;
	purchaseUrl: string;
	deviceIdStorageKey: string;
	licenseCacheStorageKey: string;
	/**
	 * Renders the Pro gate notice. Injected because the labelled-link renderer
	 * is React and lives one layer up — wire it to
	 * `createLinkNoticeRenderer(CSS_PREFIX)` from
	 * `@real1ty/obsidian-plugins-react`.
	 */
	showNotice: ShowLinkNotice;
}
