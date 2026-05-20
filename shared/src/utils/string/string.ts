export const capitalize = (str: string): string => {
	if (!str) return str;
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const pluralize = (count: number): string => {
	return count === 1 ? "" : "s";
};

export const getWeekDirection = (weeks: number): "next" | "previous" => {
	return weeks > 0 ? "next" : "previous";
};

/**
 * Removes every leading and trailing occurrence of any character in `chars`.
 * Linear-time alternative to `replace(/^[chars]+|[chars]+$/g, "")`, whose
 * end-anchored quantifier the regex engine can run in superlinear time on
 * adversarial input (polynomial ReDoS).
 */
export const trimChars = (input: string, chars: string): string => {
	let start = 0;
	let end = input.length;
	while (start < end && chars.includes(input[start])) start++;
	while (end > start && chars.includes(input[end - 1])) end--;
	return input.slice(start, end);
};

/**
 * Removes every trailing occurrence of any character in `chars`.
 * Linear-time alternative to `replace(/[chars]+$/g, "")`.
 */
export const stripTrailingChars = (input: string, chars: string): string => {
	let end = input.length;
	while (end > 0 && chars.includes(input[end - 1])) end--;
	return input.slice(0, end);
};
