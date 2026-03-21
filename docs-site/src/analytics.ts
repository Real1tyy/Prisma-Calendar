import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";
import type { ClientModule } from "@docusaurus/types";

const ANALYTICS_ENDPOINT = "https://h.matejvavroproductivity.com";
const TRACKING_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref"];

type EventCategory = "click" | "download" | "search" | "navigation" | "conversion" | "engagement" | "error";

interface UtmParams {
	utmSource: string | null;
	utmMedium: string | null;
	utmContent: string | null;
}

// First-touch session attribution — cached once from the initial landing URL before cleanup
let sessionAttribution: UtmParams | null = null;
let sessionPageCount = 0;
let pageEntryTime = 0;
let maxScrollDepth = 0;
let currentPath = "";

function getSessionAttribution(): UtmParams {
	if (!sessionAttribution) {
		const params = new URLSearchParams(window.location.search);
		sessionAttribution = {
			utmSource: params.get("utm_source") || "docs-site",
			utmMedium: params.get("utm_medium") || "docs",
			utmContent: params.get("utm_content") || "prisma-calendar",
		};
	}
	return sessionAttribution;
}

function cleanTrackingParams(): void {
	const url = new URL(window.location.href);
	let stripped = false;

	for (const param of TRACKING_PARAMS) {
		if (url.searchParams.has(param)) {
			url.searchParams.delete(param);
			stripped = true;
		}
	}

	if (stripped) {
		const clean = url.pathname + (url.search || "") + url.hash;
		window.history.replaceState(window.history.state, "", clean);
	}
}

function send(path: string, body: Record<string, unknown>): void {
	const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
	if (navigator.sendBeacon) {
		navigator.sendBeacon(`${ANALYTICS_ENDPOINT}${path}`, blob);
	} else {
		fetch(`${ANALYTICS_ENDPOINT}${path}`, {
			method: "POST",
			body: blob,
			keepalive: true,
		}).catch(() => {});
	}
}

function getScrollDepth(): number {
	const scrollTop = window.scrollY || document.documentElement.scrollTop;
	const docHeight = Math.max(
		document.body.scrollHeight,
		document.documentElement.scrollHeight,
	);
	const viewportHeight = window.innerHeight;
	if (docHeight <= viewportHeight) return 100;
	return Math.min(100, Math.round((scrollTop / (docHeight - viewportHeight)) * 100));
}

function getDuration(): number {
	if (pageEntryTime === 0) return 0;
	return Math.min(3600, Math.round((Date.now() - pageEntryTime) / 1000));
}

function flushPageEngagement(): void {
	if (!currentPath || pageEntryTime === 0) return;
	const duration = getDuration();
	if (duration < 1) return;

	send("/api/visit", {
		path: currentPath,
		referrer: null,
		previousPath: null,
		...getSessionAttribution(),
		scrollDepth: maxScrollDepth,
		duration,
		sessionPageCount,
		isEngagement: true,
	});

	// Prevent duplicate flushes for the same page (route change + visibility hidden)
	pageEntryTime = 0;
	maxScrollDepth = 0;
}

function resetPageTracking(): void {
	pageEntryTime = Date.now();
	maxScrollDepth = 0;
	currentPath = window.location.pathname;
}

function trackPageView(isInitial: boolean, previousPath?: string | null): void {
	sessionPageCount++;
	resetPageTracking();
	send("/api/visit", {
		path: window.location.pathname,
		referrer: isInitial ? document.referrer || null : null,
		previousPath: isInitial ? null : previousPath ?? null,
		...getSessionAttribution(),
		scrollDepth: null,
		duration: null,
		sessionPageCount,
		isEngagement: false,
	});
}

export function trackEvent(
	category: EventCategory,
	action: string,
	label?: string | null,
	value?: number | null,
): void {
	const utm = getSessionAttribution();
	send("/api/event", {
		category,
		action,
		label: label ?? null,
		path: window.location.pathname,
		utmSource: utm.utmSource,
		utmMedium: utm.utmMedium,
		utmContent: utm.utmContent,
		value: value ?? null,
	});
}

function setupScrollTracking(): void {
	let ticking = false;
	window.addEventListener("scroll", () => {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(() => {
			const depth = getScrollDepth();
			if (depth > maxScrollDepth) {
				maxScrollDepth = depth;
			}
			ticking = false;
		});
	});
}

function setupExternalLinkTracking(): void {
	document.addEventListener("click", (e) => {
		const anchor = (e.target as HTMLElement).closest("a[href]");
		if (!anchor) return;

		const href = anchor.getAttribute("href");
		if (!href || !href.startsWith("http")) return;

		try {
			const url = new URL(href);
			if (url.hostname === window.location.hostname) return;

			if (url.hostname.includes("youtube.com") || url.hostname.includes("youtu.be")) {
				trackEvent("navigation", "youtube_click", href);
			} else {
				trackEvent("navigation", "external_link", href);
			}
		} catch {
			// Malformed URL — ignore
		}
	});
}

function setupCodeCopyTracking(): void {
	document.addEventListener("click", (e) => {
		const target = e.target as HTMLElement;
		const copyButton = target.closest(".clean-btn[class*='copy']") ?? target.closest("button[class*='copy']");
		if (!copyButton) return;
		const codeBlock = copyButton.closest(".theme-code-block");
		const language = codeBlock?.querySelector("[class*='language-']")?.className.match(/language-(\w+)/)?.[1] ?? null;
		trackEvent("engagement", "code_copy", language);
	});
}

function setupUnloadFlush(): void {
	const flush = () => flushPageEngagement();

	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") flush();
	});

	window.addEventListener("pagehide", flush);
}

// Guard browser globals — only run in browser, not during SSR
if (ExecutionEnvironment.canUseDOM) {
	// Cache UTM params BEFORE cleaning them from the URL
	getSessionAttribution();
	trackPageView(true);
	cleanTrackingParams();
	setupScrollTracking();
	setupExternalLinkTracking();
	setupCodeCopyTracking();
	setupUnloadFlush();
}

const clientModule: ClientModule = {
	onRouteDidUpdate({ location, previousLocation }) {
		if (location.pathname !== previousLocation?.pathname) {
			flushPageEngagement();
			trackPageView(false, previousLocation?.pathname ?? null);
		}
	},
};

export default clientModule;
