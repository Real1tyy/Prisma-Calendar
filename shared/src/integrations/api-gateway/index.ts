export type {
	ContractDrift,
	ContractMatch,
	JsonSchemaFragment,
	PluginApiContract,
	PluginApiContractAction,
} from "./contract";
export {
	assertNoContractDrift,
	compareContracts,
	ContractDriftError,
	defineAction,
	emitContract,
	serializeContract,
} from "./contract";
export { canDeriveUrlCoercer, deriveUrlCoercer } from "./derive-url-coercer";
// NOTE: external-apis (emitExternalApiDts, serializeExternalApiDts) is
// deliberately NOT re-exported here. The emitter pulls in `prettier` and
// `json-schema-to-typescript` — Node-only build-time deps that would bloat
// (and break) Obsidian plugin bundles when this barrel is tree-shaken into
// `main.js`. Callers (CLI script, drift tests) must import via the deep
// subpath: `@real1ty-obsidian-plugins/integrations/api-gateway/external-apis`.
export { DEFAULT_BASE_PATH, DEFAULT_CORS, DEFAULT_HOST, HttpApiServer } from "./http-api-server";
export type {
	HttpActionConfig,
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
