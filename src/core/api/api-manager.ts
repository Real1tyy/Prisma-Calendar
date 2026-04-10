import { type ActionDefMap, PluginApiGateway } from "@real1ty-obsidian-plugins";

import type CustomCalendarPlugin from "../../main";
import { buildActions } from "./action-definitions";

const GLOBAL_KEY = "PrismaCalendar";

export class PrismaCalendarApiManager {
	private readonly gateway: PluginApiGateway<ActionDefMap>;
	readonly plugin: CustomCalendarPlugin;

	constructor(plugin: CustomCalendarPlugin) {
		this.plugin = plugin;
		this.gateway = new PluginApiGateway({
			plugin: this.plugin,
			globalKey: GLOBAL_KEY,
			protocolKey: "prisma-calendar",
			actions: buildActions(this.plugin),
		});
	}

	// ─── API Registration ─────────────────────────────────────────

	exposeFree(): void {
		(window as unknown as Record<string, unknown>)[GLOBAL_KEY] = {
			isPro: () => this.plugin.isProEnabled,
		};
	}

	expose(): void {
		if (!this.plugin.isProEnabled) {
			return;
		}
		this.gateway.expose();
	}

	unexpose(): void {
		this.gateway.unexpose();
		this.exposeFree();
	}

	destroy(): void {
		this.gateway.unexpose();
	}

	buildUrl(call: string, params?: Record<string, string | number | boolean>): string {
		return this.gateway.buildUrl(call, params);
	}
}
