import type { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_EVENT_COLOR } from "../../src/types/settings-schemas";
import { ColorEvaluator, type ColorRule } from "../../src/utils/color-evaluator";
import { createMockSingleCalendarSettings, createMockSingleCalendarSettingsStore } from "../setup";

describe("ColorEvaluator", () => {
	let settingsSubject: BehaviorSubject<any>;
	let colorEvaluator: ColorEvaluator;
	let mockSingleCalendarSettings: any;

	beforeEach(() => {
		mockSingleCalendarSettings = createMockSingleCalendarSettings();
		settingsSubject = createMockSingleCalendarSettingsStore();
		colorEvaluator = new ColorEvaluator(settingsSubject);
	});

	afterEach(() => {
		colorEvaluator.destroy();
	});

	describe("Color evaluation", () => {
		it("should return default color when no rules are defined", () => {
			const frontmatter = { status: "active", priority: "high" };
			const color = colorEvaluator.evaluateColor(frontmatter);
			expect(color).toBe(DEFAULT_EVENT_COLOR);
		});

		it("should return default color when no rules match", () => {
			const colorRules: ColorRule[] = [
				{
					id: "rule1",
					expression: "fm.status === 'completed'",
					color: "green",
					enabled: true,
				},
				{
					id: "rule2",
					expression: "fm.priority === 'low'",
					color: "blue",
					enabled: true,
				},
			];

			settingsSubject.next({ ...mockSingleCalendarSettings, colorRules });

			const frontmatter = { status: "active", priority: "high" };
			const color = colorEvaluator.evaluateColor(frontmatter);
			expect(color).toBe(DEFAULT_EVENT_COLOR);
		});

		it("should return color from first matching rule", () => {
			const colorRules: ColorRule[] = [
				{
					id: "rule1",
					expression: "fm.priority === 'high'",
					color: "red",
					enabled: true,
				},
				{
					id: "rule2",
					expression: "fm.status === 'active'",
					color: "blue",
					enabled: true,
				},
			];

			settingsSubject.next({ ...mockSingleCalendarSettings, colorRules });

			const frontmatter = { status: "active", priority: "high" };
			const color = colorEvaluator.evaluateColor(frontmatter);
			expect(color).toBe("red"); // First rule should match
		});

		it("should skip disabled rules", () => {
			const colorRules: ColorRule[] = [
				{
					id: "rule1",
					expression: "fm.priority === 'high'",
					color: "red",
					enabled: false, // Disabled
				},
				{
					id: "rule2",
					expression: "fm.status === 'active'",
					color: "blue",
					enabled: true,
				},
			];

			settingsSubject.next({ ...mockSingleCalendarSettings, colorRules });

			const frontmatter = { status: "active", priority: "high" };
			const color = colorEvaluator.evaluateColor(frontmatter);
			expect(color).toBe("blue"); // Second rule should match (first is disabled)
		});

		it("should handle complex expressions", () => {
			const colorRules: ColorRule[] = [
				{
					id: "rule1",
					expression: "fm.priority === 'high' && fm.status !== 'completed'",
					color: "orange",
					enabled: true,
				},
			];

			settingsSubject.next({ ...mockSingleCalendarSettings, colorRules });

			const frontmatter = { status: "active", priority: "high" };
			const color = colorEvaluator.evaluateColor(frontmatter);
			expect(color).toBe("orange");
		});

		it("should handle array properties", () => {
			const colorRules: ColorRule[] = [
				{
					id: "rule1",
					expression: "Array.isArray(fm.tags) && fm.tags.includes('urgent')",
					color: "red",
					enabled: true,
				},
			];

			settingsSubject.next({ ...mockSingleCalendarSettings, colorRules });

			const frontmatter = { tags: ["urgent", "work"] };
			const color = colorEvaluator.evaluateColor(frontmatter);
			expect(color).toBe("red");
		});

		it("should handle missing properties gracefully", () => {
			const colorRules: ColorRule[] = [
				{
					id: "rule1",
					expression: "fm.nonexistent === 'value'",
					color: "red",
					enabled: true,
				},
			];

			settingsSubject.next({ ...mockSingleCalendarSettings, colorRules });

			const frontmatter = { status: "active" };
			const color = colorEvaluator.evaluateColor(frontmatter);
			expect(color).toBe(DEFAULT_EVENT_COLOR); // Should return default
		});
	});

	describe("Error handling", () => {
		it("should ignore rules with invalid expressions", () => {
			const colorRules: ColorRule[] = [
				{
					id: "rule1",
					expression: "invalid syntax here",
					color: "red",
					enabled: true,
				},
				{
					id: "rule2",
					expression: "fm.status === 'active'",
					color: "blue",
					enabled: true,
				},
			];

			settingsSubject.next({ ...mockSingleCalendarSettings, colorRules });

			const frontmatter = { status: "active" };
			const color = colorEvaluator.evaluateColor(frontmatter);
			expect(color).toBe("blue"); // Should skip invalid rule and use valid one
		});

		it("should handle runtime errors in expressions", () => {
			const colorRules: ColorRule[] = [
				{
					id: "rule1",
					expression: "fm.obj.nested.property === 'value'", // Will throw if obj is undefined
					color: "red",
					enabled: true,
				},
				{
					id: "rule2",
					expression: "fm.status === 'active'",
					color: "blue",
					enabled: true,
				},
			];

			settingsSubject.next({ ...mockSingleCalendarSettings, colorRules });

			const frontmatter = { status: "active" }; // No 'obj' property
			const color = colorEvaluator.evaluateColor(frontmatter);
			expect(color).toBe("blue"); // Should skip erroring rule and use valid one
		});
	});

	describe("Settings updates", () => {
		it("should recompile rules when settings change", () => {
			// Start with no rules
			const frontmatter = { status: "active" };
			let color = colorEvaluator.evaluateColor(frontmatter);
			expect(color).toBe(DEFAULT_EVENT_COLOR);

			// Add a rule
			const colorRules: ColorRule[] = [
				{
					id: "rule1",
					expression: "fm.status === 'active'",
					color: "green",
					enabled: true,
				},
			];

			settingsSubject.next({ ...mockSingleCalendarSettings, colorRules });

			color = colorEvaluator.evaluateColor(frontmatter);
			expect(color).toBe("green");
		});

		it("should update default color when settings change", () => {
			const frontmatter = { status: "inactive" };

			// Check initial default color
			let color = colorEvaluator.evaluateColor(frontmatter);
			expect(color).toBe(DEFAULT_EVENT_COLOR);

			// Change default color
			settingsSubject.next({
				...mockSingleCalendarSettings,
				defaultEventColor: "hsl(120, 70%, 50%)",
			});

			color = colorEvaluator.evaluateColor(frontmatter);
			expect(color).toBe("hsl(120, 70%, 50%)");
		});
	});

	describe("Cleanup", () => {
		it("should clean up subscriptions on destroy", () => {
			const subscription = settingsSubject.subscribe();
			expect(subscription.closed).toBe(false);

			colorEvaluator.destroy();

			// The ColorEvaluator should have unsubscribed from settings
			// We can't directly test this, but we can verify it doesn't crash
			settingsSubject.next({ ...mockSingleCalendarSettings, defaultEventColor: "red" });
		});
	});
});
