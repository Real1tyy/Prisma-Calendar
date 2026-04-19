import { fromAnchor } from "../../fixtures/dates";
import { type EventHandle, expectAllColors } from "../../fixtures/dsl";
import { test } from "../../fixtures/electron";
import { updateCalendarSettings } from "../../fixtures/seed-events";

// Reactivity stress: many tiles must all repaint together when a single
// settings-store mutation changes the colour they resolve to. The live
// calendar-view render pipeline is:
//
//   settings-store update
//     → ColorEvaluator subscription fires
//     → EventStore.notifyChange fans out to CalendarView
//     → buildCalendarEvents recomputes every FCPrismaEventInput
//     → diffEvents marks each tile as "changed" (fingerprint includes colour)
//     → FullCalendar re-mounts the changed tiles
//     → applyEventMountStyling writes the new --event-color
//
// A regression anywhere in that chain manifests as: one tile picks up the new
// colour, twenty-three keep the old one. Seeding enough events to make that
// divergence obvious, then mutating the rule through three distinct
// transitions (recolour, disable, re-enable with a new colour), exercises
// the pipeline end-to-end. Each transition must flip every tile belonging
// to the affected category.

const ALPHA = "StressAlpha";
const BETA = "StressBeta";

const ALPHA_INITIAL = "#ff3344";
const BETA_INITIAL = "#3388ff";
const ALPHA_RECOLOURED = "#33cc88";
const BETA_REENABLED = "#aa66cc";
// Known fallback when no enabled rule matches — the renderer pulls from
// `defaultNodeColor`, so we pin it to a recognisable value for deterministic
// assertions on the "rule disabled" transition.
const DEFAULT_NODE = "#cccccc";

const COUNT_PER_CATEGORY = 12;

test.describe("stress: colour rule reactivity across many tiles", () => {
	test("mutating a colour rule repaints every matching tile in the current view", async ({ calendar }) => {
		await updateCalendarSettings(calendar.page, {
			defaultNodeColor: DEFAULT_NODE,
			colorRules: [
				{ id: "rule-alpha", expression: `Category.includes('${ALPHA}')`, color: ALPHA_INITIAL, enabled: true },
				{ id: "rule-beta", expression: `Category.includes('${BETA}')`, color: BETA_INITIAL, enabled: true },
			],
		});

		// Seeds 12 Alpha + 12 Beta across the anchor week, two per day at
		// distinct hours so FullCalendar doesn't stack / collapse them.
		const events: { handle: EventHandle; category: string }[] = [];
		const inputs: { title: string; start: string; end: string; category: string }[] = [];
		for (let i = 0; i < COUNT_PER_CATEGORY; i++) {
			const day = (i % 6) - 2; // -2..+3 inside the anchor week
			const hour = 9 + (i % 6);
			inputs.push({
				title: `Alpha Event ${i + 1}`,
				start: fromAnchor(day, hour, 0),
				end: fromAnchor(day, hour + 1, 0),
				category: ALPHA,
			});
			inputs.push({
				title: `Beta Event ${i + 1}`,
				start: fromAnchor(day, hour, 30),
				end: fromAnchor(day, hour + 1, 30),
				category: BETA,
			});
		}
		const handles = await calendar.seedOnDiskMany(inputs);
		handles.forEach((handle, idx) => {
			events.push({ handle, category: inputs[idx].category });
		});
		await calendar.goToAnchor();

		const alphaTiles = events.filter((e) => e.category === ALPHA).map((e) => e.handle);
		const betaTiles = events.filter((e) => e.category === BETA).map((e) => e.handle);

		await expectAllColors(alphaTiles, ALPHA_INITIAL);
		await expectAllColors(betaTiles, BETA_INITIAL);

		// Transition 1: mutate the alpha rule's colour. Every alpha tile must
		// flip; beta tiles must not budge.
		await updateCalendarSettings(calendar.page, {
			colorRules: [
				{ id: "rule-alpha", expression: `Category.includes('${ALPHA}')`, color: ALPHA_RECOLOURED, enabled: true },
				{ id: "rule-beta", expression: `Category.includes('${BETA}')`, color: BETA_INITIAL, enabled: true },
			],
		});
		await expectAllColors(alphaTiles, ALPHA_RECOLOURED);
		await expectAllColors(betaTiles, BETA_INITIAL);

		// Transition 2: disable the beta rule. Every beta tile falls back to
		// `defaultNodeColor`; alpha tiles stay on their mutated colour.
		await updateCalendarSettings(calendar.page, {
			colorRules: [
				{ id: "rule-alpha", expression: `Category.includes('${ALPHA}')`, color: ALPHA_RECOLOURED, enabled: true },
				{ id: "rule-beta", expression: `Category.includes('${BETA}')`, color: BETA_INITIAL, enabled: false },
			],
		});
		await expectAllColors(alphaTiles, ALPHA_RECOLOURED);
		await expectAllColors(betaTiles, DEFAULT_NODE);

		// Transition 3: re-enable beta with a new colour. Every beta tile
		// picks it up; alpha tiles remain unaffected.
		await updateCalendarSettings(calendar.page, {
			colorRules: [
				{ id: "rule-alpha", expression: `Category.includes('${ALPHA}')`, color: ALPHA_RECOLOURED, enabled: true },
				{ id: "rule-beta", expression: `Category.includes('${BETA}')`, color: BETA_REENABLED, enabled: true },
			],
		});
		await expectAllColors(alphaTiles, ALPHA_RECOLOURED);
		await expectAllColors(betaTiles, BETA_REENABLED);
	});
});
