import { Platform } from "obsidian";

/** Coarse platform tag sent as telemetry context — never anything device-identifying. */
export type PlatformId = "macos" | "windows" | "linux" | "ios" | "android" | "unknown";

export function getPlatformId(): PlatformId {
	if (Platform.isMacOS) return "macos";
	if (Platform.isWin) return "windows";
	if (Platform.isLinux) return "linux";
	if (Platform.isIosApp) return "ios";
	if (Platform.isAndroidApp) return "android";
	return "unknown";
}

/** Human-readable device label shown back to the user on the license device list. */
export function getDeviceName(): string {
	if (Platform.isDesktopApp) return `${Platform.isMacOS ? "macOS" : Platform.isWin ? "Windows" : "Linux"} Desktop`;
	if (Platform.isMobileApp) return Platform.isIosApp ? "iOS" : "Android";
	return "Unknown";
}
