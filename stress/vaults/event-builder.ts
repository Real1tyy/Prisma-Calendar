import type { GeneratedEvent, SeededRandom } from "@real1ty-obsidian-plugins/testing/stress";

import { buildEventMarkdown, type SeedEventInput } from "../../e2e/fixtures/seed-events";
import type { PrismaVaultProfile } from "./profiles";

// Deterministic Prisma event factory. Events are spread across a FROZEN anchor
// year (never `today`) so the generated vault is byte-identical run-to-run.
// Generic mock data only — never real names/categories.

const ANCHOR_YEAR = 2026;
const EVENT_TITLES = ["Team Meeting", "Workout", "Project Planning", "Weekly Review", "Standup", "Focus Block"];
const CATEGORIES = ["Work", "Personal", "Fitness", "Errands"];

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

export function buildPrismaEvent(rng: SeededRandom, index: number, _profile: PrismaVaultProfile): GeneratedEvent {
	const dayOfYear = index % 365;
	const date = new Date(Date.UTC(ANCHOR_YEAR, 0, 1 + dayOfYear));
	const month = pad(date.getUTCMonth() + 1);
	const day = pad(date.getUTCDate());
	const hour = 8 + rng.int(0, 9);

	const input: SeedEventInput = {
		title: `${rng.pick(EVENT_TITLES)} ${String(index + 1).padStart(5, "0")}`,
		startDate: `${ANCHOR_YEAR}-${month}-${day}T${pad(hour)}:00`,
		endDate: `${ANCHOR_YEAR}-${month}-${day}T${pad(hour + 1)}:00`,
		category: rng.pick(CATEGORIES),
	};

	return {
		relativePath: `Event-${String(index).padStart(5, "0")}.md`,
		content: buildEventMarkdown(input),
	};
}
