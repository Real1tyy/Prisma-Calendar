import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { StressBaselineSchema, type StressBaseline, type StressRunReport } from "../types";
import { renderMarkdownReport } from "./markdown";

export interface WrittenReport {
	jsonPath: string;
	markdownPath: string;
}

/** Write `run.json` + `report.md` into the run's artifact directory. */
export function writeRunReports(dir: string, report: StressRunReport): WrittenReport {
	mkdirSync(dir, { recursive: true });
	const jsonPath = path.join(dir, "run.json");
	const markdownPath = path.join(dir, "report.md");
	writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
	writeFileSync(markdownPath, renderMarkdownReport(report), "utf8");
	return { jsonPath, markdownPath };
}

export function readBaseline(filePath: string): StressBaseline | null {
	if (!existsSync(filePath)) return null;
	// Validate on read — a corrupt or stale-shape baseline should surface loudly,
	// not silently skew the regression verdict.
	return StressBaselineSchema.parse(JSON.parse(readFileSync(filePath, "utf8")));
}

export function writeBaseline(filePath: string, baseline: StressBaseline): void {
	mkdirSync(path.dirname(filePath), { recursive: true });
	writeFileSync(filePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
}

/** Derive a fresh baseline (p95 per timing + counts) from a run report. */
export function reportToBaseline(report: StressRunReport): StressBaseline {
	const timings: Record<string, number> = {};
	for (const [name, summary] of Object.entries(report.timings)) {
		timings[name] = summary.p95Ms;
	}
	return {
		scenario: report.scenario,
		profile: report.profile,
		capturedAt: new Date().toISOString(),
		environment: report.environment,
		timings,
		counts: { ...report.counts },
	};
}
