import * as fc from "fast-check";
import type { z } from "zod";
import type { VaultEvent } from "../../src/core/event-store";
import type { ParsedEvent } from "../../src/core/parser";
import { EventFrontmatterSchema, type ParsedEventFrontmatter } from "../../src/types/event-schemas";
import type { CustomCalendarSettings, SingleCalendarConfig } from "../../src/types/index";
import { CustomCalendarSettingsSchema, SingleCalendarConfigSchema } from "../../src/types/index";
import {
	type RRuleFrontmatter,
	RRuleFrontmatterSchema,
} from "../../src/types/recurring-event-schemas";

/**
 * Property-based test data generators using fast-check
 */
export class PropertyBasedFixtures {
	/**
	 * Generate arbitrary SingleCalendarConfig instances
	 */
	static singleCalendarConfig() {
		return fc.record({
			id: fc.string({ minLength: 1 }),
			name: fc.string({ minLength: 1 }),
			enabled: fc.boolean(),
			directory: fc.string(),
			timezone: fc.constantFrom("system", "UTC", "America/New_York", "Europe/London"),
			defaultDurationMinutes: fc.integer({ min: 15, max: 480 }),
			templatePath: fc.option(fc.string()),
			startProp: fc.string({ minLength: 1 }),
			endProp: fc.string({ minLength: 1 }),
			allDayProp: fc.string({ minLength: 1 }),
			titleProp: fc.option(fc.string({ minLength: 1 })),
			timezoneProp: fc.option(fc.string({ minLength: 1 })),
			zettelIdProp: fc.option(fc.string({ minLength: 1 })),
			rruleProp: fc.string({ minLength: 1 }),
			rruleSpecProp: fc.string({ minLength: 1 }),
			rruleIdProp: fc.string({ minLength: 1 }),
			thermometerProperties: fc.array(fc.string()),
			futureInstancesCount: fc.integer({ min: 1, max: 52 }),
			defaultView: fc.constantFrom(
				"dayGridMonth",
				"dayGridWeek",
				"timeGridWeek",
				"timeGridDay",
				"listWeek"
			),
			hideWeekends: fc.boolean(),
			hourStart: fc.integer({ min: 0, max: 23 }),
			hourEnd: fc.integer({ min: 1, max: 24 }),
			firstDayOfWeek: fc.integer({ min: 0, max: 6 }),
			slotDurationMinutes: fc.integer({ min: 1, max: 60 }),
			snapDurationMinutes: fc.integer({ min: 1, max: 60 }),
			zoomLevels: fc.array(fc.integer({ min: 1, max: 60 }), { minLength: 1 }),
			density: fc.constantFrom("comfortable", "compact"),
			enableEventPreview: fc.boolean(),
			nowIndicator: fc.boolean(),
			filterExpressions: fc.array(fc.string()),
			defaultEventColor: fc.string(),
			colorRules: fc.array(
				fc.record({
					id: fc.string(),
					expression: fc.string(),
					color: fc.string(),
					enabled: fc.boolean(),
				})
			),
		});
	}

	/**
	 * Generate arbitrary CustomCalendarSettings instances
	 */
	static customCalendarSettings() {
		return fc.record({
			version: fc.integer({ min: 1 }),
			calendars: fc.array(PropertyBasedFixtures.singleCalendarConfig(), {
				minLength: 1,
				maxLength: 5,
			}),
		});
	}

	/**
	 * Generate arbitrary event frontmatter
	 */
	static eventFrontmatter() {
		return fc.record({
			startTime: fc.date(),
			endTime: fc.option(fc.date()),
			allDay: fc.boolean(),
			title: fc.option(fc.string()),
			timezone: fc.option(fc.constantFrom("system", "UTC", "America/New_York", "Europe/London")),
		});
	}

	/**
	 * Generate arbitrary RRule frontmatter
	 */
	static rruleFrontmatter() {
		return fc.record({
			type: fc.constantFrom("daily", "weekly", "monthly", "yearly"),
			weekdays: fc.array(
				fc.constantFrom(
					"monday",
					"tuesday",
					"wednesday",
					"thursday",
					"friday",
					"saturday",
					"sunday"
				)
			),
			startTime: fc.string(),
			endTime: fc.option(fc.string()),
			allDay: fc.boolean(),
		});
	}

