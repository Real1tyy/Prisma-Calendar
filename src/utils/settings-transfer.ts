import type { CustomCalendarSettings } from "../types/settings";

export const PRISMA_SETTINGS_TRANSFER_FILENAME = "prisma-calendar-settings.json";

export const PRISMA_NON_TRANSFERABLE_SETTINGS: ReadonlyArray<keyof CustomCalendarSettings> = [
	"licenseKeySecretName",
	"version",
];
