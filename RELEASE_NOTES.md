# Bible Song Pro - Version 2.1.0

## Release Summary

Bible Song Pro `Version 2.1.0` builds on the 2.0.0 foundation with the introduction of the AI Helper desktop app, cross-platform packaging, an expanded vMix workflow, and a new feedback pipeline.

## Highlights

- **AI Scripture Assistant (Live Scripture HUD)** — the standout feature of v2.1.0. Bible Song Pro now listens to your sermon or worship service in real time and intelligently detects Bible references as they are spoken. Detected verses surface instantly in a floating HUD panel inside the control interface, allowing your operator to project scripture without missing a beat. The same AI pipeline also supports song detection mode, so lyrics can be cued from voice without manual search. Runs fully offline with the built-in Local AI engine (Moonshine) or connects to Deepgram for cloud-powered accuracy — no API key required for offline mode
- **Independent Lower Third and Full Screen Backgrounds** — Lower Third and Full Screen display modes now each have their own dedicated background layer, allowing different visuals per mode (solid color, image, video loop, or live YouTube). A single Link button instantly mirrors both modes to the same background whenever a unified look is preferred
- New AI Helper desktop companion app with clean relay-based architecture for macOS, Windows, and Linux
- Professional cross-platform packaging: macOS (Intel and Apple Silicon), Windows (installer and portable), Linux (AppImage and zip)
- New feedback pipeline with local backend and Cloudflare Worker deployment option
- Expanded vMix display URL tools, connection state UI, and advanced output routing
- Sync and output runtime hardened for improved live consistency
- Better relay resilience with reconnect controls and clearer status visibility
- Improved state persistence for recent and pinned Bible references
- Input safety guards to prevent accidental keyboard shortcut triggers while editing fields

## Included Downloads

Release assets include:

- `Bible-Song-Pro-OBS-Core-v2.1.0.zip` — OBS package with all panel, display, JS, CSS, and asset files
- macOS AI Helper DMG and ZIP (Intel x64 and Apple Silicon arm64)
- Windows AI Helper installer (NSIS) and portable executable
- Linux AI Helper AppImage and ZIP

## Notes

- OBS remains the main public workflow for this release
- The AI Helper is a standalone companion app and is downloaded separately from the OBS core package
- The Local AI engine runs fully offline — no API key required
- Test your workflow in your target environment before live use

---

# Bible Song Pro - Version 2.0.0

## Release Summary

Bible Song Pro `Version 2.0.0` is the first major packaged release of the project.

Built on top of the original OBS custom dock workflow, this update expands Bible Song Pro into a broader release with desktop packaging, vMix support, translation tools, feedback reporting, and stronger sync reliability for live presentation use.

## Highlights

- Desktop builds for macOS, Windows, and Linux
- vMix integration with configurable connection and output controls
- In-app feedback reporting to GitHub through the bundled backend
- Song translation workflow with provider configuration and testing
- Pinned and recent Bible reference tools in the workspace
- Improved OBS display sync reliability
- Refactored and modularized runtime for easier maintenance and future updates

## Included Download

Release assets may include:

- OBS package with `Bible Song Pro panel.html` and `BSP_display.html`
- macOS desktop build
- Windows installer and portable build
- Linux build

## Notes

- OBS remains the main public workflow for this release
- vMix support is included in this release
- Standalone output work is still in progress and is not part of the public release messaging
- Test your workflow in your target environment before live use
