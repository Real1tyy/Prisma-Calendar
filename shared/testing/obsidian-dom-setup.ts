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
		if (typeof opts === "object" && opts?.text) el.textContent = opts.text;
		this.appendChild(el);
		return el;
	};
}

if (!proto.empty) {
	(proto as any).empty = function (this: HTMLElement): void {
		this.innerHTML = "";
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

if (typeof globalThis.createDiv !== "function") {
	(globalThis as any).createDiv = function (opts?: string | { cls?: string; text?: string }): HTMLDivElement {
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
		if (typeof opts === "object" && opts?.text) el.textContent = opts.text;
		return el;
	};
}

if (typeof globalThis.createEl !== "function") {
	(globalThis as any).createEl = function (tag: string, opts?: { text?: string; cls?: string }): HTMLElement {
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

const elProto2 = HTMLElement.prototype as HTMLElement & Record<string, unknown>;
if (!elProto2.setAttr) {
	(elProto2 as any).setAttr = function (this: HTMLElement, name: string, value: string): void {
		this.setAttribute(name, value);
	};
}
