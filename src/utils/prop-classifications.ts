import { PROP_CLASSIFICATIONS } from "../types/event-metadata";
import type { SingleCalendarConfig } from "../types/settings";

type SettingsPropKey = keyof SingleCalendarConfig;

export function computeSystemPropKeys(): SettingsPropKey[] {
	return PROP_CLASSIFICATIONS.filter((c) => c.system).map((c) => c.settingsProp);
}

export function computeDedicatedUIPropKeys(): SettingsPropKey[] {
	return PROP_CLASSIFICATIONS.filter((c) => c.dedicatedUI).map((c) => c.settingsProp);
}

export function computeNotificationSystemPropKeys(): SettingsPropKey[] {
	return PROP_CLASSIFICATIONS.filter((c) => c.notificationSystem).map((c) => c.settingsProp);
}

export function computeNotificationDedicatedUIPropKeys(): SettingsPropKey[] {
	return PROP_CLASSIFICATIONS.filter((c) => c.notificationDedicatedUI).map((c) => c.settingsProp);
}
