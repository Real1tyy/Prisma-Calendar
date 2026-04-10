import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { type Diagnostic,linter } from "@codemirror/lint";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, highlightActiveLine, keymap, lineNumbers,placeholder as cmPlaceholder } from "@codemirror/view";

function jsonLinter(): Extension {
	return linter((view) => {
		const doc = view.state.doc.toString();
		if (!doc.trim()) return [];
		try {
			JSON.parse(doc);
			return [];
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			const posMatch = message.match(/position (\d+)/);
			const pos = posMatch ? Math.min(Number(posMatch[1]), doc.length) : 0;
			const diagnostics: Diagnostic[] = [{ from: pos, to: Math.min(pos + 1, doc.length), severity: "error", message }];
			return diagnostics;
		}
	});
}

export interface CodeEditorConfig {
	parent: HTMLElement;
	initialValue?: string;
	language?: "json" | "plain";
	onChange?: (value: string) => void;
	showLineNumbers?: boolean;
	placeholder?: string;
}

export interface CodeEditorInstance {
	getValue(): string;
	setValue(value: string): void;
	destroy(): void;
	readonly view: EditorView;
}

export function createCodeEditor(config: CodeEditorConfig): CodeEditorInstance {
	const extensions: Extension[] = [
		highlightActiveLine(),
		bracketMatching(),
		closeBrackets(),
		indentOnInput(),
		syntaxHighlighting(defaultHighlightStyle),
		history(),
		keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
		EditorView.lineWrapping,
	];

	if (config.showLineNumbers) {
		extensions.push(lineNumbers());
	}

	if (config.language === "json") {
		extensions.push(jsonLinter());
	}

	if (config.placeholder) {
		extensions.push(cmPlaceholder(config.placeholder));
	}

	if (config.onChange) {
		const onChange = config.onChange;
		extensions.push(
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					onChange(update.state.doc.toString());
				}
			})
		);
	}

	const view = new EditorView({
		state: EditorState.create({
			doc: config.initialValue ?? "",
			extensions,
		}),
		parent: config.parent,
	});

	return {
		getValue: () => view.state.doc.toString(),
		setValue: (value: string) => {
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: value },
			});
		},
		destroy: () => view.destroy(),
		view,
	};
}
