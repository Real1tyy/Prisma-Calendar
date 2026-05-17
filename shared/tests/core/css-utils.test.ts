import { describe, expect, it } from "vitest";

import { createCssUtils } from "../../src/utils/css-utils";

// ============================================================================
// Tests for createCssUtils factory
// ============================================================================

describe("createCssUtils factory", () => {
	it("should create utilities with custom prefix", () => {
		const utils = createCssUtils("my-plugin-");
		expect(utils.cls("button")).toBe("my-plugin-button");
	});

	it("should create independent instances with different prefixes", () => {
		const prismaUtils = createCssUtils("prisma-");
		const nexusUtils = createCssUtils("nexus-properties-");

		expect(prismaUtils.cls("button")).toBe("prisma-button");
		expect(nexusUtils.cls("button")).toBe("nexus-properties-button");
	});

	it("should handle empty prefix", () => {
		const utils = createCssUtils("");
		expect(utils.cls("button")).toBe("button");
	});

	describe("cls with custom prefix", () => {
		const { cls } = createCssUtils("test-");

		it("should prefix single class name", () => {
			expect(cls("button")).toBe("test-button");
		});

		it("should prefix multiple class names", () => {
			expect(cls("button", "active")).toBe("test-button test-active");
		});

		it("should handle space-separated class names", () => {
			expect(cls("modal view")).toBe("test-modal test-view");
		});
	});

	describe("addCls with custom prefix", () => {
		const { addCls, hasCls } = createCssUtils("custom-");

		it("should add prefixed class to element", () => {
			const element = document.createElement("div");
			addCls(element, "active");
			expect(element.classList.contains("custom-active")).toBe(true);
		});

		it("should work with hasCls from same factory", () => {
			const element = document.createElement("div");
			addCls(element, "button");
			expect(hasCls(element, "button")).toBe(true);
		});
	});

	describe("removeCls with custom prefix", () => {
		const { addCls, removeCls, hasCls } = createCssUtils("custom-");

		it("should remove prefixed class from element", () => {
			const element = document.createElement("div");
			addCls(element, "active");
			expect(hasCls(element, "active")).toBe(true);

			removeCls(element, "active");
			expect(hasCls(element, "active")).toBe(false);
		});
	});

	describe("toggleCls with custom prefix", () => {
		const { toggleCls, hasCls } = createCssUtils("custom-");

		it("should toggle prefixed class on element", () => {
			const element = document.createElement("div");

			toggleCls(element, "active");
			expect(hasCls(element, "active")).toBe(true);

			toggleCls(element, "active");
			expect(hasCls(element, "active")).toBe(false);
		});

		it("should respect force parameter", () => {
			const element = document.createElement("div");

			toggleCls(element, "active", true);
			expect(hasCls(element, "active")).toBe(true);

			toggleCls(element, "active", true);
			expect(hasCls(element, "active")).toBe(true);

			toggleCls(element, "active", false);
			expect(hasCls(element, "active")).toBe(false);
		});
	});
});

// ============================================================================
// Tests for tid via the createCssUtils factory
// ============================================================================

describe("tid via factory", () => {
	it("prefixes a single suffix", () => {
		const { tid } = createCssUtils("prisma-");
		expect(tid("row")).toBe("prisma-row");
	});

	it("joins multiple parts with hyphens", () => {
		const { tid } = createCssUtils("prisma-");
		expect(tid("settings", "field", "name")).toBe("prisma-settings-field-name");
	});

	it("stringifies number parts", () => {
		const { tid } = createCssUtils("prisma-");
		expect(tid("row", 5)).toBe("prisma-row-5");
	});

	it("filters empty string parts", () => {
		const { tid } = createCssUtils("prisma-");
		expect(tid("row", "", "5")).toBe("prisma-row-5");
	});

	it("returns just the prefix when called with no parts", () => {
		const { tid } = createCssUtils("prisma-");
		expect(tid()).toBe("prisma-");
	});

	it("returns just the prefix when all parts are empty", () => {
		const { tid } = createCssUtils("prisma-");
		expect(tid("", "")).toBe("prisma-");
	});

	it("works with custom prefix via factory", () => {
		const { tid } = createCssUtils("nexus-");
		expect(tid("row", "5")).toBe("nexus-row-5");
	});
});
