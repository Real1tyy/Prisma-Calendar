export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpRoute {
	method: HttpMethod;
	path: string;
	handler: (req: ParsedHttpRequest) => Promise<HttpResponse>;
}

export interface ParsedHttpRequest {
	method: HttpMethod;
	path: string;
	params: Record<string, string>;
	query: Record<string, string>;
	body: unknown;
}

export interface HttpResponse {
	status: number;
	body: unknown;
	headers?: Record<string, string>;
}

export interface HttpServerConfig {
	port: number;
	host?: string;
	basePath?: string;
	cors?: boolean;
}

export interface HttpActionConfig {
	method?: HttpMethod;
	path?: string;
	parseBody?: (body: unknown) => unknown;
	disabled?: boolean;
}
