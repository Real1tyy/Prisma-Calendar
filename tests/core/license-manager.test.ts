import { buildUtmUrl } from "@real1ty-obsidian-plugins";
import { requestUrl, type App } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	createLicenseManager,
	DEVICE_ID_STORAGE_KEY,
	LICENSE_CACHE_STORAGE_KEY,
	PRO_PURCHASE_URL,
} from "../../src/core/license";
import type { PrismaCalendarSettingsStore } from "../../src/types";
import { createMockLicenseSettingsStore } from "../fixtures/settings-fixtures";

// LicenseManager's behaviour (verify flow, result-code mapping, caching, network
// fallback, heartbeat, deactivation) lives in the shared library and is covered
// by shared/tests/license/license-manager.test.ts. These tests only assert the
// Prisma-specific wiring that createLicenseManager() injects: product identity,
// the UTM purchase URL, the plugin's storage keys, and the lazy license-key
// getter sourced from the settings store.

const mockRequestUrl = vi.mocked(requestUrl);

function createMockApp(localStorageData: Record<string, string> = {}): App {
	const storage = new Map(Object.entries(localStorageData));
	return {
		loadLocalStorage: vi.fn((key: string) => storage.get(key) ?? null),
		saveLocalStorage: vi.fn((key: string, value: string) => {
			if (value) storage.set(key, value);
			else storage.delete(key);
		}),
		secretStorage: { getSecret: vi.fn().mockReturnValue(null) },
		vault: { adapter: {} },
	} as unknown as App;
}

function makeManager(app: App, store: ReturnType<typeof createMockLicenseSettingsStore>) {
	return createLicenseManager(app, store as unknown as PrismaCalendarSettingsStore, "2.6.0");
}

describe("createLicenseManager — Prisma wiring", () => {
	let app: App;

	beforeEach(() => {
		vi.clearAllMocks();
		app = createMockApp();
	});

	it("wires the Prisma product name and UTM-tagged purchase URL", () => {
		const store = createMockLicenseSettingsStore({ licenseKeySecretName: "my-license-secret" });

		const manager = makeManager(app, store);

		expect(manager.productName).toBe("Prisma Calendar");
		expect(manager.purchaseUrl).toBe(
			buildUtmUrl(PRO_PURCHASE_URL, "prisma-calendar", "plugin", "settings", "license_section")
		);
	});

	it("persists the device id and reads the cache under the Prisma storage keys", async () => {
		const store = createMockLicenseSettingsStore({ licenseKeySecretName: "" });
		const manager = makeManager(app, store);

		await manager.initialize();
		manager.dispose();

		expect(app.saveLocalStorage).toHaveBeenCalledWith(DEVICE_ID_STORAGE_KEY, expect.any(String));
		expect(app.loadLocalStorage).toHaveBeenCalledWith(LICENSE_CACHE_STORAGE_KEY);
	});

	it("reads the license key lazily from the settings store, staying offline when it is unset", async () => {
		const store = createMockLicenseSettingsStore({ licenseKeySecretName: "" });
		const manager = makeManager(app, store);

		await manager.initialize();
		manager.dispose();

		expect(manager.isPro).toBe(false);
		expect(manager.status.state).toBe("none");
		expect(mockRequestUrl).not.toHaveBeenCalled();
	});
});
