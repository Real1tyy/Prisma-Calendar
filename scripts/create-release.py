#!/usr/bin/env python3
"""
Create GitHub release for Obsidian plugin.
Bumps version, builds plugin, and uploads assets to GitHub release.
"""

import json
import sys
import subprocess
from pathlib import Path

def get_version_from_manifest() -> str:
    """Get current version from manifest.json."""
    manifest_path = Path.cwd() / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError("manifest.json not found")

    with open(manifest_path) as f:
        manifest = json.load(f)

    version = manifest.get("version")
    if not version:
        raise ValueError("No version found in manifest.json")

    return version

def check_gh_cli() -> bool:
    """Check if GitHub CLI is installed and authenticated."""
    try:
        result = subprocess.run(
            ["gh", "--version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode != 0:
            return False

        auth_result = subprocess.run(
            ["gh", "auth", "status"],
            capture_output=True,
            text=True,
            timeout=5
        )
        return auth_result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False

def get_repo_url() -> str:
    """Get GitHub repository URL from git remote."""
    try:
        result = subprocess.run(
            ["git", "remote", "get-url", "origin"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            url = result.stdout.strip()
            if url.startswith("git@"):
                url = url.replace("git@github.com:", "https://github.com/").replace(".git", "")
            elif url.startswith("https://github.com/"):
                url = url.replace(".git", "")
            return url
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    return "https://github.com/Real1tyy/PeriodicNotesPlanner"

def check_git_clean() -> bool:
    """Check if git repository is clean (no uncommitted changes)."""
    try:
        status_result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if status_result.returncode != 0:
            return False

        return len(status_result.stdout.strip()) == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False

def main():
    project_root = Path.cwd()

    bump_type = sys.argv[1] if len(sys.argv) > 1 else "minor"

    if bump_type not in ["major", "minor", "patch"]:
        print(f"❌ Invalid bump type: {bump_type}")
        print("Usage: python3 scripts/create-release.py [major|minor|patch]")
        sys.exit(1)

    if not check_gh_cli():
        print("❌ GitHub CLI (gh) not installed or not authenticated")
        print("   Install: sudo apt install gh")
        print("   Authenticate: gh auth login")
        sys.exit(1)

    print("🔍 Checking git repository status...")
    if not check_git_clean():
        print("❌ Git repository is not clean (uncommitted changes detected)")
        print("   Please commit or stash your changes before creating a release")
        sys.exit(1)
    print("✅ Repository is clean\n")

    print("🚀 Starting release process...")
    print(f"   Bump type: {bump_type}\n")

    try:
        print("📦 Step 1: Bumping version...")
        bump_result = subprocess.run(
            ["python3", "scripts/bump-version.py", bump_type],
            cwd=project_root,
            capture_output=True,
            text=True
        )

        if bump_result.returncode != 0:
            print(f"❌ Version bump failed:")
            print(bump_result.stderr)
            sys.exit(1)

        print(bump_result.stdout)

        new_version = get_version_from_manifest()
        tag = new_version

        print(f"\n🏗️  Step 2: Building plugin...")
        build_result = subprocess.run(
            ["mise", "run", "build"],
            cwd=project_root,
            capture_output=True,
            text=True
        )

        if build_result.returncode != 0:
            print(f"❌ Build failed:")
            print(build_result.stderr)
            sys.exit(1)

        print("✅ Build completed successfully")

        files_to_upload = ["main.js", "manifest.json", "styles.css"]
        missing_files = []

        for filename in files_to_upload:
            file_path = project_root / filename
            if not file_path.exists():
                missing_files.append(filename)

        if missing_files:
            print(f"❌ Missing required files: {', '.join(missing_files)}")
            sys.exit(1)

        print(f"\n📤 Step 3: Creating GitHub release {tag}...")

        release_result = subprocess.run(
            ["gh", "release", "create", tag, "--notes", f"Release {tag}"],
            cwd=project_root,
            capture_output=True,
            text=True
        )

        if release_result.returncode != 0:
            if "already exists" in release_result.stderr.lower():
                print(f"⚠️  Release {tag} already exists, uploading assets to existing release...")
            else:
                print(f"❌ Failed to create release:")
                print(release_result.stderr)
                sys.exit(1)
        else:
            print(f"✅ Created release {tag}")

        print(f"\n📎 Step 4: Uploading assets...")

        for filename in files_to_upload:
            file_path = project_root / filename
            print(f"   Uploading {filename}...")

            upload_result = subprocess.run(
                ["gh", "release", "upload", tag, str(file_path), "--clobber"],
                cwd=project_root,
                capture_output=True,
                text=True
            )

            if upload_result.returncode != 0:
                print(f"⚠️  Failed to upload {filename}:")
                print(upload_result.stderr)
            else:
                print(f"   ✅ Uploaded {filename}")

        print(f"\n💾 Step 5: Committing release changes...")

        commit_message = f"chore: release {new_version}"

        add_result = subprocess.run(
            ["git", "add", "manifest.json", "package.json", "versions.json"],
            cwd=project_root,
            capture_output=True,
            text=True
        )

        if add_result.returncode != 0:
            print(f"⚠️  Failed to stage files for commit:")
            print(add_result.stderr)
        else:
            commit_result = subprocess.run(
                ["git", "commit", "-m", commit_message],
                cwd=project_root,
                capture_output=True,
                text=True
            )

            if commit_result.returncode != 0:
                print(f"⚠️  Failed to commit changes:")
                print(commit_result.stderr)
            else:
                print(f"✅ Committed changes: {commit_message}")

        print(f"\n📤 Step 6: Pushing to remote repository...")

        push_result = subprocess.run(
            ["git", "push"],
            cwd=project_root,
            capture_output=True,
            text=True
        )

        if push_result.returncode != 0:
            print(f"⚠️  Failed to push changes:")
            print(push_result.stderr)
        else:
            print(f"✅ Pushed commit to remote")

        repo_url = get_repo_url()
        print(f"\n✅ Release {tag} created successfully!")
        print(f"   View at: {repo_url}/releases/tag/{tag}")

    except KeyboardInterrupt:
        print("\n🛑 Release process cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
