import { compile, type Options as Json2TsOptions } from "json-schema-to-typescript";
import { format as prettierFormat, resolveConfig as prettierResolveConfig } from "prettier";

import type { JsonSchemaFragment, PluginApiContract, PluginApiContractAction } from "../contract/types";

/**
 * The compile options applied per-schema. Banner is suppressed because the
 * outer emitter writes a single banner at the top of the .d.ts; format is off
 * because pre-commit Prettier owns final formatting.
 */
/**
 * `declareExternallyReferenced: true` is load-bearing — Zod's `.describe()`
 * + JSON-Schema extraction surfaces nested object shapes as named title
 * references (e.g., `SubstringMatchingForCategoriesAndPresets`). Without
 * external declarations, the .d.ts would compile-error on undeclared types.
 *
 * Format is off because pre-commit Prettier owns final formatting. Banner is
 * suppressed because the outer emitter writes a single banner per file.
 */
const COMPILE_OPTIONS: Partial<Json2TsOptions> = {
	bannerComment: "",
	additionalProperties: false,
	format: false,
	declareExternallyReferenced: true,
};

export interface EmitExternalApiDtsArgs {
	contract: PluginApiContract;
	sourcePath: string;
	regenerateCommand: string;
	/**
	 * Optional anchor path used to resolve the closest `.prettierrc` so the
	 * emitted output matches what lefthook's prettier hook would produce.
	 * Defaults to the file the emitter writes; callers in tests typically pass
	 * the repo root.
	 */
	prettierConfigPath?: string;
}

/**
 * Asynchronously emits a complete .d.ts source for a single producer plugin's
 * contract. The shape is:
 *
 *   1. Banner referencing the source contract path and regen command.
 *   2. Per-action Input + Output interfaces (json-schema-to-typescript output).
 *   3. The combined API interface — every method returns `Promise<T>`.
 *   4. `declare global` augmentation of `Window` with the producer's key.
 *
 * Promise-returns everywhere is intentional: producer handlers may be sync
 * today and async tomorrow, and the consumer should not have to refactor for
 * that transition. See the parent ADR for rationale.
 */
export async function emitExternalApiDts(args: EmitExternalApiDtsArgs): Promise<string> {
	const { contract, sourcePath, regenerateCommand } = args;
	const pluginPrefix = contract.globalKey;
	const apiInterfaceName = `${pluginPrefix}Api`;

	const actionNames = Object.keys(contract.actions).sort();
	const blocks: string[] = [];
	const methodSignatures: string[] = [];

	for (const actionName of actionNames) {
		const action = contract.actions[actionName];
		const { typeBlock, methodLine } = await emitAction(pluginPrefix, actionName, action);
		if (typeBlock.length > 0) blocks.push(typeBlock);
		methodSignatures.push(methodLine);
	}

	const apiInterface = [
		`export interface ${apiInterfaceName} {`,
		...methodSignatures.map((line) => `\t${line}`),
		`}`,
		``,
	].join("\n");

	const windowAugmentation = [
		`declare global {`,
		`\tinterface Window {`,
		`\t\t${pluginPrefix}?: ${apiInterfaceName};`,
		`\t}`,
		`}`,
		``,
	].join("\n");

	const banner = buildBanner({ sourcePath, regenerateCommand, apiInterfaceName });
	// json-schema-to-typescript re-emits the same nested-type declarations
	// (e.g., `MobileEventsPerDay`) for every action whose schema references
	// them — once per compile() invocation. Concatenated as-is, the resulting
	// .d.ts has duplicate `export type X = …` declarations and TypeScript
	// rejects it with TS2300. Dedupe by top-level declaration name across all
	// per-action blocks before joining; later duplicates are structurally
	// identical, so keeping the first occurrence is safe.
	const dedupedBody = dedupeTopLevelDeclarations(blocks.join("\n"));
	const raw = [banner, dedupedBody, apiInterface, windowAugmentation].join("\n");

	// Formatting is load-bearing for drift detection: lefthook's prettier hook
	// rewrites unformatted .d.ts files at commit time, which would silently
	// mutate the committed artifact and trigger a false drift fail. Formatting
	// inside the emitter makes the committed file already match what prettier
	// would produce, so commit-time prettier becomes a no-op and the drift
	// test compares deterministic, prettier-formatted output to itself.
	const resolved = (await prettierResolveConfig(args.prettierConfigPath ?? process.cwd())) ?? {};
	return prettierFormat(raw, { ...resolved, parser: "typescript" });
}

