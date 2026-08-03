import { describe, expect, it } from "vitest";

import * as apiGatewayBarrel from "../../src/integrations/api-gateway";

/**
 * The api-gateway barrel is reachable from `shared/src/index.ts`, so every module it
 * touches is bundled into all 11 plugins' `main.js`. Rollup hoists external imports
 * to a top-level `require()` whether or not the binding is read, so re-exporting a
 * module that imports a Node builtin puts `require("node:http")` at the top of every
 * bundle — fatal on mobile, where the manifests all declare `isDesktopOnly: false`.
 *
 * These assertions pin the barrel's surface so a future `export *` cannot silently
 * reopen the edge. The build-time backstop is `assertNoNodeBuiltinRequires()` in
 * `shared/configs/vite-plugin-config.ts`. See [[spec-no-node-builtins-in-bundles]].
 */
describe("api-gateway barrel surface", () => {
	it.each([
		["HttpApiServer", "node:http", "integrations/api-gateway/http-api-server"],
		["assertNoContractDrift", "node:fs/promises", "integrations/api-gateway/contract"],
		["compareContracts", "node:fs/promises", "integrations/api-gateway/contract"],
		["ContractDriftError", "node:fs/promises", "integrations/api-gateway/contract"],
		["emitExternalApiDts", "prettier", "integrations/api-gateway/external-apis"],
	])("should not re-export %s (drags in %s — import from %s instead)", (symbol) => {
		expect(apiGatewayBarrel).not.toHaveProperty(symbol);
	});

	it.each(["defineAction", "emitContract", "serializeContract", "PluginApiGateway", "ParamCoercion"])(
		"should still re-export %s",
		(symbol) => {
			expect(apiGatewayBarrel).toHaveProperty(symbol);
		}
	);
});
