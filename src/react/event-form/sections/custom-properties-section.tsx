import { CollapsibleSection } from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useState } from "react";

interface CustomProperty {
	key: string;
	value: string;
	id: number;
}

interface CustomPropertiesSectionProps {
	section: "display" | "other";
	title: string;
	initialProperties?: Array<{ key: string; value: string }>;
	onPropertiesChange: (properties: Record<string, string>) => void;
}

let nextPropertyId = 0;

export const CustomPropertiesSection = memo(function CustomPropertiesSection({
	section,
	title,
	initialProperties = [],
	onPropertiesChange,
}: CustomPropertiesSectionProps) {
	const [properties, setProperties] = useState<CustomProperty[]>(() =>
		initialProperties.map((p) => ({ ...p, id: nextPropertyId++ }))
	);

	const handleAdd = useCallback(() => {
		setProperties((prev) => {
			const next = [...prev, { key: "", value: "", id: nextPropertyId++ }];
			return next;
		});
	}, []);

	const handleRemove = useCallback(
		(id: number) => {
			setProperties((prev) => {
				const next = prev.filter((p) => p.id !== id);
				const result: Record<string, string> = {};
				for (const p of next) {
					if (p.key) result[p.key] = p.value;
				}
				onPropertiesChange(result);
				return next;
			});
		},
		[onPropertiesChange]
	);

	const handleFieldChange = useCallback(
		(id: number, field: "key" | "value", newValue: string) => {
			setProperties((prev) => {
				const next = prev.map((p) => (p.id === id ? { ...p, [field]: newValue } : p));
				const result: Record<string, string> = {};
				for (const p of next) {
					if (p.key) result[p.key] = p.value;
				}
				onPropertiesChange(result);
				return next;
			});
		},
		[onPropertiesChange]
	);

	return (
		<div data-testid={`prisma-event-custom-props-${section}`}>
			<CollapsibleSection
				label={title}
				defaultCollapsed={true}
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
					{properties.map((prop) => (
						<div
							key={prop.id}
							className="prisma-custom-property-row"
							data-testid={`prisma-event-custom-prop-row-${section}`}
						>
							<input
								type="text"
								placeholder="Property name"
								value={prop.key}
								className="prisma-setting-item-control"
								onChange={(e) => handleFieldChange(prop.id, "key", e.target.value)}
								data-testid={`prisma-event-custom-prop-key-${section}`}
							/>
							<input
								type="text"
								placeholder="Value"
								value={prop.value}
								className="prisma-setting-item-control"
								onChange={(e) => handleFieldChange(prop.id, "value", e.target.value)}
								data-testid={`prisma-event-custom-prop-value-${section}`}
							/>
							<button
								type="button"
								onClick={() => handleRemove(prop.id)}
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
