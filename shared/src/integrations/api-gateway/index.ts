// This barrel is reachable from `shared/src/index.ts`, so everything it touches
// lands in every plugin's `main.js`. Rollup hoists external imports to a top-level
// `require()` regardless of whether the binding is read, so a single edge to a
// module importing a Node builtin breaks plugin load on mobile — even when the code
// around it is dead. Two consequences, both load-bearing:
//
//   1. Import from LEAF modules, never from `./contract`. That barrel re-exports
//      `drift.ts`, which imports `node:fs/promises`.
//   2. Node-only modules stay off this barrel entirely and are reached by deep
//      subpath: `external-apis` (pulls `prettier` + `json-schema-to-typescript`),
//      `http-api-server` (`node:http`), and the `./contract` drift checker.
//
// See [[spec-no-node-builtins-in-bundles]]; the build-time guard that enforces this
// lives in `shared/configs/vite-plugin-config.ts`.
export { defineAction } from "./contract/define-action";
export { emitContract, serializeContract } from "./contract/emit-contract";
export type { JsonSchemaFragment, PluginApiContract, PluginApiContractAction } from "./contract/types";
export { canDeriveUrlCoercer, deriveUrlCoercer } from "./derive-url-coercer";
export { DEFAULT_BASE_PATH, DEFAULT_CORS, DEFAULT_HOST } from "./http-types";
export type {
	HttpActionConfig,
	HttpApiServerLike,
	HttpMethod,
	HttpResponse,
	HttpRoute,
	HttpServerConfig,
	ParsedHttpRequest,
} from "./http-types";
export { ParamCoercion } from "./param-coercion";
export { PluginApiGateway } from "./plugin-api-gateway";
export type {
	ActionDef,
	ActionDefMap,
	ActionHandler,
	InferWindowApi,
	PluginApiGatewayOptions,
	UrlAccessibleActions,
} from "./types";
