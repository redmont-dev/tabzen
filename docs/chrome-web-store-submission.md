# Chrome Web Store Submission Guide (v1)

Everything to paste into the [developer dashboard](https://chrome.google.com/webstore/devconsole).
Listing copy (name, descriptions, URLs, category) lives in `chrome-web-store-listing.md`.

## What to upload

Build and zip (or use the CI artifact from a main build):

```bash
pnpm build:ext
cd packages/extension/dist && zip -r ../../../tabzen-extension-v1.0.0.zip .
```

The v1 build intentionally excludes Google Drive sync (no `identity` permission, no
`oauth2` block). See `DRIVE_SYNC_ENABLED` in `packages/extension/src/shared/constants.ts`
for the v1.1 re-enable steps — the OAuth client requires the extension ID this first
upload creates.

## Privacy tab — single purpose description

> Tabzen's single purpose is browser tab management: it organizes the user's open tabs
> into groups via user-defined rules, lets users search, sort, and de-duplicate tabs,
> and saves/restores window sessions. All data is stored locally on the device.

## Privacy tab — permission justifications

| Permission | Justification (paste as-is) |
|---|---|
| `tabs` | Core functionality. Tabzen reads tab titles and URLs to group tabs by user-defined rules, search open tabs, detect duplicates, sort tabs, and save window sessions for later restore. Tab data is processed locally and never transmitted. |
| `tabGroups` | Core functionality. Tabzen creates, names, colors, sorts, and collapses Chrome tab groups based on the user's grouping rules. |
| `storage` | Stores the user's settings, grouping rules, and workspaces locally (chrome.storage.sync/local/session). No data leaves the device. |
| `webNavigation` | Used solely to detect when a link click opens a new tab, so the duplicate blocker can check whether the destination is already open and close the extra copy. |
| `alarms` | Schedules the user's hourly/daily automatic session saves and periodic local analytics snapshots in Manifest V3 (service workers cannot use timers). |
| `notifications` | Shows a confirmation when a session is auto-saved or a grouping rule is created from the context menu. Can be silenced in settings. |
| `contextMenus` | Adds right-click actions: move tab to group, create a grouping rule from the current tab, find duplicates, save session, close duplicates. |
| `sidePanel` | Displays the tab tree side panel, one of the extension's primary UIs. |

**Host permissions:** none requested.
**Remote code:** none — select "No, I am not using remote code."

## Privacy tab — data usage disclosures

- "Does your extension collect or transmit user data?" → effectively **No transmission**.
  In the data-type checklist, check **"Web history"** only if the reviewer requires
  disclosure of *local* storage of tab URLs (sessions/analytics are stored on-device);
  the safe, honest framing is to check Web history and then certify the three boxes:
  - ✅ Not being sold to third parties
  - ✅ Not used for purposes unrelated to the single purpose
  - ✅ Not used to determine creditworthiness or for lending
- Privacy policy URL: `https://tabzen.io/privacy` (deploy the site first — the policy
  page was updated for v1 in this PR).

## Distribution tab

- Visibility: **Public**
- Regions: all
- Pricing: free

## Store listing tab

- Copy name / short description / detailed description / category / language from
  `chrome-web-store-listing.md`.
- Icon: taken from the zip (`icons/icon-128.png`).
- Screenshots: upload the 1280x800 PNGs from `docs/store-assets/`.
- Homepage `https://tabzen.io`, support URL `https://github.com/redmont-dev/tabzen/issues`.

## After the first upload (do not skip)

1. Copy the **extension ID** from the dashboard.
2. Update `CHROME_STORE_URL` in `packages/site/src/config.ts` (replace `EXTENSION_ID`).
3. For v1.1 Drive sync: create a Google Cloud OAuth client (type: Chrome Extension,
   bound to that extension ID, scope `https://www.googleapis.com/auth/drive.appdata`),
   restore the `oauth2` block + `identity` permission in `manifest.json`, flip
   `DRIVE_SYNC_ENABLED`, bump the version, and upload the new zip.

## Review expectations

No host permissions, no content scripts, no remote code — this is the fast review path.
Typical first review: 1–3 business days. The `tabs` permission always draws scrutiny;
the justification above explains exactly why it's needed.
