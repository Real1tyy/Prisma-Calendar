#!/usr/bin/env bash
# Generic Playwright E2E runner for any plugin in this monorepo. Invoked from a
# plugin's CWD (the plugin's `pnpm test:e2e` script runs `bash
# ../scripts/e2e/run-playwright.sh`). Conventions:
#   - each plugin has `e2e/playwright.config.ts` (overridable via E2E_CONFIG).
#   - on Linux we wrap in xvfb-run so Electron renders to a virtual display
#     (headless by default). Set E2E_HEADED=1 to see the real window.
#   - `--debug` / `--verbose` are stripped and set E2E_VERBOSE=1 so the shared
#     bootstrap logger spills everything to stderr.
#   - `--<feature>` (e.g. `--events`, `--settings`) is translated to a path
#     filter when a matching `e2e/specs/<feature>/` directory exists, so
#     `pnpm test:e2e --events` runs only tests under `e2e/specs/events/`.
#     Override the specs root with E2E_SPECS_DIR.
#
# All other args are forwarded to `playwright test`.
#
# Path-arg rewriting: positional args starting with `<plugin-name>/` (the
# plugin's own directory name, derived from CWD) get that prefix stripped
# before forwarding to Playwright. Lets a caller paste a monorepo-root-
# relative path — e.g. `Prisma-Calendar/e2e/specs/settings/foo.spec.ts` —
# and have it resolve correctly when Playwright runs from the plugin CWD.
set -euo pipefail

E2E_CONFIG="${E2E_CONFIG:-e2e/playwright.config.ts}"
E2E_SPECS_DIR="${E2E_SPECS_DIR:-$(dirname "$E2E_CONFIG")/specs}"
PLUGIN_DIR_NAME="$(basename "$PWD")"

# Fast-fail when the plugin's local playwright binary is missing. Without this
# check, `pnpm exec playwright test` bubbles up as
# `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "playwright" not found` —
# which is technically true but tells the contributor nothing about what to
# do. The most common cause is a fresh `@playwright/test` entry in the lock
# file that hasn't been installed yet (pull, branch switch, lockfile edit).
if [[ ! -x "./node_modules/.bin/playwright" ]]; then
	echo "[e2e] playwright binary missing at ${PLUGIN_DIR_NAME}/node_modules/.bin/playwright." >&2
	echo "[e2e] Run \`pnpm install\` from the repo root (likely needed after pulling new deps" >&2
	echo "[e2e]   or modifying pnpm-lock.yaml)." >&2
	exit 1
fi

# Demo mode (PW_DEMO=1 or a positive int slowMo in ms) implies headed — the
# whole point is to watch the browser, so xvfb would defeat the purpose.
if [[ -n "${PW_DEMO:-}" && "${PW_DEMO}" != "0" && "${PW_DEMO}" != "false" ]]; then
	export E2E_HEADED=1
fi

USE_XVFB=1
if [[ "${E2E_HEADED:-0}" == "1" ]]; then
	USE_XVFB=0
fi
if [[ "$(uname -s)" != "Linux" ]]; then
	USE_XVFB=0
fi

PW_ARGS=()
for arg in "$@"; do
	case "$arg" in
		--)
			# pnpm/npm script separator — drop it, Playwright doesn't want it
			;;
		--debug|--verbose)
			export E2E_VERBOSE=1
			;;
		--*=*)
			PW_ARGS+=("$arg")
			;;
		--*)
			feature="${arg#--}"
			candidate="${E2E_SPECS_DIR}/${feature}"
			if [[ -n "$feature" && -d "$candidate" ]]; then
				PW_ARGS+=("$candidate")
			else
				PW_ARGS+=("$arg")
			fi
			;;
		"$PLUGIN_DIR_NAME"/*)
			# Monorepo-root-relative path → strip the plugin prefix.
			PW_ARGS+=("${arg#"$PLUGIN_DIR_NAME"/}")
			;;
		*)
			PW_ARGS+=("$arg")
			;;
	esac
done

CMD=(pnpm exec playwright test --config "$E2E_CONFIG" ${PW_ARGS[@]+"${PW_ARGS[@]}"})

if [[ "$USE_XVFB" == "1" ]]; then
	if ! command -v xvfb-run >/dev/null 2>&1; then
		echo "[e2e] xvfb-run not found on PATH — falling back to headed mode." >&2
		echo "[e2e] Install xvfb (apt: 'sudo apt install xvfb') for headless runs." >&2
		exec "${CMD[@]}"
	fi
	exec xvfb-run --auto-servernum --server-args='-screen 0 1280x720x24' "${CMD[@]}"
fi

exec "${CMD[@]}"
