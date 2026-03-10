import { errors, importSPKI, jwtVerify } from "jose";
import { apiVersion, type App, Notice, Platform, requestUrl } from "obsidian";
import { BehaviorSubject, type Observable } from "rxjs";

import type { CachedLicenseData, LicenseStatus, LicenseVerifyResponse } from "../types/license";
import type { SettingsStore } from "./settings-store";

export const FREE_MAX_CALENDARS = 3;
export const FREE_MAX_EVENT_PRESETS = 2;

export const PRO_PURCHASE_URL = "https://matejvavroproductivity.com/tools/prisma-calendar";
export const LICENSE_API_URL = "https://api.matejvavroproductivity.com/api/license/verify";
export const DEVICE_ID_STORAGE_KEY = "prisma-calendar-device-id";
export const LICENSE_CACHE_STORAGE_KEY = "prisma-calendar-license-cache";

const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAExdFpvC2Gq9VcCFfulGa69NyrNw2k
3R/f04VvUXQ2TAIubwbDHFLRTJMTg7igpmDtwDYDrDL8untxkaTE+dHGsQ==
-----END PUBLIC KEY-----`;

const JWT_ALG = "ES256";
const JWT_ISSUER = "matej-vavro-productivity";
const JWT_AUDIENCE = "license";

export const PRO_FEATURES = {
	AI_CHAT: "AI Chat",
	CALDAV_SYNC: "CalDAV Sync",
	ICS_SYNC: "ICS Subscriptions",
	PROGRAMMATIC_API: "Programmatic API",
	CATEGORY_ASSIGNMENT_PRESETS: "Category Assignment Presets",
	UNLIMITED_CALENDARS: "Unlimited Calendars",
	UNLIMITED_EVENT_PRESETS: "Unlimited Event Presets",
} as const;

export type ProFeature = (typeof PRO_FEATURES)[keyof typeof PRO_FEATURES];

export class LicenseManager {
	private app: App;
	private settingsStore: SettingsStore;
	private pluginVersion: string;
	private deviceId = "";
	private cachedPublicKey: CryptoKey | null = null;
	private status: LicenseStatus = {
		state: "none",
		activationsCurrent: 0,
		activationsLimit: 5,
		expiresAt: null,
		errorMessage: null,
	};
	private onStatusChange: (() => void) | null = null;
	private readonly subject = new BehaviorSubject<boolean>(false);
	readonly isPro$: Observable<boolean> = this.subject.asObservable();

	get isPro(): boolean {
		return this.subject.getValue();
	}

	constructor(app: App, settingsStore: SettingsStore, pluginVersion: string) {
		this.app = app;
		this.settingsStore = settingsStore;
		this.pluginVersion = pluginVersion;
	}

	async initialize(): Promise<void> {
		this.deviceId = this.getOrCreateDeviceId();
		await this.loadCachedToken();
		await this.refreshLicense();
	}

	getStatus(): LicenseStatus {
		return { ...this.status };
	}

	setOnStatusChange(callback: () => void): void {
		this.onStatusChange = callback;
	}

	requirePro(featureName: string): boolean {
		if (this.isPro) return true;
		new Notice(`${featureName} requires Prisma Calendar Pro.\nVisit ${PRO_PURCHASE_URL} to learn more.`, 8000);
		return false;
	}

	async refreshLicense(): Promise<void> {
		const licenseKey = await this.getLicenseKey();
		if (!licenseKey) {
			this.updateStatus("none");
			return;
		}

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

			if (response.status === 200) {
				const data = response.json as LicenseVerifyResponse;
				const tokenResult = await this.verifyToken(data.token);
				if (tokenResult !== "valid") {
					this.updateStatus("error", "License token verification failed.");
					return;
				}
				this.cacheToken(data);
				this.activateLicense(data.activations.current, data.activations.limit, data.expiresAt);
				return;
			}

			if (response.status === 401) {
				this.clearCachedToken();
				this.updateStatus("invalid", "Invalid license key. Please check your key in settings.");
				return;
			}

			if (response.status === 403) {
				this.clearCachedToken();
				const body = response.json as { message?: string } | undefined;
				const isDeviceLimit = body?.message?.toLowerCase().includes("limit") ?? false;
				if (isDeviceLimit) {
					this.updateStatus(
						"device_limit",
						`Device limit reached (${this.status.activationsLimit} devices). Manage devices at matejvavroproductivity.com/account`
					);
				} else {
					this.updateStatus("invalid", "License expired or canceled.");
				}
				return;
			}

			await this.handleNetworkFailure();
		} catch {
			await this.handleNetworkFailure();
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

	private activateLicense(activationsCurrent: number, activationsLimit: number, expiresAt: string): void {
		this.status = {
			state: "valid",
			activationsCurrent,
			activationsLimit,
			expiresAt,
			errorMessage: null,
		};
		this.setLicenseActive(true);
		this.onStatusChange?.();
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

	private updateStatus(state: LicenseStatus["state"], errorMessage: string | null = null): void {
		this.status = {
			...this.status,
			state,
			errorMessage,
		};
		this.setLicenseActive(state === "valid");
		this.onStatusChange?.();
	}

	private getOrCreateDeviceId(): string {
		let id = this.app.loadLocalStorage(DEVICE_ID_STORAGE_KEY);
		if (!id) {
			id = crypto.randomUUID();
			this.app.saveLocalStorage(DEVICE_ID_STORAGE_KEY, id);
		}
		return id;
	}

	private async getLicenseKey(): Promise<string | null> {
		const secretName = this.settingsStore.currentSettings.licenseKeySecretName;
		if (!secretName) return null;
		return await this.app.secretStorage.getSecret(secretName);
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
		this.activateLicense(cached.activationsCurrent, cached.activationsLimit, cached.expiresAt);
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
		};
		this.app.saveLocalStorage(LICENSE_CACHE_STORAGE_KEY, JSON.stringify(cached));
	}

	private clearCachedToken(): void {
		this.app.saveLocalStorage(LICENSE_CACHE_STORAGE_KEY, "");
	}

	private readCacheFromStorage(): CachedLicenseData | null {
		const raw = this.app.loadLocalStorage(LICENSE_CACHE_STORAGE_KEY);
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
		return apiVersion ?? "unknown";
	}
}
