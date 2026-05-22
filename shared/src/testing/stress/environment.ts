import { execFileSync } from "node:child_process";
import os from "node:os";

import type { EnvironmentInfo, GitInfo } from "./types";

/**
 * Capture the host environment so every report records the machine it ran on —
 * baselines are same-machine only, so the report header is how a human spots a
 * baseline captured on different hardware. Tool/plugin versions are filled in by
 * the caller (the spec) when known.
 */
export function captureEnvironment(): EnvironmentInfo {
	const cpus = os.cpus();
	return {
		os: `${os.type()} ${os.release()}`,
		arch: os.arch(),
		cpuModel: cpus[0]?.model ?? "unknown",
		cpuCount: cpus.length,
		totalMemoryBytes: os.totalmem(),
		nodeVersion: process.version,
	};
}

// execFile (no shell) with static args — no injection surface.
function git(args: readonly string[], cwd: string): string {
	return execFileSync("git", args as string[], { cwd, encoding: "utf8" }).trim();
}

/** Capture branch/commit/dirty so a report ties to an exact tree state. */
export function captureGitInfo(cwd: string = process.cwd()): GitInfo {
	try {
		return {
			branch: git(["rev-parse", "--abbrev-ref", "HEAD"], cwd),
			commit: git(["rev-parse", "HEAD"], cwd),
			dirty: git(["status", "--porcelain"], cwd) !== "",
		};
	} catch {
		return { branch: "unknown", commit: "unknown", dirty: false };
	}
}
