import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeExternalLinksClickable } from "../../src/components/whats-new/whats-new-modal";

const mockWindowOpen = vi.fn();
global.window.open = mockWindowOpen;

describe("makeExternalLinksClickable", () => {
	let container: HTMLElement;
	let documentationBaseUrl: string;

	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();

		// Suppress jsdom "Not implemented: navigation" noise
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		// Suppress jsdom virtualConsole error events (navigation not implemented)
		if (typeof window !== "undefined" && (window as any)._virtualConsole) {
			(window as any)._virtualConsole.removeAllListeners("jsdomError");
		}

		documentationBaseUrl = "https://docs.example.com";

		container = document.createElement("div");
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
		consoleErrorSpy.mockRestore();
	});

	describe("Absolute HTTP URLs", () => {
		it("should make HTTP links clickable", () => {
			const link = document.createElement("a");
			link.href = "http://example.com/page";
			link.textContent = "Example Link";
			container.appendChild(link);

			makeExternalLinksClickable(container, documentationBaseUrl);

			link.click();

			expect(mockWindowOpen).toHaveBeenCalledWith("http://example.com/page", "_blank");
			expect(link.classList.contains("external-link")).toBe(true);
		});

		it("should make HTTPS links clickable", () => {
			const link = document.createElement("a");
			link.href = "https://example.com/secure-page";
			link.textContent = "Secure Link";
			container.appendChild(link);

			makeExternalLinksClickable(container, documentationBaseUrl);

			link.click();

			expect(mockWindowOpen).toHaveBeenCalledWith("https://example.com/secure-page", "_blank");
			expect(link.classList.contains("external-link")).toBe(true);
		});

		it("should handle multiple absolute links", () => {
			const link1 = document.createElement("a");
			link1.href = "https://example.com/page1";
			link1.textContent = "Link 1";

			const link2 = document.createElement("a");
			link2.href = "http://example.com/page2";
			link2.textContent = "Link 2";

			container.appendChild(link1);
			container.appendChild(link2);

			makeExternalLinksClickable(container, documentationBaseUrl);

			link1.click();
			expect(mockWindowOpen).toHaveBeenCalledWith("https://example.com/page1", "_blank");

			link2.click();
			expect(mockWindowOpen).toHaveBeenCalledWith("http://example.com/page2", "_blank");
		});
	});

	describe("Relative URLs", () => {
		it("should resolve relative links with documentation base URL", () => {
			const link = document.createElement("a");
			link.href = "/integrations#activitywatch";
			link.textContent = "Learn more";
			container.appendChild(link);

			makeExternalLinksClickable(container, documentationBaseUrl);

			link.click();

			expect(mockWindowOpen).toHaveBeenCalledWith("https://docs.example.com/integrations#activitywatch", "_blank");
			expect(link.classList.contains("external-link")).toBe(true);
		});

		it("should handle documentation URL with trailing slash", () => {
			const link = document.createElement("a");
			link.href = "/guides/getting-started";
			link.textContent = "Getting Started";
			container.appendChild(link);

			makeExternalLinksClickable(container, "https://docs.example.com/");

			link.click();

			// Should not have double slashes
			expect(mockWindowOpen).toHaveBeenCalledWith("https://docs.example.com/guides/getting-started", "_blank");
		});

		it("should handle documentation URL without trailing slash", () => {
			const link = document.createElement("a");
			link.href = "/api/reference";
			link.textContent = "API Reference";
			container.appendChild(link);

			makeExternalLinksClickable(container, documentationBaseUrl);

			link.click();

			expect(mockWindowOpen).toHaveBeenCalledWith("https://docs.example.com/api/reference", "_blank");
		});

		it("should handle relative links with hash fragments", () => {
			const link = document.createElement("a");
			link.href = "/features#calendars";
			link.textContent = "Calendar Features";
			container.appendChild(link);

			makeExternalLinksClickable(container, documentationBaseUrl);

			link.click();

			expect(mockWindowOpen).toHaveBeenCalledWith("https://docs.example.com/features#calendars", "_blank");
		});

		it("should handle relative links with query parameters", () => {
			const link = document.createElement("a");
			link.href = "/search?q=events";
			link.textContent = "Search Events";
			container.appendChild(link);

			makeExternalLinksClickable(container, documentationBaseUrl);

			link.click();

			expect(mockWindowOpen).toHaveBeenCalledWith("https://docs.example.com/search?q=events", "_blank");
		});

		it("should handle deep relative paths", () => {
			const link = document.createElement("a");
			link.href = "/guides/advanced/custom-views";
			link.textContent = "Custom Views";
			container.appendChild(link);

			makeExternalLinksClickable(container, documentationBaseUrl);

			link.click();

			expect(mockWindowOpen).toHaveBeenCalledWith("https://docs.example.com/guides/advanced/custom-views", "_blank");
		});
	});

	describe("Mixed link types", () => {
		it("should handle both absolute and relative links together", () => {
			const absoluteLink = document.createElement("a");
			absoluteLink.href = "https://github.com/repo";
			absoluteLink.textContent = "GitHub";

			const relativeLink = document.createElement("a");
			relativeLink.href = "/docs/api";
			relativeLink.textContent = "API Docs";

			container.appendChild(absoluteLink);
			container.appendChild(relativeLink);

			makeExternalLinksClickable(container, documentationBaseUrl);

			absoluteLink.click();
			expect(mockWindowOpen).toHaveBeenCalledWith("https://github.com/repo", "_blank");

			relativeLink.click();
			expect(mockWindowOpen).toHaveBeenCalledWith("https://docs.example.com/docs/api", "_blank");
		});
	});

	describe("Edge cases", () => {
		it("should ignore links without href attribute", () => {
			const link = document.createElement("a");
			link.textContent = "No href";
			container.appendChild(link);

			makeExternalLinksClickable(container, documentationBaseUrl);

			link.click();

			expect(mockWindowOpen).not.toHaveBeenCalled();
			expect(link.classList.contains("external-link")).toBe(false);
		});

		it("should ignore links with empty href", () => {
			const link = document.createElement("a");
			link.href = "";
			link.textContent = "Empty href";
			container.appendChild(link);

			makeExternalLinksClickable(container, documentationBaseUrl);

			link.click();

			expect(mockWindowOpen).not.toHaveBeenCalled();
		});

		it("should ignore internal wiki links", () => {
			const link = document.createElement("a");
			link.href = "Page Name";
			link.setAttribute("data-href", "Page Name");
			link.classList.add("internal-link");
			link.textContent = "Internal Link";
			container.appendChild(link);

			makeExternalLinksClickable(container, documentationBaseUrl);

			link.click();

			expect(mockWindowOpen).not.toHaveBeenCalled();
			expect(link.classList.contains("external-link")).toBe(false);
		});

		it("should handle links with special characters in URL", () => {
			const link = document.createElement("a");
			link.href = "https://example.com/page?param=value&other=123";
			link.textContent = "Special Chars";
			container.appendChild(link);

			makeExternalLinksClickable(container, documentationBaseUrl);

			link.click();

			expect(mockWindowOpen).toHaveBeenCalledWith("https://example.com/page?param=value&other=123", "_blank");
		});

		it("should prevent default link behavior", () => {
			const link = document.createElement("a");
			link.href = "https://example.com/page";
			link.textContent = "Test Link";
			container.appendChild(link);

			makeExternalLinksClickable(container, documentationBaseUrl);

			const event = new MouseEvent("click", {
				bubbles: true,
				cancelable: true,
			});

			const preventDefaultSpy = vi.spyOn(event, "preventDefault");

			link.dispatchEvent(event);

			expect(preventDefaultSpy).toHaveBeenCalled();
		});

		it("should handle nested elements within container", () => {
			const section = document.createElement("div");
			const paragraph = document.createElement("p");
			const link = document.createElement("a");
			link.href = "/nested/link";
			link.textContent = "Nested Link";

			paragraph.appendChild(link);
			section.appendChild(paragraph);
			container.appendChild(section);

			makeExternalLinksClickable(container, documentationBaseUrl);

			link.click();

			expect(mockWindowOpen).toHaveBeenCalledWith("https://docs.example.com/nested/link", "_blank");
		});

		it("should handle empty container", () => {
			expect(() => {
				makeExternalLinksClickable(container, documentationBaseUrl);
			}).not.toThrow();

			expect(mockWindowOpen).not.toHaveBeenCalled();
		});

		it("should handle container with no links", () => {
			const div = document.createElement("div");
			div.textContent = "Just text, no links";
			container.appendChild(div);

			expect(() => {
				makeExternalLinksClickable(container, documentationBaseUrl);
			}).not.toThrow();

			expect(mockWindowOpen).not.toHaveBeenCalled();
		});
	});

	describe("CSS class application", () => {
		it("should add external-link class to absolute links", () => {
			const link = document.createElement("a");
			link.href = "https://example.com";
			link.textContent = "External";
			container.appendChild(link);

			makeExternalLinksClickable(container, documentationBaseUrl);

			expect(link.classList.contains("external-link")).toBe(true);
		});

		it("should add external-link class to relative links", () => {
			const link = document.createElement("a");
			link.href = "/docs";
			link.textContent = "Docs";
			container.appendChild(link);

			makeExternalLinksClickable(container, documentationBaseUrl);

			expect(link.classList.contains("external-link")).toBe(true);
		});

		it("should not add external-link class to non-http links", () => {
			const link = document.createElement("a");
			link.href = "mailto:test@example.com";
			link.textContent = "Email";
			container.appendChild(link);

			makeExternalLinksClickable(container, documentationBaseUrl);

			expect(link.classList.contains("external-link")).toBe(false);
		});
	});
});
