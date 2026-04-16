import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactElement } from "react";

export interface RenderReactResult extends RenderResult {
	user: ReturnType<typeof userEvent.setup>;
}

export function renderReact(ui: ReactElement, options?: RenderOptions): RenderReactResult {
	const user = userEvent.setup();
	return { user, ...render(ui, options) };
}
