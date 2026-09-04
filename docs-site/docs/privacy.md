---
title: Privacy & diagnostics
description: What stays on your device, what leaves it and when, and how diagnostics are redacted before you share them.
---

# Privacy & diagnostics

Prisma Calendar is local-first. Your notes, file names, and settings stay in your vault. There is no client-side telemetry or analytics, and nothing is uploaded in the background.

## What leaves your device, and when

Only two things ever contact a server on their own, and both are documented where you configure them:

- **License verification** for Pro features — see [License & activation](./configuration/license) and the [privacy FAQ](./faq#-privacy--telemetry) for the exact fields sent.
- **The update check** — a single anonymous request to GitHub Releases, described under [General settings](./configuration/general).

Everything else — a log excerpt, a debug report, a bug report — leaves your device **only when you copy or send it yourself**. Nothing is sent automatically, and you can read exactly what is attached before it goes anywhere.

## What diagnostics contain

Diagnostics are high-level and about the plugin's own behaviour: which feature ran, what it decided, and any error it hit. They are not a copy of your notes. Before you see or share them, they are **anonymized and redacted**:

| What | What you share instead |
| --- | --- |
| Folder and note names, including inside links | A short stable token per name, e.g. `vault://{3f2a1c}/{a1b2c3}.md`. Folder depth and the file extension stay, so structure is visible without the names. The same note always gets the same token, so a repeated problem with one note is still recognisable. |
| Your home directory and the vault's location on disk | Replaced by `vault://` or `home://`. |
| Property (frontmatter) values | The property **name** and the **type** of its value, e.g. `Attendees: [array:2]`. The value itself is removed. |
| License keys, API keys, tokens, passwords, authorization headers | **Always removed**, in every mode. There is no setting that includes them. |

Files under `.obsidian/` — plugin configuration, not notes — are left readable so a configuration problem can be diagnosed.

## Including full detail

Anywhere diagnostics can be shared, an **Include full detail** switch is available. Turning it on keeps real folder and note names, the vault's location, and property values, so someone you trust can follow along with your actual setup. Secrets are still removed. The switch restates what it exposes, and it is off by default.

## What redaction cannot do

Redaction works on text. A screenshot you attach to a report is not redacted — you see it before sending and decide whether to include it. The message you type yourself is sent as written.

For the legal terms, see the [Privacy Policy](https://matejvavroproductivity.com/privacy/?utm_campaign=prisma_calendar&utm_source=docs&utm_medium=content&utm_content=privacy-page).
