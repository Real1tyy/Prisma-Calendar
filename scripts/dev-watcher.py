#!/usr/bin/env python3
"""
Development mode watcher for Obsidian plugin.
Supports both watch mode and one-time build-and-copy mode.
"""

import os
import sys
import json
import time
import signal
import shutil
import argparse
import subprocess
from pathlib import Path
from typing import Dict
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class PluginDevWatcher(FileSystemEventHandler):
    def __init__(self, project_root: Path, obsidian_vault_path: Path):
        self.project_root = project_root
        self.obsidian_vault_path = obsidian_vault_path
        self.last_copy_time = 0
        self.last_rebuild_time = 0
        self.debounce_seconds = 2
        self.rebuild_debounce_seconds = 1
        self.dev_process = None

        # Get plugin info from manifest
        self.plugin_info = self._load_plugin_info()
        if not self.plugin_info:
            raise ValueError("Could not load plugin info from manifest.json")

        print(f"📱 Plugin: {self.plugin_info['name']} (ID: {self.plugin_info['id']})")

    def _load_plugin_info(self) -> Dict:
        """Load plugin info from manifest.json."""
        manifest_path = self.project_root / "manifest.json"
        if not manifest_path.exists():
            print("❌ manifest.json not found")
            return None

        try:
            with open(manifest_path) as f:
                manifest = json.load(f)

            plugin_dir = self.obsidian_vault_path / ".obsidian" / "plugins" / manifest["id"]

            return {
                "id": manifest["id"],
                "name": manifest.get("name", manifest["id"]),
                "plugin_dir": plugin_dir
            }
        except (json.JSONDecodeError, KeyError) as e:
            print(f"⚠️  Error reading manifest.json: {e}")
            return None

    def _create_plugin_directory(self):
        """Create plugin directory if it doesn't exist."""
        plugin_dir = self.plugin_info["plugin_dir"]

        if not plugin_dir.exists():
            print(f"📁 Creating plugin directory: {plugin_dir}")
            try:
                plugin_dir.mkdir(parents=True, exist_ok=True)
                print(f"✅ Created: {plugin_dir}")
            except Exception as e:
                print(f"❌ Failed to create {plugin_dir}: {e}")
                return False
        else:
            print(f"📁 Plugin directory exists: {plugin_dir}")

        return True

    def start_dev_mode(self):
        """Start development mode with file watching."""
        # First, ensure plugin directory exists
        if not self._create_plugin_directory():
            return False

        print("🚀 Starting development mode...")
        try:
            # Start dev mode (esbuild watch)
            self.dev_process = subprocess.Popen(
                ["pnpm", "run", "dev"],
                cwd=self.project_root,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            print("✅ Development mode started")
        except Exception as e:
            print(f"❌ Failed to start development mode: {e}")
            return False

        # Wait for initial build
        print("⏳ Waiting for initial build...")
        time.sleep(3)

        # Initial copy
        print("📋 Initial copy...")
        if not self._copy_plugin_files(is_initial_copy=True):
            print("⚠️  Plugin may have build issues - check for compilation errors")

        return True

    def build_and_copy_once(self):
        """Build plugin once and copy files to Obsidian vault."""
        # First, ensure plugin directory exists
        if not self._create_plugin_directory():
            return False

        print("🏗️ Building plugin...")
        try:
            # Build the plugin
            result = subprocess.run(
                ["pnpm", "run", "build"],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode == 0:
                print("✅ Successfully built plugin")

                # Copy files
                print("📋 Copying files...")
                if self._copy_plugin_files(is_initial_copy=True):
                    print("✅ Successfully copied files")
                    return True
                else:
                    print("⚠️  Plugin may have build issues - check for compilation errors")
                    return False
            else:
                print("❌ Build failed")
                print(f"   Return code: {result.returncode}")
                if result.stdout:
                    print("   STDOUT:")
                    for line in result.stdout.strip().split('\n'):
                        print(f"   {line}")
                if result.stderr:
                    print("   STDERR:")
                    for line in result.stderr.strip().split('\n'):
                        print(f"   {line}")
                if not result.stdout and not result.stderr:
                    print("   (No output captured)")
                return False
        except subprocess.TimeoutExpired:
            print("⏰ Build timeout - build took longer than 1 minute")
            return False
        except Exception as e:
            print(f"❌ Error building plugin: {e}")
            return False

    def _check_build_success(self, is_initial_copy: bool = False) -> bool:
        """Check if the build process is successful by verifying main.js exists and is recent."""
        main_js = self.project_root / "main.js"

        # Check if main.js exists
        if main_js.exists():
            # For initial copy, just check if file exists and is not empty
            if is_initial_copy:
                return main_js.stat().st_size > 0

            # For regular rebuilds, check if it was recently modified (within last 30 seconds)
            current_time = time.time()
            file_mtime = main_js.stat().st_mtime
            return (current_time - file_mtime) < 30

        return False

    def _copy_plugin_files(self, is_initial_copy: bool = False) -> bool:
        """Copy plugin files only if build was successful."""
        # First check if the build was successful
        if not self._check_build_success(is_initial_copy):
            print("❌ Build failed - skipping file copy")
            return False

        plugin_dir = self.plugin_info["plugin_dir"]
        plugin_name = self.plugin_info["name"]

        # Ensure plugin directory exists
        plugin_dir.mkdir(parents=True, exist_ok=True)

        print(f"🔄 Updating {plugin_name} plugin...")

        copied_files = []
        files_to_copy = ["main.js", "styles.css", "manifest.json"]

        for filename in files_to_copy:
            src_file = self.project_root / filename
            if src_file.exists():
                try:
                    shutil.copy2(src_file, plugin_dir / filename)
                    copied_files.append(filename)
                except Exception as e:
                    print(f"⚠️  Failed to copy {filename}: {e}")

        if copied_files:
            print(f"✅ Updated: {', '.join(copied_files)}")
            return True
        else:
            print("⚠️  No files found to copy")
            return False

    def _should_copy(self) -> bool:
        """Check if enough time has passed since last copy (debouncing)."""
        current_time = time.time()

        if current_time - self.last_copy_time > self.debounce_seconds:
            self.last_copy_time = current_time
            return True
        return False

    def _should_rebuild(self) -> bool:
        """Check if enough time has passed since last rebuild (debouncing)."""
        current_time = time.time()

        if current_time - self.last_rebuild_time > self.rebuild_debounce_seconds:
            self.last_rebuild_time = current_time
            return True
        return False

    def _rebuild_plugin(self):
        """Rebuild the plugin."""
        print("🔄 Rebuilding plugin...")

        try:
            # Use build command for one-off rebuild
            result = subprocess.run(
                ["pnpm", "run", "build"],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0:
                print("✅ Successfully rebuilt plugin")
                # Copy files after successful build
                self._copy_plugin_files()
            else:
                print("❌ Build failed")
                print(f"   Return code: {result.returncode}")
                if result.stdout:
                    print("   STDOUT:")
                    for line in result.stdout.strip().split('\n'):
                        print(f"   {line}")
                if result.stderr:
                    print("   STDERR:")
                    for line in result.stderr.strip().split('\n'):
                        print(f"   {line}")
                if not result.stdout and not result.stderr:
                    print("   (No output captured)")
        except subprocess.TimeoutExpired:
            print("⏰ Build timeout")
        except Exception as e:
            print(f"❌ Error rebuilding plugin: {e}")

    def on_modified(self, event):
        if event.is_directory:
            return

        file_path = Path(event.src_path)

        # Skip build artifacts, temporary files, and non-source files
        if (file_path.name == "main.js" or
            file_path.name.startswith('.') or
            "node_modules" in file_path.parts or
            not file_path.suffix in [".ts", ".tsx", ".js", ".jsx", ".json", ".css"]):
            return

        # Check if file is in src directory or is a config file
        if not (file_path.is_relative_to(self.project_root / "src") or
                file_path.name in ["package.json", "tsconfig.json", "esbuild.config.mjs"]):
            return

        # Check if we should rebuild (debounce logic)
        if not self._should_rebuild():
            print(f"⏭️  Skipping rebuild (debounced - last rebuild < {self.rebuild_debounce_seconds}s ago)")
            return

        print(f"\n📝 Change detected: {file_path.name}")

        # Wait a moment for file system to settle
        time.sleep(1)

        # Rebuild plugin
        self._rebuild_plugin()

    def cleanup(self):
        """Clean up dev processes."""
        print("\n🧹 Cleaning up processes...")
        if self.dev_process:
            try:
                self.dev_process.terminate()
                self.dev_process.wait(timeout=5)
                print("  → Stopped development mode")
            except subprocess.TimeoutExpired:
                self.dev_process.kill()
                print("  → Force killed development mode")
            except Exception as e:
                print(f"  → Error stopping development mode: {e}")

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description="Development mode watcher for Obsidian plugin"
    )
    parser.add_argument(
        "--mode",
        choices=["watch", "build"],
        default="watch",
        help="Mode: 'watch' for continuous development mode, 'build' for one-time build and copy (default: watch)"
    )
    parser.add_argument(
        "--vault-path",
        help="Override OBSIDIAN_VAULT_PATH environment variable"
    )

    args = parser.parse_args()

    # Get Obsidian vault path
    obsidian_vault_path = args.vault_path or os.getenv("OBSIDIAN_VAULT_PATH")
    if not obsidian_vault_path:
        print("❌ OBSIDIAN_VAULT_PATH environment variable not set and --vault-path not provided")
        sys.exit(1)

    project_root = Path.cwd()
    obsidian_vault_path = Path(obsidian_vault_path)

    if args.mode == "build":
        print("🎯 Starting one-time build and copy...")
        print(f"   Project root: {project_root}")
        print(f"   Obsidian vault: {obsidian_vault_path}")

        try:
            # Create watcher instance for build functionality
            watcher = PluginDevWatcher(project_root, obsidian_vault_path)

            # Run one-time build and copy
            if watcher.build_and_copy_once():
                print("✅ Build and copy completed successfully!")
                sys.exit(0)
            else:
                print("❌ Build and copy failed!")
                sys.exit(1)
        except Exception as e:
            print(f"❌ Error: {e}")
            sys.exit(1)

    else:  # watch mode
        print("🎯 Starting development mode...")
        print(f"   Project root: {project_root}")
        print(f"   Obsidian vault: {obsidian_vault_path}")

        try:
            # Create watcher
            watcher = PluginDevWatcher(project_root, obsidian_vault_path)

            # Start development mode
            if not watcher.start_dev_mode():
                print("❌ Failed to start development mode")
                sys.exit(1)

            # Set up file watching
            observer = Observer()
            observer.schedule(watcher, str(project_root), recursive=True)

            # Handle cleanup on exit
            def signal_handler(signum, frame):
                print(f"\n🛑 Received signal {signum}, shutting down...")
                watcher.cleanup()
                observer.stop()
                observer.join()
                sys.exit(0)

            signal.signal(signal.SIGINT, signal_handler)
            signal.signal(signal.SIGTERM, signal_handler)

            observer.start()
            print("\n👀 Watching for changes... (Press Ctrl+C to stop)")

            # Keep the script running
            while True:
                time.sleep(1)

        except KeyboardInterrupt:
            signal_handler(signal.SIGINT, None)
        except Exception as e:
            print(f"❌ Error: {e}")
            if 'watcher' in locals():
                watcher.cleanup()
            if 'observer' in locals():
                observer.stop()
                observer.join()
            sys.exit(1)

if __name__ == "__main__":
    main()
