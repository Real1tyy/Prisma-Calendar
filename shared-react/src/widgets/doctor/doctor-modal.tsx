import type { App } from "obsidian";

import { showShelledModal } from "../../show-react-modal";
import { DOCTOR_COPY, DoctorView, type DoctorConfig } from "./doctor-view";

export interface ShowDoctorModalConfig extends DoctorConfig {
	/** Trailing-dash CSS prefix, e.g. `"prisma-"`. */
	cssPrefix: string;
	/** Modal title. Defaults to `"Doctor"`. */
	title?: string | undefined;
	/**
	 * Opens the plugin's bug-report form. Omitted ⇒ no button. The Doctor closes
	 * itself first: the report carries the same context, so leaving a stale
	 * diagnosis stacked behind the form would only invite the user to re-read it.
	 */
	onCreateBugReport?: (() => void) | undefined;
}

export function showDoctorReactModal(app: App, config: ShowDoctorModalConfig): void {
	const { cssPrefix, title, onCreateBugReport, ...doctor } = config;
	showShelledModal(app, {
		cssPrefix,
		name: "doctor",
		title: title ?? DOCTOR_COPY.title,
		render: (close) => (
			<DoctorView
				config={doctor}
				{...(onCreateBugReport !== undefined
					? {
							onCreateBugReport: () => {
								close();
								onCreateBugReport();
							},
						}
					: {})}
			/>
		),
	});
}
