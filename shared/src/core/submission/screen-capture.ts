import type { ScreenshotAttachment } from "./types";

/**
 * The desktop window, as much of Electron as capture needs. Structural rather
 * than imported so the mechanism is fakeable in a test and the bundle carries
 * no Electron dependency — Obsidian mobile has no `require` at all.
 */
export interface NativeImageLike {
	isEmpty(): boolean;
	getSize(): { width: number; height: number };
	resize(options: { width: number }): NativeImageLike;
	toPNG(): Uint8Array;
	toJPEG(quality: number): Uint8Array;
}

export interface CaptureWindowLike {
	webContents: { capturePage(): Promise<NativeImageLike> };
	/** Brings the window forward. Absent on the fakes that only exercise capture. */
	focus?: () => void;
}

/** Bytes plus the metadata the attachment needs. What a mechanism returns. */
export interface CapturedImage {
	mimeType: string;
	/** Base64 image bytes, without the `data:` URL prefix. */
	dataBase64: string;
	byteSize: number;
}

export type CaptureMechanism = () => Promise<CapturedImage>;

export type ScreenCaptureResult =
	| { readonly ok: true; readonly screenshot: ScreenshotAttachment }
	| { readonly ok: false; readonly message: string };

/**
 * A capture never throws at its call site: the user pressed a button in a form
 * they are in the middle of writing, and losing that form to an Electron quirk
 * is a worse outcome than a sentence saying capture didn't work.
 */
export type ScreenCapture = (name: string) => Promise<ScreenCaptureResult>;

/** PNG at native resolution is lossless but easily blows the per-image cap on a 4K display. */
const JPEG_FALLBACK_MAX_WIDTH = 1600;
const JPEG_FALLBACK_QUALITY = 80;

export function createScreenCapture(mechanism: CaptureMechanism): ScreenCapture {
	return async (name: string): Promise<ScreenCaptureResult> => {
		try {
			const image = await mechanism();
			return { ok: true, screenshot: { name, ...image } };
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			return { ok: false, message: `Couldn't capture the screen — ${detail}` };
		}
	};
}

export interface WindowCaptureOptions {
	/** Above this, the PNG is re-encoded as a downscaled JPEG rather than rejected at attach time. */
	maxBytes: number;
}

/**
 * Captures the whole Obsidian window through Electron's `capturePage`, which is
 * what makes the screenshot show the app as the user sees it — including the
 * parts of Obsidian our own DOM knows nothing about (a DOM-to-image rasterizer
 * would only ever see the plugin's own subtree).
 */
export function createWindowCapture(
	getWindow: () => CaptureWindowLike | null,
	{ maxBytes }: WindowCaptureOptions
): CaptureMechanism {
	return async (): Promise<CapturedImage> => {
		const win = getWindow();
		if (win === null) throw new Error("screen capture isn't available on this platform.");

		const image = await win.webContents.capturePage();
		if (image.isEmpty()) throw new Error("the window returned an empty image.");

		const png = image.toPNG();
		if (png.byteLength <= maxBytes) return encoded(png, "image/png");

		const { width } = image.getSize();
		const shrunk = width > JPEG_FALLBACK_MAX_WIDTH ? image.resize({ width: JPEG_FALLBACK_MAX_WIDTH }) : image;
		return encoded(shrunk.toJPEG(JPEG_FALLBACK_QUALITY), "image/jpeg");
	};
}

function encoded(bytes: Uint8Array, mimeType: string): CapturedImage {
	return { mimeType, dataBase64: bytesToBase64(bytes), byteSize: bytes.byteLength };
}

/** `btoa` takes a binary string, and a whole-window PNG overflows the argument limit in one call. */
const BASE64_CHUNK = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK));
	}
	return btoa(binary);
}

interface ElectronRemoteLike {
	remote?: { getCurrentWindow?: () => CaptureWindowLike };
}

/**
 * Resolves Electron's current window, or null on any surface that isn't the
 * desktop app — mobile, and the jsdom/Playwright runtimes. Callers treat null
 * as "hide the capture affordance" rather than as an error.
 */
export function getElectronWindow(): CaptureWindowLike | null {
	const load = (globalThis as { require?: (id: string) => unknown }).require;
	if (typeof load !== "function") return null;
	try {
		const electron = load("electron") as ElectronRemoteLike | undefined;
		return electron?.remote?.getCurrentWindow?.() ?? null;
	} catch {
		return null;
	}
}

/**
 * Brings the main Obsidian window forward.
 *
 * Obsidian 1.13 opens Settings in a window of its own, and a modal opened from
 * there belongs to *that* window — so a capture flow started from the settings
 * page would put its bar and its returning report behind the settings window,
 * where the user never sees them. The capture is of the app, so the flow belongs
 * to the app's window ([[spec-feedback-commands-and-screenshot-capture]]).
 *
 * A no-op wherever there is no Electron window to focus.
 */
export function focusAppWindow(): void {
	getElectronWindow()?.focus?.();
}
