import { type ChangeEvent, memo, useCallback, useRef } from "react";

import { useBundleSettings } from "../contexts/bundle-context";

const PLACEHOLDER_VALUE = "";
const CLEAR_VALUE = "__clear__";

interface FilterPresetSelectorProps {
	onPresetSelected: (expression: string) => void;
}

export const FilterPresetSelector = memo(function FilterPresetSelector({
	onPresetSelected,
}: FilterPresetSelectorProps) {
	const [settings] = useBundleSettings();
	const presets = settings.filterPresets;
	const selectRef = useRef<HTMLSelectElement>(null);

	const handleChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const value = event.target.value;
			if (value === CLEAR_VALUE) {
				onPresetSelected("");
			} else if (value !== PLACEHOLDER_VALUE) {
				onPresetSelected(value);
			}
			if (selectRef.current) selectRef.current.selectedIndex = 0;
		},
		[onPresetSelected]
	);

	return (
		<select
			ref={selectRef}
			className="prisma-fc-filter-preset-select fc-button fc-button-primary"
			data-testid="prisma-filter-preset"
			defaultValue={PLACEHOLDER_VALUE}
			onChange={handleChange}
		>
			<option value={PLACEHOLDER_VALUE} disabled hidden>
				▼
			</option>
			<option value={CLEAR_VALUE}>Clear</option>
			{presets.map((preset) => (
				<option key={`${preset.name}:${preset.expression}`} value={preset.expression}>
					{preset.name}
				</option>
			))}
		</select>
	);
});
