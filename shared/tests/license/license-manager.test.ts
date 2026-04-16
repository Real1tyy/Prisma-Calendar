import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LicenseManager } from "../../src/core/license/license-manager";
import type { LicenseManagerConfig, LicenseVerifyResponse } from "../../src/core/license/types";
import { LicenseStatusSchema } from "../../src/core/license/types";

const { mockRequestUrl } = vi.hoisted(() => ({
	mockRequestUrl: vi.fn(),
}));

vi.mock("jose", () => ({
	importSPKI: vi.fn().mockResolvedValue("mock-public-key"),
	jwtVerify: vi.fn().mockResolvedValue({ payload: {} }),
	errors: {
		JWTExpired: class JWTExpired extends Error {
			constructor() {
				super("JWT expired");
				this.name = "JWTExpired";
			}
		},
	},
}));

vi.mock("obsidian", async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>;
	return {
		...actual,
		requestUrl: mockRequestUrl,
	};
});

const TEST_CONFIG: LicenseManagerConfig = {
	productName: "Test Plugin",
	purchaseUrl: "https://example.com/purchase",
	deviceIdStorageKey: "test-device-id",
	licenseCacheStorageKey: "test-license-cache",
};

function createMockApp(overrides?: {
	localStorageData?: Record<string, string | null>;
	secretData?: Record<string, string | null>;
}) {
	const localStorage: Record<string, string | null> = overrides?.localStorageData ?? {};
	const secretStorage: Record<string, string | null> = overrides?.secretData ?? {};

	return {
		loadLocalStorage: vi.fn((key: string) => localStorage[key] ?? null),
		saveLocalStorage: vi.fn((key: string, value: string) => {
			localStorage[key] = value;
		}),
		secretStorage: {
			getSecret: vi.fn((name: string) => Promise.resolve(secretStorage[name] ?? null)),
		},
		vault: {
			adapter: {
				read: vi.fn(),
				write: vi.fn(),
			},
		},
	};
}

function createVerifyResponse(overrides?: Partial<LicenseVerifyResponse>): LicenseVerifyResponse {
	return {
		token: "mock-jwt-token",
		expiresAt: "2027-01-01T00:00:00Z",
		productId: "test-product",
		activations: { current: 1, limit: 5 },
		...overrides,
	};
}

