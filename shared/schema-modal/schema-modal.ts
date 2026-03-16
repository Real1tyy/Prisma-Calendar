import { showModal } from "../component-renderer/modal";
import { createSchemaFormRenderer } from "./render";
import type { SchemaModalConfig } from "./types";

export function showSchemaModal<T>(config: SchemaModalConfig<T>): void {
	showModal({
		app: config.app,
		cls: config.cls,
		title: config.title,
		render: createSchemaFormRenderer(config),
	});
}
