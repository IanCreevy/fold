# App Store Connect — Review Notes (Guideline 2.1)

Copy the block below (from SCREEN RECORDING through the Apple ID line) into **App Store Connect → App Review Information → Notes**, then resubmit.

Also attach or link a physical-device screen recording (see `APP_REVIEW_RECORDING_SCRIPT.md`). Put the public/unlisted URL of that recording in item 1 below.

---

BEGIN NOTES

SCREEN RECORDING
Demo video (physical iPhone, latest iOS): [PASTE LINK HERE — see store/APP_REVIEW_RECORDING_SCRIPT.md]

The recording starts at app launch and shows: title screen → Play → fold terrain with a finger drag → Go → clear a postcard → win screen → Levels list → Skins shop (free skins + paid IAP products) → Restore purchases.

No account registration, login, or account deletion exists in Fold.
No user-generated content, reporting, or blocking exists in Fold.
Paid content: optional cosmetic traveler skins via Apple In-App Purchase (non-consumable). The full level campaign is free.


1) APP PURPOSE AND AUDIENCE
Fold is a casual paper-folding physics puzzle. The player reshapes postcard terrain by dragging creases, then taps Go so a small traveler rolls across the foldscape to a door goal.

Target audience: general-audience puzzle and casual game players who enjoy short, tactile levels (similar to physics sandbox / origami-feel puzzles). Age rating is general; Fold is not directed at children under 13 and does not collect names, emails, or location.

Problem / value: many mobile puzzles are menu-heavy or paywall the campaign. Fold offers 530 free “postcard” levels (30 training + Chapter 4 long climb). Progress and stars stay on-device. Optional skins change look (and some add a Flutter flap ability); they are never required to finish levels.


2) HOW TO ACCESS MAIN FEATURES (NO LOGIN)
- Install Fold from the submitted build / TestFlight / App Store Connect review build.
- Launch the app. No sign-in screen appears.
- Title screen: tap Play to enter the current unlocked postcard, or Skins to open the shop.
- In a level: drag vertically near a crease mark to raise/lower terrain; Undo / Reset as needed; tap Go to run the traveler; cross the door to clear.
- Levels: open Postcards to pick any unlocked level (locked ones unlock in sequence).
- Skins: free starters are Pulp Moth and Paper Fox. Paid non-consumables: Moss Kit (skin_moss), Dawn Glider (skin_glider), Sunset Kite (skin_sunset), Stormwing (skin_stormwing). Tap a paid skin to trigger StoreKit / RevenueCat purchase; cancel is fine for review if purchase is not needed.
- Restore purchases: title legal row or Skins → Restore purchases (uses the review device’s Sandbox / Apple ID).
- Legal: Privacy, EULA, and Support links on the title and shop screens.

Demo account: none required — Fold has no accounts.
Sample files: none required.


3) EXTERNAL SERVICES / PLATFORMS
- Apple In-App Purchase (StoreKit) for optional non-consumable skins.
- RevenueCat (Purchases Capacitor SDK) to configure products and sync entitlements.
- Mixpanel for anonymous play analytics (app open, level start/clear, purchase/restore events). Events use a random on-device id; no name/email/IDFA. Analytics are off if the Mixpanel token is absent.
- Capacitor / WebView host for the game UI.
- Matter.js runs locally on-device for physics (not a network service).

Fold does not use social login, cloud saves, ads, or a custom backend for gameplay.


4) REGIONAL DIFFERENCES
The app functions the same in all regions. Level content, mechanics, and free campaign access do not change by country. Skin prices follow App Store local pricing / currency.


5) REGULATED INDUSTRY / PROTECTED MATERIAL
Fold is not in a regulated industry (not health, finance, gambling, etc.). It does not include licensed third-party IP that requires special credentials. All levels, art, and audio are original to the publisher.


6) IAP PRODUCTS SUBMITTED WITH THE APP
Non-consumable product IDs (should be in “Ready to Submit” / submitted with this version):
- skin_moss — Moss Kit
- skin_glider — Dawn Glider
- skin_sunset — Sunset Kite
- skin_stormwing — Stormwing

Contact: contact-us@navigatorofshame.com
Bundle ID: com.navigatorofshame.fold
Apple ID: 6838986014

END NOTES

---

## Checklist before you hit Resubmit

- [ ] Paste the Notes block above into App Review Information → Notes
- [ ] Replace `[PASTE LINK HERE…]` with your hosted screen recording URL
- [ ] Confirm Sandbox / demo Apple ID is signed in on the review device if you want reviewers to complete a test purchase (optional; cancel flow is also fine)
- [ ] Confirm all four IAP products are attached to this app version
- [ ] Screenshots show real gameplay (not only splash / title art) — Guideline 2.3.3
- [ ] Build was smoke-tested on a physical iPhone on the latest iOS
- [ ] Resubmit the same (or a new) build for Review
