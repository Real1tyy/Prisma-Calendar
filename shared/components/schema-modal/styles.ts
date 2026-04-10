import { injectStyleSheet } from "../../utils/styles/inject";

function buildSchemaFormStyles(p: string): string {
	return `
.${p}schema-form-modal {
	min-width: 400px;
	max-width: 500px;
}

.${p}schema-form-modal .modal-title {
	text-align: center;
}

.${p}schema-form-modal .setting-item {
	border-top: none;
	padding: 0.4rem 0;
}

.${p}modal-button-container {
	display: flex;
	gap: 8px;
	justify-content: flex-end;
	align-items: center;
	margin-top: 1rem;
	padding-top: 0.75rem;
	border-top: 1px solid var(--background-modifier-border);
}

.${p}schema-form-readonly .setting-item-description {
	color: var(--text-normal);
}
`;
}

export function injectSchemaFormStyles(prefix: string): void {
	injectStyleSheet(`${prefix}schema-form-styles`, buildSchemaFormStyles(prefix));
}
