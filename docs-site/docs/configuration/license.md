---
title: License & activation
description: How to activate Prisma Calendar Pro — the one-click activation link, where your license key comes from, and how it's stored on each device.
---

# License & activation

Prisma Calendar's Pro features are unlocked with a single **license key**. The quickest way to activate is the **one-click activation link**, but you can also enter the key by hand. Either way, every device you use has to be activated.

## Fastest: one-click activation

When you start a subscription or trial, you get a **one-click activation link**. You'll find the same link in two places:

- The **email** you receive when you sign up.
- Your **[account page](https://matejvavroproductivity.com/account)**.

Open that link with Obsidian running and it does everything for you — it creates the secret with your license key and activates Pro. Nothing to copy or paste.

## Manual activation

Prefer to enter the key yourself? Prisma stores it using Obsidian's built-in secrets.

**The Secret is your license key. The ID is just a name — it can be anything.**

1. Open **Prisma Calendar → Settings → General → License**.
2. Click the **License key** field. Prisma opens Obsidian's secrets menu, where you can **pick an existing secret** or **create a new one**.
3. When creating one, the **Add secret** dialog asks for two things:
   - **Secret** — paste your **license key** here. This is the part that matters.
   - **ID** — any label you like (lowercase letters, numbers, dashes). It has no effect on activation; it's just a name for the entry.
4. **Save**, then click **Verify**.

The **License status** row then shows your plan and how many device seats are in use.

## Where to find your license key

Your license key is in your sign-up **email** and on your **[account page](https://matejvavroproductivity.com/account)** any time. (The one-click activation link already has it built in.)

## Where your key is stored

Your license key lives in **Obsidian's keychain** — under **Obsidian → Settings → General → Manage secrets** — not in your vault's `data.json`, so it never ends up in plain text among your notes. Because the keychain stays on each device, your key is **not** carried over when your vault syncs.

## Activating Pro on a new device

Each device is activated separately. When you open the same vault on a new device, Pro features stay disabled until you activate there.

The easiest fix is to open the **one-click activation link** on that device. Or do it manually:

1. On the new device, open **Prisma Calendar → Settings → General → License**.
2. Add your license key as a secret — or pick an existing one — exactly as above (**Secret** = your license key, **ID** = any label).
3. Click **Verify**.

Each activated device takes one **seat** on your plan, shown in the **License status** row (for example, `2/5 devices`).

### Freeing up a seat

- Switching or retiring a device? Click **Deactivate this device** in the License section to release its seat — you can re-activate any time by clicking **Verify**.
- You can also review and remove devices from your [account page](https://matejvavroproductivity.com/account).

## Troubleshooting

| Problem | What to do |
|---|---|
| Pro features are locked on a new device | Open the one-click activation link on that device, or add your license key as a secret and click **Verify**. |
| "Device limit reached" | Free a seat with **Deactivate this device** on a device you no longer use, or manage devices on your [account page](https://matejvavroproductivity.com/account). |
| Can't find your key | Use the one-click link from your sign-up email, or open your [account page](https://matejvavroproductivity.com/account). |
| Subscription isn't active | Update billing on your [account page](https://matejvavroproductivity.com/account), then click **Verify**. |

## Still need help?

Open an issue on [GitHub](https://github.com/Real1tyy/Prisma-Calendar/issues/new/choose) or reach out through the [feedback page](https://matejvavroproductivity.com/feedback?utm_campaign=prisma_calendar&utm_source=docs&utm_medium=license&utm_content=feedback) — happy to help.