describe("LicenseManager", () => {
	let mockApp: ReturnType<typeof createMockApp>;
	let manager: LicenseManager;
	let getLicenseKeySecretName: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockApp = createMockApp();
		getLicenseKeySecretName = vi.fn().mockReturnValue("license-key-secret");
		manager = new LicenseManager(mockApp as any, getLicenseKeySecretName, "1.0.0", TEST_CONFIG);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("constructor", () => {
		it("should initialize with default status", () => {
			const status = manager.status;
			const defaults = LicenseStatusSchema.parse({});
			expect(status.state).toBe(defaults.state);
			expect(status.activationsCurrent).toBe(defaults.activationsCurrent);
			expect(status.activationsLimit).toBe(defaults.activationsLimit);
		});

		it("should not be pro initially", () => {
			expect(manager.isPro).toBe(false);
		});
	});

	describe("purchaseUrl", () => {
		it("should return configured purchase URL", () => {
			expect(manager.purchaseUrl).toBe(TEST_CONFIG.purchaseUrl);
		});
	});

	describe("productName", () => {
		it("should return configured product name", () => {
			expect(manager.productName).toBe(TEST_CONFIG.productName);
		});
	});

	describe("isPro$", () => {
		it("should emit false initially", () => {
			let value: boolean | undefined;
			const sub = manager.isPro$.subscribe((v) => (value = v));
			expect(value).toBe(false);
			sub.unsubscribe();
		});
	});

	describe("status", () => {
		it("should expose current status via getter", () => {
			expect(manager.status).toEqual(manager.status$.getValue());
		});
	});

	describe("status$", () => {
		it("should emit to subscribers on status changes", async () => {
			const callback = vi.fn();
			const sub = manager.status$.subscribe(callback);
			callback.mockClear();

			mockApp.secretStorage.getSecret.mockResolvedValue(null);
			await manager.refreshLicense();

			expect(callback).toHaveBeenCalled();
			sub.unsubscribe();
		});
	});

	describe("requirePro", () => {
		it("should return false when not pro", () => {
			expect(manager.requirePro("Advanced Export")).toBe(false);
		});

		it("should return true when pro", async () => {
			mockApp.secretStorage.getSecret.mockResolvedValue("valid-key");
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: createVerifyResponse(),
			});

			await manager.refreshLicense();

			expect(manager.requirePro("Advanced Export")).toBe(true);
		});
	});

	describe("refreshLicense", () => {
		it("should set state to 'none' when no license key is configured", async () => {
			mockApp.secretStorage.getSecret.mockResolvedValue(null);

			await manager.refreshLicense();

			expect(manager.status.state).toBe("none");
			expect(manager.isPro).toBe(false);
		});

		it("should set state to 'none' when secret name is empty", async () => {
			getLicenseKeySecretName.mockReturnValue("");

			await manager.refreshLicense();

			expect(manager.status.state).toBe("none");
		});

		describe("successful verification (200)", () => {
			it("should activate license on valid token", async () => {
				mockApp.secretStorage.getSecret.mockResolvedValue("valid-key");
				const response = createVerifyResponse();
				mockRequestUrl.mockResolvedValue({ status: 200, json: response });

				await manager.refreshLicense();

				expect(manager.isPro).toBe(true);
				const status = manager.status;
				expect(status.state).toBe("valid");
				expect(status.activationsCurrent).toBe(1);
				expect(status.activationsLimit).toBe(5);
				expect(status.expiresAt).toBe("2027-01-01T00:00:00Z");
			});

			it("should cache the token in local storage", async () => {
				mockApp.secretStorage.getSecret.mockResolvedValue("valid-key");
				mockRequestUrl.mockResolvedValue({
					status: 200,
					json: createVerifyResponse(),
				});

				await manager.refreshLicense();

				expect(mockApp.saveLocalStorage).toHaveBeenCalledWith(TEST_CONFIG.licenseCacheStorageKey, expect.any(String));
			});

			it("should set error state when token verification fails", async () => {
				mockApp.secretStorage.getSecret.mockResolvedValue("valid-key");
				mockRequestUrl.mockResolvedValue({
					status: 200,
					json: createVerifyResponse(),
				});

				const { jwtVerify } = await import("jose");
				(jwtVerify as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("bad token"));

				await manager.refreshLicense();

				expect(manager.status.state).toBe("error");
				expect(manager.isPro).toBe(false);
			});
		});

		describe("invalid key (401)", () => {
			it("should set state to 'invalid'", async () => {
				mockApp.secretStorage.getSecret.mockResolvedValue("bad-key");
				mockRequestUrl.mockResolvedValue({ status: 401, json: {} });

				await manager.refreshLicense();

				expect(manager.status.state).toBe("invalid");
				expect(manager.isPro).toBe(false);
			});

			it("should clear cached token", async () => {
				mockApp.secretStorage.getSecret.mockResolvedValue("bad-key");
				mockRequestUrl.mockResolvedValue({ status: 401, json: {} });

				await manager.refreshLicense();

				expect(mockApp.saveLocalStorage).toHaveBeenCalledWith(TEST_CONFIG.licenseCacheStorageKey, "");
			});
		});

		describe("forbidden (403)", () => {
			it("should set state to 'device_limit' when message contains 'limit'", async () => {
				mockApp.secretStorage.getSecret.mockResolvedValue("valid-key");
				mockRequestUrl.mockResolvedValue({
					status: 403,
					json: { message: "Device limit reached" },
				});

				await manager.refreshLicense();

				expect(manager.status.state).toBe("device_limit");
			});

			it("should set state to 'invalid' for non-limit 403 errors", async () => {
				mockApp.secretStorage.getSecret.mockResolvedValue("valid-key");
				mockRequestUrl.mockResolvedValue({
					status: 403,
					json: { message: "License canceled" },
				});

				await manager.refreshLicense();

				expect(manager.status.state).toBe("invalid");
			});

			it("should set state to 'invalid' when 403 has no body message", async () => {
				mockApp.secretStorage.getSecret.mockResolvedValue("valid-key");
				mockRequestUrl.mockResolvedValue({ status: 403, json: {} });

				await manager.refreshLicense();

				expect(manager.status.state).toBe("invalid");
			});
		});

		describe("network failure", () => {
			it("should use cached token when available and valid", async () => {
				mockApp.secretStorage.getSecret.mockResolvedValue("valid-key");
				const cached = JSON.stringify({
					token: "cached-jwt",
					expiresAt: "2027-01-01T00:00:00Z",
					activationsCurrent: 1,
					activationsLimit: 5,
				});
				mockApp.loadLocalStorage.mockImplementation((key: string) => {
					if (key === TEST_CONFIG.licenseCacheStorageKey) return cached;
					return null;
				});
				mockRequestUrl.mockResolvedValue({ status: 500, json: {} });

				await manager.refreshLicense();

				expect(manager.status.state).not.toBe("error");
			});

			it("should set error state when no cached token exists", async () => {
				mockApp.secretStorage.getSecret.mockResolvedValue("valid-key");
				mockRequestUrl.mockResolvedValue({ status: 500, json: {} });

				await manager.refreshLicense();

				expect(manager.status.state).toBe("error");
				expect(manager.isPro).toBe(false);
			});

			it("should handle request exceptions", async () => {
				mockApp.secretStorage.getSecret.mockResolvedValue("valid-key");
				mockRequestUrl.mockRejectedValue(new Error("Network error"));

				await manager.refreshLicense();

				expect(manager.status.state).toBe("error");
			});

			it("should set expired state when cached token is expired", async () => {
				mockApp.secretStorage.getSecret.mockResolvedValue("valid-key");
				const cached = JSON.stringify({
					token: "expired-jwt",
					expiresAt: "2020-01-01T00:00:00Z",
					activationsCurrent: 1,
					activationsLimit: 5,
				});
				mockApp.loadLocalStorage.mockImplementation((key: string) => {
					if (key === TEST_CONFIG.licenseCacheStorageKey) return cached;
					return null;
				});
				mockRequestUrl.mockRejectedValue(new Error("Network error"));

				const { jwtVerify, errors: joseErrors } = await import("jose");
				(jwtVerify as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new joseErrors.JWTExpired("expired"));

				await manager.refreshLicense();

				expect(manager.status.state).toBe("expired");
			});
		});
	});

	describe("verifyToken", () => {
		it("should return 'valid' for a valid token", async () => {
			const result = await manager.verifyToken("valid-token");
			expect(result).toBe("valid");
		});

		it("should return 'expired' for an expired token", async () => {
			const { jwtVerify, errors: joseErrors } = await import("jose");
			(jwtVerify as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new joseErrors.JWTExpired("expired"));

			const result = await manager.verifyToken("expired-token");
			expect(result).toBe("expired");
		});

		it("should return 'invalid' for a tampered token", async () => {
			const { jwtVerify } = await import("jose");
			(jwtVerify as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("signature mismatch"));

			const result = await manager.verifyToken("bad-token");
			expect(result).toBe("invalid");
		});

		it("should reuse the same public key for subsequent verifications", async () => {
			const result1 = await manager.verifyToken("token-1");
			const result2 = await manager.verifyToken("token-2");

			expect(result1).toBe("valid");
			expect(result2).toBe("valid");
		});
	});

	describe("initialize", () => {
		it("should create device ID if none exists", async () => {
			mockApp.secretStorage.getSecret.mockResolvedValue(null);
			mockRequestUrl.mockResolvedValue({ status: 200, json: createVerifyResponse() });

			await manager.initialize();

			expect(mockApp.saveLocalStorage).toHaveBeenCalledWith(TEST_CONFIG.deviceIdStorageKey, expect.any(String));
		});

		it("should reuse existing device ID", async () => {
			mockApp.loadLocalStorage.mockImplementation((key: string) => {
				if (key === TEST_CONFIG.deviceIdStorageKey) return "existing-device-id";
				return null;
			});
			mockApp.secretStorage.getSecret.mockResolvedValue(null);

			await manager.initialize();

			expect(mockApp.saveLocalStorage).not.toHaveBeenCalledWith(TEST_CONFIG.deviceIdStorageKey, expect.any(String));
		});

		it("should load cached token and refresh license", async () => {
			mockApp.secretStorage.getSecret.mockResolvedValue(null);

			await manager.initialize();

			expect(manager.status.state).toBe("none");
		});
	});

	describe("isPro$ observable", () => {
		it("should emit true after successful license activation", async () => {
			const values: boolean[] = [];
			const sub = manager.isPro$.subscribe((v) => values.push(v));

			mockApp.secretStorage.getSecret.mockResolvedValue("valid-key");
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: createVerifyResponse(),
			});

			await manager.refreshLicense();

			expect(values).toContain(true);
			sub.unsubscribe();
		});

		it("should emit false after license invalidation", async () => {
			mockApp.secretStorage.getSecret.mockResolvedValue("valid-key");
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: createVerifyResponse(),
			});
			await manager.refreshLicense();
			expect(manager.isPro).toBe(true);

			mockRequestUrl.mockResolvedValue({ status: 401, json: {} });
			await manager.refreshLicense();

			expect(manager.isPro).toBe(false);
		});
	});
});
