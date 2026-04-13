import type { Scenario } from "@real1ty-obsidian-plugins/testing/visual";

import { scenarios as stickyBannerScenarios } from "./sticky-banner";
import { scenarios as stopwatchScenarios } from "./stopwatch";

export const ALL_SCENARIOS: Scenario[] = [...stickyBannerScenarios, ...stopwatchScenarios];
