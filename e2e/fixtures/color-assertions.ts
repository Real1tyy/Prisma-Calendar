import { expect, type Locator } from "@playwright/test";

export async function expectBackgroundColor(locator: Locator, hex: string): Promise<void> {
	await expect
		.poll(
			() =>
				locator.evaluate((el, target) => {
					const probe = document.createElement("div");
					probe.style.backgroundColor = target;
					return getComputedStyle(el).backgroundColor === probe.style.backgroundColor;
				}, hex),
			{ message: `background should match ${hex}` }
		)
		.toBe(true);
}