	/**
	 * Generate arbitrary ParsedEvent instances
	 */
	static parsedEvent() {
		return fc.record({
			id: fc.string({ minLength: 1 }),
			ref: fc.record({
				filePath: fc.string({ minLength: 1 }),
			}),
			title: fc.string({ minLength: 1 }),
			start: fc.date().map((d) => d.toISOString()),
			end: fc.option(fc.date().map((d) => d.toISOString())),
			allDay: fc.boolean(),
			isVirtual: fc.boolean(),
			timezone: fc.string(),
			color: fc.option(fc.string()),
			meta: fc.record({
				folder: fc.string(),
				originalStart: fc.option(fc.string()),
				originalEnd: fc.option(fc.string()),
			}),
		});
	}

	/**
	 * Generate arbitrary VaultEvent instances
	 */
	static vaultEvent() {
		return fc.record({
			id: fc.string({ minLength: 1 }),
			title: fc.string({ minLength: 1 }),
			start: fc.date().map((d) => d.toISOString()),
			end: fc.option(fc.date().map((d) => d.toISOString())),
			allDay: fc.boolean(),
			ref: fc.record({
				filePath: fc.string({ minLength: 1 }),
			}),
			meta: fc.record({
				folder: fc.string(),
				originalStart: fc.option(fc.string()),
				originalEnd: fc.option(fc.string()),
			}),
			color: fc.option(fc.string()),
			isVirtual: fc.option(fc.boolean()),
		});
	}
}

/**
 * Mock data generators using Zod schemas with defaults
 */
export class MockFixtures {
	/**
	 * Generate a mock SingleCalendarConfig
	 */
	static singleCalendarConfig(overrides?: Partial<SingleCalendarConfig>): SingleCalendarConfig {
		const base = SingleCalendarConfigSchema.parse({
			id: "mock-calendar",
			name: "Mock Calendar",
			enabled: true,
		});
		return { ...base, ...overrides };
	}

	/**
	 * Generate a mock CustomCalendarSettings
	 */
	static customCalendarSettings(
		overrides?: Partial<CustomCalendarSettings>
	): CustomCalendarSettings {
		const base = CustomCalendarSettingsSchema.parse({
			version: 1,
			calendars: [
				{
					id: "mock-calendar",
					name: "Mock Calendar",
					enabled: true,
				},
			],
		});
		return { ...base, ...overrides };
	}

	/**
	 * Generate mock event frontmatter
	 */
	static eventFrontmatter(overrides?: Partial<any>): any {
		const base = {
			startTime: "2024-01-15T10:00:00Z",
			endTime: "2024-01-15T11:00:00Z",
			allDay: false,
			title: "Mock Event",
			timezone: "system",
		};
		return { ...base, ...overrides };
	}

	/**
	 * Generate mock RRule frontmatter
	 */
	static rruleFrontmatter(overrides?: Partial<any>): any {
		const base = {
			type: "daily" as const,
			weekdays: null, // Schema expects string or null, gets transformed to array
			startTime: "2024-01-15T10:00:00",
			endTime: "2024-01-15T11:00:00",
			allDay: false,
		};
		return { ...base, ...overrides };
	}

	/**
	 * Generate a mock ParsedEvent
	 */
	static parsedEvent(overrides?: Partial<ParsedEvent>): ParsedEvent {
		const base: ParsedEvent = {
			id: `event-${Math.random().toString(36).substr(2, 9)}`,
			ref: { filePath: `Events/event-${Date.now()}.md` },
			title: `Mock Event ${Math.random().toString(36).substr(2, 5)}`,
			start: new Date().toISOString(),
			end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
			allDay: false,
			isVirtual: false,
			timezone: "system",
			color: undefined,
			meta: {
				folder: "Events",
				originalStart: "2024-01-15 10:00",
				originalEnd: "2024-01-15 11:00",
			},
		};
		return { ...base, ...overrides };
	}

	/**
	 * Generate a mock VaultEvent
	 */
	static vaultEvent(overrides?: Partial<VaultEvent>): VaultEvent {
		const base: VaultEvent = {
			id: `vault-event-${Math.random().toString(36).substr(2, 9)}`,
			title: `Mock Vault Event ${Math.random().toString(36).substr(2, 5)}`,
			start: new Date().toISOString(),
			end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
			allDay: false,
			ref: { filePath: `Events/vault-event-${Date.now()}.md` },
			meta: {
				folder: "Events",
				originalStart: "2024-01-15 10:00",
				originalEnd: "2024-01-15 11:00",
			},
			color: undefined,
			isVirtual: false,
		};
		return { ...base, ...overrides };
	}

	/**
	 * Generate multiple mock instances
	 */
	static multiple<T>(generator: () => T, count: number): T[] {
		return Array.from({ length: count }, generator);
	}
}

/**
 * Common test scenarios and edge cases
 */
