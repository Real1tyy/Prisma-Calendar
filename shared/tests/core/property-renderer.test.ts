import { describe, expect, it, vi } from "vitest";

import { createDefaultSeparator, createTextNode, renderPropertyValue } from "../../src/components/property-renderer";

describe("createTextNode", () => {
	it("should create a text node", () => {
		const node = createTextNode("Hello World");
		expect(node.nodeType).toBe(Node.TEXT_NODE);
		expect(node.textContent).toBe("Hello World");
	});

	it("should handle empty string", () => {
		const node = createTextNode("");
		expect(node.textContent).toBe("");
	});

	it("should handle special characters", () => {
		const node = createTextNode("Test & <special> chars");
		expect(node.textContent).toBe("Test & <special> chars");
	});
});

describe("createDefaultSeparator", () => {
	it("should create a comma separator text node", () => {
		const node = createDefaultSeparator();
		expect(node.nodeType).toBe(Node.TEXT_NODE);
		expect(node.textContent).toBe(", ");
	});
});

describe("renderPropertyValue", () => {
	describe("simple values", () => {
		it("should render plain text", () => {
			const container = document.createElement("div");
			const config = {
				createLink: vi.fn(),
				createText: vi.fn((text) => document.createTextNode(text)),
			};

			renderPropertyValue(container, "Plain text", config);

			expect(config.createText).toHaveBeenCalledWith("Plain text");
			expect(config.createLink).not.toHaveBeenCalled();
			expect(container.textContent).toBe("Plain text");
		});

		it("should render number as text", () => {
			const container = document.createElement("div");
			const config = {
				createLink: vi.fn(),
				createText: vi.fn((text) => document.createTextNode(text)),
			};

			renderPropertyValue(container, 42, config);

			expect(config.createText).toHaveBeenCalledWith("42");
			expect(container.textContent).toBe("42");
		});

		it("should trim whitespace from values", () => {
			const container = document.createElement("div");
			const config = {
				createLink: vi.fn(),
				createText: vi.fn((text) => document.createTextNode(text)),
			};

			renderPropertyValue(container, "  spaced  ", config);

			expect(config.createText).toHaveBeenCalledWith("spaced");
		});
	});

	describe("Obsidian links", () => {
		it("should render simple Obsidian link", () => {
			const container = document.createElement("div");
			const mockLink = document.createElement("a");
			mockLink.textContent = "Page Name";

			const config = {
				createLink: vi.fn(() => mockLink),
				createText: vi.fn((text) => document.createTextNode(text)),
			};

			renderPropertyValue(container, "[[Page Name]]", config);

			expect(config.createLink).toHaveBeenCalledWith("Page Name", "Page Name", true);
			expect(config.createText).not.toHaveBeenCalled();
			expect(container.querySelector("a")?.textContent).toBe("Page Name");
		});

		it("should render Obsidian link with alias", () => {
			const container = document.createElement("div");
			const mockLink = document.createElement("a");
			mockLink.textContent = "Display Name";

			const config = {
				createLink: vi.fn(() => mockLink),
				createText: vi.fn((text) => document.createTextNode(text)),
			};

			renderPropertyValue(container, "[[Path/To/Page|Display Name]]", config);

			expect(config.createLink).toHaveBeenCalledWith("Display Name", "Path/To/Page", true);
			expect(container.querySelector("a")?.textContent).toBe("Display Name");
		});

		it("should render link with complex path", () => {
			const container = document.createElement("div");
			const mockLink = document.createElement("a");

			const config = {
				createLink: vi.fn(() => mockLink),
				createText: vi.fn((text) => document.createTextNode(text)),
			};

			renderPropertyValue(container, "[[Projects/Travel Around The World|Travel Around The World]]", config);

			expect(config.createLink).toHaveBeenCalledWith(
				"Travel Around The World",
				"Projects/Travel Around The World",
				true
			);
		});
	});

	describe("arrays", () => {
		it("should render plain array as comma-separated text", () => {
			const container = document.createElement("div");
			const config = {
				createLink: vi.fn(),
				createText: vi.fn((text) => document.createTextNode(text)),
			};

			renderPropertyValue(container, ["tag1", "tag2", "tag3"], config);

			expect(config.createText).toHaveBeenCalledWith("tag1, tag2, tag3");
			expect(config.createLink).not.toHaveBeenCalled();
			expect(container.textContent).toBe("tag1, tag2, tag3");
		});

		it("should render array with links using separators", () => {
			const container = document.createElement("div");
			const mockLink1 = document.createElement("a");
			mockLink1.textContent = "Link1";
			const mockLink2 = document.createElement("a");
			mockLink2.textContent = "Link2";

			const config = {
				createLink: vi.fn().mockReturnValueOnce(mockLink1).mockReturnValueOnce(mockLink2),
				createText: vi.fn((text) => document.createTextNode(text)),
				createSeparator: vi.fn(() => document.createTextNode(", ")),
			};

			renderPropertyValue(container, ["[[Link1]]", "[[Link2]]"], config);

			expect(config.createLink).toHaveBeenCalledTimes(2);
			expect(config.createSeparator).toHaveBeenCalledTimes(1);
			expect(container.textContent).toBe("Link1, Link2");
		});

		it("should render mixed array with links and text", () => {
			const container = document.createElement("div");
			const mockLink = document.createElement("a");
			mockLink.textContent = "Link";

			const config = {
				createLink: vi.fn(() => mockLink),
				createText: vi.fn((text) => document.createTextNode(text)),
				createSeparator: vi.fn(() => document.createTextNode(", ")),
			};

			renderPropertyValue(container, ["[[Link]]", "Plain text"], config);

			expect(config.createLink).toHaveBeenCalledTimes(1);
			expect(config.createText).toHaveBeenCalledTimes(1);
			expect(config.createSeparator).toHaveBeenCalledTimes(1);
		});

		it("should not call separator for first item", () => {
			const container = document.createElement("div");
			const config = {
				createLink: vi.fn(() => document.createElement("a")),
				createText: vi.fn((text) => document.createTextNode(text)),
				createSeparator: vi.fn(() => document.createTextNode(", ")),
			};

			renderPropertyValue(container, ["[[Link1]]"], config);

			expect(config.createSeparator).not.toHaveBeenCalled();
		});

		it("should handle empty array", () => {
			const container = document.createElement("div");
			const config = {
				createLink: vi.fn(),
				createText: vi.fn((text) => document.createTextNode(text)),
			};

			renderPropertyValue(container, [], config);

			expect(config.createText).toHaveBeenCalledWith("");
			expect(container.textContent).toBe("");
		});

		it("should work without createSeparator", () => {
			const container = document.createElement("div");
			const config = {
				createLink: vi.fn(() => document.createElement("a")),
				createText: vi.fn((text) => document.createTextNode(text)),
			};

			// Should not throw even without createSeparator
			expect(() => {
				renderPropertyValue(container, ["[[Link1]]", "[[Link2]]"], config);
			}).not.toThrow();
		});
	});

	describe("edge cases", () => {
		it("should handle null as string", () => {
			const container = document.createElement("div");
			const config = {
				createLink: vi.fn(),
				createText: vi.fn((text) => document.createTextNode(text)),
			};

			renderPropertyValue(container, null, config);

			expect(config.createText).toHaveBeenCalledWith("null");
		});

		it("should handle undefined as string", () => {
			const container = document.createElement("div");
			const config = {
				createLink: vi.fn(),
				createText: vi.fn((text) => document.createTextNode(text)),
			};

			renderPropertyValue(container, undefined, config);

			expect(config.createText).toHaveBeenCalledWith("undefined");
		});

		it("should handle boolean values", () => {
			const container = document.createElement("div");
			const config = {
				createLink: vi.fn(),
				createText: vi.fn((text) => document.createTextNode(text)),
			};

			renderPropertyValue(container, true, config);
			expect(config.createText).toHaveBeenCalledWith("true");

			const container2 = document.createElement("div");
			renderPropertyValue(container2, false, config);
			expect(config.createText).toHaveBeenCalledWith("false");
		});

		it("should handle object by converting to string", () => {
			const container = document.createElement("div");
			const config = {
				createLink: vi.fn(),
				createText: vi.fn((text) => document.createTextNode(text)),
			};

			renderPropertyValue(container, { key: "value" }, config);

			expect(config.createText).toHaveBeenCalledWith("[object Object]");
		});
	});

	describe("integration scenarios", () => {
		it("should render realistic property with multiple links", () => {
			const container = document.createElement("div");
			const config = {
				createLink: vi.fn((text, _path, _isObsidian) => {
					const link = document.createElement("a");
					link.textContent = text;
					return link;
				}),
				createText: vi.fn((text) => document.createTextNode(text)),
				createSeparator: () => document.createTextNode(", "),
			};

			const values = ["[[Travel Around The World]]", "[[Projects/Paris|Paris Visit]]", "Regular text"];

			renderPropertyValue(container, values, config);

			expect(config.createLink).toHaveBeenCalledTimes(2);
			expect(config.createText).toHaveBeenCalledTimes(1);
			expect(container.querySelectorAll("a")).toHaveLength(2);
		});

		it("should handle complex real-world example", () => {
			const container = document.createElement("div");
			const config = {
				createLink: vi.fn((text) => {
					const link = document.createElement("a");
					link.textContent = text;
					link.className = "internal-link";
					return link;
				}),
				createText: vi.fn((text) => document.createTextNode(text)),
				createSeparator: () => {
					const span = document.createElement("span");
					span.textContent = " • ";
					return span;
				},
			};

			const goalLinks = [
				"[[Travel Around The World]]",
				"[[Projects/Travel Around The World – Paris Visit|Travel Around The World – Paris Visit]]",
			];

			renderPropertyValue(container, goalLinks, config);

			const links = container.querySelectorAll("a.internal-link");
			expect(links).toHaveLength(2);
			expect(links[0].textContent).toBe("Travel Around The World");
			expect(links[1].textContent).toBe("Travel Around The World – Paris Visit");

			const separators = container.querySelectorAll("span");
			expect(separators).toHaveLength(1);
			expect(separators[0].textContent).toBe(" • ");
		});
	});
});
