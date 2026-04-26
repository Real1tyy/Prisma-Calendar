import { renderReactInline } from "@real1ty-obsidian-plugins-react";
import { type App, PluginSettingTab } from "obsidian";
import { createElement } from "react";

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
				this.display();
			}
		});
	}

	override display(): void {
		this.unmount?.();
		this.containerEl.empty();
		this.unmount = renderReactInline(this.containerEl, createElement(SettingsRoot, { plugin: this.plugin }), this.app);
	}

	override hide(): void {
		this.unmount?.();
		this.unmount = null;
	}
}
