import { buildUtmUrl } from "@real1ty/obsidian-plugins";
import { openFeedbackModal } from "@real1ty/obsidian-plugins-react";

import { CSS_PREFIX, docsUrl, PRISMA_CALENDAR_PLUGIN_ID } from "../../constants";
import type CustomCalendarPlugin from "../../main";

/**
 * Opens the shared feedback modal from outside the settings tab — the command
 * palette, or a hotkey the user bound to it. The General section builds the same
 * config from its own props; the only thing that differs is `utm_medium`, which
 * is the point of tracking the entry point separately.
 */
export function openPrismaFeedback(plugin: CustomCalendarPlugin): void {
	void openFeedbackModal({
		app: plugin.app,
		slug: PRISMA_CALENDAR_PLUGIN_ID,
		pluginDisplayName: "Prisma",
		pluginVersion: plugin.manifest.version,
		cssPrefix: CSS_PREFIX,
		privacyUrl: buildUtmUrl(docsUrl("/privacy"), PRISMA_CALENDAR_PLUGIN_ID, "plugin", "command", "feedback_privacy"),
		logService: plugin.logging.service,
		licenseManager: plugin.licenseManager,
	});
}
