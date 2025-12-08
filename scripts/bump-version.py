#!/usr/bin/env python3
"""
Version bumping script for Obsidian plugin.
Bumps version in manifest.json, package.json, and updates versions.json.
"""

import json
import sys
import re
from pathlib import Path
from typing import Tuple

def parse_version(version: str) -> Tuple[int, int, int]:
    """Parse semantic version string into (major, minor, patch)."""
    match = re.match(r'^(\d+)\.(\d+)\.(\d+)$', version)
    if not match:
        raise ValueError(f"Invalid version format: {version}")
    return tuple(int(x) for x in match.groups())

def bump_version(version: str, bump_type: str) -> str:
    """Bump version according to bump_type (major, minor, patch)."""
    major, minor, patch = parse_version(version)

    if bump_type == "major":
        return f"{major + 1}.0.0"
    elif bump_type == "minor":
        return f"{major}.{minor + 1}.0"
    elif bump_type == "patch":
        return f"{major}.{minor}.{patch + 1}"
    else:
        raise ValueError(f"Invalid bump type: {bump_type}. Must be 'major', 'minor', or 'patch'")

def main():
    project_root = Path.cwd()
    manifest_path = project_root / "manifest.json"
    package_path = project_root / "package.json"
    versions_path = project_root / "versions.json"

    bump_type = sys.argv[1] if len(sys.argv) > 1 else "minor"

    if bump_type not in ["major", "minor", "patch"]:
        print(f"❌ Invalid bump type: {bump_type}")
        print("Usage: python3 scripts/bump-version.py [major|minor|patch]")
        sys.exit(1)

    if not manifest_path.exists():
        print(f"❌ manifest.json not found at {manifest_path}")
        sys.exit(1)

    if not package_path.exists():
        print(f"❌ package.json not found at {package_path}")
        sys.exit(1)

    if not versions_path.exists():
        print(f"❌ versions.json not found at {versions_path}")
        sys.exit(1)

    try:
        with open(manifest_path) as f:
            manifest = json.load(f)

        with open(package_path) as f:
            package = json.load(f)

        with open(versions_path) as f:
            versions = json.load(f)

        current_version = manifest.get("version")
        if not current_version:
            print("❌ No version found in manifest.json")
            sys.exit(1)

        min_app_version = manifest.get("minAppVersion")
        if not min_app_version:
            print("❌ No minAppVersion found in manifest.json")
            sys.exit(1)

        new_version = bump_version(current_version, bump_type)

        print(f"📦 Bumping version: {current_version} → {new_version} ({bump_type})")

        manifest["version"] = new_version
        package["version"] = new_version
        versions[new_version] = min_app_version

        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent="\t")
            f.write("\n")

        with open(package_path, "w") as f:
            json.dump(package, f, indent="\t")
            f.write("\n")

        with open(versions_path, "w") as f:
            json.dump(versions, f, indent="\t")
            f.write("\n")

        print(f"✅ Updated manifest.json: version = {new_version}")
        print(f"✅ Updated package.json: version = {new_version}")
        print(f"✅ Updated versions.json: {new_version} → {min_app_version}")
        print(f"\n🎯 New version: {new_version}")

    except json.JSONDecodeError as e:
        print(f"❌ Error parsing JSON: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
