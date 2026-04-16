import { readFileSync } from "node:fs";

import { obsidianCssVars, type ObsidianTheme } from "./css-vars";

export interface HarnessOptions {
	theme: ObsidianTheme;
	title: string;
	/** Already-read plugin CSS (e.g. compiled `styles.css`). Inlined into the harness document. */
	pluginStyles: string;
	/** CSS width of the #root container. Default: "480px". */
	width?: string | undefined;
	/** Extra CSS appended after the plugin styles. */
	extraCss?: string | undefined;
}

/** Build a standalone HTML document that renders the given body content with Obsidian's theme. */
export function buildHarnessHtml(bodyInnerHtml: string, options: HarnessOptions): string {
	const { theme, title, pluginStyles, width = "480px", extraCss = "" } = options;
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>${obsidianCssVars(theme)}</style>
<style>${pluginStyles}</style>
<style>
  #root {
    width: ${width};
    padding: 0;
    box-sizing: border-box;
  }
  ${extraCss}
</style>
</head>
<body>
<div id="root">${bodyInnerHtml}</div>
</body>
</html>`;
}

/**
 * Read a plugin's compiled `styles.css` from disk. Throws a helpful error pointing at
 * `pnpm build:css` if the file isn't there yet.
 */
export function readPluginStyles(stylesPath: string): string {
	try {
		return readFileSync(stylesPath, "utf-8");
	} catch {
		throw new Error(
			`Could not read ${stylesPath}. Run 'pnpm build:css' in the plugin before generating visual fixtures.`
		);
	}
}
