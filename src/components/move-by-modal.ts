import { type App, Modal } from "obsidian";

const TIME_UNITS = ["minutes", "hours", "days", "weeks", "months", "years"] as const;

export type TimeUnit = (typeof TIME_UNITS)[number];
export type Direction = "plus" | "minus";

export interface MoveByResult {
	value: number;
	unit: TimeUnit;
	direction: Direction;
}

export class MoveByModal extends Modal {
	private valueInput!: HTMLInputElement;
	private selectedDirection: Direction = "plus";
	private selectedUnit: TimeUnit = "minutes";
	private onSubmit: (result: MoveByResult) => void;

	private directionButtons: Map<Direction, HTMLButtonElement> = new Map();
	private unitButtons: Map<TimeUnit, HTMLButtonElement> = new Map();

	constructor(app: App, onSubmit: (result: MoveByResult) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("move-by-modal");

		contentEl.createEl("h3", { text: "Move Event By" });

		const formContainer = contentEl.createDiv("move-by-form");

		// Direction buttons
		const directionContainer = formContainer.createDiv("move-by-row");
		directionContainer.createEl("div", { text: "Direction", cls: "move-by-label" });
		const directionButtons = directionContainer.createDiv("move-by-button-group");

		const plusBtn = directionButtons.createEl("button", { text: "+", cls: "move-by-btn" });
		const minusBtn = directionButtons.createEl("button", { text: "−", cls: "move-by-btn" });

		this.directionButtons.set("plus", plusBtn);
		this.directionButtons.set("minus", minusBtn);

		plusBtn.addEventListener("click", () => this.selectDirection("plus"));
		minusBtn.addEventListener("click", () => this.selectDirection("minus"));

		// Amount input with increment/decrement buttons
		const amountContainer = formContainer.createDiv("move-by-row");
		amountContainer.createEl("div", { text: "Amount", cls: "move-by-label" });
		const amountInputGroup = amountContainer.createDiv("move-by-amount-group");

		const decrementBtn = amountInputGroup.createEl("button", { text: "−", cls: "move-by-increment-btn" });
		this.valueInput = amountInputGroup.createEl("input", {
			type: "number",
			value: "15",
			cls: "move-by-input",
			attr: {
				min: "1",
				step: "1",
			},
		});
		const incrementBtn = amountInputGroup.createEl("button", { text: "+", cls: "move-by-increment-btn" });

		decrementBtn.addEventListener("click", () => this.adjustValue(-1));
		incrementBtn.addEventListener("click", () => this.adjustValue(1));

		// Time unit buttons
		const unitContainer = formContainer.createDiv("move-by-row");
		unitContainer.createEl("div", { text: "Time Unit", cls: "move-by-label" });
		const unitButtons = unitContainer.createDiv("move-by-unit-group");

		for (const unit of TIME_UNITS) {
			const label = unit.charAt(0).toUpperCase() + unit.slice(1);
			const btn = unitButtons.createEl("button", { text: label, cls: "move-by-unit-btn" });
			this.unitButtons.set(unit, btn);
			btn.addEventListener("click", () => this.selectUnit(unit));
		}

		// Action buttons
		const buttonContainer = contentEl.createDiv("modal-button-container");

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
		this.selectDirection("plus");
		this.selectUnit("minutes");

		// Focus on value input
		this.valueInput.focus();
		this.valueInput.select();
	}

	private selectDirection(direction: Direction): void {
		this.selectedDirection = direction;
		for (const [dir, btn] of this.directionButtons.entries()) {
			if (dir === direction) {
				btn.addClass("is-active");
			} else {
				btn.removeClass("is-active");
			}
		}
	}

	private selectUnit(unit: TimeUnit): void {
		this.selectedUnit = unit;
		for (const [u, btn] of this.unitButtons.entries()) {
			if (u === unit) {
				btn.addClass("is-active");
			} else {
				btn.removeClass("is-active");
			}
		}
	}

	private adjustValue(delta: number): void {
		const currentValue = Number.parseInt(this.valueInput.value, 10);
		if (Number.isNaN(currentValue)) {
			this.valueInput.value = "1";
			return;
		}
		const newValue = Math.max(1, currentValue + delta);
		this.valueInput.value = String(newValue);
	}

	private submit(): void {
		const value = Number.parseInt(this.valueInput.value, 10);

		if (Number.isNaN(value) || value <= 0) {
			return;
		}

		const result: MoveByResult = {
			value,
			unit: this.selectedUnit,
			direction: this.selectedDirection,
		};

		this.onSubmit(result);
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
