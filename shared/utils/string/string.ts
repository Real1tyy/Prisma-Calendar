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
