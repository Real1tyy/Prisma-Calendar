import type { CDPSession } from "@playwright/test";

// External runtime metrics straight from Chrome DevTools Protocol. The harness
// already connects to Obsidian via connectOverCDP, so `page.context().newCDPSession(page)`
// hands back a session these helpers drive. See `Performance.getMetrics` for the
// full metric list (ScriptDuration, LayoutDuration, JSHeapUsedSize, Nodes, …).

export type CdpMetricRecord = Record<string, number>;

export interface CdpMetricsCapture {
	before: CdpMetricRecord;
	after: CdpMetricRecord;
	delta: CdpMetricRecord;
}

export async function readCdpPerformanceMetrics(session: CDPSession): Promise<CdpMetricRecord> {
	await session.send("Performance.enable");
	const { metrics } = await session.send("Performance.getMetrics");
	const out: CdpMetricRecord = {};
	for (const metric of metrics) {
		out[metric.name] = metric.value;
	}
	return out;
}

/** Subtract two metric maps; only keys present in both are emitted. */
export function diffCdpMetrics(before: CdpMetricRecord, after: CdpMetricRecord): CdpMetricRecord {
	const delta: CdpMetricRecord = {};
	for (const [name, value] of Object.entries(after)) {
		const prior = before[name];
		if (prior !== undefined) delta[name] = value - prior;
	}
	return delta;
}

/** Capture CDP metrics before and after an action, plus the delta. */
export async function captureCdpMetrics<T>(
	session: CDPSession,
	fn: () => Promise<T>
): Promise<{ result: T; capture: CdpMetricsCapture }> {
	const before = await readCdpPerformanceMetrics(session);
	const result = await fn();
	const after = await readCdpPerformanceMetrics(session);
	return { result, capture: { before, after, delta: diffCdpMetrics(before, after) } };
}

/** Prefix CDP metric keys (e.g. `cdp.JSHeapUsedSize`) for the run's count bag. */
export function namespaceCdpMetrics(metrics: CdpMetricRecord, prefix = "cdp"): CdpMetricRecord {
	const out: CdpMetricRecord = {};
	for (const [name, value] of Object.entries(metrics)) {
		out[`${prefix}.${name}`] = value;
	}
	return out;
}
