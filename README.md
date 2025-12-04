<p align="center">
  <img src="assets/icon.svg" width="128" height="128" alt="Wormhole Desktop">
</p>

<h1 align="center">Wormhole Desktop</h1>

<p align="center">
  Secure peer-to-peer file transfers with optional AES-256 encryption
</p>

## Overview

Desktop GUI for secure peer-to-peer file transfers using [Magic Wormhole](https://magic-wormhole.readthedocs.io/). Files transfer directly between devices without cloud storage or accounts.

Optional AES-256 encryption adds a user-controlled encryption layer on top of the transfer. This follows the principle that only encryption where you define your own key can be truly trusted - the password never leaves your device and is never transmitted.

## Features

- Native Magic Wormhole integration (no Docker required)
- Drag and drop files and folders
- Send text messages (credentials, code snippets, notes)
- Optional AES-256 password encryption (files and messages)
- Secure delete: 3-pass overwrite for temp files and originals
- Cross-platform (Windows, macOS, Linux)
- Portable mode (run from USB, no installation)
- Smart installer (detects existing installation, offers upgrade/uninstall)
- Dark/Light theme

## Changelog

### 3.0.0
- **Native Wormhole**: Replaced Docker-based implementation with native Rust integration via [magic-wormhole.rs](https://github.com/magic-wormhole/magic-wormhole.rs)
- **No Docker Required**: Application now runs standalone without any external dependencies
- **Improved Performance**: Native binary eliminates container startup overhead
- **Better Progress**: Native progress callbacks instead of stdout parsing

### 2.2.0
- **Secure Delete**: Optional 3-pass overwrite (random, random, zeros) for temp files after transfer
- **Delete Originals**: Option to securely delete original files after successful transfer
- **Confirmation Dialog**: Type "DELETE" to confirm original file deletion
- **SSD Notice**: Warning that forensic recovery cannot be fully prevented on SSDs and CoW filesystems
- **Security Hardening**: Symlink protection, null-byte injection prevention, path traversal blocking

### 2.1.0
- Text message support
- UI polish and animations

### 2.0.0
- Complete TypeScript rewrite
- AES-256 encryption with 7-Zip
- NSIS installer with upgrade detection

## Quick Start

Download the release for your platform and run - no additional setup required.

**Windows:** `Wormhole-Desktop-Setup-x.x.x.exe` (installer) or `Wormhole-Desktop-x.x.x-win.zip` (portable)

## Usage

**Send Files:** Drop files or browse, optionally enable encryption, click Send, share the code.

**Send Message:** Type or paste text in the input field, optionally enable encryption, click Send, share the code.

**Receive:** Enter code, click Receive. Files are saved to your documents folder. Messages are displayed directly (not saved to disk for privacy).

Encrypted transfers use 7-Zip AES-256 format. Recipients can extract with any compatible tool using the shared password.

## Development

```bash
# Requirements: Node.js 20+, Rust toolchain (rustup)

git clone https://github.com/user/wormhole-desktop.git
cd wormhole-desktop
npm install

# Build native module (once, or after Rust changes)
npm run build:native

# Run in development mode
npm run dev
```

**Build distribution:**
```bash
npm run dist:win    # Windows (NSIS + ZIP)
npm run dist:mac    # macOS
npm run dist:linux  # Linux
```

**Release workflow (Semantic Versioning):**

Quick release (version bump + build in one command):
```bash
npm run release:patch  # Bugfix: 1.0.0 → 1.0.1
npm run release:minor  # Feature: 1.0.1 → 1.1.0
npm run release:major  # Breaking: 1.1.0 → 2.0.0
```

Full release process:
```bash
# 1. Commit all changes
git add -A
git commit -m "feat/fix: description of changes"

# 2. Bump version (choose one)
npm run version:patch   # or version:minor or version:major

# 3. Commit version bump
git add package.json
git commit -m "release: vX.Y.Z"

# 4. Create git tag
git tag vX.Y.Z

# 5. Build distribution
npm run dist:win        # or dist:mac or dist:linux

# 6. Push to remote
git push && git push --tags
```

Output files in `dist/`:
- `Wormhole Desktop Setup X.Y.Z.exe` (Windows installer)
- `Wormhole Desktop-X.Y.Z-win.zip` (Windows portable)

**Project structure:**
```
src/
├── main/       # Electron main process, IPC, services
├── preload/    # Context bridge API
├── renderer/   # UI (TypeScript/CSS)
└── shared/     # Types, constants
native/         # Rust native module (magic-wormhole bindings)
```

## Limitations

- Single transfer at a time
- 50 GB archive size limit

## License

MIT © SKR

This project uses [magic-wormhole.rs](https://github.com/magic-wormhole/magic-wormhole.rs) (Apache-2.0/MIT) and wraps the [Magic Wormhole](https://github.com/magic-wormhole/magic-wormhole) protocol by Brian Warner.

---

Contact: research@neomint.com
