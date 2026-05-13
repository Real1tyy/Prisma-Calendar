import { createContext, useContext } from "react";

import type { CalendarBundle } from "../../core/calendar-bundle";

export const BundleContext = createContext<CalendarBundle | null>(null);

export function useBundle(): CalendarBundle {
	const bundle = useContext(BundleContext);
	if (!bundle) {
		throw new Error("useBundle must be used within a BundleContext provider");
	}
	return bundle;
}
