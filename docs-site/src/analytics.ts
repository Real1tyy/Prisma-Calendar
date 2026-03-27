import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";
import type { ClientModule } from "@docusaurus/types";

const ANALYTICS_ENDPOINT = "https://h.matejvavroproductivity.com/b";
const TRACKING_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref"];

interface UtmParams {
	utmCampaign: string | null;
	utmSource: string | null;
	utmMedium: string | null;
	utmContent: string | null;
	utmTerm: string | null;
}

let sessionAttribution: UtmParams | null = null;
let sessionPageCount = 0;
let pageEntryTime = 0;
let maxScrollDepth = 0;
let currentPath = "";

function getSessionAttribution(): UtmParams {
	if (!sessionAttribution) {
		const params = new URLSearchParams(window.location.search);
		sessionAttribution = {
			utmCampaign: params.get("utm_campaign") || null,
			utmSource: params.get("utm_source") || null,
			utmMedium: params.get("utm_medium") || null,
			utmContent: params.get("utm_content") || null,
			utmTerm: params.get("utm_term") || null,
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

function send(body: Record<string, unknown>): void {
	const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
	navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
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

	send({
		path: currentPath,
		referrer: null,
		previousPath: null,
		...getSessionAttribution(),
		scrollDepth: maxScrollDepth,
		duration,
		sessionPageCount,
		isEngagement: true,
	});

	pageEntryTime = 0;
	maxScrollDepth = 0;
}

function resetPageTracking(): void {
	pageEntryTime = Date.now();
	maxScrollDepth = 0;
	currentPath = window.location.href;
}

function trackPageView(isInitial: boolean, previousPath?: string | null): void {
	sessionPageCount++;
	resetPageTracking();
	send({
		path: window.location.href,
		referrer: isInitial ? document.referrer || null : null,
		previousPath: isInitial ? null : previousPath ?? null,
		...getSessionAttribution(),
		scrollDepth: null,
		duration: null,
		sessionPageCount,
		isEngagement: false,
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

function setupUnloadFlush(): void {
	const flush = () => flushPageEngagement();

	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") flush();
	});

	window.addEventListener("pagehide", flush);
}

if (ExecutionEnvironment.canUseDOM) {
	getSessionAttribution();
	cleanTrackingParams();
	trackPageView(true);
	setupScrollTracking();
	setupUnloadFlush();
}

const clientModule: ClientModule = {
	onRouteDidUpdate({ location, previousLocation }) {
		if (location.pathname !== previousLocation?.pathname) {
			flushPageEngagement();
			const prevFullUrl = previousLocation
				? `${window.location.origin}${previousLocation.pathname}`
				: null;
			trackPageView(false, prevFullUrl);
		}
	},
};

export default clientModule;
