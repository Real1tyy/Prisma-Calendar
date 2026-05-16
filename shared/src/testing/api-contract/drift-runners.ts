// @tombstone — moved to shared/src/testing/drift-runners.ts
// Living inside the testing/api-contract/ barrel pulled `vitest` into the
// Playwright E2E transitive graph (since E2E specs consume the barrel for
// `pageEvaluateInvoker`). The drift runners now live at the testing/ root and
// are imported via the deep subpath `@real1ty-obsidian-plugins/testing/drift-runners`.
export {};
