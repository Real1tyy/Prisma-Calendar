import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactElement } from "react";

type UserEventOptions = Parameters<typeof userEvent.setup>[0];

export interface RenderReactResult extends RenderResult {
	user: ReturnType<typeof userEvent.setup>;
}

export function renderReact(
	ui: ReactElement,
	options?: RenderOptions,
	userEventOptions?: UserEventOptions
): RenderReactResult {
	const user = userEvent.setup(userEventOptions);
	return { user, ...render(ui, options) };
}
