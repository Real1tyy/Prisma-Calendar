import type { CachedLicenseData, LicenseVerifyResponse } from "@real1ty-obsidian-plugins";
import { silenceConsole } from "@real1ty-obsidian-plugins/testing";
import { Notice, requestUrl } from "obsidian";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LicenseManagerConfig } from "../../src/core/license";
import { DEVICE_ID_STORAGE_KEY, LICENSE_CACHE_STORAGE_KEY, LicenseManager } from "../../src/core/license";
import { CustomCalendarSettingsSchema } from "../../src/types/settings";

const TEST_CONFIG: LicenseManagerConfig = {
	productName: "Prisma Calendar",
	purchaseUrl: "https://matejvavroproductivity.com/tools/prisma-calendar",
	deviceIdStorageKey: DEVICE_ID_STORAGE_KEY,
	licenseCacheStorageKey: LICENSE_CACHE_STORAGE_KEY,
};

const mockRequestUrl = vi.mocked(requestUrl);

function mockResponse(status: number, json: unknown) {
	return { status, json, headers: {}, arrayBuffer: new ArrayBuffer(0), text: "" };
}

function createMockApp(localStorageData: Record<string, string> = {}) {
	const storage = new Map(Object.entries(localStorageData));
	return {
		loadLocalStorage: vi.fn((key: string) => storage.get(key) ?? null),
		saveLocalStorage: vi.fn((key: string, value: string) => {
			if (value) {
				storage.set(key, value);
			} else {
				storage.delete(key);
			}
		}),
		secretStorage: {
			getSecret: vi.fn().mockReturnValue(null),
		},
		vault: { adapter: {} },
	} as any;
}

function createMockSettingsStore(overrides: Record<string, unknown> = {}) {
	const defaults = CustomCalendarSettingsSchema.parse({});
	const settings = { ...defaults, ...overrides };
	const subject = new BehaviorSubject(settings);

	return {
		currentSettings: settings,
		settings$: subject.asObservable(),
		updateSettings: vi.fn(async (updater: (s: unknown) => unknown) => {
			const newSettings = updater(settings);
			Object.assign(settings, newSettings);
			subject.next(settings);
		}),
	} as any;
}

function successResponse(overrides: Partial<LicenseVerifyResponse> = {}) {
	return mockResponse(200, {
		token: "eyJhbGciOiJFUzI1NiIs.test-token.signature",
		expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
		productId: "prisma-calendar",
		activations: { current: 1, limit: 5 },
		...overrides,
	});
}

function cachedTokenData(overrides: Partial<CachedLicenseData> = {}): CachedLicenseData {
	return {
		token: "cached-token-jwt",
		expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
		activationsCurrent: 2,
		activationsLimit: 5,
		...overrides,
	};
}

