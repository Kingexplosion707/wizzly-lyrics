<div align="center">

## 🌶 Spicy Lyrics for Wizzly (this fork)

</div>

This fork adds **Spicy Lyrics** to Wizzly without changing Wizzly itself:

- **Dynamic Island, closed:** the line being sung, word by word, **all the time** (the island widens to fit) or **only in lyrics mode** — your choice.
- **Dynamic Island, opened** and the **karaoke window:** Spicy-style word-by-word lyrics with interlude dots; click a line to jump there.
- **Spotify Canvas** as the background and **Apple Music animated covers** on every Wizzly cover: island (closed and open), karaoke window, Control Center media card, track alerts.
- Word-by-word lyrics from Spotify (with the Live Lyrics relay), else Apple Music / Spicy Lyrics syncs, else LRCLIB.
- Settings: the 🌶 button in the island's lyrics view or the karaoke window.

**Install** (PowerShell, no admin):

```powershell
iwr -useb https://raw.githubusercontent.com/Kingexplosion707/wizzly-lyrics/main/spicy/install.ps1 | iex
```

It installs a small loader (Node.js) that starts at sign-in, restarts Wizzly once with WebView2's local debugging port (127.0.0.1 only) and adds [`spicy/spicy-wizzly.js`](spicy/spicy-wizzly.js) to Wizzly's windows. Canvas and animated covers come from the [Live Lyrics relay](https://github.com/Kingexplosion707/Live-Lyrics-for-Wallpaper-Engine) (Spicetify), so install that too for those. Uninstall: `%LOCALAPPDATA%\SpicyWizzly\uninstall.ps1`.

**Wizzly updates:** nothing in Wizzly is patched, so new versions keep the Spicy features. A daily workflow merges the main Wizzly repo into this fork and checks every new release against what the mod uses ([`spicy/COMPAT.md`](spicy/COMPAT.md)); if something changed, it opens an issue.

Wizzly's **desktop widgets** (vinyl, clock, calendar, memo) are drawn natively by `wizzly-native.exe`, not in a web view, so the mod can't reach them; for lyrics on the desktop, use the Live Lyrics wallpaper.

---

<div align="center">

# Wizzly

**macOS-style Dock, Dynamic Island Notch & Spotlight for Windows**

Lightweight desktop companion built with Rust & Tauri — bringing a customizable glass Dock, interactive Notch/Dynamic Island, and instant Spotlight search to Windows.

[Download Latest Release](https://github.com/loganmaxx/wizzly/releases/latest) · [Privacy & Data](#privacy--data) · [Report a Bug](https://github.com/loganmaxx/wizzly/issues) · [Support Wizzly](#support--donate)

</div>

---

<p align="center">
  <img src="assets/preview.jpg" alt="Wizzly Desktop Preview" width="850" />
</p>

## Features

### Dock & Desktop Experience
- **Customizable Glass Dock** — Choose between **Frosted**, **Liquid**, **Matte**, and **Classic** glass materials with optional **Wallpaper Tint** and **Dark / Light** themes.
- **Icon Styles & Animations** — Smooth magnification, launch bounce, running indicators, notification badges, window previews, and icon styles (*Windows*, *Squircle*, *macOS Pack*, *Normalized*).
- **Interactive Drag & Drop** — Drag apps from Launchpad to pin, drag icons out to unpin, or drop files directly onto Dock icons to open them.
- **Folders & Stacks** — Pin custom folders, browse your **Downloads Stack** (Grid or List view), and access Trash right from the Dock.
- **Built-in System Panels** — Quick access to Launchpad, Wi-Fi, **Per-App Volume Mixer**, Control Center, Calendar, and System Tray.
- **Multi-Monitor & Smart Auto-Hide** — Target Primary monitor, Follow Cursor, or a specific display, with **Borderless Fullscreen Detection** for gaming and presentations.

### Wizzly Notch (Notch / Dynamic Island)
- **Media & Synced Lyrics** — Now-playing widget with playback controls, seek bar, and live synced lyrics.
- **File Shelf (AirDrop-style Tray)** — Drag files from Explorer onto the Notch to hold them temporarily, then drag them out into browsers, Discord, WhatsApp, etc.
- **Clipboard History** — Search, pin, and quick-paste your recent copied text, links, and images.
- **Focus / Pomodoro Timer** — Built-in timer modes right inside the Notch.
- **Live Alerts & OSD** — Clean toast previews for incoming Windows notifications plus Volume, Wi-Fi, and Bluetooth overlays.

### Spotlight Search
- Press **`Alt + Space`** (fallback: `Ctrl + Alt + Space`) to search and launch apps, run system items, or calculate math expressions inline.

### Localization & Installer
- Available in **English** and **Indonesian** (`Auto`, `EN`, `ID`).
- Lightweight Windows installer (~3.3 MB).

---

## Download & Installation

1. Go to [**Releases**](https://github.com/loganmaxx/wizzly/releases/latest).
2. Download **`Wizzly_0.1.0_x64-setup.exe`**.
3. Run the installer and follow the setup wizard (supports English & Indonesian).

> **Note about Windows SmartScreen**
> Because Wizzly is an independent app without a paid EV code-signing certificate yet, Windows Defender SmartScreen may show *"Windows protected your PC"* on first launch. Click **More info → Run anyway** to proceed.

---

## System Requirements

- **OS:** Windows 10 / Windows 11 (64-bit)
- **Runtime:** Microsoft Edge WebView2 Runtime (already pre-installed on Windows 11 and most Windows 10 systems)

---

## Privacy & Data

Wizzly is built to run **locally on your PC** with **no ads, no analytics, and no telemetry**.

### What Wizzly Accesses Locally (Never Leaves Your Device)
- **Installed Apps, Running Windows & Shortcuts** — Used locally to populate the Dock, Launchpad, and Spotlight search (`Alt + Space`).
- **Windows Notifications** — Read locally via Windows `UserNotificationListener` to display incoming alert previews in the Notch.
- **Clipboard History & File Shelf** — Stored locally on your device so you can search, pin, or drag items from the Notch, and can be cleared anytime.
- **System Controls (Audio, Wi-Fi, Bluetooth, Battery, Wallpaper)** — Accessed via local Windows APIs to power the Dock status panels, per-app volume mixer, and wallpaper tinting.
- **App Settings & Notes** — Saved locally on your PC (`%APPDATA%\com.wizzly.app` and local app storage).

### External Network Requests
- **Synced Lyrics (`lrclib.net`)** — When fetching lyrics for a playing track, Wizzly sends only the track title, artist, album, and duration to the public [LRCLIB](https://lrclib.net) API.
- **No personal data, clipboard contents, notifications, or usage logs are ever sent to any server.**

---

## Support & Donate

Wizzly is free to download and use. If you enjoy using it and want to support future updates, you can support the project via:

- **PayPal:** [paypal.me/adrn87](https://paypal.me/adrn87)
- **Binance Pay (UID):** `977044132`
- **QRIS (Indonesia):**

<p align="left">
  <img src="assets/qris.png" alt="Wizzly QRIS Donate" width="220" />
</p>

---

## Feedback & Support

Found a bug or have an idea for Wizzly?
Open an issue on the [**Issues**](https://github.com/loganmaxx/wizzly/issues) tab!

<p align="center">
  Made with ❤️ by Adrian
</p>
