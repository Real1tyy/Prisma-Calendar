import type { BudgetFailure, RegressionFinding, StressArtifact, StressRunReport } from "../types";

// Canonical, agent-readable report. An agent reads this Markdown to find the
// hottest stage and the regression verdict without opening any GUI.

function round(value: number, places = 1): number {
	if (!Number.isFinite(value)) return value;
	const factor = 10 ** places;
	return Math.round(value * factor) / factor;
}

function fmtPct(value: number | null): string {
	if (value === null) return "—";
	if (!Number.isFinite(value)) return "∞";
	const sign = value > 0 ? "+" : "";
	return `${sign}${round(value)}%`;
}

function fmtDelta(delta: number, deltaPct: number | null): string {
	const base = String(round(delta));
	return deltaPct === null ? base : `${base} (${fmtPct(deltaPct)})`;
}

function table(header: readonly string[], rows: readonly (readonly string[])[]): string {
	const head = `| ${header.join(" | ")} |`;
	const sep = `| ${header.map(() => "---").join(" | ")} |`;
	const body = rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
	return [head, sep, body].join("\n");
}

function regressionsSection(regressions: readonly RegressionFinding[]): string {
	if (regressions.length === 0) return "_No baseline comparison (no baseline committed yet)._";
	const rows = regressions.map((r) => [
		r.metric,
		r.kind,
		String(round(r.baseline)),
		String(round(r.candidate)),
		fmtDelta(r.delta, r.deltaPct),
		r.regressed ? "❌ REGRESSED" : "✅",
	]);
	return table(["Metric", "Kind", "Baseline", "Candidate", "Delta", "Status"], rows);
}

function budgetSection(failures: readonly BudgetFailure[]): string {
	if (failures.length === 0) return "_All budgets within limits._";
	const rows = failures.map((f) => [
		f.metric,
		f.comparison,
		String(round(f.actual)),
		String(round(f.expected)),
		fmtDelta(f.delta, f.deltaPct),
	]);
	return table(["Metric", "Rule", "Actual", "Expected", "Delta"], rows);
}

function timingsSection(timings: StressRunReport["timings"]): string {
	const entries = Object.entries(timings).sort((a, b) => b[1].totalMs - a[1].totalMs);
	if (entries.length === 0) return "_No timing stages recorded._";
	const rows = entries.map(([name, s]) => [
		name,
		String(s.count),
		String(round(s.avgMs)),
		String(round(s.p50Ms)),
		String(round(s.p95Ms)),
		String(round(s.maxMs)),
	]);
	return table(["Stage", "Count", "Avg ms", "P50 ms", "P95 ms", "Max ms"], rows);
}

function profileDigestSection(digest: StressRunReport["profileDigest"]): string {
	if (!digest) return "_No CPU profile captured._";
	if (digest.topSelfTime.length === 0) {
		return "_CPU profile captured, but no non-idle frames were sampled — the action is too fast to profile (try a larger profile)._";
	}
	const caption = `Profiled ${round(digest.durationMs)}ms · ${digest.sampleCount} samples`;
	const rows = digest.topSelfTime.map((entry, index) => [
		String(index + 1),
		entry.functionName,
		entry.location,
		`${round(entry.selfPct)}%`,
		String(round(entry.selfTimeMs)),
		String(entry.hitCount),
	]);
	return [caption, "", table(["#", "Function", "Location", "Self %", "Self ms", "Hits"], rows)].join("\n");
}

function heapDigestSection(digest: StressRunReport["heapDigest"]): string {
	if (!digest) return "_No heap snapshot captured._";
	const mb = (bytes: number): string => `${round(bytes / 1_000_000)} MB`;
	const caption = `Nodes ${digest.nodeCount} · Edges ${digest.edgeCount} · Retained ${mb(digest.totalSizeBytes)} · Detached nodes ${digest.detachedNodeCount}`;
	const parts = [caption];
	if (digest.topTypes.length > 0) {
		const rows = digest.topTypes.map((entry, index) => [
			String(index + 1),
			entry.type,
			String(entry.count),
			mb(entry.selfSizeBytes),
		]);
		parts.push("", "**Top types**", "", table(["#", "Type", "Count", "Self size"], rows));
	}
	if (digest.topRetainers.length > 0) {
		const rows = digest.topRetainers.map((entry, index) => [String(index + 1), entry.retainer, String(entry.count)]);
		parts.push("", "**Top retainers of detached nodes**", "", table(["#", "Holder.edge", "Detached held"], rows));
	}
	return parts.join("\n");
}

function countsSection(counts: StressRunReport["counts"]): string {
	const entries = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
	if (entries.length === 0) return "_No counts recorded._";
	const rows = entries.map(([name, value]) => [name, String(value)]);
	return table(["Metric", "Value"], rows);
}

function artifactsSection(artifacts: readonly StressArtifact[]): string {
	if (artifacts.length === 0) return "_No artifacts._";
	const rows = artifacts.map((a) => [a.kind, a.path, a.description ?? ""]);
	return table(["Kind", "Path", "Description"], rows);
}

export function renderMarkdownReport(report: StressRunReport): string {
	const env = report.environment;
	const git = report.git;
	const lines = [
		`# Stress Report — ${report.scenario} (${report.profile})`,
		"",
		`Run: ${report.runId} · Status: **${report.status.toUpperCase()}**`,
		`Seed: ${report.config.seed} · Repeats: ${report.config.repeats} (warmup ${report.config.warmup}) · Collectors: ${report.config.collectors.join(", ") || "none"}`,
		`Started: ${report.startedAt} · Finished: ${report.finishedAt}`,
		`Git: ${git.branch} @ ${git.commit.slice(0, 8)}${git.dirty ? " (dirty)" : ""}`,
		`Env: ${env.os} · ${env.arch} · ${env.cpuModel} ×${env.cpuCount} · node ${env.nodeVersion}${env.pluginVersion ? ` · plugin ${env.pluginVersion}` : ""}`,
		"",
		"## Regressions vs baseline (same machine)",
		"",
		regressionsSection(report.regressions),
		"",
		"## Budget failures",
		"",
		budgetSection(report.budgetFailures),
		"",
		"## Timings",
		"",
		timingsSection(report.timings),
		"",
		"## Top self-time (CPU profile)",
		"",
		profileDigestSection(report.profileDigest),
		"",
		"## Heap",
		"",
		heapDigestSection(report.heapDigest),
		"",
		"## Counts",
		"",
		countsSection(report.counts),
		"",
		"## Artifacts",
		"",
		artifactsSection(report.artifacts),
		"",
	];
	return lines.join("\n");
}
