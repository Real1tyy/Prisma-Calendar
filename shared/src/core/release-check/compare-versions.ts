const SEGMENT_REGEX = /\d+/g;

export function parseVersion(raw: string): number[] {
	const stripped = raw.replace(/^v/i, "").trim();
	const matches = stripped.match(SEGMENT_REGEX);
	if (!matches) return [];
	return matches.map((m) => Number.parseInt(m, 10)).filter((n) => Number.isFinite(n));
}

/**
 * Segment-by-segment semver comparison. Returns 1 if `a > b`, -1 if `a < b`, 0 if equal.
 * Strips a leading `v`, ignores prerelease/build metadata. Missing segments are treated as 0
 * so `1.2` compares equal to `1.2.0`.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
	const aSegments = parseVersion(a);
	const bSegments = parseVersion(b);
	const length = Math.max(aSegments.length, bSegments.length);
	for (let i = 0; i < length; i++) {
		const left = aSegments[i] ?? 0;
		const right = bSegments[i] ?? 0;
		if (left > right) return 1;
		if (left < right) return -1;
	}
	return 0;
}
