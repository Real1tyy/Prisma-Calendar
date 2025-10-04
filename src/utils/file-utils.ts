/**
 * Sanitizes a string for use as a filename while preserving spaces and case.
 * Only removes characters that are truly invalid on most file systems.
 *
 * Invalid characters removed:
 * - < > : " / \ | ? * (Windows/Unix invalid characters)
 * - Trailing dots (invalid on Windows)
 */
export const sanitizeForFilename = (input: string): string => {
	return (
		input
			// Remove invalid filename characters (cross-platform compatibility)
			.replace(/[<>:"/\\|?*]/g, "")
			// Remove trailing dots (invalid on Windows)
			.replace(/\.+$/g, "")
			// Remove leading/trailing whitespace
			.trim()
	);
};
