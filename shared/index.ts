// Core business logic, data, and patterns
export * from "./core";
// UI components and rendering modules
export * from "./components";
// Pure utility functions
export * from "./utils";
// External system adapters
export * from "./integrations";
// Test infrastructure is intentionally NOT re-exported here — doing so pulls vitest
// into plugin production bundles. Import from "@real1ty-obsidian-plugins/testing" instead.
