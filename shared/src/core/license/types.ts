import { z } from "zod";

// Stable machine-readable result codes returned by every verify/deactivate
// response (success and error). Clients switch on `code` — never on the human
// `error` string, which is for logs/support only. Mirrors the backend
// `LicenseCode` enum (see docs/specs/2026-05-25-license-flow-robustness.md).
export const LICENSE_CODES = [
	"OK",
	"KEY_INVALID_OR_REVOKED",
	"ENTITLEMENT_INACTIVE",
	"SEAT_LIMIT_REACHED",
	"DEVICE_NOT_FOUND",
	"INTERNAL_ERROR",
] as const;
export type LicenseCode = (typeof LICENSE_CODES)[number];

// The subscription states the backend treats as entitled (verify returns 200).
export const ENTITLEMENT_STATUSES = ["active", "trialing", "active_canceled", "trialing_canceled"] as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

export interface LicenseVerifyResponse {
	code: LicenseCode;
	token: string;
	expiresAt: string;
	productId: string;
	productName?: string;
	// Subscription lifecycle — a DIFFERENT clock from `expiresAt` (which is the
	// rolling 7-day offline-grace window). Nullable; absent on older backends.
	entitlementStatus?: EntitlementStatus;
	currentPeriodEnd?: string | null;
	cancelAt?: string | null;
	trialEndsAt?: string | null;
	activations: {
		current: number;
		limit: number;
	};
}

export interface LicenseErrorResponse {
	code: LicenseCode;
	error?: string;
	activations?: {
		current: number;
		limit: number;
	};
}

export interface LicenseDeactivateResponse {
	code: LicenseCode;
	deactivated?: boolean;
	error?: string;
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
}
