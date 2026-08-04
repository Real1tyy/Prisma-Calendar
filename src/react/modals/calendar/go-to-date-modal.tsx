import { formatDateInputValue, parseDateInputValue } from "@real1ty/obsidian-plugins";
import { ModalForm, openReactModal, SettingItem } from "@real1ty/obsidian-plugins-react";
import type { App } from "obsidian";
import { useCallback, useState } from "react";

import { cls, tid } from "../../../constants";

interface GoToDateFormProps {
	initialDate: Date;
	onSubmit: (date: Date) => void;
	onCancel: () => void;
}

export function GoToDateForm({ initialDate, onSubmit, onCancel }: GoToDateFormProps) {
	const [value, setValue] = useState(() => formatDateInputValue(initialDate));
	const parsed = parseDateInputValue(value);

	const handleSubmit = useCallback(() => {
		const date = parseDateInputValue(value);
		if (date) onSubmit(date);
	}, [value, onSubmit]);

	return (
		<ModalForm onSubmit={handleSubmit} onCancel={onCancel} submitLabel="Go" submitDisabled={parsed === null}>
			<h3>Go to date</h3>
			<SettingItem name="Date">
				<input
					type="date"
					className="prisma-setting-item-control"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					data-testid={tid("go-to-date-value")}
					autoFocus
				/>
			</SettingItem>
		</ModalForm>
	);
}

export function openGoToDateModal(app: App, initialDate: Date): Promise<Date | null> {
	return openReactModal<Date>({
		app,
		cls: cls("go-to-date-modal"),
		testId: tid("modal-go-to-date"),
		render: (submit, cancel) => <GoToDateForm initialDate={initialDate} onSubmit={submit} onCancel={cancel} />,
	});
}
