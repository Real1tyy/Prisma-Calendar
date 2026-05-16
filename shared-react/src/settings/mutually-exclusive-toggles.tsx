import { memo, useCallback } from "react";

import { Toggle } from "../components/setting-controls";
import { SettingItem } from "../components/setting-item";
import { type SettingsStorelike, useSchemaField } from "../hooks/settings/use-schema-field";

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
	const [selfValue, setSelf] = useSchemaField<boolean>(store, self.path);
	const [otherValue, setOther] = useSchemaField<boolean>(store, otherPath);

	const handleChange = useCallback(
		(value: boolean) => {
			setSelf(value);
			if (value && otherValue) {
				setOther(false);
			}
		},
		[setSelf, setOther, otherValue]
	);

	return (
		<SettingItem name={self.name} description={self.description}>
			<Toggle value={Boolean(selfValue)} onChange={handleChange} />
		</SettingItem>
	);
});
