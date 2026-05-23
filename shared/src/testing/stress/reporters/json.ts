import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ProfileTreeNode } from "../profile-tree";
import { StressBaselineSchema, type StressBaseline, type StressRunReport } from "../types";
import { renderHtmlReport } from "./html";
import { renderMarkdownReport } from "./markdown";

export interface WrittenReport {
	jsonPath: string;
	markdownPath: string;
	htmlPath: string;
}

export interface WriteRunReportsOptions {
	/** CPU-profile call tree for the HTML report's interactive flame chart. */
	profileTree?: ProfileTreeNode;
}

/** Write `run.json` + `report.md` + `report.html` into the run's artifact directory. */
export function writeRunReports(
	dir: string,
	report: StressRunReport,
	options: WriteRunReportsOptions = {}
): WrittenReport {
	mkdirSync(dir, { recursive: true });
	const jsonPath = path.join(dir, "run.json");
	const markdownPath = path.join(dir, "report.md");
	const htmlPath = path.join(dir, "report.html");
	writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
	writeFileSync(markdownPath, renderMarkdownReport(report), "utf8");
	writeFileSync(
		htmlPath,
		renderHtmlReport(report, options.profileTree ? { profileTree: options.profileTree } : {}),
		"utf8"
	);
	return { jsonPath, markdownPath, htmlPath };
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
