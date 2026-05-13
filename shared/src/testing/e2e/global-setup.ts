import { execFileSync } from "node:child_process";
import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

export interface GlobalSetupOptions {
	vaultsRoot: string;
	staleThresholdMs?: number;
}

const DEFAULT_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
const STALE_TMP_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export function pruneStaleE2eResources(options: GlobalSetupOptions): void {
	const thresholdMs = options.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS;
	pruneOrphanObsidianProcesses();
	pruneOrphanTmpDirs();
	pruneStaleVaults(options.vaultsRoot, thresholdMs);
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

function pruneOrphanTmpDirs(): void {
	let entries: string[];
	try {
		entries = readdirSync("/tmp");
	} catch {
		return;
	}

	const cutoff = Date.now() - STALE_TMP_THRESHOLD_MS;
	const currentUid = typeof process.getuid === "function" ? process.getuid() : undefined;
	let removed = 0;

	for (const entry of entries) {
		if (!entry.startsWith("o-e2e-") && !entry.startsWith("obsidian-launcher-config-")) continue;
		const full = join("/tmp", entry);
		try {
			const stat = statSync(full);
			if (stat.mtimeMs >= cutoff) continue;
			if (currentUid !== undefined && stat.uid !== currentUid) continue;
			rmSync(full, { recursive: true, force: true });
			removed++;
		} catch {
			// already gone, permission denied, or race
		}
	}

	if (removed > 0) {
		console.log(`[global-setup] cleaned ${removed} stale orphan /tmp dir(s)`);
	}
}

function pruneOrphanObsidianProcesses(): void {
	if (process.platform !== "linux") return;

	let out: string;
	try {
		out = execFileSync("ps", ["-eo", "pid=,pgid=,args="], {
			encoding: "utf8",
			timeout: 5_000,
		});
	} catch {
		return;
	}

	let killed = 0;
	const killedGroups = new Set<number>();

	for (const line of out.split("\n")) {
		const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
		if (!match) continue;

		const pid = Number.parseInt(match[1], 10);
		const pgid = Number.parseInt(match[2], 10);
		const args = match[3];

		if (!Number.isFinite(pid) || pid <= 1) continue;
		if (!Number.isFinite(pgid) || pgid <= 1) continue;

		if (!args.includes("--remote-debugging-port=")) continue;
		if (!args.includes("--user-data-dir=")) continue;
		if (!args.includes("obsidian-launcher-config-")) continue;

		const userDataMatch = args.match(/--user-data-dir=(?:"([^"]+)"|(\S+))/);
		const userDataDir = userDataMatch?.[1] ?? userDataMatch?.[2];
		if (userDataDir) {
			try {
				const stat = statSync(userDataDir);
				if (stat.mtimeMs >= Date.now() - STALE_TMP_THRESHOLD_MS) continue;
			} catch {
				// dir already gone → orphaned, safe to kill
			}
		}

		try {
			if (pgid === pid && !killedGroups.has(pgid)) {
				process.kill(-pgid, "SIGKILL");
				killedGroups.add(pgid);
			} else if (!killedGroups.has(pgid)) {
				process.kill(pid, "SIGKILL");
			}
			killed++;
		} catch {
			// ESRCH — already gone
		}
	}

	if (killed > 0) {
		console.log(`[global-setup] killed ${killed} orphan Obsidian/Electron process(es) from a prior E2E run`);
	}
}
