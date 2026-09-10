import { buildUtmUrl } from "@real1ty/obsidian-plugins";
import { createFeedbackSession, hasMinimizedFeedback, MinimizedModals } from "@real1ty/obsidian-plugins-react";

import { COMMAND_IDS, CSS_PREFIX, docsUrl, PRISMA_CALENDAR_PLUGIN_ID } from "../../constants";
import type CustomCalendarPlugin from "../../main";

/**
 * Builds the feedback flow from outside the settings tab — the command palette,
 * or a hotkey the user bound to it. The General section builds the same config
 * from its own props; the only thing that differs is `utm_medium`, which is the
 * point of tracking the entry point separately.
 *
 * A session per invocation is deliberate: the minimized report lives in the
 * shared slot, so a command built fresh still finds what the last one paused.
 */
function prismaFeedbackSession(plugin: CustomCalendarPlugin) {
	return createFeedbackSession({
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

/**
 * Registers every feedback entry point that isn't the settings row. Each is its
 * own command so each can carry its own hotkey — a user who just hit a bug
 * should be one keystroke from a report, not three menus.
 *
 * Lives here rather than in `commands.ts` so the wiring stays importable
 * without dragging in the calendar view.
 */
export function registerFeedbackCommands(plugin: CustomCalendarPlugin): void {
	const addCommand = (id: string, name: string, action: () => void): void => {
		plugin.addCommand({ id, name, callback: action });
	};

	// Only offered while a report is paused, so the palette never lists a capture
	// with nowhere to put the image.
	const addReportCommand = (id: string, name: string, action: () => void): void => {
		plugin.addCommand({
			id,
			name,
			checkCallback: (checking: boolean) => {
				if (!hasMinimizedFeedback()) return false;
				if (!checking) action();
				return true;
			},
		});
	};

	addCommand(COMMAND_IDS.SEND_FEEDBACK, "Send feedback", () => {
		void prismaFeedbackSession(plugin).open({ type: "general", includeDebug: false });
	});

	addCommand(COMMAND_IDS.REPORT_A_BUG, "Report a bug", () => {
		void prismaFeedbackSession(plugin).open({ type: "bug", includeDebug: true });
	});

	// The whole point is that the screen is grabbed before anything of ours is
	// drawn over it, so this is one command rather than "open, then capture".
	addCommand(COMMAND_IDS.SCREENSHOT_AND_REPORT_A_BUG, "Take a screenshot & report a bug", () => {
		void prismaFeedbackSession(plugin).captureAndOpen();
	});

	addReportCommand(COMMAND_IDS.RESTORE_FEEDBACK_REPORT, "Restore minimized report", () => MinimizedModals.restore());

	addReportCommand(COMMAND_IDS.CAPTURE_INTO_FEEDBACK_REPORT, "Add a screenshot to the minimized report", () => {
		void prismaFeedbackSession(plugin).captureIntoMinimized();
	});
}
