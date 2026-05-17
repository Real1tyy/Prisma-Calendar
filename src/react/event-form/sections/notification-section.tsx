import { memo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useController, useWatch } from "react-hook-form";

import type { EventFormState } from "../../../components/modals/event/event-form-state";
import { PrismaSettingItem } from "../../event-form/prisma-setting-item";

interface NotificationSectionProps {
	form: UseFormReturn<EventFormState>;
}

export const NotificationSection = memo(function NotificationSection({ form }: NotificationSectionProps) {
	const { field } = useController({ control: form.control, name: "notifyBefore" });
	const isAllDay = useWatch({ control: form.control, name: "allDay" });
	const labelText = isAllDay ? "Notify days before" : "Notify minutes before";

	return (
		<PrismaSettingItem name={labelText} description="Override default notification timing for this event">
			<input
				type="number"
				className="prisma-setting-item-control"
				min={0}
				step={1}
				placeholder="Default"
				value={field.value}
				onChange={(e) => field.onChange(e.target.value)}
				data-testid="prisma-event-control-notify-before"
			/>
		</PrismaSettingItem>
	);
});
