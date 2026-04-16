import { introspectField } from "@real1ty-obsidian-plugins";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { SchemaField } from "../../src/settings/schema-field";
import { makeStore } from "../helpers/make-store";
import { renderReact } from "../helpers/render-react";

describe("SchemaField placeholder pipeline (imperative parity)", () => {
	it("renders the .catch() default as placeholder when the stored value is empty", () => {
		const descriptor = introspectField(
			"startProp",
			z.string().catch("Start Date").describe("Start frontmatter property name")
		);
		const store = makeStore({ startProp: "" });
		renderReact(<SchemaField store={store} descriptor={descriptor} />);

		expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "Start Date");
	});

	it("renders the .default() as placeholder when the stored value is empty", () => {
		const descriptor = introspectField("title", z.string().default("Untitled"));
		const store = makeStore({ title: "" });
		renderReact(<SchemaField store={store} descriptor={descriptor} />);

		expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "Untitled");
	});

	it("renders .meta({ placeholder }) in preference to any default", () => {
		const descriptor = introspectField("hint", z.string().catch("catch-default").meta({ placeholder: "type here…" }));
		const store = makeStore({ hint: "" });
		renderReact(<SchemaField store={store} descriptor={descriptor} />);

		expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "type here…");
	});

	it("override.placeholder wins over schema-derived placeholder", () => {
		const descriptor = introspectField("hint", z.string().catch("catch-default"));
		const store = makeStore({ hint: "" });
		renderReact(<SchemaField store={store} descriptor={descriptor} override={{ placeholder: "site-override" }} />);

		expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "site-override");
	});

	it("plain z.string() with no default and no meta has no placeholder attribute", () => {
		const descriptor = introspectField("plain", z.string());
		const store = makeStore({ plain: "" });
		renderReact(<SchemaField store={store} descriptor={descriptor} />);

		const input = screen.getByRole("textbox");
		expect(input.getAttribute("placeholder")).toBeNull();
	});
});
