import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
	SharedReactThemeProvider,
	useCls,
	useCssPrefix,
	useResolvedCssPrefix,
	useResolvedTestIdPrefix,
	useTestId,
	useTheme,
} from "../../src/contexts/theme-context";
import { useThemed, withTheme } from "../../src/contexts/with-theme";

describe("SharedReactThemeProvider", () => {
	it("default theme has empty cssPrefix and no testIdPrefix", () => {
		function Probe() {
			const theme = useTheme();
			return (
				<div data-testid="probe">
					<span data-testid="css">{theme.cssPrefix}</span>
					<span data-testid="tid">{theme.testIdPrefix ?? "<none>"}</span>
				</div>
			);
		}
		render(<Probe />);
		expect(screen.getByTestId("css").textContent).toBe("");
		expect(screen.getByTestId("tid").textContent).toBe("<none>");
	});

	it("provides cssPrefix and testIdPrefix to descendants", () => {
		function Probe() {
			const cssPrefix = useCssPrefix();
			const cls = useCls();
			const tid = useTestId();
			return (
				<div data-testid="probe">
					<span data-testid="css">{cssPrefix}</span>
					<span data-testid="class">{cls("row", "abc")}</span>
					<span data-testid="tid">{tid("toggle", "id") ?? "<none>"}</span>
				</div>
			);
		}
		render(
			<SharedReactThemeProvider cssPrefix="prisma-" testIdPrefix="prisma-">
				<Probe />
			</SharedReactThemeProvider>
		);
		expect(screen.getByTestId("css").textContent).toBe("prisma-");
		expect(screen.getByTestId("class").textContent).toBe("prisma-row-abc");
		expect(screen.getByTestId("tid").textContent).toBe("prisma-toggle-id");
	});

	it("nested providers merge values — child wins when set, falls back to parent otherwise", () => {
		function Probe() {
			const theme = useTheme();
			return (
				<div>
					<span data-testid="css">{theme.cssPrefix}</span>
					<span data-testid="tid">{theme.testIdPrefix ?? "<none>"}</span>
				</div>
			);
		}
		render(
			<SharedReactThemeProvider cssPrefix="outer-" testIdPrefix="outer-tid">
				<SharedReactThemeProvider cssPrefix="inner-">
					<Probe />
				</SharedReactThemeProvider>
			</SharedReactThemeProvider>
		);
		expect(screen.getByTestId("css").textContent).toBe("inner-");
		expect(screen.getByTestId("tid").textContent).toBe("outer-tid");
	});

	it("useResolved* prefers explicit override over context", () => {
		function Probe() {
			const css = useResolvedCssPrefix("override-");
			const tid = useResolvedTestIdPrefix("override-tid");
			return (
				<div>
					<span data-testid="css">{css}</span>
					<span data-testid="tid">{tid}</span>
				</div>
			);
		}
		render(
			<SharedReactThemeProvider cssPrefix="ctx-" testIdPrefix="ctx-tid">
				<Probe />
			</SharedReactThemeProvider>
		);
		expect(screen.getByTestId("css").textContent).toBe("override-");
		expect(screen.getByTestId("tid").textContent).toBe("override-tid");
	});

	it("tid() returns undefined when no testIdPrefix is configured", () => {
		function Probe() {
			const tid = useTestId();
			const value = tid("foo");
			return <span data-testid="probe">{value === undefined ? "<none>" : value}</span>;
		}
		render(
			<SharedReactThemeProvider cssPrefix="prisma-">
				<Probe />
			</SharedReactThemeProvider>
		);
		expect(screen.getByTestId("probe").textContent).toBe("<none>");
	});

	it("useThemed bundles cssPrefix, testIdPrefix, cls and tid", () => {
		function Probe() {
			const themed = useThemed();
			return (
				<div>
					<span data-testid="css">{themed.cls("foo")}</span>
					<span data-testid="tid">{themed.tid("bar", "1") ?? "<none>"}</span>
				</div>
			);
		}
		render(
			<SharedReactThemeProvider cssPrefix="x-" testIdPrefix="t-">
				<Probe />
			</SharedReactThemeProvider>
		);
		expect(screen.getByTestId("css").textContent).toBe("x-foo");
		expect(screen.getByTestId("tid").textContent).toBe("t-bar-1");
	});
});

describe("withTheme HOC", () => {
	it("auto-injects ThemedProps from context", () => {
		const Wrapped = withTheme(function Inner({
			cls,
			tid,
			message,
		}: { cls: ReturnType<typeof useCls>; tid: ReturnType<typeof useTestId>; message: string } & {
			cssPrefix: string;
			testIdPrefix: string | undefined;
		}) {
			return (
				<div className={cls("row")} data-testid={tid("row", "1")}>
					{message}
				</div>
			);
		});
		render(
			<SharedReactThemeProvider cssPrefix="p-" testIdPrefix="p-">
				<Wrapped message="hello" />
			</SharedReactThemeProvider>
		);
		const el = screen.getByTestId("p-row-1");
		expect(el.className).toBe("p-row");
		expect(el.textContent).toBe("hello");
	});

	it("caller-supplied cssPrefix/testIdPrefix override context", () => {
		const Wrapped = withTheme(function Inner({
			cls,
		}: { cls: ReturnType<typeof useCls> } & {
			cssPrefix: string;
			testIdPrefix: string | undefined;
			tid: ReturnType<typeof useTestId>;
		}) {
			return <div data-testid="probe">{cls("row")}</div>;
		});
		render(
			<SharedReactThemeProvider cssPrefix="ctx-">
				<Wrapped cssPrefix="override-" />
			</SharedReactThemeProvider>
		);
		expect(screen.getByTestId("probe").textContent).toBe("override-row");
	});
});
