import { describe, expectTypeOf, it } from "vitest";

import type { Paths, PathValue } from "../../src/hooks/settings/path-types";

interface Sample {
	alpha: string;
	beta: number;
	nested: {
		inner: boolean;
		deeper: {
			value: string;
		};
	};
	list: string[];
}

describe("Paths<T>", () => {
	it("enumerates top-level keys", () => {
		expectTypeOf<"alpha">().toExtend<Paths<Sample>>();
		expectTypeOf<"beta">().toExtend<Paths<Sample>>();
		expectTypeOf<"list">().toExtend<Paths<Sample>>();
	});

	it("includes intermediate object paths and nested dotted paths", () => {
		expectTypeOf<"nested">().toExtend<Paths<Sample>>();
		expectTypeOf<"nested.inner">().toExtend<Paths<Sample>>();
		expectTypeOf<"nested.deeper">().toExtend<Paths<Sample>>();
		expectTypeOf<"nested.deeper.value">().toExtend<Paths<Sample>>();
	});

	it("does not descend into arrays", () => {
		// "list" is a key, but "list.0" / "list.length" are not legal Paths.
		expectTypeOf<"list.0">().not.toExtend<Paths<Sample>>();
		expectTypeOf<"list.length">().not.toExtend<Paths<Sample>>();
	});
});

describe("PathValue<T, P>", () => {
	it("resolves top-level field types", () => {
		expectTypeOf<PathValue<Sample, "alpha">>().toEqualTypeOf<string>();
		expectTypeOf<PathValue<Sample, "beta">>().toEqualTypeOf<number>();
	});

	it("resolves nested field types", () => {
		expectTypeOf<PathValue<Sample, "nested.inner">>().toEqualTypeOf<boolean>();
		expectTypeOf<PathValue<Sample, "nested.deeper.value">>().toEqualTypeOf<string>();
	});

	it("returns the intermediate object type for partial paths", () => {
		expectTypeOf<PathValue<Sample, "nested">>().toEqualTypeOf<Sample["nested"]>();
		expectTypeOf<PathValue<Sample, "nested.deeper">>().toEqualTypeOf<Sample["nested"]["deeper"]>();
	});
});
