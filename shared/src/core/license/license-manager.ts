import { errors, importSPKI, jwtVerify } from "jose";
import { apiVersion, Notice, Platform, requestUrl, type App } from "obsidian";
import { BehaviorSubject, type Observable } from "rxjs";

import {
	LicenseStatusSchema,
	type CachedLicenseData,
	type EntitlementStatus,
	type LicenseDeactivateResponse,
	type LicenseErrorResponse,
	type LicenseManagerConfig,
	type LicenseStatus,
	type LicenseVerifyResponse,
} from "./types";

const LICENSE_API_URL = "https://api.matejvavroproductivity.com/api/license/verify";
const LICENSE_DEACTIVATE_URL = "https://api.matejvavroproductivity.com/api/license/deactivate";

const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAExdFpvC2Gq9VcCFfulGa69NyrNw2k
3R/f04VvUXQ2TAIubwbDHFLRTJMTg7igpmDtwDYDrDL8untxkaTE+dHGsQ==
-----END PUBLIC KEY-----`;

const JWT_ALG = "ES256";
const JWT_ISSUER = "matej-vavro-productivity";
const JWT_AUDIENCE = "license";

// Background re-verify ("heartbeat"). The runtime gate is the cached 7-day JWT,
// re-checked only at plugin load / manual Verify — so an always-open client (a
// macOS user who only ever sleeps/wakes) could ride a stale entitlement for the
// whole session. A daily, wall-clock-gated re-verify turns the 7-day window into
// a rolling "7 days since last online", enforces cancellation within ~a day, and
// makes server-side telemetry a real heartbeat instead of a restart log.
export const HEARTBEAT_INTERVAL_MS = 24 * 60 * 60 * 1000;
// How often we *check* whether a day has elapsed. The re-verify itself is throttled
// to HEARTBEAT_INTERVAL_MS; the coarse poll also covers always-on desktops that
// never emit a focus/online wake event.
export const HEARTBEAT_POLL_MS = 30 * 60 * 1000;
// When a re-verify is due, delay it by a random 0..JITTER.
export const HEARTBEAT_JITTER_MS = 5 * 60 * 1000;

export class LicenseManager {
	private app: App;
	private getLicenseKeySecretName: () => string;
	private pluginVersion: string;
	private config: LicenseManagerConfig;
	private deviceId = "";
	private cachedPublicKey: CryptoKey | null = null;
	private heartbeatIntervalId: number | null = null;
	private heartbeatJitterId: number | null = null;
	private lastVerifyAttemptAt = 0;
	private disposed = false;
	private readonly onHeartbeatTrigger = (): void => {
		this.maybeHeartbeat();
	};
	readonly status$: BehaviorSubject<LicenseStatus>;
	private readonly subject = new BehaviorSubject<boolean>(false);
	readonly isPro$: Observable<boolean> = this.subject.asObservable();

	get isPro(): boolean {
		return this.subject.getValue();
	}

	get status(): LicenseStatus {
		return this.status$.getValue();
	}

	get purchaseUrl(): string {
		return this.config.purchaseUrl;
	}

	get productName(): string {
		return this.config.productName;
	}

	constructor(app: App, getLicenseKeySecretName: () => string, pluginVersion: string, config: LicenseManagerConfig) {
		this.app = app;
		this.getLicenseKeySecretName = getLicenseKeySecretName;
		this.pluginVersion = pluginVersion;
		this.config = config;
		this.status$ = new BehaviorSubject<LicenseStatus>(LicenseStatusSchema.parse({}));
	}

	async initialize(): Promise<void> {
		this.deviceId = this.getOrCreateDeviceId();
		await this.loadCachedToken();
		await this.refreshLicense();
		this.startHeartbeat();
	}

	/**
	 * Stop the background heartbeat and detach its listeners. Consumers MUST call
	 * this on plugin unload — the manager is not an Obsidian Component, so its
	 * interval and window/document listeners are not torn down automatically.
	 */
	dispose(): void {
		this.disposed = true;
		if (this.heartbeatIntervalId !== null) {
			window.clearInterval(this.heartbeatIntervalId);
			this.heartbeatIntervalId = null;
		}
		if (this.heartbeatJitterId !== null) {
			window.clearTimeout(this.heartbeatJitterId);
			this.heartbeatJitterId = null;
		}
		if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
			window.removeEventListener("focus", this.onHeartbeatTrigger);
			window.removeEventListener("online", this.onHeartbeatTrigger);
		}
		if (typeof document !== "undefined" && typeof document.removeEventListener === "function") {
			document.removeEventListener("visibilitychange", this.onHeartbeatTrigger);
		}
	}

	/**
	 * Test-only seam for E2E specs to unlock Pro features without hitting the
	 * license API. Guarded by `window.E2E === true`, which the test harness
	 * sets during bootstrap. No-op in production builds' runtime context.
	 */
	__setProForTesting(value: boolean): void {
		if (typeof window === "undefined" || (window as unknown as { E2E?: boolean }).E2E !== true) {
			return;
		}
		this.subject.next(value);
	}

	requirePro(featureName: string, options?: { docsUrl?: string; purchaseUrl?: string }): boolean {
		if (this.isPro) return true;
		const purchaseUrl = options?.purchaseUrl ?? this.config.purchaseUrl;
		const docsUrl = options?.docsUrl;
		const lines = [`${featureName} requires ${this.config.productName} Pro.`];
		if (docsUrl) lines.push(`Docs: ${docsUrl}`);
		lines.push(`Get Pro: ${purchaseUrl}`);
		new Notice(lines.join("\n"), 8000);
		console.log(
			`[${this.config.productName}] Pro feature required: ${featureName}` +
				(docsUrl ? `\n  Docs: ${docsUrl}` : "") +
				`\n  Purchase: ${purchaseUrl}`
		);
		return false;
	}

	async refreshLicense(): Promise<void> {
		const licenseKey = await this.getLicenseKey();
		if (!licenseKey) {
			this.updateStatus("none");
			return;
		}

		this.lastVerifyAttemptAt = Date.now();

		try {
			const response = await requestUrl({
				url: LICENSE_API_URL,
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					licenseKey,
					deviceId: this.deviceId,
					deviceName: this.getDeviceName(),
					pluginVersion: this.pluginVersion,
					obsidianVersion: this.getObsidianVersion(),
					platform: this.getPlatform(),
				}),
				throw: false,
			});

			const data = response.json as (LicenseVerifyResponse & Partial<LicenseErrorResponse>) | undefined;
			switch (data?.code) {
				case "OK": {
					const tokenResult = await this.verifyToken(data.token);
					if (tokenResult !== "valid") {
						this.updateStatus("error", "License token verification failed.");
						return;
					}
					this.cacheToken(data);
					this.activateLicense({
						activationsCurrent: data.activations.current,
						activationsLimit: data.activations.limit,
						expiresAt: data.expiresAt,
						entitlementStatus: data.entitlementStatus ?? null,
						currentPeriodEnd: data.currentPeriodEnd ?? null,
						cancelAt: data.cancelAt ?? null,
						trialEndsAt: data.trialEndsAt ?? null,
					});
					return;
				}
				case "KEY_INVALID_OR_REVOKED":
					this.clearCachedToken();
					this.updateStatus("invalid", "This license key is no longer valid. Check the key in settings.");
					return;
				case "ENTITLEMENT_INACTIVE":
					this.clearCachedToken();
					this.updateStatus(
						"entitlement_inactive",
						"Your subscription isn't active. Check your billing on the account page."
					);
					return;
				case "SEAT_LIMIT_REACHED": {
					this.clearCachedToken();
					const limit = data.activations.limit;
					this.updateStatus(
						"device_limit",
						`Device limit reached (${limit} devices). Deactivate a device to free a seat.`,
						{
							activationsCurrent: data.activations.current,
							activationsLimit: limit,
						}
					);
					return;
				}
				default:
					await this.handleNetworkFailure();
			}
		} catch {
			await this.handleNetworkFailure();
		}
	}

	/**
	 * Free this device's activation seat server-side (plugin-facing device
	 * self-management). On success Pro is dropped on this device until the next
	 * successful verify re-takes a seat. Returns false on failure so the caller
	 * can surface a retry.
	 */
	async deactivateDevice(): Promise<boolean> {
		const licenseKey = await this.getLicenseKey();
		if (!licenseKey) return false;
		try {
			const response = await requestUrl({
				url: LICENSE_DEACTIVATE_URL,
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ licenseKey, deviceId: this.deviceId }),
				throw: false,
			});
			const data = response.json as LicenseDeactivateResponse | undefined;
			if (data?.code === "OK" || data?.code === "DEVICE_NOT_FOUND") {
				this.clearCachedToken();
				this.updateStatus("deactivated", "This device was deactivated. Click Verify to re-activate it.");
				return true;
			}
			return false;
		} catch {
			return false;
		}
	}

	async verifyToken(token: string): Promise<"valid" | "expired" | "invalid"> {
		try {
			const key = await this.getPublicKey();
			await jwtVerify(token, key, {
				issuer: JWT_ISSUER,
				audience: JWT_AUDIENCE,
			});
			return "valid";
		} catch (err) {
			if (err instanceof errors.JWTExpired) return "expired";
			return "invalid";
		}
	}

	private activateLicense(data: {
		activationsCurrent: number;
		activationsLimit: number;
		expiresAt: string;
		entitlementStatus: EntitlementStatus | null;
		currentPeriodEnd: string | null;
		cancelAt: string | null;
		trialEndsAt: string | null;
	}): void {
		this.status$.next({
			state: "valid",
			activationsCurrent: data.activationsCurrent,
			activationsLimit: data.activationsLimit,
			expiresAt: data.expiresAt,
			entitlementStatus: data.entitlementStatus,
			currentPeriodEnd: data.currentPeriodEnd,
			cancelAt: data.cancelAt,
			trialEndsAt: data.trialEndsAt,
			errorMessage: null,
		});
		this.setLicenseActive(true);
	}

	private setLicenseActive(active: boolean): void {
		if (this.subject.getValue() !== active) {
			this.subject.next(active);
		}
	}

	private async handleNetworkFailure(): Promise<void> {
		const cached = this.readCacheFromStorage();
		if (cached?.token) {
			const result = await this.verifyToken(cached.token);
			if (result === "valid") return;
			if (result === "expired") {
				this.clearCachedToken();
				this.updateStatus("expired", "Cached license expired. Please connect to the internet to re-verify.");
				return;
			}
		}
		this.updateStatus("error", "Could not reach license server. Please check your internet connection.");
	}

	private startHeartbeat(): void {
		if (this.heartbeatIntervalId !== null) return;
		this.heartbeatIntervalId = window.setInterval(this.onHeartbeatTrigger, HEARTBEAT_POLL_MS);
		if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
			window.addEventListener("focus", this.onHeartbeatTrigger);
			window.addEventListener("online", this.onHeartbeatTrigger);
		}
		if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
			document.addEventListener("visibilitychange", this.onHeartbeatTrigger);
		}
	}

	/**
	 * Re-verify in the background at most once per {@link HEARTBEAT_INTERVAL_MS}.
	 * Skips when disposed, when a verify is already scheduled, when no key is
	 * configured, or when offline. The actual `refreshLicense()` reuses the normal
	 * verify path, so it keeps the existing definitive-vs-transient semantics:
	 * 401/403 revokes (clears the cached token), while a network/5xx failure falls
	 * back to the still-valid cached JWT — a paying offline user is never yanked.
	 */
	private maybeHeartbeat(): void {
		if (this.disposed || this.heartbeatJitterId !== null) return;
		if (!this.getLicenseKeySecretName()) return;
		// Only skip when the browser reports *definitively* offline. `onLine` can be
		// absent (non-DOM/partial navigator), and an unknown state must not suppress
		// re-verification — hence the explicit `=== false`, not `!onLine`.
		const onLine: boolean | undefined = typeof navigator === "undefined" ? undefined : navigator.onLine;
		if (onLine === false) return;
		if (Date.now() - this.lastVerifyAttemptAt < HEARTBEAT_INTERVAL_MS) return;

		const jitter = Math.floor(Math.random() * HEARTBEAT_JITTER_MS);
		this.heartbeatJitterId = window.setTimeout(() => {
			this.heartbeatJitterId = null;
			if (this.disposed) return;
			void this.refreshLicense();
		}, jitter);
	}

	private updateStatus(
		state: LicenseStatus["state"],
		errorMessage: string | null = null,
		extra?: Partial<LicenseStatus>
	): void {
		this.status$.next({
			...this.status$.getValue(),
			state,
			errorMessage,
			...extra,
		});
		this.setLicenseActive(state === "valid");
	}

	private getOrCreateDeviceId(): string {
		let id = this.app.loadLocalStorage(this.config.deviceIdStorageKey);
		if (!id) {
			id = crypto.randomUUID();
			this.app.saveLocalStorage(this.config.deviceIdStorageKey, id);
		}
		return id;
	}

	private getLicenseKey(): Promise<string | null> {
		const secretName = this.getLicenseKeySecretName();
		if (!secretName) return Promise.resolve(null);
		return Promise.resolve(this.app.secretStorage.getSecret(secretName));
	}

	private async loadCachedToken(): Promise<void> {
		const cached = this.readCacheFromStorage();
		if (!cached?.token) return;
		const result = await this.verifyToken(cached.token);
		if (result === "expired") {
			this.clearCachedToken();
			this.updateStatus("expired", "Cached license expired. Click Verify to refresh.");
			return;
		}
		if (result !== "valid") {
			this.clearCachedToken();
			return;
		}
		this.activateLicense({
			activationsCurrent: cached.activationsCurrent,
			activationsLimit: cached.activationsLimit,
			expiresAt: cached.expiresAt,
			entitlementStatus: cached.entitlementStatus ?? null,
			currentPeriodEnd: cached.currentPeriodEnd ?? null,
			cancelAt: cached.cancelAt ?? null,
			trialEndsAt: cached.trialEndsAt ?? null,
		});
	}

	private async getPublicKey(): Promise<CryptoKey> {
		if (this.cachedPublicKey) return this.cachedPublicKey;
		this.cachedPublicKey = await importSPKI(LICENSE_PUBLIC_KEY_PEM, JWT_ALG);
		return this.cachedPublicKey;
	}

	private cacheToken(data: LicenseVerifyResponse): void {
		const cached: CachedLicenseData = {
			token: data.token,
			expiresAt: data.expiresAt,
			activationsCurrent: data.activations.current,
			activationsLimit: data.activations.limit,
			entitlementStatus: data.entitlementStatus ?? null,
			currentPeriodEnd: data.currentPeriodEnd ?? null,
			cancelAt: data.cancelAt ?? null,
			trialEndsAt: data.trialEndsAt ?? null,
		};
		this.app.saveLocalStorage(this.config.licenseCacheStorageKey, JSON.stringify(cached));
	}

	private clearCachedToken(): void {
		this.app.saveLocalStorage(this.config.licenseCacheStorageKey, "");
	}

	private readCacheFromStorage(): CachedLicenseData | null {
		const raw = this.app.loadLocalStorage(this.config.licenseCacheStorageKey);
		if (!raw) return null;
		try {
			return JSON.parse(raw) as CachedLicenseData;
		} catch {
			return null;
		}
	}

	private getDeviceName(): string {
		if (Platform.isDesktopApp) return `${Platform.isMacOS ? "macOS" : Platform.isWin ? "Windows" : "Linux"} Desktop`;
		if (Platform.isMobileApp) return Platform.isIosApp ? "iOS" : "Android";
		return "Unknown";
	}

	private getPlatform(): string {
		if (Platform.isMacOS) return "macos";
		if (Platform.isWin) return "windows";
		if (Platform.isLinux) return "linux";
		if (Platform.isIosApp) return "ios";
		if (Platform.isAndroidApp) return "android";
		return "unknown";
	}

	private getObsidianVersion(): string {
		return apiVersion;
	}
}
