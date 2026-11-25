# Fold — App Review screen recording script

Apple requires a screen recording captured on a **physical device** running the **latest iOS**, starting at **app launch**, showing a typical user flow.

This environment cannot capture that video for you. Record on your iPhone, host the file, then paste the URL into `APP_REVIEW_NOTES.md` item “SCREEN RECORDING”.

## Before you record

1. Install the **same binary** you submitted (TestFlight or the review build).
2. Update the phone to the latest iOS.
3. Sign out of any unrelated Sandbox accounts if purchases look stuck; optional: use a Sandbox Apple ID so a skin purchase can complete.
4. Clear Fold’s progress only if you want level 1 tutorials on camera (Settings → Fold → offload/reinstall, or delete and reinstall). Fresh install is ideal for reviewers.
5. Quiet room; silence notifications (Focus / Do Not Disturb).
6. Start iOS Screen Recording from Control Center (add Screen Recording if missing). Prefer landscape or portrait matching how Fold runs (portrait).

## Suggested length

90–150 seconds. Keep it continuous from launch—no cuts that hide the cold start.

## Shot list (say nothing, or narrate briefly)

| Time | Action | What Apple should see |
|------|--------|------------------------|
| 0:00 | Open Fold from the Home Screen | Cold launch → title “Fold” with Play / Skins |
| 0:08 | Tap **Play** | First postcard loads (e.g. 1. Crease) with hint |
| 0:15 | Drag **up** on the red guide crease | Terrain folds / raises |
| 0:25 | Tap **Go** | Traveler rolls; clear the door if possible |
| 0:35 | On **Clear!** tap **Next** or **Replay** | Win UI + stars |
| 0:45 | Tap **Levels** | Postcard list; Training sections visible |
| 0:55 | Close Levels; tap **Skins** | Traveler skins shop |
| 1:05 | Show free skins (Pulp Moth, Paper Fox); select one | Equip free cosmetic |
| 1:15 | Tap a **paid** skin (e.g. Moss Kit) | StoreKit sheet appears |
| 1:25 | Complete purchase **or** cancel | Shows paid-content path; cancel is OK |
| 1:35 | Tap **Restore purchases** | Restore flow runs |
| 1:45 | Optional: open Privacy / Support link briefly | Legal reachable in-app |
| 1:55 | Return to a level; Undo / Reset once | Core controls |
| End | Stop recording on the gameplay or title screen | |

### Flows Apple listed that Fold does **not** have

Do **not** invent these. The Notes field already states they are absent:

- Account registration / login / account deletion — **N/A**
- User-generated content, reporting, blocking — **N/A**

### Paid content

Showing the Skins shop + StoreKit sheet (purchase or cancel) satisfies “accessing paid content.” Completing a Sandbox purchase of `skin_moss` is nicest if it works quickly.

## Hosting the file

Upload somewhere App Review can open without an account wall:

- Unlisted YouTube or Vimeo, **or**
- Google Drive / Dropbox / iCloud link set to “anyone with the link”

Paste that URL into the SCREEN RECORDING line in `APP_REVIEW_NOTES.md` before copying Notes into App Store Connect.

## Filename suggestion

`Fold-AppReview-Demo-iPhone-iOS.mp4`

## Quick QA while filming

- App does not crash on launch or Go
- Folding responds to touch
- Win or at least a clear attempt is visible
- Skins and Restore are reachable without login
