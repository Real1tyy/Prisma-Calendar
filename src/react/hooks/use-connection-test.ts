import { describeError } from "@real1ty-obsidian-plugins";
import { Notice } from "obsidian";
import { useCallback, useState } from "react";

interface ConnectionTestResult<T = void> {
	success: boolean;
	data?: T;
	error?: string;
}

interface UseConnectionTestReturn<T> {
	testPassed: boolean;
	testing: boolean;
	runTest: () => Promise<void>;
	testData: T | undefined;
}

export function useConnectionTest<T = void>(
	testFn: () => Promise<ConnectionTestResult<T>>,
	options?: { successMessage?: (data: T) => string }
): UseConnectionTestReturn<T> {
	const [testPassed, setTestPassed] = useState(false);
	const [testing, setTesting] = useState(false);
	const [testData, setTestData] = useState<T | undefined>(undefined);

	const runTest = useCallback(async () => {
		setTesting(true);
		try {
			const result = await testFn();
			if (result.success) {
				setTestPassed(true);
				if (result.data !== undefined) setTestData(result.data);
				if (options?.successMessage && result.data !== undefined) {
					new Notice(options.successMessage(result.data));
				}
			} else {
				new Notice(`Connection failed: ${result.error || "Unknown error"}`);
				setTestPassed(false);
			}
		} catch (error) {
			new Notice(`Connection failed: ${describeError(error)}`);
			setTestPassed(false);
		} finally {
			setTesting(false);
		}
	}, [testFn, options]);

	return { testPassed, testing, runTest, testData };
}
