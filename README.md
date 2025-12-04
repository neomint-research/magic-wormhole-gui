<p align="center">
  <img src="assets/icon.svg" width="128" height="128" alt="Wormhole Desktop">
</p>

<h1 align="center">Wormhole Desktop</h1>

<p align="center">
  Secure peer-to-peer file transfers with optional AES-256 encryption
</p>

## Overview

Wormhole Desktop is a GUI for the [Magic Wormhole](https://magic-wormhole.readthedocs.io/) protocol. It transfers files directly between devices without cloud storage, accounts, or configuration. Share a short code, and the transfer happens peer-to-peer.

Optional AES-256 encryption adds a second layer where you control the key. The password never leaves your device.

## Features

- Native Magic Wormhole integration (no Docker, no external dependencies)
- Drag and drop files and folders
- Send text messages (credentials, code snippets, notes)
- Optional AES-256 password encryption
- Secure delete with 3-pass overwrite
- Portable mode (run from USB)
- Dark and light theme

## Quick Start

Download the [latest release](https://github.com/user/wormhole-desktop/releases) for your platform:

- **Windows:** Installer (`.exe`) or portable (`.zip`)
- **macOS:** DMG
- **Linux:** AppImage or `.deb`

Run the application. No setup required.

## Usage

**Send files:**
1. Drop files or folders into the window (or click Browse)
2. Optional: Enter a password for AES-256 encryption
3. Click Send
4. Share the code with the recipient (e.g. "7-guitarist-revenge")
5. Transfer starts automatically when they connect

**Send text:** Type or paste into the text field instead of dropping files. Same flow.

**Receive:**
1. Enter the code from the sender
2. Click Receive
3. Files save to your documents folder
4. Text messages display directly (not saved to disk)

**Secure delete:** After a successful transfer, you can shred temp files and optionally the originals. Uses 3-pass overwrite (random, random, zeros). On SSDs and copy-on-write filesystems (APFS, Btrfs), forensic recovery cannot be fully prevented - the app is honest about this.

**Encryption:** Uses 7-Zip AES-256 format. Recipients can extract with 7-Zip, WinRAR, or any compatible tool using the shared password.

## Development

Requirements: Node.js 20+, Rust toolchain

```bash
git clone https://github.com/user/wormhole-desktop.git
cd wormhole-desktop
npm install
npm run build:native   # Build Rust module (once)
npm run dev            # Run in development mode
```

Build distribution:

```bash
npm run dist:win       # Windows
npm run dist:mac       # macOS
npm run dist:linux     # Linux
```

Project structure:

```
src/
├── main/       # Electron main process
├── preload/    # Context bridge
├── renderer/   # UI
└── shared/     # Types, constants
native/         # Rust bindings to magic-wormhole
```

## Limitations

- Single transfer at a time
- 50 GB archive size limit
- macOS and Linux builds require platform-specific compilation

## Changelog

### 3.0.0
- Native Rust integration via magic-wormhole.rs (no Docker required)
- Improved performance and progress reporting

### 2.2.0
- Secure delete for temp files and originals
- Security hardening (symlink protection, path traversal blocking)

### 2.1.0
- Text message support

### 2.0.0
- TypeScript rewrite
- AES-256 encryption with 7-Zip
- NSIS installer with upgrade detection

## License

MIT © SKR

Uses [magic-wormhole.rs](https://github.com/magic-wormhole/magic-wormhole.rs) (Apache-2.0/MIT).
