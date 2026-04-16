import { describe, expect, it } from "vitest";

import { buildSettingsFooterLinks, buildUtmUrl, buildWhatsNewLinks } from "../../src/utils/utm";

describe("buildUtmUrl", () => {
	it("appends the four standard UTM params to a plain URL", () => {
		const url = buildUtmUrl("https://example.com/page", "prisma-calendar", "plugin", "settings", "documentation");
		const parsed = new URL(url);
		expect(parsed.searchParams.get("utm_campaign")).toBe("prisma_calendar");
		expect(parsed.searchParams.get("utm_source")).toBe("plugin");
		expect(parsed.searchParams.get("utm_medium")).toBe("settings");
		expect(parsed.searchParams.get("utm_content")).toBe("documentation");
	});

	it("replaces hyphens with underscores in utm_campaign", () => {
		const url = buildUtmUrl("https://example.com/", "page-header-manager", "plugin", "settings", "support");
		expect(new URL(url).searchParams.get("utm_campaign")).toBe("page_header_manager");
	});

	it("preserves existing query parameters", () => {
		const url = buildUtmUrl(
			"https://youtube.com/@channel?sub_confirmation=1",
			"periodix-planner",
			"plugin",
			"whats_new",
			"youtube"
		);
		const parsed = new URL(url);
		expect(parsed.searchParams.get("sub_confirmation")).toBe("1");
		expect(parsed.searchParams.get("utm_campaign")).toBe("periodix_planner");
	});

	it("overwrites existing utm params rather than duplicating", () => {
		const url = buildUtmUrl(
			"https://example.com/?utm_source=stale",
			"fusion-goals",
			"plugin",
			"settings",
			"product_page"
		);
		const parsed = new URL(url);
		expect(parsed.searchParams.getAll("utm_source")).toEqual(["plugin"]);
	});

	it("handles URLs containing fragments", () => {
		const url = buildUtmUrl("https://example.com/page#anchor", "bases-improvements", "plugin", "settings", "x");
		const parsed = new URL(url);
		expect(parsed.hash).toBe("#anchor");
		expect(parsed.searchParams.get("utm_campaign")).toBe("bases_improvements");
	});
});

describe("buildSettingsFooterLinks", () => {
	it("always emits docs, changelog, and support in order", () => {
		const links = buildSettingsFooterLinks("nexus-properties", { docsBaseUrl: "https://docs.example.com" });
		expect(links.map((l) => l.text)).toEqual(["Documentation", "Changelog", "Support"]);
	});

	it("prepends Product Page when productPageUrl is provided", () => {
		const links = buildSettingsFooterLinks("nexus-properties", {
			docsBaseUrl: "https://docs.example.com",
			productPageUrl: "https://product.example.com",
		});
		expect(links[0]?.text).toBe("Product Page");
	});

	it("appends Video Tutorials when youtubeUrl is provided", () => {
		const links = buildSettingsFooterLinks("nexus-properties", {
			docsBaseUrl: "https://docs.example.com",
			youtubeUrl: "https://youtube.com/@channel",
		});
		expect(links.at(-1)?.text).toBe("Video Tutorials");
	});

	it("wraps every link href with UTM parameters", () => {
		const links = buildSettingsFooterLinks("people-manager", {
			docsBaseUrl: "https://docs.example.com",
			productPageUrl: "https://product.example.com",
			youtubeUrl: "https://youtube.com/@channel",
		});
		for (const link of links) {
			const parsed = new URL(link.href);
			expect(parsed.searchParams.get("utm_campaign")).toBe("people_manager");
			expect(parsed.searchParams.get("utm_source")).toBe("plugin");
			expect(parsed.searchParams.get("utm_medium")).toBe("settings");
			expect(parsed.searchParams.get("utm_content")).toBeTruthy();
		}
	});

	it("builds the changelog URL from docsBaseUrl", () => {
		const links = buildSettingsFooterLinks("core-finance", { docsBaseUrl: "https://docs.example.com" });
		const changelog = links.find((l) => l.text === "Changelog");
		expect(new URL(changelog!.href).pathname).toBe("/changelog");
	});
});

describe("buildWhatsNewLinks", () => {
	it("returns support, changelog, documentation, and youtube by default", () => {
		const links = buildWhatsNewLinks("prisma-calendar", { docsBaseUrl: "https://docs.example.com" });
		expect(Object.keys(links).sort()).toEqual(["changelog", "documentation", "support", "youtube"]);
	});

	it("includes github only when githubUrl is provided", () => {
		const without = buildWhatsNewLinks("prisma-calendar", { docsBaseUrl: "https://docs.example.com" });
		expect(without.github).toBeUndefined();

		const withGithub = buildWhatsNewLinks("prisma-calendar", {
			docsBaseUrl: "https://docs.example.com",
			githubUrl: "https://github.com/acme/repo",
		});
		expect(withGithub.github).toBeDefined();
		expect(new URL(withGithub.github!).searchParams.get("utm_content")).toBe("github");
	});

	it("UTM-wraps every returned link with medium=whats_new", () => {
		const links = buildWhatsNewLinks("notes-manipulator", {
			docsBaseUrl: "https://docs.example.com",
			githubUrl: "https://github.com/acme/repo",
		});
		for (const href of Object.values(links)) {
			if (!href) continue;
			const parsed = new URL(href);
			expect(parsed.searchParams.get("utm_campaign")).toBe("notes_manipulator");
			expect(parsed.searchParams.get("utm_medium")).toBe("whats_new");
		}
	});
});
