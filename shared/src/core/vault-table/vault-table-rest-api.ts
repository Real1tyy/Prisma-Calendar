import type { ZodTypeAny } from "zod";

import type { ActionDefMap, HttpActionConfig } from "../../integrations/api-gateway";
import { ParamCoercion } from "../../integrations/api-gateway";
import type { SerializableSchema } from "./create-mapped-schema";
import type { VaultRow, VaultTableDefMap } from "./types";
import type { VaultTable } from "./vault-table";
import type { VaultTableQueryResult } from "./vault-table-query";
import { VaultTableQuery } from "./vault-table-query";
import {
	type FilterField,
	inferFilterFields,
	inferSortFields,
	parseFilterParams,
	parseSortParams,
	type SortField,
} from "./zod-filter-sort";

// ─── Types ──────────────────────────────────────────────────────

type ZodShape = Record<string, ZodTypeAny>;

export interface VaultTableRestConfig {
	resourceName: string;
	shape: ZodShape;
	readOnly?: boolean;
	children?: Record<string, VaultTableChildRestConfig>;
}

export interface VaultTableChildRestConfig {
	resourceName: string;
	shape: ZodShape;
	readOnly?: boolean;
	childKey: string;
}

interface SerializedRow {
	id: string;
	filePath: string;
	data: Record<string, unknown>;
	content: string;
	mtime: number;
}

