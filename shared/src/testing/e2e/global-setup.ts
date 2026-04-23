import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

export interface GlobalSetupOptions {
	vaultsRoot: string;
	staleThresholdMs?: number;
}

const DEFAULT_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

export function pruneStaleE2eResources(options: GlobalSetupOptions): void {
	pruneStaleVaults(options.vaultsRoot, options.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS);
	pruneOrphanXdgDirs();
}

function pruneStaleVaults(vaultsRoot: string, thresholdMs: number): void {
	let entries: string[];
	try {
		entries = readdirSync(vaultsRoot);
	} catch {
		return;
	}

	const cutoff = Date.now() - thresholdMs;
	let removed = 0;

	for (const entry of entries) {
		const full = join(vaultsRoot, entry);
		try {
			const stat = statSync(full);
			if (stat.mtimeMs < cutoff) {
				rmSync(full, { recursive: true, force: true });
				removed++;
			}
		} catch {
			// already gone or inaccessible
		}
	}

	if (removed > 0) {
		console.log(`[global-setup] pruned ${removed} stale vault(s) older than ${Math.round(thresholdMs / 3_600_000)}h`);
	}
}

function pruneOrphanXdgDirs(): void {
	let entries: string[];
	try {
		entries = readdirSync("/tmp");
	} catch {
		return;
	}

	let removed = 0;
	for (const entry of entries) {
		if (!entry.startsWith("o-e2e-")) continue;
		try {
			rmSync(join("/tmp", entry), { recursive: true, force: true });
			removed++;
		} catch {
			// permission or race
		}
	}

	if (removed > 0) {
		console.log(`[global-setup] cleaned ${removed} orphan /tmp/o-e2e-* dir(s)`);
	}
}
