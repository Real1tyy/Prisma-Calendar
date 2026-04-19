import { memo, useCallback } from "react";

import { Toggle } from "../components/setting-controls";
import { SettingItem } from "../components/setting-item";
import { type SettingsStorelike, useSchemaField } from "../hooks/use-schema-field";

interface ToggleConfig {
	path: string;
	name: string;
	description?: string;
}

interface MutuallyExclusiveTogglesProps {
	store: SettingsStorelike;
	toggleA: ToggleConfig;
	toggleB: ToggleConfig;
}

export const MutuallyExclusiveToggles = memo(function MutuallyExclusiveToggles({
	store,
	toggleA,
	toggleB,
}: MutuallyExclusiveTogglesProps) {
	return (
		<>
			<ExclusiveToggleRow store={store} self={toggleA} otherPath={toggleB.path} />
			<ExclusiveToggleRow store={store} self={toggleB} otherPath={toggleA.path} />
		</>
	);
});

interface ExclusiveToggleRowProps {
	store: SettingsStorelike;
	self: ToggleConfig;
	otherPath: string;
}

const ExclusiveToggleRow = memo(function ExclusiveToggleRow({ store, self, otherPath }: ExclusiveToggleRowProps) {
	const selfBinding = useSchemaField<boolean>(store, self.path);
	const otherBinding = useSchemaField<boolean>(store, otherPath);

	const handleChange = useCallback(
		(value: boolean) => {
			selfBinding.onChange(value);
			if (value && otherBinding.value) {
				otherBinding.onChange(false);
			}
		},
		[selfBinding, otherBinding]
	);

	return (
		<SettingItem name={self.name} description={self.description}>
			<Toggle value={Boolean(selfBinding.value)} onChange={handleChange} />
		</SettingItem>
	);
});
