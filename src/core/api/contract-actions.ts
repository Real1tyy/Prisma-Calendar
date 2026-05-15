import type { ActionDefMap } from "@real1ty-obsidian-plugins";

import type CustomCalendarPlugin from "../../main";
import { buildActions } from "./action-definitions";

/**
 * Single source of truth for the globally exposed window key. Used by:
 *   - PrismaCalendarApiManager when exposing the runtime API
 *   - scripts/emit-contract.ts when generating the on-disk contract
 *   - tests that assert against the canonical key
 */
export const GLOBAL_KEY = "PrismaCalendar";

/**
 * Builds the action map for contract emission and drift tests. Uses a stub
 * plugin object because the contract only inspects static metadata
 * (description, input/output schemas, parseParams presence, http config) —
 * handlers are never invoked during emission.
 *
 * Keep this separate from `buildActions` only because emission needs an
 * action map without booting Obsidian; the action *shapes* themselves come
 * from the single `buildActions` definition.
 */
export function buildContractActions(): ActionDefMap {
	const stubPlugin = {} as CustomCalendarPlugin;
	return buildActions(stubPlugin);
}
