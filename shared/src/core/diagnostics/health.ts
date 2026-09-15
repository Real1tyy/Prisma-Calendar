import { describeError } from "../../utils/errors";

export const HEALTH_STATUSES = ["ok", "warn", "fail"] as const;

export type HealthStatus = (typeof HEALTH_STATUSES)[number];

/** Ascending severity. The worst row is the page's overall verdict. */
export const HEALTH_STATUS_SEVERITY: Record<HealthStatus, number> = {
	ok: 0,
	warn: 1,
	fail: 2,
};

/** An inline remedy a check can offer — rendered as a button next to the row. */
export interface HealthCheckFix {
	label: string;
	run: () => void | Promise<void>;
}

/**
 * One row of the Doctor. `detail` is the plain-language sentence the user
 * reads — never a stack trace or a metric only we understand.
 * See [[spec-doctor-health-and-quick-debug-export]].
 */
export interface HealthCheck {
	readonly id: string;
	readonly label: string;
	readonly status: HealthStatus;
	readonly detail: string;
	readonly fix?: HealthCheckFix;
}

/** Produces this check's current verdict(s), or `null` when it does not apply. */
export type HealthCheckProvider = () => HealthCheck | readonly HealthCheck[] | null;

/**
 * A check as it travels off the page — to the clipboard, or attached to a bug
 * report. The `fix` callback is dropped, which is what makes the row plain
 * data rather than a live handle into the running plugin.
 */
export interface HealthReportRow {
	id: string;
	label: string;
	status: HealthStatus;
	detail: string;
}

export function toHealthReportRows(checks: readonly HealthCheck[]): HealthReportRow[] {
	return checks.map(({ id, label, status, detail }) => ({ id, label, status, detail }));
}

export interface HealthSummary {
	ok: number;
	warn: number;
	fail: number;
	/** The worst row's status — `ok` for an empty registry. */
	status: HealthStatus;
}

export function summarizeHealth(checks: readonly HealthCheck[]): HealthSummary {
	const summary: HealthSummary = { ok: 0, warn: 0, fail: 0, status: "ok" };
	for (const check of checks) {
		summary[check.status] += 1;
		if (HEALTH_STATUS_SEVERITY[check.status] > HEALTH_STATUS_SEVERITY[summary.status]) {
			summary.status = check.status;
		}
	}
	return summary;
}

/**
 * The per-plugin check set the Doctor renders, in registration order.
 *
 * Providers are re-run on every {@link run} rather than cached, because the
 * page's whole job is to report the state at the moment the user opened it.
 * The universal checks live in `./checks`; a plugin registers its own
 * (indexing, sync, …) on top.
 */
export class HealthCheckRegistry {
	private readonly providers: Array<{ id: string; provider: HealthCheckProvider }> = [];

	get size(): number {
		return this.providers.length;
	}

	/** Registers a provider under `id`; returns its unregister. */
	register(id: string, provider: HealthCheckProvider): () => void {
		const entry = { id, provider };
		this.providers.push(entry);
		return () => {
			const index = this.providers.indexOf(entry);
			if (index !== -1) this.providers.splice(index, 1);
		};
	}

	run(): HealthCheck[] {
		const checks: HealthCheck[] = [];
		for (const { id, provider } of this.providers) {
			try {
				const produced = provider();
				if (produced === null) continue;
				if (Array.isArray(produced)) checks.push(...(produced as readonly HealthCheck[]));
				else checks.push(produced as HealthCheck);
			} catch (error) {
				// A check that throws must not blank the page it exists to diagnose,
				// and "this check is broken" is itself a finding worth showing.
				checks.push({
					id,
					label: id,
					status: "fail",
					detail: `This check could not run: ${describeError(error)}`,
				});
			}
		}
		return checks;
	}
}
