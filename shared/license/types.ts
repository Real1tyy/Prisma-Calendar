import { z } from "zod";

export interface LicenseVerifyResponse {
	token: string;
	expiresAt: string;
	productId: string;
	activations: {
		current: number;
		limit: number;
	};
}

export const LicenseStatusSchema = z.object({
	state: z.enum(["none", "valid", "expired", "invalid", "device_limit", "error"]).default("none"),
	activationsCurrent: z.number().default(0),
	activationsLimit: z.number().default(5),
	expiresAt: z.string().nullable().default(null),
	errorMessage: z.string().nullable().default(null),
});

export type LicenseStatus = z.infer<typeof LicenseStatusSchema>;

export interface CachedLicenseData {
	token: string;
	expiresAt: string;
	activationsCurrent: number;
	activationsLimit: number;
}

export interface LicenseManagerConfig {
	productName: string;
	purchaseUrl: string;
	deviceIdStorageKey: string;
	licenseCacheStorageKey: string;
}
