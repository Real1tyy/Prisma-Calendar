import type { TestCase, TestError, TestResult } from "@playwright/test/reporter";
import { describe, expect, it, vi } from "vitest";

import DepsInFluxReporter from "../../src/testing/e2e/infra-error-reporter";

const fakeTest = (title: string): TestCase => ({ titlePath: () => ["", "specs", title] }) as unknown as TestCase;
const resultWith = (...errors: TestError[]): TestResult => ({ errors }) as unknown as TestResult;

/** Run the reporter against a set of test results and capture everything it writes to stderr. */
function captureRun(feed: (reporter: DepsInFluxReporter) => void): string {
	const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
	try {
		const reporter = new DepsInFluxReporter();
		feed(reporter);
		reporter.onEnd();
		return spy.mock.calls.map((call) => String(call[0])).join("");
	} finally {
		spy.mockRestore();
	}
}

describe("DepsInFluxReporter", () => {
	it("emits the ENVIRONMENT IN FLUX summary naming the affected spec", () => {
		const output = captureRun((reporter) => {
			reporter.onTestEnd(
				fakeTest("caldav-add-modal"),
				resultWith({ message: "Cannot find package 'obsidian-launcher' imported from bootstrap.ts" } as TestError)
			);
		});

		expect(output).toContain("ENVIRONMENT IN FLUX");
		expect(output).toContain("caldav-add-modal");
	});

	it("announces in real time on the first hit, before the end summary", () => {
		const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
		try {
			const reporter = new DepsInFluxReporter();
			reporter.onTestEnd(
				fakeTest("ics-export"),
				resultWith({ message: "Cannot find module '/repo/node_modules/@playwright/test/index.js'" } as TestError)
			);
			expect(spy).toHaveBeenCalledTimes(1);
			expect(String(spy.mock.calls[0]?.[0])).toContain("node_modules likely rebuilt mid-run");
		} finally {
			spy.mockRestore();
		}
	});

	it("stays silent for a genuine assertion failure", () => {
		const output = captureRun((reporter) => {
			reporter.onTestEnd(
				fakeTest("skip-toggle"),
				resultWith({ message: "frontmatter Skip did not match\nexpect(received).toBe(expected)" } as TestError)
			);
		});

		expect(output).toBe("");
	});

	it("writes nothing when no test reported an error", () => {
		expect(captureRun(() => undefined)).toBe("");
	});
});
