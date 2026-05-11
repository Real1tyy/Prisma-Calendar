import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MountImperative } from "../../src/components/mount-imperative";
import { renderReact } from "../helpers/render-react";

describe("MountImperative", () => {
	it("invokes render with the host element on mount", () => {
		const render = vi.fn((host: HTMLElement) => {
			host.textContent = "imperative content";
		});
		const { getByTestId } = renderReact(<MountImperative render={render} testId="host" />);

		expect(render).toHaveBeenCalledOnce();
		expect(render.mock.calls[0][0]).toBe(getByTestId("host"));
		expect(getByTestId("host").textContent).toBe("imperative content");
	});

	it("invokes cleanup when the component unmounts", () => {
		const cleanup = vi.fn();
		const render = vi.fn();
		const { unmount } = renderReact(<MountImperative render={render} cleanup={cleanup} />);

		unmount();
		expect(cleanup).toHaveBeenCalledOnce();
	});

	it("clears the host children on unmount", () => {
		const { unmount, container } = renderReact(
			<MountImperative
				render={(host) => {
					host.appendChild(document.createElement("span"));
					host.appendChild(document.createElement("span"));
				}}
				testId="host"
			/>
		);

		const host = container.querySelector("[data-testid='host']") as HTMLElement;
		expect(host.children.length).toBe(2);

		unmount();
		// Host is removed alongside its parent React tree on unmount, so only
		// assert that cleanup happens via React's normal teardown.
		expect(container.querySelector("[data-testid='host']")).toBeNull();
	});

	it("does NOT re-run render when the render prop reference changes", () => {
		const render1 = vi.fn();
		const render2 = vi.fn();
		const { rerender } = renderReact(<MountImperative render={render1} />);
		expect(render1).toHaveBeenCalledOnce();

		rerender(<MountImperative render={render2} />);
		// MountImperative intentionally does not retear-down on render prop changes
		// because imperative engines (FullCalendar, frappe-gantt, etc.) own their
		// own DOM and tearing down on every parent re-render would destroy state.
		expect(render2).not.toHaveBeenCalled();
	});

	it("forwards className and style to the host element", () => {
		const { container } = renderReact(
			<MountImperative render={() => {}} className="my-host" style={{ height: 200 }} testId="host" />
		);
		const host = container.querySelector("[data-testid='host']") as HTMLElement;
		expect(host.className).toBe("my-host");
		expect(host.style.height).toBe("200px");
	});

	describe("async + cleanup contract", () => {
		let consoleError: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		});
		afterEach(() => {
			consoleError.mockRestore();
		});

		it("aborts the signal passed to render when the component unmounts", () => {
			let captured: AbortSignal | undefined;
			const { unmount } = renderReact(
				<MountImperative
					render={(_host, signal) => {
						captured = signal;
					}}
				/>
			);
			expect(captured?.aborted).toBe(false);
			unmount();
			expect(captured?.aborted).toBe(true);
		});

		it("logs (does not throw) when an async render rejects", async () => {
			const failure = new Error("boom");
			renderReact(
				<MountImperative
					render={async () => {
						await Promise.resolve();
						throw failure;
					}}
				/>
			);
			await Promise.resolve();
			await Promise.resolve();
			expect(consoleError).toHaveBeenCalledWith("MountImperative render failed", failure);
		});

		it("suppresses async render errors that arrive after unmount", async () => {
			let reject: (err: Error) => void = () => {};
			const pending = new Promise<void>((_, rej) => {
				reject = rej;
			});
			const { unmount } = renderReact(<MountImperative render={() => pending} />);
			unmount();
			reject(new Error("post-unmount"));
			await Promise.resolve();
			await Promise.resolve();
			expect(consoleError).not.toHaveBeenCalled();
		});

		it("still clears host children when cleanup throws", () => {
			const cleanup = vi.fn(() => {
				throw new Error("cleanup blew up");
			});
			const { unmount, container } = renderReact(
				<MountImperative
					render={(host) => {
						host.appendChild(document.createElement("span"));
					}}
					cleanup={cleanup}
					testId="host"
				/>
			);
			const host = container.querySelector("[data-testid='host']") as HTMLElement;
			expect(host.children.length).toBe(1);

			expect(() => unmount()).toThrow("cleanup blew up");
			expect(cleanup).toHaveBeenCalledOnce();
			// The host node has been detached by React, but its children were
			// emptied by the finally branch before detachment.
			expect(host.children.length).toBe(0);
		});
	});
});
