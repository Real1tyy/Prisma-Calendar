import { memo } from "react";

import { Button } from "../../primitives/atoms/button";
import { SettingHeading, SettingItem } from "../../primitives/layout/setting-item";

export const DOCTOR_SECTION_COPY = {
	heading: "Doctor",
	name: "Plugin health",
	description:
		"Run diagnostics: health checks for indexing, settings and your license, with a one-click bug report or debug bundle when something is wrong. Nothing is sent unless you submit a report.",
	buttonLabel: "Open Doctor",
} as const;

export interface DoctorSectionProps {
	onOpen: () => void;
	/** Stamps `${testIdPrefix}field-doctor` on the row and `${testIdPrefix}doctor-btn` on the button. */
	testIdPrefix?: string | undefined;
	description?: string | undefined;
}

/**
 * The General-page entry point, mounted through `GeneralSection`'s
 * `extraSections` so the Doctor plugs in without every plugin re-writing the
 * row. Opt-in per plugin: a plugin that wires no Doctor renders nothing.
 */
export const DoctorSection = memo(function DoctorSection({ onOpen, testIdPrefix, description }: DoctorSectionProps) {
	const tid = (suffix: string): string | undefined =>
		testIdPrefix !== undefined ? `${testIdPrefix}${suffix}` : undefined;

	return (
		<>
			<SettingHeading name={DOCTOR_SECTION_COPY.heading} testId={tid("heading-doctor")} />
			<SettingItem
				name={DOCTOR_SECTION_COPY.name}
				description={description ?? DOCTOR_SECTION_COPY.description}
				testId={tid("field-doctor")}
			>
				<Button variant="primary" onClick={onOpen} testId={tid("doctor-btn")}>
					{DOCTOR_SECTION_COPY.buttonLabel}
				</Button>
			</SettingItem>
		</>
	);
});
