import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { App } from "obsidian";
import type { ReactElement } from "react";

import { AppContext } from "../../src/contexts/app-context";
import { createMockApp } from "./mock-app";

export interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
	app?: App;
}

export interface RenderWithProvidersResult extends RenderResult {
	user: ReturnType<typeof userEvent.setup>;
	app: App;
}

export function renderWithProviders(
	ui: ReactElement,
	options: RenderWithProvidersOptions = {}
): RenderWithProvidersResult {
	const { app = createMockApp(), ...renderOptions } = options;
	const user = userEvent.setup();

	function Wrapper({ children }: { children: React.ReactNode }) {
		return <AppContext value={app}>{children}</AppContext>;
	}

	return { user, app, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
