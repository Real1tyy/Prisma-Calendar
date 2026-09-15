import { apiVersion } from "obsidian";

import { getPlatformId } from "../../utils/platform";
import type { DebugEnvironment } from "./debug-bundle";

/**
 * Reads the host's version and platform for a debug bundle. Kept out of
 * `debug-bundle.ts` so the builder itself stays pure — this is the one impure
 * step, and every surface that captures a bundle (the Doctor's export, the
 * bug-report payload) shares it rather than re-deriving the same four fields.
 */
export function describeDebugEnvironment(pluginId: string, pluginVersion: string): DebugEnvironment {
	return {
		pluginId,
		pluginVersion,
		obsidianVersion: apiVersion,
		platform: getPlatformId(),
	};
}
