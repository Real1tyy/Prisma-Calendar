# Installation

import useBaseUrl from "@docusaurus/useBaseUrl";

How to install Prisma Calendar using BRAT.

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/InstallationBrat.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/InstallationBrat.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

## Quick Start Video

Learn how to install, setup, and begin using Prisma Calendar in minutes.

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <iframe
    width="100%"
    style={{"maxWidth": "800px", "aspectRatio": "16/9", "borderRadius": "8px", "border": "none"}}
    src="https://www.youtube.com/embed/dziQK9UQhvE"
    title="Prisma Calendar Quick Start"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen
  />
</div>

Prisma Calendar is currently **awaiting approval** for the Obsidian Community Plugin store. While it's pending approval, you can install it using one of the methods below.

## 🎯 Recommended: BRAT (Beta Reviewers Auto-update Tool)

The easiest and most convenient way to install Prisma Calendar with automatic updates:

### Steps

1. **Install BRAT plugin** (if you don't have it already)
   - Open Settings → Community Plugins → Browse
   - Search for "BRAT"
   - Install and enable [BRAT](https://github.com/TfTHacker/obsidian42-brat)

2. **Add Prisma Calendar via BRAT**
   - Open Settings → BRAT
   - Click **Add Beta Plugin**
   - Enter the repository URL: `https://github.com/Real1tyy/Prisma-Calendar`
   - Click **Add Plugin**

3. **Enable the plugin**
   - Go to Settings → Community Plugins
   - Find "Prisma Calendar" in the list
   - Toggle it on

### Benefits of BRAT

- ✅ **Automatic updates** - Get new features and fixes automatically
- ✅ **Easy installation** - Just paste the repo URL
- ✅ **One-click setup** - No manual file management

## 📥 Manual Installation from GitHub Releases

If you prefer manual installation or can't use BRAT:

### Steps

1. **Download the latest release**
   - Go to [GitHub Releases](https://github.com/Real1tyy/Prisma-Calendar/releases)
   - Find the latest version (all releases are versioned and tagged)
   - Download these three files:
     - `main.js`
     - `manifest.json`
     - `styles.css`

2. **Create plugin folder**
   - Navigate to your vault's plugins directory: `{VaultFolder}/.obsidian/plugins/`
   - Create a new folder: `prisma-calendar`
   - Full path should be: `{VaultFolder}/.obsidian/plugins/prisma-calendar/`

3. **Move files**
   - Place the three downloaded files into the `prisma-calendar` folder

4. **Reload Obsidian**
   - Press `Ctrl/Cmd + R` to reload Obsidian
   - Or close and reopen Obsidian

5. **Enable the plugin**
   - Go to Settings → Community Plugins
   - Find "Prisma Calendar" in the installed plugins list
   - Toggle it on

### Note on Manual Updates

With manual installation, you'll need to repeat these steps whenever you want to update to a new version. Consider using BRAT for automatic updates.

## ✨ Coming Soon: Community Plugin Store

Once Prisma Calendar is approved for the Obsidian Community Plugin store, you'll be able to install it directly:

1. Open Settings → Community Plugins → Browse
2. Search for "Prisma Calendar"
3. Click Install
4. Enable the plugin

I'll update this page as soon as the plugin is available in the store!

## Requirements
- Obsidian 1.10+
- For templating features, install the [Templater](https://github.com/SilentVoid13/Templater) plugin

## Next Steps

After installation, see the [Quick Start Guide](quickstart.md) for:
- Opening your calendar
- Initial setup and configuration
- Creating your first event
- Getting started with recurring events
