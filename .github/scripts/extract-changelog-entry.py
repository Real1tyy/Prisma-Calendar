#!/usr/bin/env python3
"""Extract a single version's section from a docs-site changelog.md and append
a UTM-tracked link to the full docs-site changelog.

Self-contained — no monorepo imports. Lives in the mirror at
`.github/scripts/extract-changelog-entry.py` and is invoked by the release
workflow to assemble the GitHub release body.

Usage:
    python3 extract-changelog-entry.py <version> <changelog-path>

Writes the version's section (without the heading) to stdout, followed by
"---" + a `[Full changelog](...)` link derived from the `GITHUB_REPOSITORY`
environment variable (always set in GitHub Actions; falls back to the
changelog path's repo name when run locally). Exits non-zero only if the
version section is absent or the file is missing — the calling workflow
falls back to `--generate-notes`.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Optional

VERSION_HEADING_RE = re.compile(r"^## (\d+\.\d+\.\d+)")


def extract_version_notes(changelog_path: Path, version: str) -> Optional[str]:
    if not changelog_path.exists():
        return None

    lines = changelog_path.read_text(encoding="utf-8").splitlines()
    start_idx: Optional[int] = None
    end_idx: Optional[int] = None

    for i, line in enumerate(lines):
        match = VERSION_HEADING_RE.match(line.strip())
        if not match:
            continue
        if match.group(1) == version:
            start_idx = i
        elif start_idx is not None:
            end_idx = i
            break

    if start_idx is None:
        return None

    section = lines[start_idx + 1 : end_idx]
    while section and section[0].strip() in ("", "---"):
        section.pop(0)
    while section and section[-1].strip() in ("", "---"):
        section.pop()

    return "\n".join(section) if section else None


def build_full_changelog_link(changelog_path: Path) -> Optional[str]:
    """Build the UTM-tracked docs-site link for the trailing "Full changelog"
    reference. Mirrors the previous monorepo-side `build_release_notes`
    (scripts/utils/changelog_parser.py) so GitHub release bodies stay
    consistent across the workflow handover.

    Resolves the repo name from `GITHUB_REPOSITORY` (always set in Actions)
    and falls back to walking up from `changelog_path` for local runs.
    Returns None if neither source yields a repo name.
    """
    repo_full = os.environ.get("GITHUB_REPOSITORY", "")
    if "/" in repo_full:
        repo_name = repo_full.split("/", 1)[1]
        repo_owner = repo_full.split("/", 1)[0]
    else:
        # Local fallback: docs-site/docs/changelog.md → walk up to the plugin dir.
        repo_name = changelog_path.resolve().parents[2].name
        repo_owner = "Real1tyy"

    if not repo_name:
        return None

    campaign = repo_name.lower().replace("-", "_")
    url = (
        f"https://{repo_owner}.github.io/{repo_name}/changelog"
        f"?utm_source=github&utm_medium=release&utm_campaign={campaign}"
        f"&utm_content=release_notes"
    )
    return f"[Full changelog]({url})"


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(f"usage: {argv[0]} <version> <changelog-path>", file=sys.stderr)
        return 2

    version = argv[1]
    changelog_path = Path(argv[2])
    notes = extract_version_notes(changelog_path, version)
    if not notes:
        print(f"No changelog section found for {version} in {changelog_path}", file=sys.stderr)
        return 1

    print(notes)
    link = build_full_changelog_link(changelog_path)
    if link:
        print()
        print("---")
        print()
        print(link)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
