import "./setup-window";

/**
 * Element-creation options accepted by Obsidian's DOM helpers. Only the subset
 * the polyfills below honour — a test double has to be behaviourally
 * compatible, not signature-identical to `obsidian.d.ts`.
 */
interface ElOptions {
	text?: string;
	cls?: string;
	type?: string;
	placeholder?: string;
	href?: string;
	attr?: Record<string, string>;
}

/**
 * The members Obsidian installs on `HTMLElement.prototype` at runtime. Declared
 * here so each polyfill assignment below is type-checked: the prototypes are
 * viewed through this interface rather than cast to `any` per line, which is
 * what `@typescript-eslint/no-unsafe-member-access` was firing on.
 */
interface ObsidianElementPolyfills {
	createEl?: (this: HTMLElement, tag: string, opts?: ElOptions) => HTMLElement;
	createDiv?: (this: HTMLElement, opts?: string | ElOptions) => HTMLDivElement;
	createSpan?: (this: HTMLElement, opts?: string | ElOptions) => HTMLSpanElement;
	toggle?: (this: HTMLElement, show: boolean) => void;
	empty?: (this: HTMLElement) => void;
	appendText?: (this: HTMLElement, text: string) => void;
	addClass?: (this: HTMLElement, ...classes: string[]) => void;
	removeClass?: (this: HTMLElement, ...classes: string[]) => void;
	hasClass?: (this: HTMLElement, cls: string) => boolean;
	setAttr?: (this: HTMLElement, name: string, value: string) => void;
}

interface ObsidianFragmentPolyfills {
	appendText?: (this: DocumentFragment, text: string) => void;
	createSpan?: (this: DocumentFragment, opts?: ElOptions) => HTMLSpanElement;
	createEl?: (this: DocumentFragment, tag: string, opts?: ElOptions) => HTMLElement;
}

/** Obsidian's bare global element factories, plus the constructable-sheet shim. */
interface ObsidianGlobalPolyfills {
	createDiv?: (opts?: string | ElOptions) => HTMLDivElement;
	createEl?: (tag: string, opts?: ElOptions) => HTMLElement;
	createFragment?: (callback?: (frag: DocumentFragment) => void) => DocumentFragment;
	CSSStyleSheet?: unknown;
}

function applyClasses(el: HTMLElement, cls: string | undefined): void {
	if (!cls) return;
	for (const c of cls.split(" ")) {
		if (c) el.classList.add(c);
	}
}

function buildEl<K extends keyof HTMLElementTagNameMap>(tag: K, opts?: string | ElOptions): HTMLElementTagNameMap[K];
function buildEl(tag: string, opts?: string | ElOptions): HTMLElement;
function buildEl(tag: string, opts?: string | ElOptions): HTMLElement {
	const el = document.createElement(tag);
	if (typeof opts === "string") {
		applyClasses(el, opts);
		return el;
	}
	if (!opts) return el;

	if (opts.text) el.textContent = opts.text;
	applyClasses(el, opts.cls);
	if (opts.type) (el as HTMLInputElement).type = opts.type;
	if (opts.placeholder) (el as HTMLInputElement).placeholder = opts.placeholder;
	if (opts.href) (el as HTMLAnchorElement).href = opts.href;
	if (opts.attr) {
		for (const [k, v] of Object.entries(opts.attr)) {
			el.setAttribute(k, v);
		}
	}
	return el;
}

// Skip DOM patching when running in node environment (pure-logic tests)
if (typeof HTMLElement !== "undefined") {
	setupObsidianDom();
}

function setupObsidianDom(): void {
	// Cast to the polyfill view alone, never intersected with the real type:
	// `obsidian.d.ts` already augments these prototypes, and an intersection
	// would demand each stub satisfy Obsidian's full overload set (tag-name
	// generics, DomElementInfo, callbacks) instead of the subset tests use.
	const proto = HTMLElement.prototype as unknown as ObsidianElementPolyfills;
	const fragProto = DocumentFragment.prototype as unknown as ObsidianFragmentPolyfills;
	const globals = globalThis as unknown as ObsidianGlobalPolyfills;

	if (!proto.createEl) {
		proto.createEl = function (this: HTMLElement, tag, opts) {
			return this.appendChild(buildEl(tag, opts));
		};
	}

	if (!proto.createDiv) {
		proto.createDiv = function (this: HTMLElement, opts) {
			return this.appendChild(buildEl("div", opts));
		};
	}

	if (!proto.createSpan) {
		proto.createSpan = function (this: HTMLElement, opts) {
			return this.appendChild(buildEl("span", opts));
		};
	}

	// Mirrors Obsidian's `HTMLElement.toggle(show)`, which really does drive
	// `display` inline — this polyfill has to match it for tests to observe
	// the same thing production does.
	if (!proto.toggle) {
		proto.toggle = function (this: HTMLElement, show) {
			this.style.setProperty("display", show ? "" : "none");
		};
	}

	if (!proto.empty) {
		proto.empty = function (this: HTMLElement) {
			this.replaceChildren();
		};
	}

	if (!proto.appendText) {
		proto.appendText = function (this: HTMLElement, text) {
			this.appendChild(document.createTextNode(text));
		};
	}

	if (!proto.addClass) {
		proto.addClass = function (this: HTMLElement, ...classes) {
			for (const cls of classes) {
				if (cls) this.classList.add(cls);
			}
		};
	}

	if (!proto.removeClass) {
		proto.removeClass = function (this: HTMLElement, ...classes) {
			for (const cls of classes) {
				if (cls) this.classList.remove(cls);
			}
		};
	}

	if (!proto.hasClass) {
		proto.hasClass = function (this: HTMLElement, cls) {
			return this.classList.contains(cls);
		};
	}

	if (!proto.setAttr) {
		proto.setAttr = function (this: HTMLElement, name, value) {
			this.setAttribute(name, value);
		};
	}

	if (typeof globals.createDiv !== "function") {
		globals.createDiv = (opts) => buildEl("div", opts);
	}

	if (typeof globals.createEl !== "function") {
		globals.createEl = (tag, opts) => buildEl(tag, opts);
	}

	if (typeof globals.createFragment !== "function") {
		globals.createFragment = (callback) => {
			const frag = document.createDocumentFragment();
			callback?.(frag);
			return frag;
		};
	}

	// Neither jsdom nor happy-dom implements constructable stylesheets, which is
	// how `injectStyleSheet` ships runtime CSS. Stand in a minimal version so
	// tests can read back what a component adopted.
	if (!Array.isArray(document.adoptedStyleSheets)) {
		Object.defineProperty(document, "adoptedStyleSheets", { value: [], writable: true });
	}
	const NativeCSSStyleSheet = globals.CSSStyleSheet as { prototype?: { replaceSync?: unknown } } | undefined;
	const hasConstructableSheets = typeof NativeCSSStyleSheet?.prototype?.replaceSync === "function";
	if (!hasConstructableSheets) {
		globals.CSSStyleSheet = class {
			cssText = "";
			replaceSync(css: string): void {
				this.cssText = css;
			}
		};
	}

	if (!fragProto.appendText) {
		fragProto.appendText = function (this: DocumentFragment, text) {
			this.appendChild(document.createTextNode(text));
		};
	}

	if (!fragProto.createSpan) {
		fragProto.createSpan = function (this: DocumentFragment, opts) {
			return this.appendChild(buildEl("span", opts));
		};
	}

	if (!fragProto.createEl) {
		fragProto.createEl = function (this: DocumentFragment, tag, opts) {
			return this.appendChild(buildEl(tag, opts));
		};
	}
}
