/**
 * Per-element polyfill for Obsidian's HTMLElement DOM extensions
 * (createDiv, createEl, createSpan, setText, addClass, etc.) for use in
 * visual-regression rendering outside of Obsidian.
 *
 * Per-element rather than prototype-patching: visual harness scenarios run
 * in the same vitest process as unit tests, and we don't want the harness
 * leaking these methods globally onto every HTMLElement created during
 * unrelated tests. Tests that DO want global patching should import
 * `obsidian-dom-setup` instead.
 *
 * Intentionally minimal — only the option shapes plugin code actually uses:
 *   cls: string | string[]
 *   text: string
 *   type: string        (for <input>)
 *   attr: Record<string, string>
 *   title: string
 *   href: string        (for <a>)
 *   value: string       (for <input>)
 *   placeholder: string (for <input>)
 */

type ObsidianElOptions = {
	cls?: string | string[];
	text?: string;
	type?: string;
	attr?: Record<string, string>;
	title?: string;
	href?: string;
	value?: string;
	placeholder?: string;
};

function applyOptions(el: HTMLElement, options?: ObsidianElOptions): void {
	if (!options) return;
	if (options.cls) {
		const classes = Array.isArray(options.cls) ? options.cls : options.cls.split(/\s+/);
		el.classList.add(...classes.filter((c) => c.length > 0));
	}
	if (options.text !== undefined) el.textContent = options.text;
	if (options.type) (el as HTMLInputElement).type = options.type;
	if (options.title) el.title = options.title;
	if (options.href) (el as HTMLAnchorElement).href = options.href;
	if (options.value !== undefined) (el as HTMLInputElement).value = options.value;
	if (options.placeholder) (el as HTMLInputElement).placeholder = options.placeholder;
	if (options.attr) {
		for (const [k, v] of Object.entries(options.attr)) el.setAttribute(k, v);
	}
}

export function applyObsidianDomHelpers(element: HTMLElement): void {
	const anyEl = element as unknown as Record<string, unknown>;
	if (anyEl["__obsidianDomHelpersApplied"]) return;
	anyEl["__obsidianDomHelpersApplied"] = true;

	anyEl["createDiv"] = function (this: HTMLElement, options?: ObsidianElOptions | string): HTMLElement {
		const div = document.createElement("div");
		if (typeof options === "string") {
			div.className = options;
		} else {
			applyOptions(div, options);
		}
		this.appendChild(div);
		applyObsidianDomHelpers(div);
		return div;
	};

	anyEl["createEl"] = function (this: HTMLElement, tag: string, options?: ObsidianElOptions | string): HTMLElement {
		const el = document.createElement(tag);
		if (typeof options === "string") {
			el.className = options;
		} else {
			applyOptions(el, options);
		}
		this.appendChild(el);
		applyObsidianDomHelpers(el);
		return el;
	};

	anyEl["createSpan"] = function (this: HTMLElement, options?: ObsidianElOptions | string): HTMLElement {
		const span = document.createElement("span");
		if (typeof options === "string") {
			span.className = options;
		} else {
			applyOptions(span, options);
		}
		this.appendChild(span);
		applyObsidianDomHelpers(span);
		return span;
	};

	anyEl["setText"] = function (this: HTMLElement, text: string): void {
		this.textContent = text;
	};

	anyEl["addClass"] = function (this: HTMLElement, ...classes: string[]): void {
		this.classList.add(...classes);
	};

	anyEl["removeClass"] = function (this: HTMLElement, ...classes: string[]): void {
		this.classList.remove(...classes);
	};

	anyEl["toggleClass"] = function (this: HTMLElement, cls: string, value?: boolean): void {
		this.classList.toggle(cls, value);
	};

	anyEl["empty"] = function (this: HTMLElement): void {
		while (this.firstChild) this.removeChild(this.firstChild);
	};

	anyEl["hasClass"] = function (this: HTMLElement, cls: string): boolean {
		return this.classList.contains(cls);
	};
}

export function makeContainer(): HTMLElement {
	const container = document.createElement("div");
	applyObsidianDomHelpers(container);
	return container;
}
