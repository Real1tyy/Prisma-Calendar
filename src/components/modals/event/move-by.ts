import { addCls, cls, removeCls, showModal } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import { type MoveByResult, TIME_UNITS, type TimeUnit } from "../../../types/move-by";
import { createModalButtons, registerSubmitHotkey } from "../../../utils/dom-utils";

function renderMoveByForm(el: HTMLElement, onSubmit: (result: MoveByResult) => void, close: () => void): void {
	el.createEl("h3", { text: "Move event by" });

	const formContainer = el.createDiv(cls("move-by-form"));

	let selectedUnit: TimeUnit = "minutes";
	const unitButtons = new Map<TimeUnit, HTMLButtonElement>();

	const amountContainer = formContainer.createDiv(cls("move-by-row"));
	amountContainer.createEl("div", { text: "Amount", cls: cls("move-by-label") });
	const amountInputGroup = amountContainer.createDiv(cls("move-by-amount-group"));

	const decrementBtn = amountInputGroup.createEl("button", { text: "−", cls: cls("move-by-increment-btn") });
	const valueInput = amountInputGroup.createEl("input", {
		type: "number",
		value: "15",
		cls: cls("move-by-input"),
		attr: { step: "1" },
	});
	const incrementBtn = amountInputGroup.createEl("button", { text: "+", cls: cls("move-by-increment-btn") });
	const toggleBtn = amountInputGroup.createEl("button", { text: "+/−", cls: cls("move-by-toggle-btn") });
	toggleBtn.setAttribute("aria-label", "Toggle sign");

	function adjustValue(delta: number): void {
		const currentValue = Number.parseInt(valueInput.value, 10);
		if (Number.isNaN(currentValue)) {
			valueInput.value = "1";
			return;
		}
		const newValue = currentValue + delta;
		if (newValue === 0) {
			valueInput.value = delta > 0 ? "1" : "-1";
			return;
		}
		valueInput.value = String(newValue);
	}

	function toggleSign(): void {
		const currentValue = Number.parseInt(valueInput.value, 10);
		if (Number.isNaN(currentValue)) {
			valueInput.value = "1";
			return;
		}
		valueInput.value = String(-currentValue);
	}

	function selectUnit(unit: TimeUnit): void {
		selectedUnit = unit;
		for (const [u, btn] of unitButtons.entries()) {
			if (u === unit) {
				addCls(btn, "is-active");
			} else {
				removeCls(btn, "is-active");
			}
		}
	}

	function submit(): void {
		const value = Number.parseInt(valueInput.value, 10);
		if (Number.isNaN(value) || value === 0) return;
		onSubmit({ value, unit: selectedUnit });
		close();
	}

	decrementBtn.addEventListener("click", () => adjustValue(-1));
	incrementBtn.addEventListener("click", () => adjustValue(1));
	toggleBtn.addEventListener("click", toggleSign);

	const unitContainer = formContainer.createDiv(cls("move-by-row"));
	unitContainer.createEl("div", { text: "Time unit", cls: cls("move-by-label") });
	const unitBtnGroup = unitContainer.createDiv(cls("move-by-unit-group"));

	for (const unit of TIME_UNITS) {
		const label = unit.charAt(0).toUpperCase() + unit.slice(1);
		const btn = unitBtnGroup.createEl("button", { text: label, cls: cls("move-by-unit-btn") });
		unitButtons.set(unit, btn);
		btn.addEventListener("click", () => selectUnit(unit));
	}

	createModalButtons(el, {
		submitText: "Move",
		onSubmit: submit,
		onCancel: close,
	});

	selectUnit("minutes");

	setTimeout(() => {
		valueInput.focus();
		valueInput.select();
	}, 50);
}

export function showMoveByModal(app: App, onSubmit: (result: MoveByResult) => void): void {
	showModal({
		app,
		cls: cls("move-by-modal"),
		render: (el, ctx) => {
			renderMoveByForm(el, onSubmit, ctx.close);
			if (ctx.type === "modal") {
				registerSubmitHotkey(ctx.scope, () => {
					const valueInput = el.querySelector<HTMLInputElement>(`.${cls("move-by-input")}`);
					const value = Number.parseInt(valueInput?.value ?? "", 10);
					if (Number.isNaN(value) || value === 0) return;
					const activeBtn = el.querySelector(`.${cls("move-by-unit-btn")}.prisma-is-active`);
					const unit = (activeBtn?.textContent?.toLowerCase() as TimeUnit) || "minutes";
					onSubmit({ value, unit });
					ctx.close();
				});
			}
		},
	});
}
