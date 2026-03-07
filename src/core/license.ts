import { Notice } from "obsidian";

export const FREE_MAX_CALENDARS = 3;
export const FREE_MAX_EVENT_PRESETS = 2;

const PRO_PURCHASE_URL = "https://matejvavroproductivity.com/tools/prisma-calendar";

export const PRO_FEATURES = {
	AI_CHAT: "AI Chat",
	CALDAV_SYNC: "CalDAV Sync",
	ICS_SYNC: "ICS Subscriptions",
	PROGRAMMATIC_API: "Programmatic API",
	CATEGORY_ASSIGNMENT_PRESETS: "Category Assignment Presets",
	UNLIMITED_CALENDARS: "Unlimited Calendars",
	UNLIMITED_EVENT_PRESETS: "Unlimited Event Presets",
} as const;

export type ProFeature = (typeof PRO_FEATURES)[keyof typeof PRO_FEATURES];

export function isProEnabled(): boolean {
	return false;
}

export function showProUpgradeNotice(feature: string): void {
	new Notice(`${feature} requires Prisma Calendar Pro.\nVisit ${PRO_PURCHASE_URL} to learn more.`, 8000);
}

export { PRO_PURCHASE_URL };