describe("LicenseManager", () => {
	let app: ReturnType<typeof createMockApp>;
	let settingsStore: ReturnType<typeof createMockSettingsStore>;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(LicenseManager.prototype, "verifyToken").mockResolvedValue("valid");
		app = createMockApp();
		settingsStore = createMockSettingsStore({ licenseKeySecretName: "my-license-secret" });
	});

	describe("Device ID management", () => {
		it("should generate and persist a device ID on first run", async () => {
			app.secretStorage.getSecret.mockReturnValue("PRISM-TEST-KEY");
			mockRequestUrl.mockResolvedValue(successResponse());

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(app.loadLocalStorage).toHaveBeenCalledWith(DEVICE_ID_STORAGE_KEY);
			expect(app.saveLocalStorage).toHaveBeenCalledWith(DEVICE_ID_STORAGE_KEY, expect.any(String));

			const savedId = app.saveLocalStorage.mock.calls.find((c: string[]) => c[0] === DEVICE_ID_STORAGE_KEY)?.[1];
			expect(savedId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
		});

		it("should reuse existing device ID", async () => {
			app = createMockApp({ [DEVICE_ID_STORAGE_KEY]: "existing-device-id" });
			app.secretStorage = { getSecret: vi.fn().mockReturnValue("PRISM-TEST-KEY") };
			mockRequestUrl.mockResolvedValue(successResponse());

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(app.saveLocalStorage).not.toHaveBeenCalledWith(DEVICE_ID_STORAGE_KEY, expect.any(String));
		});
	});

	describe("No license configured", () => {
		it("should stay in 'none' state when no license key secret name is set", async () => {
			settingsStore = createMockSettingsStore({ licenseKeySecretName: "" });

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(manager.isPro).toBe(false);
			expect(manager.status.state).toBe("none");
			expect(mockRequestUrl).not.toHaveBeenCalled();
		});

		it("should stay in 'none' state when secret storage returns null", async () => {
			app.secretStorage.getSecret.mockReturnValue(null);

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(manager.isPro).toBe(false);
			expect(manager.status.state).toBe("none");
			expect(mockRequestUrl).not.toHaveBeenCalled();
		});
	});

	describe("Successful verification", () => {
		beforeEach(() => {
			app.secretStorage.getSecret.mockReturnValue("PRISM-VALID-KEY");
		});

		it("should activate pro on 200 response", async () => {
			mockRequestUrl.mockResolvedValue(successResponse());

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(manager.isPro).toBe(true);
			expect(manager.status.state).toBe("valid");
		});

		it("should store activation counts from response", async () => {
			mockRequestUrl.mockResolvedValue(successResponse({ activations: { current: 3, limit: 5 } }));

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			const status = manager.status;
			expect(status.activationsCurrent).toBe(3);
			expect(status.activationsLimit).toBe(5);
		});

		it("should store expiry date from response", async () => {
			const expiresAt = "2026-03-20T12:00:00.000Z";
			mockRequestUrl.mockResolvedValue(successResponse({ expiresAt }));

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(manager.status.expiresAt).toBe(expiresAt);
		});

		it("should cache token in localStorage", async () => {
			mockRequestUrl.mockResolvedValue(successResponse());

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(app.saveLocalStorage).toHaveBeenCalledWith(LICENSE_CACHE_STORAGE_KEY, expect.stringContaining("token"));

			const cachedRaw = app.saveLocalStorage.mock.calls.find((c: string[]) => c[0] === LICENSE_CACHE_STORAGE_KEY)?.[1];
			const cached = JSON.parse(cachedRaw) as CachedLicenseData;
			expect(cached.token).toBeTruthy();
			expect(cached.expiresAt).toBeTruthy();
			expect(cached.activationsCurrent).toBeGreaterThanOrEqual(0);
			expect(cached.activationsLimit).toBeGreaterThan(0);
		});

		it("should send correct request body", async () => {
			app = createMockApp({ [DEVICE_ID_STORAGE_KEY]: "test-device-id" });
			app.secretStorage = { getSecret: vi.fn().mockReturnValue("PRISM-MY-KEY") };
			mockRequestUrl.mockResolvedValue(successResponse());

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					method: "POST",
					headers: { "Content-Type": "application/json" },
				})
			);

			const arg = mockRequestUrl.mock.calls[0][0] as { body: string };
			const body = JSON.parse(arg.body);
			expect(body.licenseKey).toBe("PRISM-MY-KEY");
			expect(body.deviceId).toBe("test-device-id");
			expect(body.pluginVersion).toBe("2.6.0");
			expect(body.platform).toBe("linux");
		});

		it("should emit on status$ observable", async () => {
			mockRequestUrl.mockResolvedValue(successResponse());

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			const callback = vi.fn();
			const sub = manager.status$.subscribe(callback);
			callback.mockClear();
			await manager.initialize();

			expect(callback).toHaveBeenCalled();
			sub.unsubscribe();
		});

		it("should emit true on isPro$ observable", async () => {
			mockRequestUrl.mockResolvedValue(successResponse());

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			const values: boolean[] = [];
			manager.isPro$.subscribe((v) => values.push(v));

			await manager.initialize();

			expect(values).toContain(true);
		});

		it("should reject 200 response with invalid token signature", async () => {
			vi.spyOn(LicenseManager.prototype, "verifyToken").mockResolvedValue("invalid");
			mockRequestUrl.mockResolvedValue(successResponse());

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(manager.isPro).toBe(false);
			expect(manager.status.state).toBe("error");
			expect(manager.status.errorMessage).toContain("token verification failed");
		});
	});

	describe("Invalid license (401)", () => {
		beforeEach(() => {
			app.secretStorage.getSecret.mockReturnValue("PRISM-BAD-KEY");
		});

		it("should set state to invalid", async () => {
			mockRequestUrl.mockResolvedValue(mockResponse(401, {}));

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(manager.isPro).toBe(false);
			expect(manager.status.state).toBe("invalid");
			expect(manager.status.errorMessage).toContain("Invalid license key");
		});

		it("should clear cached token", async () => {
			app = createMockApp({
				[LICENSE_CACHE_STORAGE_KEY]: JSON.stringify(cachedTokenData()),
			});
			app.secretStorage = { getSecret: vi.fn().mockReturnValue("PRISM-BAD-KEY") };
			mockRequestUrl.mockResolvedValue(mockResponse(401, {}));

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(app.saveLocalStorage).toHaveBeenCalledWith(LICENSE_CACHE_STORAGE_KEY, "");
		});
	});

	describe("Forbidden (403)", () => {
		beforeEach(() => {
			app.secretStorage.getSecret.mockReturnValue("PRISM-VALID-KEY");
		});

		it("should detect device limit from error message", async () => {
			mockRequestUrl.mockResolvedValue(mockResponse(403, { message: "Activation limit exceeded" }));

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(manager.isPro).toBe(false);
			expect(manager.status.state).toBe("device_limit");
			expect(manager.status.errorMessage).toContain("Device limit reached");
		});

		it("should treat other 403 as expired/canceled", async () => {
			mockRequestUrl.mockResolvedValue(mockResponse(403, { message: "Entitlement inactive" }));

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(manager.isPro).toBe(false);
			expect(manager.status.state).toBe("invalid");
			expect(manager.status.errorMessage).toContain("expired or canceled");
		});

		it("should clear cached token on 403", async () => {
			mockRequestUrl.mockResolvedValue(mockResponse(403, { message: "Activation limit exceeded" }));

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(app.saveLocalStorage).toHaveBeenCalledWith(LICENSE_CACHE_STORAGE_KEY, "");
		});
	});

	describe("Network failure with valid cache", () => {
		it("should remain pro if cached token is still valid", async () => {
			const cached = cachedTokenData();
			app = createMockApp({
				[LICENSE_CACHE_STORAGE_KEY]: JSON.stringify(cached),
			});
			app.secretStorage = { getSecret: vi.fn().mockReturnValue("PRISM-VALID-KEY") };
			mockRequestUrl.mockRejectedValue(new Error("Network error"));

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(manager.isPro).toBe(true);
			expect(manager.status.state).toBe("valid");
		});

		it("should use cached activation data", async () => {
			const cached = cachedTokenData({ activationsCurrent: 4, activationsLimit: 10 });
			app = createMockApp({
				[LICENSE_CACHE_STORAGE_KEY]: JSON.stringify(cached),
			});
			app.secretStorage = { getSecret: vi.fn().mockReturnValue("PRISM-VALID-KEY") };
			mockRequestUrl.mockRejectedValue(new Error("Network error"));

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			const status = manager.status;
			expect(status.activationsCurrent).toBe(4);
			expect(status.activationsLimit).toBe(10);
		});

		it("should not set error state when cache is valid", async () => {
			const cached = cachedTokenData();
			app = createMockApp({
				[LICENSE_CACHE_STORAGE_KEY]: JSON.stringify(cached),
			});
			app.secretStorage = { getSecret: vi.fn().mockReturnValue("PRISM-VALID-KEY") };
			mockRequestUrl.mockRejectedValue(new Error("Network error"));

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(manager.status.state).toBe("valid");
			expect(manager.status.errorMessage).toBeNull();
		});

		it("should keep pro active on repeated network failures with valid cache", async () => {
			const cached = cachedTokenData();
			app = createMockApp({
				[LICENSE_CACHE_STORAGE_KEY]: JSON.stringify(cached),
			});
			app.secretStorage = { getSecret: vi.fn().mockReturnValue("PRISM-VALID-KEY") };
			mockRequestUrl.mockRejectedValue(new Error("Network error"));

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();
			expect(manager.isPro).toBe(true);

			await manager.refreshLicense();
			expect(manager.isPro).toBe(true);

			await manager.refreshLicense();
			expect(manager.isPro).toBe(true);
		});

		it("should reject cached token with invalid signature on network failure", async () => {
			const cached = cachedTokenData();
			app = createMockApp({
				[LICENSE_CACHE_STORAGE_KEY]: JSON.stringify(cached),
			});
			app.secretStorage = { getSecret: vi.fn().mockReturnValue("PRISM-VALID-KEY") };
			mockRequestUrl.mockRejectedValue(new Error("Network error"));

			vi.spyOn(LicenseManager.prototype, "verifyToken")
				.mockResolvedValueOnce("valid") // loadCachedToken succeeds
				.mockResolvedValueOnce("invalid"); // handleNetworkFailure fails

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(manager.isPro).toBe(false);
			expect(manager.status.state).toBe("error");
		});

		it("should show expired message when cached token JWT is expired on network failure", async () => {
			const cached = cachedTokenData();
			app = createMockApp({
				[LICENSE_CACHE_STORAGE_KEY]: JSON.stringify(cached),
			});
			app.secretStorage = { getSecret: vi.fn().mockReturnValue("PRISM-VALID-KEY") };
			mockRequestUrl.mockRejectedValue(new Error("Network error"));

			vi.spyOn(LicenseManager.prototype, "verifyToken")
				.mockResolvedValueOnce("valid") // loadCachedToken succeeds
				.mockResolvedValueOnce("expired"); // handleNetworkFailure detects expiration

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(manager.isPro).toBe(false);
			expect(manager.status.state).toBe("expired");
			expect(manager.status.errorMessage).toContain("Cached license expired");
		});
	});

	describe("Network failure with expired cache", () => {
		it("should set error state when cached JWT is expired and network fails", async () => {
			const expired = cachedTokenData({
				expiresAt: new Date(Date.now() - 1000).toISOString(),
			});
			app = createMockApp({
				[LICENSE_CACHE_STORAGE_KEY]: JSON.stringify(expired),
			});
			app.secretStorage = { getSecret: vi.fn().mockReturnValue("PRISM-VALID-KEY") };
			mockRequestUrl.mockRejectedValue(new Error("Network error"));
			vi.spyOn(LicenseManager.prototype, "verifyToken").mockResolvedValue("expired");

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			// loadCachedToken clears the expired cache, then handleNetworkFailure
			// finds no cache and sets generic error
			expect(manager.isPro).toBe(false);
			expect(manager.status.state).toBe("error");
		});
	});

	describe("Network failure with no cache", () => {
		it("should set error state when no cache exists", async () => {
			app.secretStorage.getSecret.mockReturnValue("PRISM-VALID-KEY");
			mockRequestUrl.mockRejectedValue(new Error("Network error"));

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(manager.isPro).toBe(false);
			expect(manager.status.state).toBe("error");
		});
	});

	describe("Server error (500) with valid cache", () => {
		it("should fall back to cached token on server error", async () => {
			const cached = cachedTokenData();
			app = createMockApp({
				[LICENSE_CACHE_STORAGE_KEY]: JSON.stringify(cached),
			});
			app.secretStorage = { getSecret: vi.fn().mockReturnValue("PRISM-VALID-KEY") };
			mockRequestUrl.mockResolvedValue(mockResponse(500, {}));

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(manager.isPro).toBe(true);
		});
	});

	describe("Cached token loading on startup", () => {
		it("should activate pro from valid cache before network call", async () => {
			const cached = cachedTokenData();
			app = createMockApp({
				[LICENSE_CACHE_STORAGE_KEY]: JSON.stringify(cached),
			});
			app.secretStorage = { getSecret: vi.fn().mockReturnValue("PRISM-VALID-KEY") };

			let proBeforeNetworkCall = false;
			mockRequestUrl.mockImplementation((() => {
				proBeforeNetworkCall = manager.isPro;
				return Promise.resolve(successResponse());
			}) as any);

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(proBeforeNetworkCall).toBe(true);
		});

		it("should not activate pro when cached token has invalid signature", async () => {
			const cached = cachedTokenData();
			app = createMockApp({
				[LICENSE_CACHE_STORAGE_KEY]: JSON.stringify(cached),
			});
			app.secretStorage = { getSecret: vi.fn().mockReturnValue("PRISM-VALID-KEY") };

			vi.spyOn(LicenseManager.prototype, "verifyToken")
				.mockResolvedValueOnce("invalid") // loadCachedToken fails
				.mockResolvedValue("valid"); // refreshLicense succeeds
			mockRequestUrl.mockResolvedValue(successResponse());

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(app.saveLocalStorage).toHaveBeenCalledWith(LICENSE_CACHE_STORAGE_KEY, "");
			expect(manager.isPro).toBe(true);
		});

		it("should handle corrupted cache data gracefully", async () => {
			app = createMockApp({
				[LICENSE_CACHE_STORAGE_KEY]: "not-valid-json{{{",
			});
			app.secretStorage = { getSecret: vi.fn().mockReturnValue("PRISM-VALID-KEY") };
			mockRequestUrl.mockResolvedValue(successResponse());

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(manager.isPro).toBe(true);
		});
	});

	describe("Cache invalidation then network failure", () => {
		it("should NOT activate pro when cache was cleared by 401 and network then fails", async () => {
			const cached = cachedTokenData();
			app = createMockApp({
				[LICENSE_CACHE_STORAGE_KEY]: JSON.stringify(cached),
			});
			app.secretStorage = { getSecret: vi.fn().mockReturnValue("PRISM-VALID-KEY") };

			mockRequestUrl.mockResolvedValueOnce(mockResponse(401, {}));

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();
			expect(manager.isPro).toBe(false);
			expect(manager.status.state).toBe("invalid");

			mockRequestUrl.mockRejectedValueOnce(new Error("Network error"));
			await manager.refreshLicense();

			expect(manager.isPro).toBe(false);
			expect(manager.status.state).toBe("error");
		});

		it("should NOT activate pro when cache was cleared by 403 and network then fails", async () => {
			const cached = cachedTokenData();
			app = createMockApp({
				[LICENSE_CACHE_STORAGE_KEY]: JSON.stringify(cached),
			});
			app.secretStorage = { getSecret: vi.fn().mockReturnValue("PRISM-VALID-KEY") };

			mockRequestUrl.mockResolvedValueOnce(mockResponse(403, { message: "Activation limit exceeded" }));

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();
			expect(manager.isPro).toBe(false);

			mockRequestUrl.mockRejectedValueOnce(new Error("Network error"));
			await manager.refreshLicense();

			expect(manager.isPro).toBe(false);
		});
	});

	describe("Manual refresh", () => {
		it("should update state on successful refresh", async () => {
			app.secretStorage.getSecret.mockReturnValue("PRISM-VALID-KEY");
			mockRequestUrl.mockResolvedValueOnce(mockResponse(401, {}));

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();
			expect(manager.isPro).toBe(false);

			mockRequestUrl.mockResolvedValueOnce(successResponse());
			await manager.refreshLicense();

			expect(manager.isPro).toBe(true);
			expect(manager.status.state).toBe("valid");
		});

		it("should deactivate pro on failed refresh", async () => {
			app.secretStorage.getSecret.mockReturnValue("PRISM-VALID-KEY");
			mockRequestUrl.mockResolvedValueOnce(successResponse());

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();
			expect(manager.isPro).toBe(true);

			mockRequestUrl.mockResolvedValueOnce(mockResponse(401, {}));
			await manager.refreshLicense();

			expect(manager.isPro).toBe(false);
			expect(manager.status.state).toBe("invalid");
		});
	});

	describe("requirePro", () => {
		silenceConsole(["log", "info", "warn", "error"]);

		it("should return true when pro is active", async () => {
			app.secretStorage.getSecret.mockReturnValue("PRISM-VALID-KEY");
			mockRequestUrl.mockResolvedValue(successResponse());

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(manager.requirePro("AI Chat")).toBe(true);
			expect(Notice).not.toHaveBeenCalled();
		});

		it("should return false and show notice when pro is not active", async () => {
			settingsStore = createMockSettingsStore({ licenseKeySecretName: "" });

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			await manager.initialize();

			expect(manager.requirePro("AI Chat")).toBe(false);
			expect(Notice).toHaveBeenCalledWith(expect.stringContaining("AI Chat"), expect.any(Number));
		});
	});

	describe("Status snapshots", () => {
		it("should emit a new reference on each transition", async () => {
			app.secretStorage.getSecret.mockReturnValue("PRISM-VALID-KEY");
			mockRequestUrl.mockResolvedValue(successResponse());

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);

			const snapshots: Array<{ state: string }> = [];
			const sub = manager.status$.subscribe((s) => snapshots.push(s));
			await manager.initialize();
			sub.unsubscribe();

			expect(snapshots.length).toBeGreaterThan(1);
			for (let i = 1; i < snapshots.length; i++) {
				expect(snapshots[i]).not.toBe(snapshots[i - 1]);
			}
		});
	});

	describe("isPro$ observable", () => {
		it("should emit false initially then true after successful verification", async () => {
			app.secretStorage.getSecret.mockReturnValue("PRISM-VALID-KEY");
			mockRequestUrl.mockResolvedValue(successResponse());

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			const emissions: boolean[] = [];
			manager.isPro$.subscribe((v) => emissions.push(v));

			expect(emissions).toEqual([false]);

			await manager.initialize();

			expect(emissions[emissions.length - 1]).toBe(true);
		});

		it("should not emit duplicate values", async () => {
			const cached = cachedTokenData();
			app = createMockApp({
				[LICENSE_CACHE_STORAGE_KEY]: JSON.stringify(cached),
			});
			app.secretStorage = { getSecret: vi.fn().mockReturnValue("PRISM-VALID-KEY") };
			mockRequestUrl.mockResolvedValue(successResponse());

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			const emissions: boolean[] = [];
			manager.isPro$.subscribe((v) => emissions.push(v));

			await manager.initialize();

			const trueCount = emissions.filter((v) => v === true).length;
			expect(trueCount).toBe(1);
		});

		it("should transition from true to false when license becomes invalid on refresh", async () => {
			app.secretStorage.getSecret.mockReturnValue("PRISM-VALID-KEY");
			mockRequestUrl.mockResolvedValue(successResponse());

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			const emissions: boolean[] = [];
			manager.isPro$.subscribe((v) => emissions.push(v));

			await manager.initialize();
			expect(manager.isPro).toBe(true);

			mockRequestUrl.mockResolvedValueOnce(mockResponse(401, {}));
			await manager.refreshLicense();

			expect(manager.isPro).toBe(false);
			expect(emissions).toEqual([false, true, false]);
		});

		it("should transition back to true when re-verified after invalidation", async () => {
			app.secretStorage.getSecret.mockReturnValue("PRISM-VALID-KEY");
			mockRequestUrl.mockResolvedValueOnce(mockResponse(401, {}));

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);
			const emissions: boolean[] = [];
			manager.isPro$.subscribe((v) => emissions.push(v));

			await manager.initialize();
			expect(manager.isPro).toBe(false);

			mockRequestUrl.mockResolvedValueOnce(successResponse());
			await manager.refreshLicense();

			expect(manager.isPro).toBe(true);
			expect(emissions).toEqual([false, true]);
		});

		it("should allow reactive subscription for API exposure", async () => {
			app.secretStorage.getSecret.mockReturnValue("PRISM-VALID-KEY");
			mockRequestUrl.mockResolvedValue(successResponse());

			const manager = new LicenseManager(
				app,
				() => settingsStore.currentSettings.licenseKeySecretName,
				"2.6.0",
				TEST_CONFIG
			);

			let apiExposed = false;
			manager.isPro$.subscribe((isPro) => {
				apiExposed = isPro;
			});

			expect(apiExposed).toBe(false);

			await manager.initialize();

			expect(apiExposed).toBe(true);
		});
	});
});
