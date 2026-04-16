import { describe, expect, it } from "vitest";

import { addCls, cls, createCssUtils, hasCls, removeCls, toggleCls } from "../../src/utils/css-utils";

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
// Tests for default "prisma-" prefixed exports (backwards compatibility)
// ============================================================================

describe("cls", () => {
	it("should prefix single class name", () => {
		expect(cls("calendar-view")).toBe("prisma-calendar-view");
	});

	it("should prefix multiple class names", () => {
		expect(cls("button", "active")).toBe("prisma-button prisma-active");
	});

	it("should handle space-separated class names", () => {
		expect(cls("modal calendar")).toBe("prisma-modal prisma-calendar");
	});

	it("should handle multiple arguments with spaces", () => {
		expect(cls("modal calendar", "active selected")).toBe("prisma-modal prisma-calendar prisma-active prisma-selected");
	});

	it("should filter out empty strings", () => {
		expect(cls("button", "", "active")).toBe("prisma-button prisma-active");
	});

	it("should handle multiple spaces between class names", () => {
		expect(cls("button  active   selected")).toBe("prisma-button prisma-active prisma-selected");
	});

	it("should return empty string for no arguments", () => {
		expect(cls()).toBe("");
	});

	it("should return empty string for empty string argument", () => {
		expect(cls("")).toBe("");
	});

	it("should return empty string for only whitespace", () => {
		expect(cls("   ")).toBe("");
	});

	it("should handle hyphenated class names", () => {
		expect(cls("calendar-view", "task-list")).toBe("prisma-calendar-view prisma-task-list");
	});

	it("should handle underscored class names", () => {
		expect(cls("calendar_view")).toBe("prisma-calendar_view");
	});

	it("should handle numeric class names", () => {
		expect(cls("item-1", "item-2")).toBe("prisma-item-1 prisma-item-2");
	});
});

describe("addCls", () => {
	it("should add single class to element", () => {
		const element = document.createElement("div");
		addCls(element, "active");
		expect(element.classList.contains("prisma-active")).toBe(true);
	});

	it("should add multiple classes to element", () => {
		const element = document.createElement("div");
		addCls(element, "button", "active");
		expect(element.classList.contains("prisma-button")).toBe(true);
		expect(element.classList.contains("prisma-active")).toBe(true);
	});

	it("should add space-separated classes", () => {
		const element = document.createElement("div");
		addCls(element, "button active");
		expect(element.classList.contains("prisma-button")).toBe(true);
		expect(element.classList.contains("prisma-active")).toBe(true);
	});

	it("should not add empty strings", () => {
		const element = document.createElement("div");
		addCls(element, "");
		expect(element.classList.length).toBe(0);
	});

	it("should handle already existing classes", () => {
		const element = document.createElement("div");
		element.classList.add("prisma-button");
		addCls(element, "button");
		expect(element.classList.length).toBe(1);
		expect(element.classList.contains("prisma-button")).toBe(true);
	});

	it("should add multiple classes at once", () => {
		const element = document.createElement("div");
		addCls(element, "modal calendar", "active");
		expect(element.classList.length).toBe(3);
		expect(element.classList.contains("prisma-modal")).toBe(true);
		expect(element.classList.contains("prisma-calendar")).toBe(true);
		expect(element.classList.contains("prisma-active")).toBe(true);
	});
});

describe("removeCls", () => {
	it("should remove single class from element", () => {
		const element = document.createElement("div");
		element.classList.add("prisma-active");
		removeCls(element, "active");
		expect(element.classList.contains("prisma-active")).toBe(false);
	});

	it("should remove multiple classes from element", () => {
		const element = document.createElement("div");
		element.classList.add("prisma-button", "prisma-active");
		removeCls(element, "button", "active");
		expect(element.classList.contains("prisma-button")).toBe(false);
		expect(element.classList.contains("prisma-active")).toBe(false);
	});

	it("should remove space-separated classes", () => {
		const element = document.createElement("div");
		element.classList.add("prisma-button", "prisma-active");
		removeCls(element, "button active");
		expect(element.classList.contains("prisma-button")).toBe(false);
		expect(element.classList.contains("prisma-active")).toBe(false);
	});

	it("should handle removing non-existent class", () => {
		const element = document.createElement("div");
		removeCls(element, "active");
		expect(element.classList.length).toBe(0);
	});

	it("should not affect other classes", () => {
		const element = document.createElement("div");
		element.classList.add("prisma-button", "prisma-active", "other-class");
		removeCls(element, "active");
		expect(element.classList.contains("prisma-button")).toBe(true);
		expect(element.classList.contains("other-class")).toBe(true);
		expect(element.classList.contains("prisma-active")).toBe(false);
	});
});

