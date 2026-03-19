import { LicenseManager, type LicenseManagerConfig } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import type { PrismaCalendarSettingsStore } from "../types";

export { LicenseManager };
export type {
	CachedLicenseData,
	LicenseManagerConfig,
	LicenseStatus,
	LicenseVerifyResponse,
} from "@real1ty-obsidian-plugins";

export const FREE_MAX_CALENDARS = 3;
export const FREE_MAX_EVENT_PRESETS = 2;

export const PRO_PURCHASE_URL = "https://matejvavroproductivity.com/tools/prisma-calendar";
export const DEVICE_ID_STORAGE_KEY = "prisma-calendar-device-id";
export const LICENSE_CACHE_STORAGE_KEY = "prisma-calendar-license-cache";

export const PRO_FEATURES = {
	AI_CHAT: "AI Chat",
	CALDAV_SYNC: "CalDAV Sync",
	ICS_SYNC: "ICS Subscriptions",
	PROGRAMMATIC_API: "Programmatic API",
	CATEGORY_ASSIGNMENT_PRESETS: "Category Assignment Presets",
	UNLIMITED_CALENDARS: "Unlimited Calendars",
	UNLIMITED_EVENT_PRESETS: "Unlimited Event Presets",
	HEATMAP: "Heatmap View",
	BASES_VIEW: "Bases Calendar View",
	PREREQUISITE_CONNECTIONS: "Prerequisite Connections",
} as const;

const LICENSE_CONFIG: LicenseManagerConfig = {
	productName: "Prisma Calendar",
	purchaseUrl: PRO_PURCHASE_URL,
	deviceIdStorageKey: DEVICE_ID_STORAGE_KEY,
	licenseCacheStorageKey: LICENSE_CACHE_STORAGE_KEY,
};

export function createLicenseManager(
	app: App,
	settingsStore: PrismaCalendarSettingsStore,
	pluginVersion: string
): LicenseManager {
	return new LicenseManager(
		app,
		() => settingsStore.currentSettings.licenseKeySecretName,
		pluginVersion,
		LICENSE_CONFIG
	);
}
