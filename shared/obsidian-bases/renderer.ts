import {
	type BaseDefinition,
	BaseDefinitionSchema,
	type BaseFilterGroup,
	type BaseFilterLeaf,
	type BaseFilterNode,
	type BaseView,
	type FilterValue,
} from "./schema";

export class BaseRenderer {
	static render(base: BaseDefinition): string {
		BaseDefinitionSchema.parse(base);
		const sections: string[] = [];

		if (base.filter) {
			sections.push(renderFilterSection(base.filter, 0));
		}

		const hasTypedFormulas = base.formulas && base.formulas.length > 0;
		const hasRawFormulas = base.rawFormulas && base.rawFormulas.trim();
		if (hasTypedFormulas || hasRawFormulas) {
			const parts: string[] = ["formulas:"];
			if (hasTypedFormulas) {
				parts.push(renderFormulasContent(base.formulas!));
			}
			if (hasRawFormulas) {
				parts.push(base.rawFormulas!);
			}
			sections.push(parts.join("\n"));
		}

		if (base.properties && base.properties.length > 0) {
			sections.push(renderPropertiesSection(base.properties));
		}

		if (base.summaries && Object.keys(base.summaries).length > 0) {
			sections.push(renderSummariesSection(base.summaries, 0));
		}

		sections.push(renderViewsSection(base.views));

		return sections.join("\n");
	}

	static renderCodeBlock(base: BaseDefinition): string {
		return `\`\`\`base\n${BaseRenderer.render(base)}\n\`\`\``;
	}
}

// ── Filter rendering ────────────────────────────────────────────────────

function renderFilterSection(node: BaseFilterNode, baseIndent: number): string {
	const pad = " ".repeat(baseIndent);

	if (node.type !== "group") {
		return `${pad}filters:\n${pad}  - ${renderLeafExpression(node)}`;
	}

	const lines = [`${pad}filters:`];
	lines.push(...renderGroupBody(node, baseIndent + 2));
	return lines.join("\n");
}

function renderGroupBody(group: BaseFilterGroup, indent: number): string[] {
	const pad = " ".repeat(indent);
	const lines: string[] = [`${pad}${group.operator}:`];
	lines.push(...renderGroupChildren(group.children, indent + 2));
	return lines;
}

function renderGroupChildren(children: readonly BaseFilterNode[], itemIndent: number): string[] {
	const pad = " ".repeat(itemIndent);
	const lines: string[] = [];

	for (const child of children) {
		if (child.type === "group") {
			const childGroup = child as BaseFilterGroup;
			lines.push(`${pad}- ${childGroup.operator}:`);
			lines.push(...renderGroupChildren(childGroup.children, itemIndent + 4));
		} else {
			lines.push(`${pad}- ${renderLeafExpression(child)}`);
		}
	}

	return lines;
}

function renderLeafExpression(leaf: BaseFilterLeaf): string {
	switch (leaf.type) {
		case "noteComparison":
			return `note["${leaf.property}"] ${leaf.operator} ${renderFilterValue(leaf.value)}`;
		case "noteContains":
			return `note["${leaf.property}"].contains("${escapeQuotes(leaf.value)}")`;
		case "noteSelfLink":
			return `note["${leaf.property}"].contains(this.file.asLink())`;
		case "noteLinkComparison": {
			const link = leaf.displayName ? `[[${leaf.path}|${leaf.displayName}]]` : `[[${leaf.path}]]`;
			return `note["${leaf.property}"] ${leaf.operator} ["${link}"]`;
		}
		case "reverseContains":
			return `this["${leaf.property}"].contains(file)`;
		case "filePath":
			return `file.path ${leaf.operator} "${leaf.path}"`;
		case "fileFunction":
			return `file.${leaf.fn}(${leaf.args.map((a) => `"${a}"`).join(", ")})`;
		case "raw":
			return leaf.expression;
	}
}

function renderFilterValue(value: FilterValue): string {
	if (typeof value === "string") return `"${escapeQuotes(value)}"`;
	return String(value);
}

