import { defineConfig } from "vite";

import { obsidianPluginConfig } from "./shared/configs/vite-plugin-config";

export default defineConfig(
	obsidianPluginConfig({
		pluginDir: import.meta.dirname,
	})
);
