import { cls, tid } from "@real1ty-obsidian-plugins";
import { ModalSchemaForm, openReactModal, SchemaForm, useZodForm } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { z } from "zod";

const UntrackedEventSchema = z.object({
	name: z.string().min(1).default("").describe("Event name"),
});

type UntrackedEventValues = z.infer<typeof UntrackedEventSchema>;

interface UntrackedEventCreateFormProps {
	onSubmit: (values: UntrackedEventValues) => void;
	onCancel: () => void;
}

function UntrackedEventCreateForm({ onSubmit, onCancel }: UntrackedEventCreateFormProps) {
	const form = useZodForm({ schema: UntrackedEventSchema });

	return (
		<ModalSchemaForm form={form} onSubmit={onSubmit} onCancel={onCancel} submitLabel="Create">
			<SchemaForm form={form} schema={UntrackedEventSchema} testIdPrefix={tid("untracked-event-")} />
		</ModalSchemaForm>
	);
}

export function openUntrackedEventCreateModal(app: App): Promise<string | null> {
	return openReactModal<string>({
		app,
		title: "Create Untracked Event",
		cls: cls("untracked-event-modal"),
		testId: tid("modal-untracked-event-create"),
		render: (submit, cancel) => (
			<UntrackedEventCreateForm onSubmit={(values) => submit(values.name)} onCancel={cancel} />
		),
	});
}
