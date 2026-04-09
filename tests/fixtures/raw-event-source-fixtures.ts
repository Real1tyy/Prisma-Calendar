import type { RawEventSource } from "../../src/types/event-source";
import { createDefaultMetadata } from "./event-fixtures";

/** Factory for RawEventSource with default metadata merging. */
export function createRawEventSource(
	overrides: Omit<Partial<RawEventSource>, "metadata"> & { metadata?: Partial<RawEventSource["metadata"]> } = {}
): RawEventSource {
	return {
		filePath: "event.md",
		mtime: Date.now(),
		frontmatter: {},
		folder: "",
		isAllDay: false,
		isUntracked: false,
		...overrides,
		metadata: createDefaultMetadata(overrides.metadata),
	};
}
