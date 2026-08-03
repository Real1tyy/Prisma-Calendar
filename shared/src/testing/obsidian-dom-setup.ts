import "./setup-window";

// Skip DOM patching when running in node environment (pure-logic tests)
if (typeof HTMLElement !== "undefined") {
	setupObsidianDom();
}

function setupObsidianDom(): void {
	const proto = HTMLElement.prototype as HTMLElement & Record<string, unknown>;

	if (!proto.createEl) {
		(proto as any).createEl = function (
			this: HTMLElement,
			tag: string,
			opts?: {
				text?: string;
				cls?: string;
				type?: string;
				placeholder?: string;
				href?: string;
				attr?: Record<string, string>;
			}
		): HTMLElement {
			const el = document.createElement(tag);
			if (opts?.text) el.textContent = opts.text;
			if (opts?.cls) {
				for (const c of opts.cls.split(" ")) {
					if (c) el.classList.add(c);
				}
			}
			if (opts?.type) (el as HTMLInputElement).type = opts.type;
			if (opts?.placeholder) (el as HTMLInputElement).placeholder = opts.placeholder;
			if (opts?.href) (el as HTMLAnchorElement).href = opts.href;
			if (opts?.attr) {
				for (const [k, v] of Object.entries(opts.attr)) {
					el.setAttribute(k, v);
				}
			}
			this.appendChild(el);
			return el;
		};
	}

	if (!proto.createDiv) {
		(proto as any).createDiv = function (
			this: HTMLElement,
			opts?: string | { cls?: string; text?: string }
		): HTMLDivElement {
			const el = document.createElement("div");
			if (typeof opts === "string") {
				for (const c of opts.split(" ")) {
					if (c) el.classList.add(c);
				}
			} else if (opts?.cls) {
				for (const c of opts.cls.split(" ")) {
					if (c) el.classList.add(c);
				}
			}
			if (typeof opts === "object" && opts.text) el.textContent = opts.text;
			this.appendChild(el);
			return el;
		};
	}

	if (!proto.createSpan) {
		(proto as any).createSpan = function (
			this: HTMLElement,
			opts?: string | { cls?: string; text?: string }
		): HTMLSpanElement {
			const el = document.createElement("span");
			const cls = typeof opts === "string" ? opts : opts?.cls;
			if (cls) {
				for (const c of cls.split(" ")) {
					if (c) el.classList.add(c);
				}
			}
			if (typeof opts === "object" && opts.text) el.textContent = opts.text;
			this.appendChild(el);
			return el;
		};
	}

	// Mirrors Obsidian's `HTMLElement.toggle(show)`, which really does drive
	// `display` inline — this polyfill has to match it for tests to observe
	// the same thing production does.
	if (!proto.toggle) {
		(proto as any).toggle = function (this: HTMLElement, show: boolean): void {
			this.style.setProperty("display", show ? "" : "none");
		};
	}

	if (!proto.empty) {
		(proto as any).empty = function (this: HTMLElement): void {
			this.innerHTML = "";
		};
	}

	if (!proto.appendText) {
		(proto as any).appendText = function (this: HTMLElement, text: string): void {
			this.appendChild(document.createTextNode(text));
		};
	}

	if (!proto.addClass) {
		(proto as any).addClass = function (this: HTMLElement, ...classes: string[]): void {
			for (const cls of classes) {
				if (cls) this.classList.add(cls);
			}
		};
	}

	if (!proto.removeClass) {
		(proto as any).removeClass = function (this: HTMLElement, ...classes: string[]): void {
			for (const cls of classes) {
				if (cls) this.classList.remove(cls);
			}
		};
	}

	if (!proto.hasClass) {
		(proto as any).hasClass = function (this: HTMLElement, cls: string): boolean {
			return this.classList.contains(cls);
		};
	}

	if (typeof window.createDiv !== "function") {
		(window as any).createDiv = function (opts?: string | { cls?: string; text?: string }): HTMLDivElement {
			const el = document.createElement("div");
			if (typeof opts === "string") {
				for (const c of opts.split(" ")) {
					if (c) el.classList.add(c);
				}
			} else if (opts?.cls) {
				for (const c of opts.cls.split(" ")) {
					if (c) el.classList.add(c);
				}
			}
			if (typeof opts === "object" && opts.text) el.textContent = opts.text;
			return el;
		};
	}

	if (typeof window.createEl !== "function") {
		(window as any).createEl = function (tag: string, opts?: { text?: string; cls?: string }): HTMLElement {
			const el = document.createElement(tag);
			if (opts?.text) el.textContent = opts.text;
			if (opts?.cls) {
				for (const c of opts.cls.split(" ")) {
					if (c) el.classList.add(c);
				}
			}
			return el;
		};
	}

	if (typeof window.createFragment !== "function") {
		(window as any).createFragment = function (callback?: (frag: DocumentFragment) => void): DocumentFragment {
			const frag = document.createDocumentFragment();
			callback?.(frag);
			return frag;
		};
	}

	// Neither jsdom nor happy-dom implements constructable stylesheets, which is
	// how `injectStyleSheet` ships runtime CSS. Stand in a minimal version so
	// tests can read back what a component adopted (see `readAdoptedCss`).
	if (!Array.isArray(document.adoptedStyleSheets)) {
		Object.defineProperty(document, "adoptedStyleSheets", { value: [], writable: true });
	}
	const NativeCSSStyleSheet = globalThis.CSSStyleSheet as (new () => { replaceSync?: unknown }) | undefined;
	const hasConstructableSheets =
		typeof NativeCSSStyleSheet === "function" &&
		typeof (NativeCSSStyleSheet.prototype as { replaceSync?: unknown }).replaceSync === "function";
	if (!hasConstructableSheets) {
		(globalThis as any).CSSStyleSheet = class {
			cssText = "";
			replaceSync(css: string): void {
				this.cssText = css;
			}
		};
	}

	const fragProto = DocumentFragment.prototype as DocumentFragment & Record<string, unknown>;

	if (!fragProto.appendText) {
		(fragProto as any).appendText = function (this: DocumentFragment, text: string): void {
			this.appendChild(document.createTextNode(text));
		};
	}

	if (!fragProto.createSpan) {
		(fragProto as any).createSpan = function (
			this: DocumentFragment,
			opts?: { cls?: string; text?: string }
		): HTMLSpanElement {
			const el = document.createElement("span");
			if (opts?.cls) el.className = opts.cls;
			if (opts?.text) el.textContent = opts.text;
			this.appendChild(el);
			return el;
		};
	}

	if (!fragProto.createEl) {
		(fragProto as any).createEl = function (
			this: DocumentFragment,
			tag: string,
			opts?: { text?: string; cls?: string; href?: string }
		): HTMLElement {
			const el = document.createElement(tag);
			if (opts?.text) el.textContent = opts.text;
			if (opts?.cls) el.className = opts.cls;
			if (opts?.href) (el as HTMLAnchorElement).href = opts.href;
			this.appendChild(el);
			return el;
		};
	}

	if (!proto.setAttr) {
		(proto as any).setAttr = function (this: HTMLElement, name: string, value: string): void {
			this.setAttribute(name, value);
		};
	}
}
