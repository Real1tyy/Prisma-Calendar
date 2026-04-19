import type { FrontmatterDiff } from "@real1ty-obsidian-plugins";

import type { SingleCalendarConfig } from "../../types";

export interface TimePropagationDiff {
	startChange?: { oldValue: string; newValue: string } | undefined;
	endChange?: { oldValue: string; newValue: string } | undefined;
}

interface StringChange {
	oldValue: string;
	newValue: string;
}

function findStringChange(diff: FrontmatterDiff, prop: string): StringChange | undefined {
	for (const c of diff.modified) {
		if (c.key === prop && typeof c.oldValue === "string" && typeof c.newValue === "string") {
			return { oldValue: c.oldValue, newValue: c.newValue };
		}
	}
	return undefined;
}

export function extractTimeDiffFromFrontmatterDiff(
	diff: FrontmatterDiff,
	settings: SingleCalendarConfig
): TimePropagationDiff | null {
	const startChange = findStringChange(diff, settings.startProp);
	const endChange = findStringChange(diff, settings.endProp);

	if (!startChange && !endChange) return null;

	return { startChange, endChange };
}
