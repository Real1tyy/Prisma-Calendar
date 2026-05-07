import type { DateTime } from "luxon";
import type { ReactNode } from "react";

export type SourceTab = "name" | "category" | "recurring";

export interface TabConfig {
	id: SourceTab;
	label: string;
}

export interface EventRowItem {
	date: DateTime;
	title: string;
	filePath: string;
	skipped: boolean;
	color?: string | undefined;
	allColors?: string[] | undefined;
}

export interface EventListOptions {
	title?: string;
	onTitleClick?: () => void;
	hidePast: boolean;
	hideSkipped: boolean;
	onHidePastChange: (value: boolean) => void;
	onHideSkippedChange: (value: boolean) => void;
	extraInfo?: ReactNode;
}
