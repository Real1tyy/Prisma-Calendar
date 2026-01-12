import { addCls, cls, removeCls } from "@real1ty-obsidian-plugins/utils";
import { type App, Modal } from "obsidian";

const TIME_UNITS = ["minutes", "hours", "days", "weeks", "months", "years"] as const;

export type TimeUnit = (typeof TIME_UNITS)[number];

export interface MoveByResult {
	value: number;
	unit: TimeUnit;
}

export class MoveByModal extends Modal {
	private valueInput!: HTMLInputElement;
	private selectedUnit: TimeUnit = "minutes";
	private onSubmit: (result: MoveByResult) => void;

	private unitButtons: Map<TimeUnit, HTMLButtonElement> = new Map();

	constructor(app: App, onSubmit: (result: MoveByResult) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		addCls(contentEl, "move-by-modal");

		contentEl.createEl("h3", { text: "Move event by" });

		const formContainer = contentEl.createDiv(cls("move-by-form"));

		// Amount input with increment/decrement/toggle buttons
		const amountContainer = formContainer.createDiv(cls("move-by-row"));
		amountContainer.createEl("div", { text: "Amount", cls: cls("move-by-label") });
		const amountInputGroup = amountContainer.createDiv(cls("move-by-amount-group"));

		const decrementBtn = amountInputGroup.createEl("button", { text: "−", cls: cls("move-by-increment-btn") });
		this.valueInput = amountInputGroup.createEl("input", {
			type: "number",
			value: "15",
			cls: cls("move-by-input"),
			attr: {
				step: "1",
			},
		});
		const incrementBtn = amountInputGroup.createEl("button", { text: "+", cls: cls("move-by-increment-btn") });
		const toggleBtn = amountInputGroup.createEl("button", { text: "+/−", cls: cls("move-by-toggle-btn") });
		toggleBtn.setAttribute("aria-label", "Toggle sign");

		decrementBtn.addEventListener("click", () => this.adjustValue(-1));
		incrementBtn.addEventListener("click", () => this.adjustValue(1));
		toggleBtn.addEventListener("click", () => this.toggleSign());

		// Time unit buttons
		const unitContainer = formContainer.createDiv(cls("move-by-row"));
		unitContainer.createEl("div", { text: "Time unit", cls: cls("move-by-label") });
		const unitButtons = unitContainer.createDiv(cls("move-by-unit-group"));

		for (const unit of TIME_UNITS) {
			const label = unit.charAt(0).toUpperCase() + unit.slice(1);
			const btn = unitButtons.createEl("button", { text: label, cls: cls("move-by-unit-btn") });
			this.unitButtons.set(unit, btn);
			btn.addEventListener("click", () => this.selectUnit(unit));
		}

		// Action buttons
		const buttonContainer = contentEl.createDiv(cls("modal-button-container"));

		const submitButton = buttonContainer.createEl("button", {
			text: "Move",
			cls: "mod-cta",
		});
		submitButton.addEventListener("click", () => {
			this.submit();
		});

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
		});
		cancelButton.addEventListener("click", () => {
			this.close();
		});

		// Handle Enter key
		contentEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey) {
				e.preventDefault();
				this.submit();
			}
		});

		// Initialize selection states
		this.selectUnit("minutes");

		setTimeout(() => {
			this.valueInput.focus();
			this.valueInput.select();
		}, 50);
	}

	private selectUnit(unit: TimeUnit): void {
		this.selectedUnit = unit;
		for (const [u, btn] of this.unitButtons.entries()) {
			if (u === unit) {
				addCls(btn, "is-active");
			} else {
				removeCls(btn, "is-active");
			}
		}
	}

	private adjustValue(delta: number): void {
		const currentValue = Number.parseInt(this.valueInput.value, 10);
		if (Number.isNaN(currentValue)) {
			this.valueInput.value = "1";
			return;
		}
		const newValue = currentValue + delta;
		// Don't allow zero
		if (newValue === 0) {
			this.valueInput.value = delta > 0 ? "1" : "-1";
			return;
		}
		this.valueInput.value = String(newValue);
	}

	private toggleSign(): void {
		const currentValue = Number.parseInt(this.valueInput.value, 10);
		if (Number.isNaN(currentValue)) {
			this.valueInput.value = "1";
			return;
		}
		this.valueInput.value = String(-currentValue);
	}

	private submit(): void {
		const value = Number.parseInt(this.valueInput.value, 10);

		if (Number.isNaN(value) || value === 0) {
			return;
		}

		const result: MoveByResult = {
			value,
			unit: this.selectedUnit,
		};

		this.onSubmit(result);
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
