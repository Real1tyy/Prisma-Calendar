import { requestUrl } from "obsidian";

// iCloud, Outlook and most "Add to calendar" buttons hand out webcal:// links,
// but requestUrl only speaks http(s). Every major provider serves the feed over
// https, which is also what Full Calendar rewrites to.
const WEBCAL_SCHEME = /^webcals?:\/\//i;

export function normalizeIcsUrl(raw: string): string {
	return raw.trim().replace(WEBCAL_SCHEME, "https://");
}

export async function fetchIcsFeed(url: string): Promise<string> {
	const response = await requestUrl({ url: normalizeIcsUrl(url), method: "GET" });
	return response.text;
}
