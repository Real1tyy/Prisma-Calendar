import type { BaseDefinition, BaseFilterNode, BaseFormula, BasePropertyConfig, BaseView } from "./schema";

export class BaseBuilder {
	private _filter?: BaseFilterNode;
	private _formulas: BaseFormula[] = [];
	private _rawFormulas?: string;
	private _properties: BasePropertyConfig[] = [];
	private _summaries: Record<string, string> = {};
	private _views: BaseView[] = [];

	private constructor() {}

	static create(): BaseBuilder {
		return new BaseBuilder();
	}

	filter(node: BaseFilterNode): this {
		this._filter = node;
		return this;
	}

	formula(name: string, expression: string): this {
		this._formulas.push({ name, expression });
		return this;
	}

	formulas(entries: BaseFormula[]): this {
		this._formulas.push(...entries);
		return this;
	}

	rawFormulas(yaml: string): this {
		this._rawFormulas = yaml;
		return this;
	}

	property(key: string, displayName: string): this {
		this._properties.push({ key, displayName });
		return this;
	}

	summary(name: string, expression: string): this {
		this._summaries[name] = expression;
		return this;
	}

	addView(view: BaseView): this {
		this._views.push(view);
		return this;
	}

	build(): BaseDefinition {
		if (this._views.length === 0) {
			throw new Error("BaseDefinition requires at least one view");
		}

		const def: BaseDefinition = {
			views: this._views,
			...(this._filter && { filter: this._filter }),
			...(this._formulas.length > 0 && { formulas: this._formulas }),
			...(this._rawFormulas && { rawFormulas: this._rawFormulas }),
			...(this._properties.length > 0 && { properties: this._properties }),
			...(Object.keys(this._summaries).length > 0 && { summaries: this._summaries }),
		};

		return def;
	}
}
