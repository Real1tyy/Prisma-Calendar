import { PrismaSettingItem } from "../../event-form/prisma-setting-item";
import { memo, useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useController, useWatch } from "react-hook-form";

import type { EventFormState } from "../../../components/modals/event/event-form-state";
import type { Weekday } from "../../../types/recurring";
import { RECURRENCE_TYPE_OPTIONS, WEEKDAY_OPTIONS, WEEKDAY_PRESET_DAYS } from "../../../types/recurring";
import {
	buildCustomIntervalDSL,
	isPresetType,
	isWeekdaySupported,
	parseRecurrenceType,
} from "../../../utils/dates/recurring";
import { PrismaCheckbox } from "../prisma-checkbox";

const FREQ_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "DAILY", label: "Days" },
	{ value: "WEEKLY", label: "Weeks" },
	{ value: "MONTHLY", label: "Months" },
	{ value: "YEARLY", label: "Years" },
];

const DEFAULT_INTERVAL = "1";
const DEFAULT_FREQ = "DAILY";

interface RecurrenceSectionProps {
	form: UseFormReturn<EventFormState>;
}

export const RecurrenceSection = memo(function RecurrenceSection({ form }: RecurrenceSectionProps) {
	const { field: enabledField } = useController({ control: form.control, name: "recurring.enabled" });
	const { field: rruleTypeField } = useController({ control: form.control, name: "recurring.rruleType" });
	const { field: weekdaysField } = useController({ control: form.control, name: "recurring.weekdays" });
	const { field: customFreqField } = useController({ control: form.control, name: "recurring.customFreq" });
	const { field: customIntervalField } = useController({ control: form.control, name: "recurring.customInterval" });
	const { field: untilDateField } = useController({ control: form.control, name: "recurring.untilDate" });
	const { field: futureInstancesField } = useController({
		control: form.control,
		name: "recurring.futureInstancesCount",
	});
	const { field: generatePastField } = useController({ control: form.control, name: "recurring.generatePastEvents" });

	const isEnabled = useWatch({ control: form.control, name: "recurring.enabled" });

	const rruleType = rruleTypeField.value;
	const isCustom = rruleType === "custom" || (!isPresetType(rruleType) && rruleType !== "");
	const showWeekdays = !isCustom && isWeekdaySupported(rruleType);
	const fixedDays = WEEKDAY_PRESET_DAYS[rruleType];
	const selectValue = isCustom ? "custom" : rruleType;

	const buildCustomDSL = useCallback(
		(freq?: string, interval?: string) =>
			buildCustomIntervalDSL(
				freq ?? customFreqField.value ?? DEFAULT_FREQ,
				Number.parseInt(interval ?? customIntervalField.value ?? DEFAULT_INTERVAL, 10) || 1
			),
		[customFreqField.value, customIntervalField.value]
	);

	const handleRruleTypeChange = useCallback(
		(value: string) => {
			rruleTypeField.onChange(value === "custom" ? buildCustomDSL() : value);
		},
		[rruleTypeField, buildCustomDSL]
	);

	const handleCustomFreqChange = useCallback(
		(freq: string) => {
			customFreqField.onChange(freq);
			rruleTypeField.onChange(buildCustomDSL(freq));
		},
		[customFreqField, rruleTypeField, buildCustomDSL]
	);

	const handleCustomIntervalChange = useCallback(
		(interval: string) => {
			customIntervalField.onChange(interval);
			rruleTypeField.onChange(buildCustomDSL(undefined, interval));
		},
		[customIntervalField, rruleTypeField, buildCustomDSL]
	);

	const handleWeekdayToggle = useCallback(
		(day: string, checked: boolean) => {
			const current = weekdaysField.value as string[];
			weekdaysField.onChange(checked ? [...current, day] : current.filter((d) => d !== day));
		},
		[weekdaysField]
	);

	const parsed = isCustom && rruleType ? parseRecurrenceType(rruleType) : null;
	const displayFreq = parsed?.freq ?? customFreqField.value ?? DEFAULT_FREQ;
	const displayInterval = parsed?.interval?.toString() ?? customIntervalField.value ?? DEFAULT_INTERVAL;

	return (
		<>
			<PrismaSettingItem name="Recurring event" testId="prisma-event-field-rrule">
				<PrismaCheckbox
					style="plain"
					value={!!isEnabled}
					onChange={enabledField.onChange}
					testId="prisma-event-control-rrule"
				/>
			</PrismaSettingItem>

			{isEnabled && (
				<div className="prisma-recurring-event-fields">
					<PrismaSettingItem name="Recurrence pattern">
						<select
							className="prisma-setting-item-control"
							value={selectValue}
							onChange={(e) => handleRruleTypeChange(e.target.value)}
							data-testid="prisma-event-control-rrule-type"
						>
							{Object.entries(RECURRENCE_TYPE_OPTIONS).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
							<option value="custom">Custom interval...</option>
						</select>
					</PrismaSettingItem>

					{isCustom && (
						<PrismaSettingItem name="Custom interval">
							<div className="prisma-setting-item-control prisma-custom-interval-controls">
								<span>Every </span>
								<input
									type="number"
									className="prisma-custom-interval-input"
									min={1}
									step={1}
									value={displayInterval}
									onChange={(e) => handleCustomIntervalChange(e.target.value)}
									data-testid="prisma-event-control-custom-interval"
								/>
								<select
									className="prisma-custom-freq-select"
									value={displayFreq}
									onChange={(e) => handleCustomFreqChange(e.target.value)}
									data-testid="prisma-event-control-custom-freq"
								>
									{FREQ_OPTIONS.map(({ value, label }) => (
										<option key={value} value={value}>
											{label}
										</option>
									))}
								</select>
							</div>
						</PrismaSettingItem>
					)}

					{showWeekdays && (
						<PrismaSettingItem name="Days of week">
							<div className="prisma-weekday-grid">
								{Object.entries(WEEKDAY_OPTIONS).map(([value, label]) => {
									const isFixed = fixedDays?.includes(value as Weekday);
									const isChecked = isFixed || (weekdaysField.value as string[]).includes(value);
									return (
										<div key={value} className="prisma-weekday-item">
											<input
												type="checkbox"
												id={`weekday-${value}`}
												checked={isChecked}
												disabled={!!isFixed}
												onChange={(e) => handleWeekdayToggle(value, e.target.checked)}
												data-testid={`prisma-event-control-weekday-${value}`}
											/>
											<label htmlFor={`weekday-${value}`}>{label}</label>
										</div>
									);
								})}
							</div>
						</PrismaSettingItem>
					)}

					<PrismaSettingItem
						name="End date"
						description="Inclusive last occurrence day. Leave empty to repeat indefinitely."
					>
						<input
							type="date"
							className="prisma-setting-item-control"
							value={untilDateField.value}
							onChange={(e) => untilDateField.onChange(e.target.value)}
							data-testid="prisma-event-control-rrule-until"
						/>
					</PrismaSettingItem>

					<PrismaSettingItem
						name="Future instances count"
						description="Override the global setting for this event. Leave empty to use the default."
					>
						<input
							type="number"
							className="prisma-setting-item-control"
							min={1}
							step={1}
							placeholder="Default"
							value={futureInstancesField.value}
							onChange={(e) => futureInstancesField.onChange(e.target.value)}
							data-testid="prisma-event-control-future-instances-count"
						/>
					</PrismaSettingItem>

					<PrismaSettingItem
						name="Generate past events"
						description="Generate instances from the source event start date instead of from today."
					>
						<PrismaCheckbox
							style="plain"
							value={generatePastField.value}
							onChange={generatePastField.onChange}
							testId="prisma-event-control-generate-past-events"
						/>
					</PrismaSettingItem>
				</div>
			)}
		</>
	);
});
