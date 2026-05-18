#!/usr/bin/env python3
"""Extract a single version's section from a docs-site changelog.md.

Self-contained — no monorepo imports. Lives in the mirror at
`.github/scripts/extract-changelog-entry.py` and is invoked by the release
workflow to assemble the GitHub release body.

Usage:
    python3 extract-changelog-entry.py <version> <changelog-path>

Writes the version's section (without the heading) to stdout. Exits non-zero
if the version is absent or the file is missing — the calling workflow falls
back to `--generate-notes`.
"""

from __future__ import annotations

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
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
