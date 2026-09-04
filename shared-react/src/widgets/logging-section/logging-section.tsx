import { LOGGING_ADVANCED_FIELDS, LOGGING_BASIC_FIELDS, LoggingSettingsSchema } from "@real1ty/obsidian-plugins";
import { memo, useCallback, useState, type ReactNode } from "react";

import type { SettingsStorelike } from "../../hooks/settings/use-schema-field";
import { Toggle } from "../../primitives/controls/toggle";
import { SettingHeading, SettingItem } from "../../primitives/layout/setting-item";
import { SchemaSection } from "../../settings/schema-section";

/** The settings key every plugin stores its `LoggingSettings` under. */
export const LOGGING_SETTINGS_KEY = "logging";

export interface LoggingSectionProps {
	/** The plugin's root settings store; the section binds to `logging.*` inside it. */
	store: SettingsStorelike;
	/** Override when the `LoggingSettings` live under a different dotted key. */
	pathPrefix?: string | undefined;
	/**
	 * Same convention as `SchemaSection`: each field row gets
	 * `${testIdPrefix}field-<key>` and its control `${testIdPrefix}control-<key>`.
	 */
	testIdPrefix?: string | undefined;
	/** Trailing content — the place a privacy disclaimer or a "view logs" button mounts. */
	children?: ReactNode;
}

/**
 * The universal Logging settings — minimum level, console mirror, file
 * logging, and (behind a disclosure) the rotation/retention limits. Rendered
 * straight from `LoggingSettingsSchema`, so the fields, labels and bounds have
 * one source of truth. Mounted by `GeneralSection` on every plugin; see
 * [[spec-logging-config-sinks-and-instrumentation]].
 */
export const LoggingSection = memo(function LoggingSection({
	store,
	pathPrefix = LOGGING_SETTINGS_KEY,
	testIdPrefix,
	children,
}: LoggingSectionProps) {
	// Rotation and retention only matter once file logging is on, and even then
	// the defaults are right for almost everyone — so they stay folded away.
	const [showAdvanced, setShowAdvanced] = useState(false);
	const toggleAdvanced = useCallback((value: boolean) => setShowAdvanced(value), []);
	const tid = (suffix: string): string | undefined =>
		testIdPrefix !== undefined ? `${testIdPrefix}${suffix}` : undefined;

	return (
		<>
			<SettingHeading name="Logging" testId={tid("heading-logging")} />
			<SchemaSection
				store={store}
				shape={LoggingSettingsSchema.shape}
				fields={LOGGING_BASIC_FIELDS}
				pathPrefix={pathPrefix}
				{...(testIdPrefix !== undefined ? { testIdPrefix } : {})}
			/>
			<SettingItem
				name="Show advanced options"
				description="Rotation and cleanup limits for log files."
				testId={tid("field-logging-advanced")}
			>
				<Toggle value={showAdvanced} onChange={toggleAdvanced} testId={tid("control-logging-advanced")} />
			</SettingItem>
			{showAdvanced && (
				<SchemaSection
					store={store}
					shape={LoggingSettingsSchema.shape}
					fields={LOGGING_ADVANCED_FIELDS}
					pathPrefix={pathPrefix}
					{...(testIdPrefix !== undefined ? { testIdPrefix } : {})}
				/>
			)}
			{children}
		</>
	);
});
