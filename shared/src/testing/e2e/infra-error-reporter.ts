import type { Reporter, TestCase, TestError, TestResult } from "@playwright/test/reporter";

import { formatDepsInFluxSummary, isDepResolutionError } from "./infra-errors";

// Playwright reporter that detects dependency-resolution failures (node_modules
// rebuilt mid-run) and converts the otherwise-cryptic pile of per-spec reds into
// one dominant, unmistakable "ENVIRONMENT IN FLUX — re-run" verdict.
//
// It does NOT change the exit code: a poisoned run still fails (you cannot
// certify a run where specs never executed), but the failure is now legible
// instead of forty look-alike test failures. Worker processes that hit the
// teardown mid-import are already dead by the time we hear about it, so there is
// no safe way to un-spawn them — the at-launch counterpart
// (shared/scripts/e2e/check-e2e-deps.mjs) covers the "already broken before we
// started" case with a true immediate fail. See
// docs/decisions/2026-05-21-e2e-deps-in-flux-guard.md.
export default class DepsInFluxReporter implements Reporter {
	private readonly affectedSpecs: string[] = [];
	private announced = false;

	printsToStdio(): boolean {
		return true;
	}

	onError(error: TestError): void {
		this.scan("<worker>", error);
	}

	onTestEnd(test: TestCase, result: TestResult): void {
		for (const error of result.errors) {
			this.scan(test.titlePath().filter(Boolean).join(" › "), error);
		}
	}

	onEnd(): void {
		if (this.affectedSpecs.length === 0) return;
		process.stderr.write(formatDepsInFluxSummary(this.affectedSpecs));
	}

	private scan(label: string, error: TestError): void {
		const haystack = `${error.message ?? ""}\n${error.stack ?? ""}\n${error.value ?? ""}`;
		if (!isDepResolutionError(haystack)) return;
		this.affectedSpecs.push(label);
		if (!this.announced) {
			this.announced = true;
			// Real-time signal on the first hit so you know the moment it happens,
			// not only at the end-of-run summary.
			process.stderr.write(
				`\n[e2e] ⚠ test dependency failed to resolve (${label}) — node_modules likely ` +
					"rebuilt mid-run; see the ENVIRONMENT IN FLUX summary at the end.\n"
			);
		}
	}
}
