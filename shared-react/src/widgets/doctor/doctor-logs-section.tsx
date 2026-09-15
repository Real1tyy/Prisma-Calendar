import { memo, useCallback, useState } from "react";

import type { ScopedTheme } from "../../contexts/theme-context";
import { ObsidianIcon } from "../../primitives/atoms/obsidian-icon";
import { testIdAttr } from "../../utils/test-id";
import { LogsViewer, type LogsViewerProps } from "../logs-viewer/logs-viewer";

export type DoctorLogsConfig = Omit<LogsViewerProps, "variant">;

export const DOCTOR_LOGS_COPY = {
	heading: "Logs",
	hint: "What the plugin recorded — filter by level, scope, text or time. Ctrl/Cmd+F searches.",
} as const;

interface DoctorLogsSectionProps extends Pick<ScopedTheme, "cls" | "tid"> {
	logs: DoctorLogsConfig;
}

/**
 * The evidence behind the health rows, collapsed until asked for. The viewer
 * mounts only on expand, so a Doctor opened for a quick verdict pays nothing
 * for it — and toggling never re-runs the checks, whose state lives above.
 */
export const DoctorLogsSection = memo(function DoctorLogsSection({ logs, cls, tid }: DoctorLogsSectionProps) {
	const [open, setOpen] = useState(false);
	const toggle = useCallback(() => setOpen((current) => !current), []);

	return (
		<section className={cls("logs")} {...testIdAttr(tid("logs"))}>
			<button
				type="button"
				className={cls("logs-toggle")}
				aria-expanded={open}
				onClick={toggle}
				{...testIdAttr(tid("logs-toggle"))}
			>
				<ObsidianIcon icon={open ? "chevron-down" : "chevron-right"} className={cls("logs-caret")} />
				<span className={cls("logs-heading")}>{DOCTOR_LOGS_COPY.heading}</span>
				<span className={cls("logs-hint")}>{DOCTOR_LOGS_COPY.hint}</span>
			</button>
			{open && <LogsViewer {...logs} variant="embedded" />}
		</section>
	);
});
