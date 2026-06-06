import { describe, expect, it } from "vitest";

import { isSafePathSegment, isUrlWithAllowedHost } from "../../src/utils/security";

describe("isSafePathSegment", () => {
	it.each(["dataview", "obsidian-excalidraw-plugin", "templater_obsidian", "my.plugin.name", "Plugin123"])(
		"accepts the normal plugin id %s",
		(id) => {
			expect(isSafePathSegment(id)).toBe(true);
		}
	);

	it.each<[string, string]>([
		["empty", ""],
		["dot", "."],
		["dot-dot", ".."],
		["parent traversal", "../../../evil"],
		["embedded traversal", "a..b"],
		["forward slash", "core-plugins/dataview"],
		["back slash", "core\\dataview"],
		["leading dot (hidden)", ".obsidian"],
		["null byte", `data${String.fromCharCode(0)}view`],
		["DEL control char", `data${String.fromCharCode(0x7f)}view`],
		["newline", "data\nview"],
	])("rejects %s", (_label, id) => {
		expect(isSafePathSegment(id)).toBe(false);
	});
});

describe("isUrlWithAllowedHost", () => {
	const hosts = ["github.com", "*.githubusercontent.com"];

	it.each([
		"https://github.com/owner/repo/releases/download/1.0.0/main.js",
		"https://objects.githubusercontent.com/abc/main.js",
		"https://release-assets.githubusercontent.com/x/main.js",
		"https://githubusercontent.com/apex/main.js",
	])("accepts allowed https host %s", (url) => {
		expect(isUrlWithAllowedHost(url, hosts)).toBe(true);
	});

	it.each<[string, string]>([
		["http scheme", "http://github.com/owner/repo/main.js"],
		["attacker host", "https://evil.example.com/main.js"],
		["lookalike suffix", "https://github.com.evil.com/main.js"],
		["subdomain confusion", "https://githubusercontent.com.evil.com/main.js"],
		["internal host", "https://169.254.169.254/latest/meta-data"],
		["file scheme", "file:///etc/passwd"],
		["not a url", "not a url"],
	])("rejects %s", (_label, url) => {
		expect(isUrlWithAllowedHost(url, hosts)).toBe(false);
	});
});
