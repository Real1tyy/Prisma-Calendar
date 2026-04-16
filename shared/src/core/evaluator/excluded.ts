import type { BehaviorSubject } from "rxjs";

export interface PathExcludedProperties {
	id: string;
	path: string;
	excludedProperties: string[];
	enabled: boolean;
}

/**
 * Generic evaluator for determining which frontmatter properties to exclude when creating new nodes.
 *
 * Logic:
 * 1. ALWAYS includes the default excluded properties (e.g., Parent, Child, Related, _ZettelID)
 * 2. Checks if the source file's path matches any path-based exclusion rules
 * 3. First matching path rule's properties are ADDED to the default exclusion list
 * 4. Returns the combined set of excluded properties
 */
export class ExcludedPropertiesEvaluator<
	TSettings extends {
		defaultExcludedProperties: string[];
		pathExcludedProperties: PathExcludedProperties[];
	},
> {
	private defaultExcludedProperties!: string[];

	private pathRules!: PathExcludedProperties[];

	constructor(settingsObservable: BehaviorSubject<TSettings>) {
		const assignSettings = (settings: TSettings) => {
			this.defaultExcludedProperties = settings.defaultExcludedProperties;
			this.pathRules = settings.pathExcludedProperties.filter((rule) => rule.enabled);
		};

		assignSettings(settingsObservable.value);
		settingsObservable.subscribe(assignSettings);
	}

	/**
	 * Evaluate which properties should be excluded for a given file path.
	 *
	 * @param filePath - The file path to match against path rules
	 * @returns Array of property names to exclude (always includes defaults + path rule matches)
	 */
	evaluateExcludedProperties(filePath: string): string[] {
		// Always start with default excluded properties
		const excludedProperties = [...this.defaultExcludedProperties];

		// Find first matching path rule and add its excluded properties
		const match = this.pathRules.find((rule) => filePath.startsWith(rule.path));

		if (match) {
			// Add path-specific excluded properties to the defaults
			for (const prop of match.excludedProperties) {
				if (!excludedProperties.includes(prop)) {
					excludedProperties.push(prop);
				}
			}
		}

		return excludedProperties;
	}
}
