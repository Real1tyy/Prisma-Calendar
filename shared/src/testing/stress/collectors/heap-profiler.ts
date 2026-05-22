import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CDPSession } from "@playwright/test";

// CDP heap profiler — the memory half of the leak harness. `collectGarbage`
// forces a GC so anything still retained afterwards is a real leak, not a
// not-yet-collected temporary. `takeHeapSnapshot` streams the `.heapsnapshot`
// (V8 serialises it in chunks via `addHeapSnapshotChunk`) to disk for DevTools
// post-mortem; the cheap gating signal (`JSHeapUsedSize`) comes from
// `Performance.getMetrics`, and the structured signal from `digestHeapSnapshot`.

const HEAP_SNAPSHOT_CHUNK_EVENT = "HeapProfiler.addHeapSnapshotChunk";

/** Force a full GC so a follow-up snapshot / `JSHeapUsedSize` reflects only retained memory. */
export async function collectGarbage(session: CDPSession): Promise<void> {
	await session.send("HeapProfiler.enable");
	await session.send("HeapProfiler.collectGarbage");
}

/**
 * Capture a heap snapshot, streaming it to `filePath`, and return its byte size.
 * The `.heapsnapshot` opens in DevTools → Memory; parse it with
 * `digestHeapSnapshot` for an agent-readable summary (detached nodes, top types).
 */
export async function takeHeapSnapshot(session: CDPSession, filePath: string): Promise<number> {
	await session.send("HeapProfiler.enable");
	await mkdir(path.dirname(filePath), { recursive: true });

	const chunks: string[] = [];
	const onChunk = (event: { chunk: string }): void => {
		chunks.push(event.chunk);
	};
	session.on(HEAP_SNAPSHOT_CHUNK_EVENT, onChunk);
	try {
		await session.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false, captureNumericValue: false });
	} finally {
		session.off(HEAP_SNAPSHOT_CHUNK_EVENT, onChunk);
	}

	const content = chunks.join("");
	await writeFile(filePath, content, "utf8");
	return Buffer.byteLength(content, "utf8");
}