function escapeQuotes(s: string): string {
	return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// ── Formula rendering ───────────────────────────────────────────────────

function renderFormulasContent(formulas: readonly { name: string; expression: string }[]): string {
	const lines: string[] = [];
	for (const f of formulas) {
		if (f.expression.includes("\n")) {
			lines.push(`  ${f.name}: |-`);
			for (const exprLine of f.expression.split("\n")) {
				lines.push(`    ${exprLine}`);
			}
		} else {
			lines.push(`  ${f.name}: '${f.expression.replace(/'/g, "''")}'`);
		}
	}
	return lines.join("\n");
}

// ── Properties rendering ────────────────────────────────────────────────

function renderPropertiesSection(properties: readonly { key: string; displayName?: string | undefined }[]): string {
	const lines: string[] = ["properties:"];
	for (const prop of properties) {
		lines.push(`  ${prop.key}:`);
		if (prop.displayName) {
			lines.push(`    displayName: ${yamlScalar(prop.displayName)}`);
		}
	}
	return lines.join("\n");
}

// ── Summaries rendering ─────────────────────────────────────────────────

function renderSummariesSection(summaries: Readonly<Record<string, string>>, indent: number): string {
	const pad = " ".repeat(indent);
	const lines: string[] = [`${pad}summaries:`];
	for (const [key, expr] of Object.entries(summaries)) {
		lines.push(`${pad}  ${key}: '${expr.replace(/'/g, "''")}'`);
	}
	return lines.join("\n");
}

// ── Views rendering ─────────────────────────────────────────────────────

function renderViewsSection(views: readonly BaseView[]): string {
	const lines: string[] = ["views:"];
	for (const view of views) {
		lines.push(...renderView(view));
	}
	return lines.join("\n");
}

function renderView(view: BaseView): string[] {
	const lines: string[] = [];

	lines.push(`  - type: ${view.type}`);

	if (view.name != null) {
		lines.push(`    name: ${yamlScalar(view.name)}`);
	}

	if (view.limit != null) {
		lines.push(`    limit: ${view.limit}`);
	}

	if (view.groupBy) {
		lines.push("    groupBy:");
		lines.push(`      property: ${view.groupBy.property}`);
		lines.push(`      direction: ${view.groupBy.direction}`);
	}

	if (view.filter) {
		lines.push(...renderViewFilter(view.filter));
	}

	if (view.order && view.order.length > 0) {
		lines.push("    order:");
		for (const entry of view.order) {
			lines.push(`      - ${entry}`);
		}
	}

	if (view.rawSort && view.rawSort.trim()) {
		lines.push(`    sort:\n${view.rawSort}`);
	} else if (view.sort && view.sort.length > 0) {
		lines.push("    sort:");
		for (const s of view.sort) {
			lines.push(`      - property: ${s.property}`);
			lines.push(`        direction: ${s.direction}`);
		}
	}

	if (view.columnSize && Object.keys(view.columnSize).length > 0) {
		lines.push("    columnSize:");
		for (const [key, width] of Object.entries(view.columnSize)) {
			lines.push(`      ${key}: ${width}`);
		}
	}

	if (view.summaries && Object.keys(view.summaries).length > 0) {
		lines.push(...renderSummariesSection(view.summaries, 4).split("\n"));
	}

	return lines;
}

function renderViewFilter(node: BaseFilterNode): string[] {
	if (node.type !== "group") {
		return [`    filters:`, `      - ${renderLeafExpression(node)}`];
	}

	const lines: string[] = ["    filters:"];
	lines.push(...renderGroupBody(node, 6));
	return lines;
}

// ── YAML helpers ────────────────────────────────────────────────────────

function yamlScalar(value: string): string {
	if (needsQuoting(value)) {
		return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
	}
	return value;
}

function needsQuoting(value: string): boolean {
	if (value.length === 0) return true;
	if (/^[\s'"{[\]|>&*!%@#`]/.test(value)) return true;
	if (/[:\s]#/.test(value)) return true;
	if (value.includes(": ")) return true;
	if (value === "true" || value === "false" || value === "null") return true;
	if (/^-?\d/.test(value) && !Number.isNaN(Number(value))) return true;
	return false;
}
