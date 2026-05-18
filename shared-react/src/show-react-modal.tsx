import { applyClsTokens } from "@real1ty-obsidian-plugins";
import { Modal, type App } from "obsidian";
import { StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

import { AppContext } from "./contexts/app-context";
import { SharedReactThemeProvider } from "./contexts/theme-context";

export interface ReactModalBaseConfig {
	app: App;
	/** Space-separated class tokens applied to the modal root. */
	cls?: string | undefined;
	title?: string | undefined;
	testId?: string | undefined;
	/**
	 * CSS prefix shared by the modal subtree (`prisma-`, `bases-`, …). When set,
	 * every shared-react component inside this modal reads it via
	 * `useCssPrefix()` so the explicit `cssPrefix` prop can be dropped.
	 */
	cssPrefix?: string | undefined;
	/**
	 * TestId prefix mirrored to the `SharedReactThemeProvider`. Defaults to
	 * `cssPrefix` when omitted. Pass an explicit `""` for the unprefixed-
	 * testids mode used by shared plugin-agnostic modals.
	 */
	testIdPrefix?: string | undefined;
}

export interface ShowReactModalConfig extends ReactModalBaseConfig {
	render: (close: () => void) => ReactNode;
}

export interface OpenReactModalConfig<T> extends ReactModalBaseConfig {
	render: (submit: (value: T) => void, cancel: () => void) => ReactNode;
}

/**
 * Convenience config for the common shell pattern `{ app, cssPrefix,
 * testIdPrefix: cssPrefix, cls: `${cssPrefix}${name}-modal`, title, render }`.
 * Pass the bare `name` (e.g. `"item-manager"`) — `showShelledModal` derives
 * `cls` and mirrors `cssPrefix` to `testIdPrefix` so individual wrappers can't
 * forget either.
 */
export interface ShelledModalConfig {
	cssPrefix: string;
	name: string;
	title?: string | undefined;
	render: (close: () => void) => ReactNode;
}

class ReactModal extends Modal {
	private root: Root | null = null;

	constructor(
		app: App,
		private readonly options: ReactModalBaseConfig,
		private readonly renderContent: (close: () => void) => ReactNode,
		private readonly onModalClose?: () => void
	) {
		super(app);
	}

	override onOpen(): void {
		const { contentEl, modalEl } = this;
		contentEl.empty();
		applyClsTokens(modalEl, this.options.cls);
		if (this.options.title) this.setTitle(this.options.title);
		if (this.options.testId) modalEl.setAttribute("data-testid", this.options.testId);

		const testIdPrefix = this.options.testIdPrefix ?? this.options.cssPrefix;

		this.root = createRoot(contentEl);
		this.root.render(
			<StrictMode>
				<AppContext value={this.app}>
					<SharedReactThemeProvider cssPrefix={this.options.cssPrefix} testIdPrefix={testIdPrefix}>
						{this.renderContent(() => this.close())}
					</SharedReactThemeProvider>
				</AppContext>
			</StrictMode>
		);
	}

	override onClose(): void {
		this.root?.unmount();
		this.root = null;
		this.contentEl.empty();
		this.onModalClose?.();
	}
}

function mountReactModal(
	app: App,
	options: ReactModalBaseConfig,
	renderContent: (close: () => void) => ReactNode,
	onModalClose?: () => void
): Modal {
	return new ReactModal(app, options, renderContent, onModalClose);
}

export function showReactModal(config: ShowReactModalConfig): void {
	mountReactModal(config.app, config, config.render).open();
}

export function showShelledModal(app: App, config: ShelledModalConfig): void {
	showReactModal({
		app,
		cssPrefix: config.cssPrefix,
		testIdPrefix: config.cssPrefix,
		cls: `${config.cssPrefix}${config.name}-modal`,
		...(config.title !== undefined ? { title: config.title } : {}),
		render: config.render,
	});
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
