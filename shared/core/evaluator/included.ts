import type { BehaviorSubject } from "rxjs";

export interface PathIncludedProperties {
	id: string;
	path: string;
	includedProperties: string[];
	enabled: boolean;
}

/**
 * Generic evaluator for determining which properties to include in Bases view columns.
 *
 * Logic:
 * 1. ALWAYS includes the default included properties
 * 2. Checks if the file's path matches any path-based inclusion rules
 * 3. First matching path rule's properties are ADDED to the default inclusion list
 * 4. Returns the combined set of included properties in order:
 *    - file.name (always first)
 *    - default included properties (in specified order)
 *    - path-specific included properties (in specified order)
 */
export class IncludedPropertiesEvaluator<
	TSettings extends {
		defaultBasesIncludedProperties: string[];
		pathBasesIncludedProperties: PathIncludedProperties[];
	},
> {
	private defaultIncludedProperties!: string[];

	private pathRules!: PathIncludedProperties[];

	constructor(settingsObservable: BehaviorSubject<TSettings>) {
		const assignSettings = (settings: TSettings) => {
			this.defaultIncludedProperties = settings.defaultBasesIncludedProperties;
			this.pathRules = settings.pathBasesIncludedProperties.filter((rule) => rule.enabled);
		};

		assignSettings(settingsObservable.value);
		settingsObservable.subscribe(assignSettings);
	}

	/**
	 * Evaluate which properties should be included in the order array for a given file path.
	 * Returns an array with "file.name" as the first element, followed by default and path-specific properties.
	 *
	 * @param filePath - The file path to match against path rules
	 * @returns Array of property names to include in the order (file.name + defaults + path rule matches)
	 */
	evaluateIncludedProperties(filePath: string): string[] {
		// Always start with file.name
		const includedProperties = ["file.name"];

		// Add default included properties
		for (const prop of this.defaultIncludedProperties) {
			if (!includedProperties.includes(prop)) {
				includedProperties.push(prop);
			}
		}

		// Find first matching path rule and add its included properties
		const match = this.pathRules.find((rule) => filePath.startsWith(rule.path));

		if (match) {
			// Add path-specific included properties to the defaults
			for (const prop of match.includedProperties) {
				if (!includedProperties.includes(prop)) {
					includedProperties.push(prop);
				}
			}
		}

		return includedProperties;
	}
}
