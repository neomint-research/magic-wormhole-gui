# Wormhole Desktop

Secure peer-to-peer file transfers with optional AES-256 encryption. A desktop GUI for [Magic Wormhole](https://magic-wormhole.readthedocs.io/).

## Overview

Wormhole Desktop eliminates the friction of secure file sharing. No accounts, no cloud storage, no file size limits imposed by services. Files transfer directly between devices using Magic Wormhole's PAKE protocol, ensuring only the sender and recipient can access the data.

Built for users who need fast, private transfers without trusting intermediaries.

**This project is a GUI wrapper around [Magic Wormhole](https://github.com/magic-wormhole/magic-wormhole) by Brian Warner and contributors.** All cryptographic transfer functionality is provided by the original project.

## Features

- Drag & drop files and folders (up to 100 items)
- Optional AES-256 password encryption with header encryption
- Cross-platform (Windows, macOS, Linux)
- Dark/Light theme with system preference detection
- Containerized wormhole execution via Docker

## Quick Start

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) running.

1. Download the release for your platform (see Installation below)
2. Build the Docker image once: `docker build -t wormhole-cli ./docker`
3. Launch the app

## Installation

Two distribution variants are available:

**Installer (recommended)**
- Windows: `Wormhole-Desktop-Setup-x.x.x.exe`
- Installs to Program Files, stores data in `%APPDATA%/wormhole-desktop`
- Automatic updates, Start Menu integration

**Portable (ZIP)**
- Windows: `Wormhole-Desktop-x.x.x-win.zip`
- No installation required, run from any location (including USB drives)
- All data stored in `./data` subfolder next to the executable
- No registry modifications, fully self-contained

## Usage

**Send:** Drop files → optionally enable encryption → click Send → share the code.

**Receive:** Enter the code → click Receive → decrypt if prompted.

Encrypted archives use 7-Zip format with AES-256. Recipients can extract with any compatible tool (7-Zip, WinRAR) using the shared password.

## Development

```bash
# Requirements: Node.js 18+, npm 9+, Docker 20.10+

git clone https://github.com/user/wormhole-desktop.git
cd wormhole-desktop
npm install
npm run build:docker   # One-time Docker image build
npm run dev            # Build and run
```

**Distribution builds:**
```bash
npm run dist           # All platforms (current OS)
npm run dist:win       # Windows (NSIS installer + ZIP portable)
npm run dist:mac       # macOS
npm run dist:linux     # Linux
```

**Structure:**
```
src/
├── main/           # Electron main process
│   ├── index.ts    # App initialization, window management
│   ├── ipc/        # IPC handlers with input validation
│   ├── services/   # Docker, wormhole CLI, archiver logic
│   └── utils/      # Path handling, validation, process management
├── preload/        # Secure context bridge (exposes typed API)
├── renderer/       # UI (vanilla JS, CSS, no framework)
└── shared/         # TypeScript types, constants, error codes
```

**Code Quality:**

The codebase follows enterprise-grade practices:

- TypeScript strict mode enabled
- Result type pattern for error handling (no thrown exceptions in IPC)
- Double input validation (IPC handlers + services)
- Path traversal protection with allowlist

Before committing, ensure no compiled files exist in `src/`:
```bash
# These should be in build/, not src/
git status src/**/*.js src/**/*.js.map
```

## Security

Electron security configuration follows best practices:

| Setting | Value | Rationale |
|---------|-------|-----------|
| `nodeIntegration` | `false` | Renderer cannot access Node.js APIs |
| `contextIsolation` | `true` | Preload runs in isolated context |
| `sandbox` | `false` | Required for drag-drop `file.path` access |

The preload script exposes only specific IPC invoke functions, never raw `ipcRenderer`. Content Security Policy restricts script sources to `'self'`.

**Path Security:**
- Send operations restricted to user directories (home, documents, downloads, desktop)
- Receive operations write to dedicated `wormhole-received/` folder
- Path traversal (`..`) blocked at validation layer
- Archive extraction checks size limits (50 GB max)

## Limitations

- Requires Docker Desktop running
- No progress indicator during transfer (wormhole CLI limitation)
- Single transfer at a time
- Archive size capped at 50 GB

## Acknowledgments

This project builds on the work of:

- [Magic Wormhole](https://github.com/magic-wormhole/magic-wormhole) — Brian Warner and contributors (MIT License)
- [Electron](https://www.electronjs.org/) — OpenJS Foundation
- [7-Zip](https://www.7-zip.org/) — Igor Pavlov (LGPL)

## License

MIT © SKR

This is free software. Use, modify, and distribute without restriction.

---

Contact: research@neomint.com
