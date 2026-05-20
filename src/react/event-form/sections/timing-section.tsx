import { calculateDurationMinutes } from "@real1ty-obsidian-plugins";
import { memo, useCallback } from "react";
import { useController, useWatch, type UseFormReturn } from "react-hook-form";

import type { EventFormState } from "../../../components/modals/event/event-form-state";
import { formatDateOnly, formatDateTimeForInput } from "../../../utils/format";
import { PrismaCheckbox } from "../prisma-checkbox";
import { PrismaSettingItem } from "../prisma-setting-item";

interface TimingSectionProps {
	form: UseFormReturn<EventFormState>;
	showDurationField: boolean;
	onFill?: ((direction: "previous" | "next") => Date | null) | undefined;
}

export const TimingSection = memo(function TimingSection({ form, showDurationField, onFill }: TimingSectionProps) {
	const { field: allDayField } = useController({ control: form.control, name: "allDay" });
	const { field: startField } = useController({ control: form.control, name: "start" });
	const { field: endField } = useController({ control: form.control, name: "end" });
	const { field: dateField } = useController({ control: form.control, name: "date" });

	const isAllDay = useWatch({ control: form.control, name: "allDay" });

	const handleAllDayChange = useCallback(
		(checked: boolean) => {
			allDayField.onChange(checked);
			if (checked) {
				if (startField.value) {
					dateField.onChange(formatDateOnly(startField.value));
				}
			} else if (dateField.value) {
				startField.onChange(`${dateField.value}T09:00`);
				endField.onChange(`${dateField.value}T10:00`);
			}
		},
		[allDayField, startField, endField, dateField]
	);

	const handleNow = useCallback(
		(target: "start" | "end") => {
			const now = formatDateTimeForInput(new Date());
			if (target === "start") {
				startField.onChange(now);
			} else {
				endField.onChange(now);
			}
		},
		[startField, endField]
	);

	const handleStartChange = useCallback(
		(value: string) => {
			startField.onChange(value);
		},
		[startField]
	);

	const handleEndChange = useCallback(
		(value: string) => {
			endField.onChange(value);
		},
		[endField]
	);

	const handleDurationChange = useCallback(
		(durationStr: string) => {
			if (!startField.value || !durationStr) return;
			const durationMinutes = Number.parseInt(durationStr, 10);
			if (Number.isNaN(durationMinutes) || durationMinutes < 0) return;
			const startDate = new Date(startField.value);
			const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
			endField.onChange(formatDateTimeForInput(endDate));
		},
		[startField, endField]
	);

	const handleFill = useCallback(
		(direction: "previous" | "next") => {
			const time = onFill?.(direction);
			if (!time) return;
			const target = direction === "previous" ? startField : endField;
			target.onChange(formatDateTimeForInput(time));
		},
		[onFill, startField, endField]
	);

	const fillPreviousCb = onFill ? () => handleFill("previous") : undefined;
	const fillNextCb = onFill ? () => handleFill("next") : undefined;

	const durationValue =
		startField.value && endField.value ? calculateDurationMinutes(startField.value, endField.value).toString() : "";

	return (
		<>
			<PrismaSettingItem name="All day" testId="prisma-event-field-all-day">
				<PrismaCheckbox
					style="plain"
					value={isAllDay}
					onChange={handleAllDayChange}
					testId="prisma-event-control-all-day"
				/>
			</PrismaSettingItem>

			{!isAllDay && (
				<div className="prisma-timed-event-fields">
					<DateTimeField
						label="Start Date"
						value={startField.value}
						onChange={handleStartChange}
						onNow={() => handleNow("start")}
						onFill={fillPreviousCb}
						fillLabel="Fill prev"
						fillTitle="Fill from previous event's end time"
						testIdField="prisma-event-field-start"
						testIdControl="prisma-event-control-start"
					/>
					<DateTimeField
						label="End Date"
						value={endField.value}
						onChange={handleEndChange}
						onNow={() => handleNow("end")}
						onFill={fillNextCb}
						fillLabel="Fill next"
						fillTitle="Fill from next event's start time"
						testIdField="prisma-event-field-end"
						testIdControl="prisma-event-control-end"
					/>
					{showDurationField && (
						<PrismaSettingItem name="Duration (min)" testId="prisma-event-field-duration">
							<input
								type="number"
								className="prisma-setting-item-control"
								min={0}
								step={1}
								value={durationValue}
								onChange={(e) => handleDurationChange(e.target.value)}
								data-testid="prisma-event-control-duration"
							/>
						</PrismaSettingItem>
					)}
				</div>
			)}

			{isAllDay && (
				<div className="prisma-allday-event-fields">
					<PrismaSettingItem name="Date" testId="prisma-event-field-date">
						<input
							type="date"
							className="prisma-setting-item-control"
							value={dateField.value}
							onChange={(e) => dateField.onChange(e.target.value)}
							data-testid="prisma-event-control-date"
						/>
					</PrismaSettingItem>
				</div>
			)}
		</>
	);
});

interface DateTimeFieldProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	onNow: () => void;
	onFill?: (() => void) | undefined;
	fillLabel?: string;
	fillTitle?: string;
	testIdField: string;
	testIdControl: string;
}

const DateTimeField = memo(function DateTimeField({
	label,
	value,
	onChange,
	onNow,
	onFill,
	fillLabel,
	fillTitle,
	testIdField,
	testIdControl,
}: DateTimeFieldProps) {
	return (
		<PrismaSettingItem name={label} testId={testIdField}>
			<div className="prisma-datetime-input-wrapper">
				<button type="button" className="prisma-now-button" onClick={onNow}>
					Now
				</button>
				{onFill && (
					<button type="button" className="prisma-fill-button" onClick={onFill} title={fillTitle}>
						{fillLabel}
					</button>
				)}
				<input
					type="datetime-local"
					className="prisma-setting-item-control"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					data-testid={testIdControl}
				/>
			</div>
		</PrismaSettingItem>
	);
});
