import { describeError, summarizeHealth, type HealthCheck, type HealthStatus } from "@real1ty/obsidian-plugins";
import { Notice } from "obsidian";
import { memo, useCallback, useState } from "react";

import type { ScopedTheme } from "../../contexts/theme-context";
import { useScopedStyles } from "../../hooks/styles/use-styles";
import { Button } from "../../primitives/atoms/button";
import { testIdAttr } from "../../utils/test-id";
import { PrivacyDisclaimer } from "../privacy-disclaimer/privacy-disclaimer";
import { DoctorLogsSection, type DoctorLogsConfig } from "./doctor-logs-section";
import { buildDoctorStyles } from "./doctor-view.styles";

/** The glyph and screen-reader word for each verdict. */
const STATUS_GLYPH: Record<HealthStatus, string> = { ok: "✓", warn: "!", fail: "✕" };
const STATUS_WORD: Record<HealthStatus, string> = { ok: "Healthy", warn: "Warning", fail: "Problem" };

export const DOCTOR_COPY = {
	title: "Doctor",
	healthy: "Everything looks healthy.",
	copyLabel: "Copy debug",
	saveLabel: "Save debug to file",
	refreshLabel: "Re-run checks",
	bugReportLabel: "Create bug report",
	copySuccess: "Debug bundle copied to the clipboard",
	copyFailure: "Could not copy the debug bundle",
	saveFailure: "Could not save the debug bundle",
	empty: "No health checks are registered.",
	problemHint: "Click Copy debug and paste the result into your bug report.",
} as const;