interface ListParams {
	filters?: ReturnType<typeof parseFilterParams>;
	sorts?: ReturnType<typeof parseSortParams>;
	limit?: number;
	offset?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────

function serializeRow<T>(row: VaultRow<T>): SerializedRow {
	return {
		id: row.id,
		filePath: row.filePath,
		data: row.data as Record<string, unknown>,
		content: row.content,
		mtime: row.mtime,
	};
}

function notFound(entity: string, id: string) {
	return { status: 404, body: { error: `${entity} not found: ${id}` } };
}

function parseListParams(raw: Record<string, string>, filterFields: FilterField[]): ListParams {
	const limit = ParamCoercion.number(raw, "limit");
	const offset = ParamCoercion.number(raw, "offset");
	return {
		filters: parseFilterParams(raw, filterFields),
		sorts: parseSortParams(raw),
		...(limit !== undefined ? { limit } : {}),
		...(offset !== undefined ? { offset } : {}),
	};
}

function execListQuery(table: { toClonedArray(): VaultRow<unknown>[] }, params: ListParams, sortFields: SortField[]) {
	const query = VaultTableQuery.from(table, sortFields);

	if (params.filters?.length) query.addFilters(params.filters);
	if (params.sorts?.length) query.addSorts(params.sorts);
	if (params.limit !== undefined) query.limit(params.limit);
	if (params.offset !== undefined) query.offset(params.offset);

	return serializeQueryResult(query.exec());
}

function serializeQueryResult(result: VaultTableQueryResult<unknown>) {
	return {
		data: result.data.map(serializeRow),
		total: result.total,
		filtered: result.filtered,
		limit: result.limit,
		offset: result.offset,
	};
}

function serializeChildrenMeta(children?: Record<string, VaultTableChildRestConfig>) {
	if (!children) return [];
	return Object.values(children).map((c) => ({
		resource: c.resourceName,
		readOnly: c.readOnly ?? false,
	}));
}

// ─── Child Resource Builder ───────────────────────────────────────

function buildChildActions(
	parentTable: VaultTable<unknown, SerializableSchema<unknown>, VaultTableDefMap>,
	parentName: string,
	childConfig: VaultTableChildRestConfig
): ActionDefMap {
	const actions: ActionDefMap = {};
	const childName = childConfig.resourceName;
	const prefix = `${parentName}.${childName}`;
	const childKey = childConfig.childKey;

	const childFilterFields = inferFilterFields(childConfig.shape);
	const childSortFields = inferSortFields(childConfig.shape);

	async function requireChildTable(parentId: string) {
		const hydrated = await parentTable.getHydrated(parentId);
		if (!hydrated) return null;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const relations = hydrated.relations as Record<string, VaultTable<any, any, any>>;
		return relations[childKey] ?? null;
	}

	actions[`${prefix}.list`] = {
		handler: async (params: ListParams & { id: string }) => {
			const childTable = await requireChildTable(params.id);
			if (!childTable) return notFound(parentName, params.id);
			return execListQuery(childTable, params, childSortFields);
		},
		parseParams: (raw: Record<string, string>) => ({
			id: ParamCoercion.required.string(raw, "id"),
			...parseListParams(raw, childFilterFields),
		}),
		http: {
			method: "GET",
			path: `/${parentName}/:id/${childName}`,
		} satisfies HttpActionConfig,
	};

	actions[`${prefix}.get`] = {
		handler: async (params: { id: string; childId: string }) => {
			const childTable = await requireChildTable(params.id);
			if (!childTable) return notFound(parentName, params.id);

			const row = childTable.get(params.childId);
			if (!row) return notFound(childName, params.childId);

			return { data: serializeRow(row) };
		},
		parseParams: (raw: Record<string, string>) => ({
			id: ParamCoercion.required.string(raw, "id"),
			childId: ParamCoercion.required.string(raw, "childId"),
		}),
		http: {
			method: "GET",
			path: `/${parentName}/:id/${childName}/:childId`,
		} satisfies HttpActionConfig,
	};

	if (!childConfig.readOnly) {
		actions[`${prefix}.create`] = {
			handler: async (params: { id: string; fileName: string; data: unknown; content?: string }) => {
				const childTable = await requireChildTable(params.id);
				if (!childTable) return notFound(parentName, params.id);

				const row = await childTable.create({
					fileName: params.fileName,
					data: params.data,
					...(params.content !== undefined ? { content: params.content } : {}),
				});
				return { data: serializeRow(row) };
			},
			parseParams: (raw: Record<string, string>) => ({
				id: ParamCoercion.required.string(raw, "id"),
			}),
			http: {
				method: "POST",
				path: `/${parentName}/:id/${childName}`,
				parseBody: (body) => body as { fileName: string; data: unknown; content?: string },
			} satisfies HttpActionConfig,
		};

		actions[`${prefix}.update`] = {
			handler: async (params: { id: string; childId: string; data: unknown }) => {
				const childTable = await requireChildTable(params.id);
				if (!childTable) return notFound(parentName, params.id);

				const row = await childTable.update(params.childId, params.data as Record<string, unknown>);
				return { data: serializeRow(row) };
			},
			parseParams: (raw: Record<string, string>) => ({
				id: ParamCoercion.required.string(raw, "id"),
				childId: ParamCoercion.required.string(raw, "childId"),
			}),
			http: {
				method: "PUT",
				path: `/${parentName}/:id/${childName}/:childId`,
				parseBody: (body) => {
					const parsed = body as { data?: unknown };
					return { data: parsed.data ?? parsed };
				},
			} satisfies HttpActionConfig,
		};

		actions[`${prefix}.delete`] = {
			handler: async (params: { id: string; childId: string }) => {
				const childTable = await requireChildTable(params.id);
				if (!childTable) return notFound(parentName, params.id);

				await childTable.delete(params.childId);
				return { success: true };
			},
			parseParams: (raw: Record<string, string>) => ({
				id: ParamCoercion.required.string(raw, "id"),
				childId: ParamCoercion.required.string(raw, "childId"),
			}),
			http: {
				method: "DELETE",
				path: `/${parentName}/:id/${childName}/:childId`,
			} satisfies HttpActionConfig,
		};
	}

	return actions;
}

// ─── VaultTableRestApi ────────────────────────────────────────────

export class VaultTableRestApi<TData extends Record<string, unknown>> {
	private readonly filterFields: FilterField[];
	private readonly sortFields: SortField[];

	constructor(
		private readonly table: VaultTable<TData, SerializableSchema<TData>, VaultTableDefMap>,
		private readonly config: VaultTableRestConfig
	) {
		this.filterFields = inferFilterFields(config.shape);
		this.sortFields = inferSortFields(config.shape);
	}