describe("toggleCls", () => {
	it("should toggle class on element", () => {
		const element = document.createElement("div");
		const result = toggleCls(element, "active");
		expect(result).toBe(true);
		expect(element.classList.contains("prisma-active")).toBe(true);
	});

	it("should toggle class off element", () => {
		const element = document.createElement("div");
		element.classList.add("prisma-active");
		const result = toggleCls(element, "active");
		expect(result).toBe(false);
		expect(element.classList.contains("prisma-active")).toBe(false);
	});

	it("should force add class when force is true", () => {
		const element = document.createElement("div");
		const result = toggleCls(element, "active", true);
		expect(result).toBe(true);
		expect(element.classList.contains("prisma-active")).toBe(true);

		// Should remain true even on second call
		const result2 = toggleCls(element, "active", true);
		expect(result2).toBe(true);
		expect(element.classList.contains("prisma-active")).toBe(true);
	});

	it("should force remove class when force is false", () => {
		const element = document.createElement("div");
		element.classList.add("prisma-active");
		const result = toggleCls(element, "active", false);
		expect(result).toBe(false);
		expect(element.classList.contains("prisma-active")).toBe(false);

		// Should remain false even on second call
		const result2 = toggleCls(element, "active", false);
		expect(result2).toBe(false);
		expect(element.classList.contains("prisma-active")).toBe(false);
	});

	it("should return correct boolean value", () => {
		const element = document.createElement("div");
		expect(toggleCls(element, "active")).toBe(true);
		expect(toggleCls(element, "active")).toBe(false);
		expect(toggleCls(element, "active")).toBe(true);
	});
});

describe("hasCls", () => {
	it("should return true when element has class", () => {
		const element = document.createElement("div");
		element.classList.add("prisma-active");
		expect(hasCls(element, "active")).toBe(true);
	});

	it("should return false when element does not have class", () => {
		const element = document.createElement("div");
		expect(hasCls(element, "active")).toBe(false);
	});

	it("should only check for prefixed class", () => {
		const element = document.createElement("div");
		element.classList.add("active"); // No prefix
		expect(hasCls(element, "active")).toBe(false);
	});

	it("should work with multiple classes on element", () => {
		const element = document.createElement("div");
		element.classList.add("prisma-button", "prisma-active", "other-class");
		expect(hasCls(element, "active")).toBe(true);
		expect(hasCls(element, "button")).toBe(true);
		expect(hasCls(element, "disabled")).toBe(false);
	});

	it("should handle hyphenated class names", () => {
		const element = document.createElement("div");
		element.classList.add("prisma-calendar-view");
		expect(hasCls(element, "calendar-view")).toBe(true);
	});
});

describe("integration: DOM manipulation workflow", () => {
	it("should handle typical add/remove/toggle workflow", () => {
		const element = document.createElement("div");

		// Add initial classes
		addCls(element, "button", "primary");
		expect(hasCls(element, "button")).toBe(true);
		expect(hasCls(element, "primary")).toBe(true);

		// Toggle active state
		toggleCls(element, "active");
		expect(hasCls(element, "active")).toBe(true);

		// Remove primary, keep button and active
		removeCls(element, "primary");
		expect(hasCls(element, "button")).toBe(true);
		expect(hasCls(element, "primary")).toBe(false);
		expect(hasCls(element, "active")).toBe(true);

		// Toggle active off
		toggleCls(element, "active");
		expect(hasCls(element, "active")).toBe(false);
	});

	it("should handle space-separated classes in workflow", () => {
		const element = document.createElement("div");

		addCls(element, "modal calendar-view");
		expect(hasCls(element, "modal")).toBe(true);
		expect(hasCls(element, "calendar-view")).toBe(true);

		removeCls(element, "modal calendar-view");
		expect(element.classList.length).toBe(0);
	});

	it("should maintain non-prefixed classes", () => {
		const element = document.createElement("div");
		element.classList.add("external-class");

		addCls(element, "button");
		expect(element.classList.contains("external-class")).toBe(true);
		expect(hasCls(element, "button")).toBe(true);

		removeCls(element, "button");
		expect(element.classList.contains("external-class")).toBe(true);
		expect(hasCls(element, "button")).toBe(false);
	});
});
