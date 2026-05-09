import { createContext, useContext } from "react";

import type CustomCalendarPlugin from "../../main";

export const PluginContext = createContext<CustomCalendarPlugin | null>(null);

export function usePlugin(): CustomCalendarPlugin {
	const plugin = useContext(PluginContext);
	if (!plugin) {
		throw new Error("usePlugin must be used within a PluginContext provider");
	}
	return plugin;
}
