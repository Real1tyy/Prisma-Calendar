import { type SettingsUpdater, useSettingsStore } from "@real1ty-obsidian-plugins-react";
import { createContext, useContext } from "react";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type { SingleCalendarConfig } from "../../types/index";

export const BundleContext = createContext<CalendarBundle | null>(null);

export function useBundle(): CalendarBundle {
	const bundle = useContext(BundleContext);
	if (!bundle) {
		throw new Error("useBundle must be used within a BundleContext provider");
	}
	return bundle;
}

export function useBundleSettings(): readonly [SingleCalendarConfig, SettingsUpdater<SingleCalendarConfig>] {
	const bundle = useBundle();
	return useSettingsStore(bundle.settingsStore);
}
