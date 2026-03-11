import { BehaviorSubject } from "rxjs";

import type { LicenseManager } from "../../license/license-manager";

export function createProLicenseStore(): LicenseManager {
	const subject = new BehaviorSubject<boolean>(true);
	return {
		get isPro() {
			return subject.getValue();
		},
		isPro$: subject.asObservable(),
		requirePro: () => true,
	} as unknown as LicenseManager;
}

export function createFreeLicenseStore(): LicenseManager {
	const subject = new BehaviorSubject<boolean>(false);
	return {
		get isPro() {
			return subject.getValue();
		},
		isPro$: subject.asObservable(),
		requirePro: () => false,
	} as unknown as LicenseManager;
}
