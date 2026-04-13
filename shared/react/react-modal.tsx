import type { App } from "obsidian";
import { Modal } from "obsidian";
import type { ReactNode } from "react";
import { StrictMode } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";

import { AppContext } from "./contexts/app-context";

export interface ReactModalConfig<T> {
	app: App;
	cls?: string;
	title?: string;
	render: (onSubmit: (value: T) => void, onCancel: () => void) => ReactNode;
}

export class ReactModal<T> extends Modal {
	private root: Root | null = null;
	private resolvePromise: ((value: T | null) => void) | null = null;
	private config: ReactModalConfig<T>;

	constructor(config: ReactModalConfig<T>) {
		super(config.app);
		this.config = config;
	}

	override onOpen(): void {
		const { contentEl, modalEl } = this;
		contentEl.empty();

		if (this.config.cls) {
			modalEl.addClass(this.config.cls);
		}
		if (this.config.title) {
			this.setTitle(this.config.title);
		}

		this.root = createRoot(contentEl);
		this.root.render(
			<StrictMode>
				<AppContext value={this.config.app}>
					{this.config.render(
						(value: T) => {
							this.resolvePromise?.(value);
							this.close();
						},
						() => {
							this.resolvePromise?.(null);
							this.close();
						}
					)}
				</AppContext>
			</StrictMode>
		);
	}

	override onClose(): void {
		this.root?.unmount();
		this.root = null;
		this.resolvePromise?.(null);
		this.resolvePromise = null;
		this.contentEl.empty();
	}

	openAndAwait(): Promise<T | null> {
		return new Promise<T | null>((resolve) => {
			this.resolvePromise = resolve;
			super.open();
		});
	}
}
