import { CollapsibleSection } from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useState } from "react";
import { useFieldArray, type UseFormReturn } from "react-hook-form";

import type { EventFormState } from "../../../components/modals/event/event-form-state";

type CustomPropertyFieldName = "customPropertiesDisplay" | "customPropertiesOther";

interface CustomPropertiesSectionProps {
	section: "display" | "other";
	title: string;
	form: UseFormReturn<EventFormState>;
	name: CustomPropertyFieldName;
}

export const CustomPropertiesSection = memo(function CustomPropertiesSection({
	section,
	title,
	form,
	name,
}: CustomPropertiesSectionProps) {
	const { fields, append, remove } = useFieldArray({ control: form.control, name });
	const [collapsed, setCollapsed] = useState(true);

	// Mirror base-event-modal.ts addButton handler: auto-expand the section
	// when the user adds a property so the new row is visible.
	const handleAdd = useCallback(() => {
		setCollapsed(false);
		append({ key: "", value: "" });
	}, [append]);

	return (
		<div data-testid={`prisma-event-custom-props-${section}`}>
			<CollapsibleSection
				label={title}
				collapsed={collapsed}
				onToggle={setCollapsed}
				actions={
					<button
						type="button"
						className="prisma-mod-cta"
						onClick={handleAdd}
						data-testid={`prisma-event-btn-add-custom-prop-${section}`}
					>
						Add property
					</button>
				}
			>
				<div data-testid={`prisma-event-custom-props-${section}-container`}>
					{fields.map((field, index) => (
						<div
							key={field.id}
							className="prisma-custom-property-row"
							data-testid={`prisma-event-custom-prop-row-${section}`}
						>
							<input
								type="text"
								placeholder="Property name"
								className="prisma-setting-item-control"
								data-testid={`prisma-event-custom-prop-key-${section}`}
								{...form.register(`${name}.${index}.key`)}
							/>
							<input
								type="text"
								placeholder="Value"
								className="prisma-setting-item-control"
								data-testid={`prisma-event-custom-prop-value-${section}`}
								{...form.register(`${name}.${index}.value`)}
							/>
							<button
								type="button"
								onClick={() => remove(index)}
								data-testid={`prisma-event-btn-remove-custom-prop-${section}`}
							>
								Remove
							</button>
						</div>
					))}
				</div>
			</CollapsibleSection>
		</div>
	);
});

export function customPropertiesToRecord(entries: { key: string; value: string }[]): Record<string, string> {
	return Object.fromEntries(entries.filter((entry) => entry.key).map((entry) => [entry.key, entry.value]));
}
