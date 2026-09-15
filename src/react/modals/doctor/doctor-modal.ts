import { showDoctorReactModal } from "@real1ty/obsidian-plugins-react";

import { CSS_PREFIX, settingsDocUrl } from "../../../constants";
import { buildPrismaDebugText, createPrismaHealthChecks, savePrismaDebugFile } from "../../../core/diagnostics";
import type CustomCalendarPlugin from "../../../main";

const PRIVACY_DOCS_URL = settingsDocUrl("/privacy", "doctor_privacy");

/**
 * Opens the Doctor over the plugin's own check registry. The registry is built
 * per open, so a calendar added since the last visit is included; the checks
 * themselves re-read state on every run.
 */
export function openPrismaDoctor(plugin: CustomCalendarPlugin): void {
	const registry = createPrismaHealthChecks(plugin);

	showDoctorReactModal(plugin.app, {
		cssPrefix: CSS_PREFIX,
		privacyDocsUrl: PRIVACY_DOCS_URL,
		runChecks: () => registry.run(),
		buildDebugText: (fullDetail) => buildPrismaDebugText(plugin, registry.run(), fullDetail),
		saveDebugFile: (text) => savePrismaDebugFile(plugin, text),
	});
}