function plural(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export interface DoctorConfig {
	/** Re-run on mount, on Re-run checks, and after a fix — the page reports the state right now. */
	runChecks: () => readonly HealthCheck[];
	/** The serialised, already-redacted bundle for the current export mode. */
	buildDebugText: (fullDetail: boolean) => string;
	/** The plugin's privacy page (already UTM-tracked). */
	privacyDocsUrl: string;
	/** Writes the bundle into the vault and resolves with the path written. */
	saveDebugFile: (text: string) => Promise<string>;
	/** The plugin's log stream, shown in a collapsed Logs section under the checks. Omit and the section is not offered. */
	logs?: DoctorLogsConfig | undefined;
}

/**
 * The triage surface: what is wrong right now, in plain language, and one
 * click to hand us everything we need to look into it. The exhaustive
 * counterpart is the Logs viewer — this page aggregates, that one lists.
 * See [[spec-doctor-health-and-quick-debug-export]].
 */
export interface DoctorViewProps {
	config: DoctorConfig;
	/**
	 * Opens the bug-report form with this same context already attached. Omitted
	 * when the plugin wires no feedback flow, and then the button does not render.
	 */
	onCreateBugReport?: (() => void) | undefined;
}

export const DoctorView = memo(function DoctorView({ config, onCreateBugReport }: DoctorViewProps) {
	const { cls, tid } = useScopedStyles("doctor", buildDoctorStyles);
	const [checks, setChecks] = useState<readonly HealthCheck[]>(() => config.runChecks());
	const [fullDetail, setFullDetail] = useState(false);

	const refresh = useCallback(() => setChecks(config.runChecks()), [config]);

	// Both exports build the bundle at click time, not at render time: a page
	// left open for ten minutes must still export the last fifteen.
	const handleCopy = useCallback(() => {
		void (async () => {
			try {
				await navigator.clipboard.writeText(config.buildDebugText(fullDetail));
				new Notice(DOCTOR_COPY.copySuccess);
			} catch {
				new Notice(DOCTOR_COPY.copyFailure);
			}
		})();
	}, [config, fullDetail]);

	const handleSave = useCallback(() => {
		void (async () => {
			try {
				const path = await config.saveDebugFile(config.buildDebugText(fullDetail));
				new Notice(`Debug bundle saved to ${path}`);
			} catch {
				new Notice(DOCTOR_COPY.saveFailure);
			}
		})();
	}, [config, fullDetail]);

	const summary = summarizeHealth(checks);

	return (
		<div className={cls()} {...testIdAttr(tid())}>
			<div
				className={`${cls("summary")} ${cls(`summary-${summary.status}`)}`}
				role="status"
				{...testIdAttr(tid("summary"))}
			>
				{summarize(summary.fail, summary.warn)}
			</div>

			<div className={cls("actions")}>
				{onCreateBugReport !== undefined && (
					<Button variant="primary" onClick={onCreateBugReport} testId={tid("bug-report")}>
						{DOCTOR_COPY.bugReportLabel}
					</Button>
				)}
				<Button
					variant={onCreateBugReport === undefined ? "primary" : "default"}
					onClick={handleCopy}
					testId={tid("copy")}
				>
					{DOCTOR_COPY.copyLabel}
				</Button>
				<Button onClick={handleSave} testId={tid("save")}>
					{DOCTOR_COPY.saveLabel}
				</Button>
				<Button onClick={refresh} testId={tid("refresh")}>
					{DOCTOR_COPY.refreshLabel}
				</Button>
			</div>

			<PrivacyDisclaimer
				docsUrl={config.privacyDocsUrl}
				fullDetail={fullDetail}
				onFullDetailChange={setFullDetail}
				testId={tid("privacy")}
			/>

			<div className={cls("checks")}>
				{checks.length === 0 ? (
					<div className={cls("empty")}>{DOCTOR_COPY.empty}</div>
				) : (
					checks.map((check) => <CheckRow key={check.id} check={check} cls={cls} tid={tid} onFixed={refresh} />)
				)}
			</div>

			{config.logs !== undefined && <DoctorLogsSection logs={config.logs} cls={cls} tid={tid} />}
		</div>
	);
});

function summarize(fail: number, warn: number): string {
	if (fail === 0 && warn === 0) return DOCTOR_COPY.healthy;
	const counts =
		fail > 0 && warn > 0
			? `${plural(fail, "problem")} and ${plural(warn, "warning")}`
			: fail > 0
				? plural(fail, "problem")
				: plural(warn, "warning");
	return `${counts} found. ${DOCTOR_COPY.problemHint}`;
}

interface CheckRowProps {
	check: HealthCheck;
	cls: ScopedTheme["cls"];
	tid: ScopedTheme["tid"];
	onFixed: () => void;
}

const CheckRow = memo(function CheckRow({ check, cls, tid, onFixed }: CheckRowProps) {
	const { fix } = check;

	// Re-running the checks after a fix is what makes the button feel like it
	// did something — the row it belongs to is usually the one that changes.
	// A fix that throws is itself a finding, so the checks are re-run either
	// way and the failure is reported rather than escaping as a rejection.
	const runFix = useCallback(() => {
		if (fix === undefined) return;
		void (async () => {
			try {
				await fix.run();
			} catch (error) {
				new Notice(`${fix.label} failed: ${describeError(error)}`);
			}
			onFixed();
		})();
	}, [fix, onFixed]);

	return (
		<div className={cls("check")} {...testIdAttr(tid(`check-${check.id}`))}>
			<span
				className={`${cls("status")} ${cls(`status-${check.status}`)}`}
				aria-label={STATUS_WORD[check.status]}
				{...testIdAttr(tid(`status-${check.id}`))}
			>
				{STATUS_GLYPH[check.status]}
			</span>
			<div className={cls("check-body")}>
				<div className={cls("check-label")}>{check.label}</div>
				<div className={cls("check-detail")}>{check.detail}</div>
			</div>
			{fix !== undefined && (
				<div className={cls("check-fix")}>
					<Button onClick={runFix} testId={tid(`fix-${check.id}`)}>
						{fix.label}
					</Button>
				</div>
			)}
		</div>
	);
});
