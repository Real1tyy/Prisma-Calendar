import type { App } from "obsidian";
import { Modal } from "obsidian";
import type { ReactNode } from "react";
import { StrictMode } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";

import { AppContext } from "./contexts/app-context";

export interface ReactModalBaseConfig {
	app: App;
	cls?: string | undefined;
	title?: string | undefined;
	testId?: string | undefined;
}

export interface ShowReactModalConfig extends ReactModalBaseConfig {
	render: (close: () => void) => ReactNode;
}

export interface OpenReactModalConfig<T> extends ReactModalBaseConfig {
	render: (submit: (value: T) => void, cancel: () => void) => ReactNode;
}

function mountReactModal(
	app: App,
	options: ReactModalBaseConfig,
	renderContent: (close: () => void) => ReactNode,
	onModalClose?: () => void
): Modal {
	class ReactModalInternal extends Modal {
		private root: Root | null = null;

		override onOpen(): void {
			const { contentEl, modalEl } = this;
			contentEl.empty();
			if (options.cls) modalEl.addClass(options.cls);
			if (options.title) this.setTitle(options.title);
			if (options.testId) modalEl.setAttribute("data-testid", options.testId);

			this.root = createRoot(contentEl);
			this.root.render(
				<StrictMode>
					<AppContext value={app}>{renderContent(() => this.close())}</AppContext>
				</StrictMode>
			);
		}

		override onClose(): void {
			this.root?.unmount();
			this.root = null;
			this.contentEl.empty();
			onModalClose?.();
		}
	}

	return new ReactModalInternal(app);
}

export function showReactModal(config: ShowReactModalConfig): void {
	mountReactModal(config.app, config, config.render).open();
}

export function openReactModal<T>(config: OpenReactModalConfig<T>): Promise<T | null> {
	return new Promise<T | null>((resolve) => {
		let settled = false;

		const settle = (value: T | null): void => {
			if (settled) return;
			settled = true;
			resolve(value);
		};

		mountReactModal(
			config.app,
			config,
			(close) =>
				config.render(
					(value: T) => {
						settle(value);
						close();
					},
					() => {
						settle(null);
						close();
					}
				),
			() => settle(null)
		).open();
	});
}
