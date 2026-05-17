import { memo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useController } from "react-hook-form";

import type { EventFormState } from "../../../components/modals/event/event-form-state";
import type { EventPreset } from "../../../types/settings";
import { PrismaCheckbox } from "../prisma-checkbox";

export interface EventFormHeaderProps {
	mode: "create" | "edit";
	form: UseFormReturn<EventFormState>;
	presets: readonly EventPreset[];
	onMinimize: () => void;
	onClear: () => void;
	onPresetChange: (id: string) => void;
}

export const EventFormHeader = memo(function EventFormHeader({
	mode,
	form,
	presets,
	onMinimize,
	onClear,
	onPresetChange,
}: EventFormHeaderProps) {
	return (
		<div className="prisma-event-modal-header">
			<h2>{mode === "create" ? "Create Event" : "Edit Event"}</h2>
			<VirtualToggle form={form} />
			<div className="prisma-event-modal-header-controls">
				<button
					type="button"
					className="prisma-event-modal-minimize-button"
					onClick={onMinimize}
					title="Minimize modal (preserves all form data)"
					data-testid="prisma-event-btn-minimize"
				>
					−
				</button>
				<button
					type="button"
					className="prisma-event-modal-clear-button"
					onClick={onClear}
					data-testid="prisma-event-btn-clear"
				>
					Clear
				</button>
				<PresetSelector presets={presets} onChange={onPresetChange} />
			</div>
		</div>
	);
});

function VirtualToggle({ form }: { form: UseFormReturn<EventFormState> }) {
	const { field } = useController({ control: form.control, name: "virtual" });
	return (
		<PrismaCheckbox
			style="labeled-toggle"
			label="Virtual"
			value={field.value}
			onChange={field.onChange}
			testId="prisma-event-control-virtual"
		/>
	);
}

// Always-empty controlled select. Acts as a one-shot trigger: picking a preset
// fires onChange (which applies it to the form) and then the dropdown
// immediately resets to blank so the user can pick the same preset again to
// re-apply, and the initial state isn't tied to any option (no "first preset
// auto-selected" trap).
function PresetSelector({ presets, onChange }: { presets: readonly EventPreset[]; onChange: (id: string) => void }) {
	return (
		<div className="prisma-event-preset-selector-wrapper">
			<span className="prisma-event-preset-label">Preset:</span>
			<select
				className="prisma-event-preset-select"
				value=""
				onChange={(e) => {
					const id = e.target.value;
					if (!id) return;
					onChange(id);
					e.target.value = "";
				}}
				data-testid="prisma-event-control-preset"
			>
				<option value="" />
				{presets.map((p) => (
					<option key={p.id} value={p.id}>
						{p.name}
					</option>
				))}
			</select>
		</div>
	);
}
