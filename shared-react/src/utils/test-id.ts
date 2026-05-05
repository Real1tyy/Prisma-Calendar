/**
 * Spread onto a native DOM element to stamp `data-testid` only when the id is
 * defined. Avoids the `data-testid={undefined}` attribute that React still
 * renders as `data-testid=""` in some Obsidian DOM scenarios.
 */
export function testIdAttr(testId: string | undefined): { "data-testid"?: string } {
	return testId !== undefined ? { "data-testid": testId } : {};
}

/**
 * Spread onto a `shared-react` primitive that accepts a `testId` prop. Same
 * intent as `testIdAttr` but pass-through — keeps wrapper components from
 * forwarding `testId={undefined}` and overriding internal defaults.
 */
export function testIdProp(testId: string | undefined): { testId?: string } {
	return testId !== undefined ? { testId } : {};
}
