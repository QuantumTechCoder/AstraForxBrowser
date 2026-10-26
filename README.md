<div align="center">

```
   █████╗ ███████╗████████╗██████╗  █████╗ ███████╗ ██████╗ ██████╗ ██╗  ██╗
  ██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██╔═══██╗██╔══██╗╚██╗██╔╝
  ███████║███████╗   ██║   ██████╔╝███████║█████╗  ██║   ██║██████╔╝ ╚███╔╝ 
  ██╔══██║╚════██║   ██║   ██╔══██╗██╔══██║██╔══╝  ██║   ██║██╔══██╗ ██╔██╗ 
  ██║  ██║███████║   ██║   ██║  ██║██║  ██║██║     ╚██████╔╝██║  ██║██╔╝ ██╗
  ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝      ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
```

### ⚡ The Cybernetic, Terminal-Aesthetic Desktop Web Browser for Power Users & Hackers

[![GitHub Release](https://img.shields.io/github/v/release/QuantumTechCoder/AstraForxBrowser?color=00f0ff&style=for-the-badge&logo=github)](https://github.com/QuantumTechCoder/AstraForxBrowser/releases)
[![License](https://img.shields.io/badge/License-Apache%202.0-a855f7?style=for-the-badge&logo=apache)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20x64%20%7C%20AMD64-00ff9d?style=for-the-badge&logo=windows)](https://github.com/QuantumTechCoder/AstraForxBrowser/releases)
[![Electron](https://img.shields.io/badge/Electron-31.x-47848F?style=for-the-badge&logo=electron)](https://www.electronjs.org/)
[![Chromium](https://img.shields.io/badge/Chromium-Engine-4285F4?style=for-the-badge&logo=googlechrome)](https://www.chromium.org/)
[![Stars](https://img.shields.io/github/stars/QuantumTechCoder/AstraForxBrowser?style=for-the-badge&color=f59e0b&logo=star)](https://github.com/QuantumTechCoder/AstraForxBrowser/stargazers)

<p align="center">
  <a href="#-key-features"><b>Key Features</b></a> •
  <a href="#-void-runner-arcade"><b>Void Runner Minigame</b></a> •
  <a href="#-incognito-mode"><b>Incognito Mode</b></a> •
  <a href="#-command-omnibox"><b>CLI Omnibox</b></a> •
  <a href="#-shortcuts"><b>Shortcuts</b></a> •
  <a href="#-download--install"><b>Download & Install</b></a> •
  <a href="#-license"><b>License</b></a>
</p>

---

</div>

## 🌌 Overview

**AstraForx** is a high-octane desktop browser engineered for developers, security researchers, and terminal minimalists who demand the power and compatibility of modern **Chromium (Blink/V8)** wrapped inside a razor-sharp, obsidian-dark, command-driven **Cyberpunk / TUI aesthetic**.

Say goodbye to bloated interfaces and clunky white screens. AstraForx delivers ultra-responsive navigation, persistent pinned tabs, hardware-accelerated GPU rasterization, an isolated in-memory Incognito workstation, and a built-in zero-asset 8-bit offline retro synth minigame.

---

## ⚡ Key Features

| Capability | Engineering Highlight |
|---|---|
| **Chromium Core** | Powered by modern Electron `WebContentsView` architecture for native multi-process isolation and full web standard compatibility. |
| **Obsidian Void Theme** | Deep `#06070a` palette, hairline neon cyan (`#00f0ff`) and ultraviolet (`#a855f7`) borders, pulse radar animations, and CRT scanlines. |
| **Astra // Void Runner** | Built-in offline endless runner mini-game featuring procedural 8-bit sound synthesis via Web Audio API—zero assets, 100% offline. |
| **Multi-Window Incognito** | Isolated in-memory partition sessions (`session.fromPartition`) with an ultraviolet theme, telemetry indicator, and no disk logging. |
| **Persistent Pinned Tabs** | Tabs stay permanently pinned across restarts with full session, cookie, and state preservation. |
| **CLI Omnibox Engine** | Command shortcuts (`gh:`, `so:`, `yt:`, `w:`, `ddg:`), direct IP/host auto-HTTPS routing, and live protocol status chips. |
| **Native Dark Context Menus** | Custom high-contrast right-click menus for tabs, links, images, selections, and devtools with zero viewport clipping. |
| **Telemetry & Diagnostics** | Diagnostic network error pages (`ERR_NAME_NOT_RESOLVED`, `ERR_INTERNET_DISCONNECTED`, etc.) with checklist troubleshooting and live telemetry timestamps. |
| **Find in Page (`Ctrl+F`)** | Non-intrusive embedded search bar with live match counter, arrow cycle, and escape dismiss. |
| **Media HUD & Muting** | Automatic audio stream detection on tabs with instant speaker glyph and one-click per-tab mute (`🔊` / `🔇`). |
| **Built-in System Stations** | Rich internal suites: `astra://settings`, `astra://history`, `astra://bookmarks`, `astra://downloads`, and `astra://game`. |

---

## 🎮 Void Runner Arcade (`astra://game`)

When the uplink drops or when you need a mental break, **Astra // Void Runner** engages instantly:

```
  [▲ BOOST / DOUBLE JUMP]      [▼ DIVE / SLIDE]      [⚡ COLLECT ORBS]
      Space / Up Arrow             Down Arrow           +50 Telemetry Pts
```

- **Procedural 8-Bit Audio Synth**: Uses Web Audio API square, sine, triangle oscillators and white noise buffers for jump, thruster burst, point collection, and explosion sound FX. No audio files or external dependencies.
- **Physics Engine**: Double-jump thruster trail particles, dynamic obstacle generation (laser ground spikes, hovering cyber drones, glitch pillars), progressive speed multiplier, and local high-score persistence.
- **Instant Launch**: Press **Space** on any connection failure screen, or navigate to `astra://game` / `astra://runner` / `chrome://dino`.

---

## 🕶 Incognito Mode (`Ctrl + Shift + N`)

- **Total Isolation**: Spawns an independent `BrowserWindow` bound to an ephemeral, in-memory partition (`incognito-<timestamp>`).
- **Zero Disk Footprint**: Cookies, cache, local storage, history, and pinned tabs vanish completely when the window is closed.
- **Ultraviolet Cyber Aesthetic**: Dynamic UI theme shift to neon purple (`#c084fc` / `#a855f7`), `[INCOGNITO]` protocol badge, and dedicated titlebar telemetry HUD.
- **Independent Window Lifecycle**: Window minimize, maximize, and close controls operate strictly on the incognito instance—never affecting your main workspace.

---

## 🚀 Command-Driven Omnibox

Enter search queries, direct URLs, or turbocharge your research with prefix triggers:

```bash
❯ gh linux kernel          # Searches GitHub directly
❯ so electron webview      # Searches Stack Overflow
❯ yt lofi chill cyberpunk  # Searches YouTube
❯ w quantum computing      # Searches Wikipedia
❯ ddg privacy guides       # Searches DuckDuckGo
❯ localhost:8080           # Direct HTTP/HTTPS resolution
```

---

## ⌨ Keyboard Cheatsheet

| Shortcut | Action |
|---|---|
| <kbd>Ctrl</kbd> + <kbd>T</kbd> | New Tab |
| <kbd>Ctrl</kbd> + <kbd>W</kbd> | Close Active Tab |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd> | Reopen Last Closed Tab |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>N</kbd> | Open Incognito Window |
| <kbd>Ctrl</kbd> + <kbd>L</kbd> | Focus Address / Omnibox Bar |
| <kbd>Ctrl</kbd> + <kbd>F</kbd> | Find in Page |
| <kbd>Ctrl</kbd> + <kbd>R</kbd> | Reload Page |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd> | Force Hard Reload (bypass cache) |
| <kbd>Ctrl</kbd> + <kbd>D</kbd> | Bookmark Current Page |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd> | Toggle Bookmarks Bar |
| <kbd>Ctrl</kbd> + <kbd>J</kbd> | Toggle Downloads Panel |
| <kbd>Ctrl</kbd> + <kbd>H</kbd> | Open Browsing History (`astra://history`) |
| <kbd>Ctrl</kbd> + <kbd>,</kbd> | Open Browser Settings (`astra://settings`) |
| <kbd>Ctrl</kbd> + <kbd>U</kbd> | View Page Source (`view-source:`) |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Save Page As Complete HTML |
| <kbd>Ctrl</kbd> + <kbd>P</kbd> | Print Page |
| <kbd>Ctrl</kbd> + <kbd>1</kbd> - <kbd>9</kbd> | Switch to Tab 1 through 9 |
| <kbd>Ctrl</kbd> + <kbd>+</kbd> / <kbd>-</kbd> / <kbd>0</kbd> | Zoom In / Zoom Out / Reset Zoom (100%) |
| <kbd>F12</kbd> / <kbd>Ctrl+Shift+I</kbd> | Open Chromium DevTools |
| <kbd>Alt</kbd> + <kbd>Left</kbd> / <kbd>Right</kbd> | Navigate Back / Forward |

---

## 💾 Download & Install

### Pre-built Binaries (Windows AMD64 / x64)

Download the latest release from the [Releases Page](https://github.com/QuantumTechCoder/AstraForxBrowser/releases):

- **NSIS Installer**: `AstraForx Setup 1.0.0.exe` (Complete desktop & start menu installation)
- **Portable Executable**: `AstraForx 1.0.0.exe` (Self-contained standalone runner)

### Build From Source

```bash
# Clone the repository
git clone https://github.com/QuantumTechCoder/AstraForxBrowser.git
cd AstraForxBrowser

# Install project dependencies
npm install

# Run development mode
npm start

# Compile Windows x64 distribution packages
npm run dist
```

Compiled installers will be generated inside the `release/` directory.

---

## 🛡 Performance & Privacy

- **GPU Zero-Copy Pipeline**: Launches Chromium with `--enable-gpu-rasterization`, `--enable-zero-copy`, and `--enable-tcp-fast-open` for instant viewport rendering.
- **Isolated User Storage**: Browser data, settings, history, and pinned tabs are stored in `%APPDATA%\AstraForxBrowser`.
- **Zero Telemetry Leaks**: AstraForx does not harvest your browsing data, send background telemetry pings, or bundle ads.

---

## 📜 License

Licensed under the **Apache License, Version 2.0**. See the [LICENSE](LICENSE) file for the full terms and conditions.

---

<div align="center">
  <sub>Developed with ⚡ by <a href="https://github.com/QuantumTechCoder"><b>QuantumTechCoder</b></a>. Built on Chromium & Electron.</sub>
</div>
