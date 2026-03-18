import { showSchemaFormModal } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { z } from "zod";

import { CSS_PREFIX } from "../../../constants";

const UntrackedEventShape = {
	name: z.string().min(1),
};

export function showUntrackedEventCreateModal(app: App, onSubmit: (title: string) => void | Promise<void>): void {
	showSchemaFormModal({
		app,
		prefix: CSS_PREFIX,
		cls: "prisma-untracked-event-modal",
		title: "Create Untracked Event",
		shape: UntrackedEventShape,
		submitText: "Create",
		onSubmit: (values) => onSubmit(values.name),
	});
}