	buildActions(): ActionDefMap {
		const actions: ActionDefMap = {};
		const name = this.config.resourceName;

		actions[`${name}.list`] = this.buildListAction();
		actions[`${name}.get`] = this.buildGetAction();
		actions[`${name}.schema`] = this.buildSchemaAction();

		if (!this.config.readOnly) {
			actions[`${name}.create`] = this.buildCreateAction();
			actions[`${name}.update`] = this.buildUpdateAction();
			actions[`${name}.delete`] = this.buildDeleteAction();
		}

		if (this.config.children) {
			for (const childConfig of Object.values(this.config.children)) {
				const childActions = buildChildActions(
					this.table as VaultTable<unknown, SerializableSchema<unknown>, VaultTableDefMap>,
					name,
					childConfig
				);
				Object.assign(actions, childActions);
			}
		}

		return actions;
	}

	// ─── Parent Actions ─────────────────────────────────────────

	private buildListAction(): ActionDefMap[string] {
		return {
			handler: (params: ListParams) => {
				return execListQuery(this.table, params, this.sortFields);
			},
			parseParams: (raw: Record<string, string>) => parseListParams(raw, this.filterFields),
			http: {
				method: "GET",
				path: `/${this.config.resourceName}`,
			} satisfies HttpActionConfig,
		};
	}

	private buildGetAction(): ActionDefMap[string] {
		return {
			handler: (params: { id: string }) => {
				const row = this.table.get(params.id);
				if (!row) return notFound(this.config.resourceName, params.id);
				return { data: serializeRow(row) };
			},
			parseParams: (raw: Record<string, string>) => ({
				id: ParamCoercion.required.string(raw, "id"),
			}),
			http: {
				method: "GET",
				path: `/${this.config.resourceName}/:id`,
			} satisfies HttpActionConfig,
		};
	}

	private buildCreateAction(): ActionDefMap[string] {
		return {
			handler: async (params: { fileName: string; data: Partial<TData>; content?: string }) => {
				const row = await this.table.create({
					fileName: params.fileName,
					data: params.data as TData,
					...(params.content !== undefined ? { content: params.content } : {}),
				});
				return { data: serializeRow(row) };
			},
			http: {
				method: "POST",
				path: `/${this.config.resourceName}`,
				parseBody: (body) => body as { fileName: string; data: Partial<TData>; content?: string },
			} satisfies HttpActionConfig,
		};
	}

	private buildUpdateAction(): ActionDefMap[string] {
		return {
			handler: async (params: { id: string; data: Partial<TData> }) => {
				const row = await this.table.update(params.id, params.data);
				return { data: serializeRow(row) };
			},
			parseParams: (raw: Record<string, string>) => ({
				id: ParamCoercion.required.string(raw, "id"),
			}),
			http: {
				method: "PUT",
				path: `/${this.config.resourceName}/:id`,
				parseBody: (body) => {
					const parsed = body as { data?: Partial<TData> };
					return { data: parsed.data ?? (parsed as Partial<TData>) };
				},
			} satisfies HttpActionConfig,
		};
	}

	private buildDeleteAction(): ActionDefMap[string] {
		return {
			handler: async (params: { id: string }) => {
				await this.table.delete(params.id);
				return { success: true };
			},
			parseParams: (raw: Record<string, string>) => ({
				id: ParamCoercion.required.string(raw, "id"),
			}),
			http: {
				method: "DELETE",
				path: `/${this.config.resourceName}/:id`,
			} satisfies HttpActionConfig,
		};
	}

	private buildSchemaAction(): ActionDefMap[string] {
		return {
			handler: () => ({
				resource: this.config.resourceName,
				readOnly: this.config.readOnly ?? false,
				filterFields: this.filterFields,
				sortFields: this.sortFields,
				children: serializeChildrenMeta(this.config.children),
			}),
			http: {
				method: "GET",
				path: `/${this.config.resourceName}/_schema`,
			} satisfies HttpActionConfig,
		};
	}
}
