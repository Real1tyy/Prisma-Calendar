import { screen } from "@testing-library/react";
import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { PropertyValue } from "../../../src/widgets/property-row/property-value";
import { createMockApp } from "../../harness/mock-app";
import { renderWithProviders } from "../../harness/render-with-providers";

function appWithOpenLink(): App {
	const app = createMockApp();
	app.workspace.openLinkText = vi.fn();
	return app;
}

describe("PropertyValue", () => {
	describe("simple values", () => {
		it("renders plain text", () => {
			const { container } = renderWithProviders(<PropertyValue value="Plain text" />);
			expect(container.textContent).toBe("Plain text");
			expect(container.querySelector("a")).toBeNull();
		});

		it("renders number as text", () => {
			const { container } = renderWithProviders(<PropertyValue value={42} />);
			expect(container.textContent).toBe("42");
		});

		it("trims whitespace from values", () => {
			const { container } = renderWithProviders(<PropertyValue value="  spaced  " />);
			expect(container.textContent).toBe("spaced");
		});

		it("renders boolean values as text", () => {
			const { container: trueContainer } = renderWithProviders(<PropertyValue value={true} />);
			expect(trueContainer.textContent).toBe("true");

			const { container: falseContainer } = renderWithProviders(<PropertyValue value={false} />);
			expect(falseContainer.textContent).toBe("false");
		});

		it("renders null as the string 'null'", () => {
			const { container } = renderWithProviders(<PropertyValue value={null} />);
			expect(container.textContent).toBe("null");
		});

		it("renders undefined as the string 'undefined'", () => {
			const { container } = renderWithProviders(<PropertyValue value={undefined} />);
			expect(container.textContent).toBe("undefined");
		});

		it("stringifies objects", () => {
			const { container } = renderWithProviders(<PropertyValue value={{ key: "value" }} />);
			expect(container.textContent).toBe("[object Object]");
		});
	});

	describe("obsidian links", () => {
		it("renders a simple wiki-link as an anchor with the page name as text", () => {
			renderWithProviders(<PropertyValue value="[[Page Name]]" />);
			const link = screen.getByText("Page Name");
			expect(link.tagName).toBe("A");
		});

		it("uses the alias as link text when the link has a pipe", () => {
			renderWithProviders(<PropertyValue value="[[Path/To/Page|Display Name]]" />);
			expect(screen.getByText("Display Name").tagName).toBe("A");
			expect(screen.queryByText("Path/To/Page")).toBeNull();
		});

		it("applies linkClassName to the rendered anchor", () => {
			renderWithProviders(<PropertyValue value="[[Foo]]" linkClassName="my-link" />);
			expect(screen.getByText("Foo")).toHaveClass("my-link");
		});

		it("opens the wiki-link via workspace.openLinkText on click", async () => {
			const app = appWithOpenLink();
			const { user } = renderWithProviders(<PropertyValue value="[[Path/To/Page|Display]]" />, { app });

			await user.click(screen.getByText("Display"));

			expect(app.workspace.openLinkText).toHaveBeenCalledExactlyOnceWith("Path/To/Page", "", false);
		});

		it("invokes onLinkClick after opening the link", async () => {
			const onLinkClick = vi.fn();
			const { user } = renderWithProviders(<PropertyValue value="[[Page]]" onLinkClick={onLinkClick} />, {
				app: appWithOpenLink(),
			});

			await user.click(screen.getByText("Page"));

			expect(onLinkClick).toHaveBeenCalledTimes(1);
		});

		it("does not throw when onLinkClick is omitted", async () => {
			const { user } = renderWithProviders(<PropertyValue value="[[Page]]" />, { app: appWithOpenLink() });
			await expect(user.click(screen.getByText("Page"))).resolves.not.toThrow();
		});
	});

	describe("arrays", () => {
		it("renders a plain array as comma-separated text", () => {
			const { container } = renderWithProviders(<PropertyValue value={["tag1", "tag2", "tag3"]} />);
			expect(container.textContent).toBe("tag1, tag2, tag3");
			expect(container.querySelector("a")).toBeNull();
		});

		it("renders an empty array as empty content", () => {
			const { container } = renderWithProviders(<PropertyValue value={[]} />);
			expect(container.textContent).toBe("");
		});

		it("renders an all-link array with `, ` separators between links", () => {
			const { container } = renderWithProviders(<PropertyValue value={["[[Link1]]", "[[Link2]]"]} />);
			expect(container.querySelectorAll("a")).toHaveLength(2);
			expect(container.textContent).toBe("Link1, Link2");
		});

		it("renders mixed link + text arrays with separators", () => {
			const { container } = renderWithProviders(<PropertyValue value={["[[Link]]", "Plain text"]} />);
			expect(container.querySelectorAll("a")).toHaveLength(1);
			expect(container.textContent).toBe("Link, Plain text");
		});

		it("does not emit a separator before the first array item", () => {
			const { container } = renderWithProviders(<PropertyValue value={["[[Only]]"]} />);
			expect(container.textContent).toBe("Only");
		});

		it("renders complex real-world property with multiple aliased links", () => {
			const { container } = renderWithProviders(
				<PropertyValue
					value={["[[Travel Around The World]]", "[[Projects/Paris|Paris Visit]]", "Regular text"]}
					linkClassName="internal-link"
				/>
			);
			const links = container.querySelectorAll("a.internal-link");
			expect(links).toHaveLength(2);
			expect(links[0].textContent).toBe("Travel Around The World");
			expect(links[1].textContent).toBe("Paris Visit");
			expect(container.textContent).toBe("Travel Around The World, Paris Visit, Regular text");
		});

		it("opens each link in a mixed array independently", async () => {
			const app = appWithOpenLink();
			const { user } = renderWithProviders(<PropertyValue value={["[[A]]", "[[Folder/B|B alias]]"]} />, { app });

			await user.click(screen.getByText("A"));
			await user.click(screen.getByText("B alias"));

			expect(app.workspace.openLinkText).toHaveBeenNthCalledWith(1, "A", "", false);
			expect(app.workspace.openLinkText).toHaveBeenNthCalledWith(2, "Folder/B", "", false);
		});
	});
});
