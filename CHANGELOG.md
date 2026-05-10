# Changelog

All notable changes to `Bible Song Pro` should be documented in this file.

## Version 2.1.0

### New Features

- **AI Scripture Assistant (Live Scripture HUD)** — real-time speech-to-scripture detection that listens during sermons and worship, automatically surfaces Bible references and song cues in a floating HUD panel, and works across both Bible verse and song lyrics display modes. Runs fully offline with Local AI (Moonshine) or in the cloud via Deepgram
- **Independent Lower Third and Full Screen Backgrounds** — each display mode now has its own independent background layer supporting solid colors, images, videos, and YouTube. A Link toggle instantly syncs both modes to the same background when needed
- Dedicated AI Helper desktop companion app with relay-based control, in-panel start/stop, and relay diagnostics
- Cross-platform helper packaging pipeline for macOS (Intel and Apple Silicon), Windows (installer and portable), and Linux (AppImage and zip) using Electron Builder
- New feedback pipeline: local feedback backend plus Cloudflare Worker deployment option for public issue intake
- Expanded vMix workflow support with display URL tools, connection state UI, and advanced output routing controls
- New tutorial hub module and broader modular project structure for maintainability

### Fixes and Reliability Improvements

- Major sync/output runtime hardening to reduce state drift and improve live output consistency
- Better relay and session resilience with reconnect actions and clearer connection visibility in the UI
- Improved state persistence and sanitization for recent and pinned Bible references and host settings
- Better input safety through typing shortcut guards to prevent accidental hotkey triggers while editing text fields
- Startup behavior improvements including vMix reconnect-on-start and safer settings restore flows

---

## Version 2.0.0

Major release focused on productizing Bible Song Pro beyond the original two-file OBS package while keeping OBS workflows central.

### Added

- Desktop app packaging for macOS, Windows, and Linux
- vMix integration with configurable connection, routing, and output controls
- In-app feedback workflow that can create GitHub issues through the bundled backend
- Song translation workflow with provider configuration and testing
- Pinned and recent Bible reference shortcuts in the workspace
- Branded platform app icons and packaging resources
- Expanded project structure with modular panel runtime files, packaging config, and release documentation

### Improved

- OBS display communication reliability and sync recovery behavior
- Host-mode state loading and settings persistence
- Packaging workflow for release artifacts and OBS zip distribution
- General maintainability through modularization of the panel runtime

### Notes

- This release is intended to be presented publicly as an OBS-first update with desktop packaging and vMix support
- Standalone output work is still in progress and is not part of the public release messaging

## Version 1.0

Initial public release.

### Added

- OBS custom dock control panel workflow
- Bible verse projection
- Song lyrics projection
- Full Screen mode
- Lower Third mode
- Auto-retrieve lyrics workflow
- Dual Bible version support
- Multi-language interface support
- Support for 50+ languages
- Support for 250+ Bible versions
- Theme support
- Song, Bible, and setlist workflows
- Background, typography, and layout controls
- Quick Actions panel

### Notes

- This release is intended for OBS-based church and live presentation workflows.
