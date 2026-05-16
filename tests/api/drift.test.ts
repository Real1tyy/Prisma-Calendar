// @vitest-environment jsdom

import { resolve } from "node:path";

import { declareApiDriftSuite } from "@real1ty-obsidian-plugins/testing/drift-runners";

import { buildActions, GLOBAL_KEY } from "../../src/core/api/action-definitions";
import type CustomCalendarPlugin from "../../src/main";

declareApiDriftSuite({
	pluginDir: resolve(__dirname, "..", ".."),
	pluginKebab: "prisma-calendar",
	globalKey: GLOBAL_KEY,
	actions: buildActions({} as CustomCalendarPlugin),
	contractRegenerateCommand: "pnpm --dir Prisma-Calendar run contract:emit",
	externalApisRegenerateCommand: "pnpm --filter @real1ty-obsidian-plugins run emit-external-apis",
});
