import type { App } from "obsidian";

import { showShelledModal } from "../../show-react-modal";
import { DOCTOR_COPY, DoctorView, type DoctorConfig } from "./doctor-view";

export interface ShowDoctorModalConfig extends DoctorConfig {
	/** Trailing-dash CSS prefix, e.g. `"prisma-"`. */
	cssPrefix: string;
	/** Modal title. Defaults to `"Doctor"`. */
	title?: string | undefined;
}

export function showDoctorReactModal(app: App, config: ShowDoctorModalConfig): void {
	const { cssPrefix, title, ...doctor } = config;
	showShelledModal(app, {
		cssPrefix,
		name: "doctor",
		title: title ?? DOCTOR_COPY.title,
		render: () => <DoctorView config={doctor} />,
	});
}
