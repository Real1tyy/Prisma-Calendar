// Core business logic, data, and patterns
export * from "./core";
// UI components and rendering modules
export * from "./components";
// Pure utility functions
export * from "./utils";
// External system adapters
export * from "./integrations";
// React bridge layer is exposed via the `@real1ty-obsidian-plugins/react`
// subpath, not re-exported here — names like `ChipList` intentionally overlap
// with imperative classes during the parallel-exposure migration window.
// Test infrastructure is intentionally NOT re-exported here — doing so pulls vitest
// into plugin production bundles. Import from "@real1ty-obsidian-plugins/testing" instead.
