// Dependency-free constants for the Prisma onboarding tour. Single source of
// truth shared by the tour definition (buildPrismaTourSteps), its unit test, and
// the E2E DSL — kept import-free so the E2E layer can pull it in without dragging
// the plugin runtime into the Playwright process.

/** Step ids in display order. Add new steps here when the tour grows; the
 * buildPrismaTourSteps unit test pins the definition to this list. */
export const PRISMA_TOUR_STEP_IDS = [
	"welcome",
	"first-event",
	"drag-and-drop",
	"open-event",
	"create-event",
	"switch-views",
	"finish",
] as const;

export type PrismaTourStepId = (typeof PRISMA_TOUR_STEP_IDS)[number];

/** Title of the sample event the tour seeds on today. */
export const SAMPLE_EVENT_TITLE = "Your first event";
