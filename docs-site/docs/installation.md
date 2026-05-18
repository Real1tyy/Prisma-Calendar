# Installation

import useBaseUrl from "@docusaurus/useBaseUrl";

How to install Prisma Calendar — from the official Obsidian Community Plugin Store (recommended), or manually from a GitHub release.

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

## ✨ Recommended: Obsidian Community Plugin Store

Prisma Calendar is published in the official **[Obsidian Community Plugin Store](https://community.obsidian.md/plugins/prisma-calendar)** — Obsidian's plugin marketplace. This is the recommended way to install the plugin.

### Why install from the store

- ✅ **One-click install and enable** — no folders, no file copying, no manual updates
- ✅ **Automatic updates** — Obsidian shows you when a new version is available and updates in one click
- ✅ **Verified by the Obsidian team** — every release is reviewed for compliance and security before it ships
- ✅ **Listed alongside your other plugins** — manage Prisma the same way you manage every other Community plugin

### Option A — Install via the Obsidian Community page

Open Prisma Calendar's official Community Plugin page and click **Add to Obsidian** — it opens it straight inside Obsidian:

[![Install in Obsidian](https://img.shields.io/badge/Install_in_Obsidian-7c3aed?style=for-the-badge&logo=obsidian&logoColor=white)](https://community.obsidian.md/plugins/prisma-calendar)

Direct URL: <https://community.obsidian.md/plugins/prisma-calendar>

### Option B — Install manually from inside Obsidian

If the above doesn't work, you can install Prisma manually, regardless of browser or platform compatibility:

1. Open Obsidian
2. Go to **Settings → Community Plugins**
3. If Restricted Mode is on, click **Turn on community plugins**
4. Click **Browse**
5. Search for **"Prisma Calendar"**
6. Click **Install**
7. Click **Enable**

That's it — Prisma is now active in your vault. Open the [Quick Start](./quickstart.md) to set up your first calendar.

## 📥 Alternative: Manual Installation from GitHub Releases

If you prefer manual installation:

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

With manual installation, you'll need to repeat these steps whenever you want to update to a new version. Consider using Obsidian's Community Plugin Store for automatic updates.

## Requirements
- **Obsidian 1.11.4 or newer** — earlier versions don't expose the APIs Prisma uses for Bases integration and encrypted secret storage. Update Obsidian first if you're on an older build.
- For templating features, install the [Templater](https://github.com/SilentVoid13/Templater) plugin

## Next Steps

After installation, see the [Quick Start Guide](quickstart.md) for:
- Opening your calendar
- Initial setup and configuration
- Creating your first event
- Getting started with recurring events
