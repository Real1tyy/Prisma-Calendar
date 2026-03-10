export interface LicenseVerifyResponse {
	token: string;
	expiresAt: string;
	productId: string;
	activations: {
		current: number;
		limit: number;
	};
}

export interface LicenseStatus {
	state: "none" | "valid" | "expired" | "invalid" | "device_limit" | "error";
	activationsCurrent: number;
	activationsLimit: number;
	expiresAt: string | null;
	errorMessage: string | null;
}

export interface CachedLicenseData {
	token: string;
	expiresAt: string;
	activationsCurrent: number;
	activationsLimit: number;
}
