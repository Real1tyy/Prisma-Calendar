import { reactSettingDefinitions, renderReactInline } from "@real1ty/obsidian-plugins-react";
import { PluginSettingTab, requireApiVersion, type App, type SettingDefinitionItem } from "obsidian";
import { createElement } from "react";

import { CSS_PREFIX } from "../../constants";
import type CustomCalendarPlugin from "../../main";
import { SettingsRoot } from "../../react/settings/settings-root";

export class CustomCalendarSettingsTab extends PluginSettingTab {
	plugin: CustomCalendarPlugin;
	private unmount: (() => void) | null = null;

	constructor(app: App, plugin: CustomCalendarPlugin) {
		super(app, plugin);
		this.plugin = plugin;

		this.plugin.licenseManager.status$.subscribe(() => {
			if (this.containerEl.isShown()) {
				this.refresh();
			}
		});
	}

	override display(): void {
		this.remount();
	}

	override getSettingDefinitions(): SettingDefinitionItem[] {
		return reactSettingDefinitions("Prisma Calendar", (containerEl) => this.mountSettings(containerEl));
	}

	override hide(): void {
		this.unmount?.();
		this.unmount = null;
	}

	private mountSettings(containerEl: HTMLElement): () => void {
		return renderReactInline(containerEl, createElement(SettingsRoot, { plugin: this.plugin }), this.app, {
			cssPrefix: CSS_PREFIX,
			testIdPrefix: CSS_PREFIX,
		});
	}

	private remount(): void {
		this.unmount?.();
		this.containerEl.empty();
		this.unmount = this.mountSettings(this.containerEl);
	}

	/**
	 * Re-render after the license status moves. The two paths are not
	 * interchangeable: on 1.13 the tab is rendered from `getSettingDefinitions()`
	 * and `display()` is skipped, so remounting into `containerEl` here would
	 * strand a second React root underneath the declarative one.
	 */
	private refresh(): void {
		if (requireApiVersion("1.13.0")) {
			this.update();
		} else {
			this.remount();
		}
	}
}
