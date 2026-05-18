import { memo, useCallback } from "react";
import { useController, useWatch, type UseFormReturn } from "react-hook-form";

import type { EventFormState } from "../../../components/modals/event/event-form-state";
import {
	RECURRENCE_TYPE_OPTIONS,
	WEEKDAY_OPTIONS,
	WEEKDAY_PRESET_DAYS,
	type RecurrenceFreq,
	type Weekday,
} from "../../../types/recurring";
import {
	buildCustomIntervalDSL,
	FREQ_OPTIONS,
	isPresetType,
	isWeekdaySupported,
	parseRecurrenceType,
} from "../../../utils/dates/recurring";
import { PrismaCheckbox } from "../prisma-checkbox";
import { PrismaSettingItem } from "../prisma-setting-item";

const SET_VALUE_OPTIONS = {
	shouldDirty: true,
	shouldTouch: true,
	shouldValidate: true,
} as const;

type RecurringCheckboxName = "recurring.enabled" | "recurring.generatePastEvents";

interface RecurringCheckboxProps {
	form: UseFormReturn<EventFormState>;
	name: RecurringCheckboxName;
	testId: string;
}

const RecurringCheckbox = memo(function RecurringCheckbox({ form, name, testId }: RecurringCheckboxProps) {
	const { field } = useController({ control: form.control, name });
	return <PrismaCheckbox style="plain" value={!!field.value} onChange={field.onChange} testId={testId} />;
});

interface RecurrenceSectionProps {
	form: UseFormReturn<EventFormState>;
}

export const RecurrenceSection = memo(function RecurrenceSection({ form }: RecurrenceSectionProps) {
	const recurring = useWatch({ control: form.control, name: "recurring" });

	const enabled = recurring.enabled;
	const rruleType = recurring.rruleType;
	const weekdays = recurring.weekdays as readonly Weekday[];
	const customFreq = recurring.customFreq as RecurrenceFreq;
	const customInterval = recurring.customInterval;

	const isCustom = rruleType === "custom" || (!isPresetType(rruleType) && rruleType !== "");
	const showWeekdays = !isCustom && isWeekdaySupported(rruleType);
	const fixedDays = WEEKDAY_PRESET_DAYS[rruleType];
	const selectValue = isCustom ? "custom" : rruleType;

	const parsed = isCustom && rruleType ? parseRecurrenceType(rruleType) : null;
	const displayFreq = (parsed?.freq as RecurrenceFreq | undefined) ?? customFreq;
	const displayInterval = parsed?.interval.toString() ?? customInterval;

	const buildCustomDSL = useCallback(
		(freq: RecurrenceFreq = displayFreq, interval: string = displayInterval) =>
			buildCustomIntervalDSL(freq, Number.parseInt(interval, 10) || 1),
		[displayFreq, displayInterval]
	);

	const setRecurringValue = useCallback(
		<K extends keyof EventFormState["recurring"]>(key: K, value: EventFormState["recurring"][K]) => {
			form.setValue(`recurring.${key}` as const, value as never, SET_VALUE_OPTIONS);
		},
		[form]
	);

	const handleRruleTypeChange = useCallback(
		(value: string) => {
			setRecurringValue("rruleType", value === "custom" ? buildCustomDSL() : value);
		},
		[setRecurringValue, buildCustomDSL]
	);

	const handleCustomFreqChange = useCallback(
		(freq: RecurrenceFreq) => {
			setRecurringValue("customFreq", freq);
			setRecurringValue("rruleType", buildCustomDSL(freq));
		},
		[setRecurringValue, buildCustomDSL]
	);

	const handleCustomIntervalChange = useCallback(
		(interval: string) => {
			setRecurringValue("customInterval", interval);
			setRecurringValue("rruleType", buildCustomDSL(displayFreq, interval));
		},
		[setRecurringValue, buildCustomDSL, displayFreq]
	);

	const handleWeekdayToggle = useCallback(
		(day: Weekday, checked: boolean) => {
			const next = checked ? Array.from(new Set([...weekdays, day])) : weekdays.filter((d) => d !== day);
			setRecurringValue("weekdays", next as string[]);
		},
		[weekdays, setRecurringValue]
	);

	return (
		<>
			<PrismaSettingItem name="Recurring event" testId="prisma-event-field-rrule">
				<RecurringCheckbox form={form} name="recurring.enabled" testId="prisma-event-control-rrule" />
			</PrismaSettingItem>

			{enabled && (
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
									onChange={(e) => handleCustomFreqChange(e.target.value as RecurrenceFreq)}
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
									const weekday = value as Weekday;
									const isFixed = fixedDays?.includes(weekday);
									const isChecked = isFixed || weekdays.includes(weekday);
									return (
										<div key={value} className="prisma-weekday-item">
											<input
												type="checkbox"
												id={`weekday-${value}`}
												checked={isChecked}
												disabled={!!isFixed}
												onChange={(e) => handleWeekdayToggle(weekday, e.target.checked)}
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
							data-testid="prisma-event-control-rrule-until"
							{...form.register("recurring.untilDate")}
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
							data-testid="prisma-event-control-future-instances-count"
							{...form.register("recurring.futureInstancesCount")}
						/>
					</PrismaSettingItem>

					<PrismaSettingItem
						name="Generate past events"
						description="Generate instances from the source event start date instead of from today."
					>
						<RecurringCheckbox
							form={form}
							name="recurring.generatePastEvents"
							testId="prisma-event-control-generate-past-events"
						/>
					</PrismaSettingItem>
				</div>
			)}
		</>
	);
});