/**
 * Splits a concatenated stream of `export interface NAME { … }` and
 * `export type NAME = …` declarations on top-level braces, keeps the first
 * occurrence of each NAME, and drops later duplicates.
 *
 * The brace/bracket walk is balanced (not regex-only) so nested `{ }` inside
 * an interface body don't terminate the block early. Anything that isn't a
 * tracked top-level declaration passes through unchanged so comments, blank
 * lines, and unrecognised forms survive.
 */
function dedupeTopLevelDeclarations(source: string): string {
	const headerPattern = /export\s+(interface|type)\s+([A-Za-z_$][\w$]*)/g;
	const seen = new Set<string>();
	const out: string[] = [];
	let cursor = 0;

	for (;;) {
		headerPattern.lastIndex = cursor;
		const match = headerPattern.exec(source);
		if (!match) {
			out.push(source.slice(cursor));
			break;
		}

		const headerStart = match.index;
		out.push(source.slice(cursor, headerStart));

		const kind = match[1];
		const name = match[2];
		const declEnd = kind === "interface" ? findInterfaceEnd(source, headerStart) : findTypeEnd(source, headerStart);

		if (!seen.has(name)) {
			seen.add(name);
			out.push(source.slice(headerStart, declEnd));
		}

		cursor = declEnd;
	}

	return out.join("");
}

function findInterfaceEnd(source: string, from: number): number {
	const braceStart = source.indexOf("{", from);
	if (braceStart === -1) return source.length;

	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const ch = source[i];
		if (ch === "{") depth += 1;
		else if (ch === "}") {
			depth -= 1;
			if (depth === 0) return i + 1;
		}
	}
	return source.length;
}

function findTypeEnd(source: string, from: number): number {
	let depth = 0;
	let sawEquals = false;
	for (let i = from; i < source.length; i += 1) {
		const ch = source[i];
		if (!sawEquals) {
			if (ch === "=") sawEquals = true;
			continue;
		}
		if (ch === "{" || ch === "(" || ch === "[" || ch === "<") depth += 1;
		else if (ch === "}" || ch === ")" || ch === "]" || ch === ">") depth -= 1;
		// A bare newline at top level ends a `type X = …` declaration. The
		// generator output is one declaration per source line — that's what
		// we're parsing here; prettier reflow happens afterwards.
		else if (ch === "\n" && depth <= 0) return i;
	}
	return source.length;
}

/**
 * Trailing newline matches the repo's Prettier config so a post-emit format
 * pass is a no-op and committed artifacts round-trip without diff churn.
 */
export function serializeExternalApiDts(content: string): string {
	const trimmed = content.replace(/\n+$/, "");
	return `${trimmed}\n`;
}

async function emitAction(
	pluginPrefix: string,
	actionName: string,
	action: PluginApiContractAction
): Promise<{ typeBlock: string; methodLine: string }> {
	const pascalAction = pascalCase(actionName);
	const inputTypeName = `${pluginPrefix}${pascalAction}Input`;
	const outputTypeName = `${pluginPrefix}${pascalAction}Output`;

	const typeBlocks: string[] = [];

	const inputDeclared = action.input !== null;
	const outputDeclared = action.output !== null;

	if (inputDeclared) {
		const inputDts = await compileSchema(action.input as JsonSchemaFragment, inputTypeName);
		typeBlocks.push(inputDts);
	}

	if (outputDeclared) {
		const outputDts = await compileSchema(action.output as JsonSchemaFragment, outputTypeName);
		typeBlocks.push(outputDts);
	}

	const inputParam = inputDeclared ? `input: ${inputTypeName}` : "";
	const returnInner = outputDeclared ? outputTypeName : "void";
	const methodLine = `${actionName}(${inputParam}): Promise<${returnInner}>;`;

	return {
		typeBlock: typeBlocks.join("\n"),
		methodLine,
	};
}

async function compileSchema(schema: JsonSchemaFragment, name: string): Promise<string> {
	const schemaForCompile = { ...schema, title: name };
	const compiled = await compile(schemaForCompile, name, COMPILE_OPTIONS);
	return compiled.trim();
}

function buildBanner(args: { sourcePath: string; regenerateCommand: string; apiInterfaceName: string }): string {
	const { sourcePath, regenerateCommand, apiInterfaceName } = args;
	return [
		`/**`,
		` * AUTOGENERATED — DO NOT EDIT.`,
		` *`,
		` * Source: ${sourcePath}`,
		` * Regenerate: ${regenerateCommand}`,
		` *`,
		` * Public surface: ${apiInterfaceName} + window augmentation. Every method`,
		` * returns Promise<T> regardless of whether the producer's handler is sync`,
		` * or async — see docs/decisions/2026-05-15-external-apis-shared-emission.md.`,
		` */`,
		``,
	].join("\n");
}

function pascalCase(name: string): string {
	if (name.length === 0) return name;
	return name.charAt(0).toUpperCase() + name.slice(1);
}