export class TestScenarios {
	/**
	 * Generate edge case scenarios for event testing
	 */
	static eventEdgeCases() {
		return [
			// All-day event
			MockFixtures.parsedEvent({
				allDay: true,
				end: undefined,
				start: "2024-01-15T00:00:00.000Z",
			}),
			// Multi-day event
			MockFixtures.parsedEvent({
				start: "2024-01-15T10:00:00.000Z",
				end: "2024-01-17T15:00:00.000Z",
				allDay: false,
			}),
			// Virtual recurring event instance
			MockFixtures.parsedEvent({
				isVirtual: true,
				id: "recurring-event-2024-01-15",
			}),
			// Event with custom timezone
			MockFixtures.parsedEvent({
				timezone: "America/New_York",
			}),
			// Event with color
			MockFixtures.parsedEvent({
				color: "#ff5733",
			}),
		];
	}

	/**
	 * Generate settings edge cases
	 */
	static settingsEdgeCases() {
		return [
			// Minimal settings
			MockFixtures.customCalendarSettings({
				calendars: [
					MockFixtures.singleCalendarConfig({
						id: "minimal",
						name: "Minimal Calendar",
						directory: "",
					}),
				],
			}),
			// Maximum calendars
			MockFixtures.customCalendarSettings({
				calendars: Array.from({ length: 5 }, (_, i) =>
					MockFixtures.singleCalendarConfig({
						id: `calendar-${i}`,
						name: `Calendar ${i}`,
					})
				),
			}),
			// Complex filter rules
			MockFixtures.customCalendarSettings({
				calendars: [
					MockFixtures.singleCalendarConfig({
						filterExpressions: [
							"fm.Status === 'Done'",
							"fm.Priority !== 'Low'",
							"fm.Tags && fm.Tags.includes('important')",
						],
						colorRules: [
							{
								id: "high-priority",
								expression: "fm.Priority === 'High'",
								color: "#ff0000",
								enabled: true,
							},
							{
								id: "completed",
								expression: "fm.Status === 'Done'",
								color: "#00ff00",
								enabled: true,
							},
						],
					}),
				],
			}),
		];
	}

	/**
	 * Generate invalid data scenarios for error testing
	 */
	static invalidDataScenarios() {
		return {
			invalidSettings: [
				// Empty calendars array
				{ calendars: [] },
				// Too many calendars
				{
					calendars: Array.from({ length: 10 }, (_, i) => ({
						id: `calendar-${i}`,
						name: `Calendar ${i}`,
					})),
				},
				// Invalid timezone
				{
					calendars: [
						{
							id: "invalid-tz",
							name: "Invalid Timezone",
							timezone: "Invalid/Timezone",
						},
					],
				},
			],
			invalidEventFrontmatter: [
				// Missing required start time
				{ title: "Event without start" },
				// Invalid date format
				{ startTime: "not-a-date", title: "Invalid date" },
				// All-day with end time (violates schema refinement)
				{
					startTime: "2024-01-15T10:00:00",
					endTime: "2024-01-15T11:00:00",
					allDay: true,
				},
			],
		};
	}
}

/**
 * Invariant testing helpers
 */
export class InvariantHelpers {
	/**
	 * Test that a function preserves certain properties
	 */
	static preservesProperty<T, R>(
		fn: (input: T) => R,
		property: (input: T, output: R) => boolean,
		description: string
	) {
		return {
			fn,
			property,
			description,
		};
	}

	/**
	 * Test that a function is idempotent (f(f(x)) === f(x))
	 */
	static isIdempotent<T>(fn: (input: T) => T, description: string) {
		return InvariantHelpers.preservesProperty(
			fn,
			(input: T, output: T) => {
				const secondOutput = fn(output);
				return JSON.stringify(secondOutput) === JSON.stringify(output);
			},
			`${description} should be idempotent`
		);
	}

	/**
	 * Test that a function always returns valid output according to a schema
	 */
	static returnsValidOutput<T, R>(
		fn: (input: T) => R,
		outputSchema: z.ZodSchema<R>,
		description: string
	) {
		return InvariantHelpers.preservesProperty(
			fn,
			(_input: T, output: R) => {
				try {
					outputSchema.parse(output);
					return true;
				} catch {
					return false;
				}
			},
			`${description} should always return valid output`
		);
	}

	/**
	 * Test that a function handles edge cases gracefully
	 */
	static handlesEdgeCases<T, R>(
		fn: (input: T) => R,
		edgeCases: T[],
		predicate: (output: R) => boolean,
		description: string
	) {
		return {
			fn,
			edgeCases,
			predicate,
			description,
		};
	}
}
