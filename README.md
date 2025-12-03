<p align="center">
  <img src="assets/icon.svg" width="128" height="128" alt="Wormhole Desktop">
</p>

<h1 align="center">Wormhole Desktop</h1>

<p align="center">
  Secure peer-to-peer file transfers with optional AES-256 encryption
</p>

## Overview

Desktop GUI for secure peer-to-peer file transfers using [Magic Wormhole](https://magic-wormhole.readthedocs.io/). Files transfer directly between devices without cloud storage or accounts. Optional AES-256 encryption adds password protection with hidden filenames.

Built for users who need fast, private transfers without trusting intermediaries.

## Features

- Drag and drop files and folders
- Optional AES-256 password encryption
- Cross-platform (Windows, macOS, Linux)
- Portable mode (run from USB, no installation)
- Dark/Light theme

## Quick Start

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) running.

```bash
# Build the wormhole container (once)
docker build -t wormhole-cli ./docker

# Download release for your platform and run
```

**Windows:** `Wormhole-Desktop-Setup-x.x.x.exe` (installer) or `Wormhole-Desktop-x.x.x-win.zip` (portable)

## Usage

**Send:** Drop files, optionally enable encryption, click Send, share the code.

**Receive:** Enter code, click Receive, decrypt if prompted.

Encrypted archives use 7-Zip AES-256 format. Recipients can extract with any compatible tool using the shared password.

## Development

```bash
# Requirements: Node.js 18+, Docker 20.10+

git clone https://github.com/user/wormhole-desktop.git
cd wormhole-desktop
npm install
npm run build:docker
npm run dev
```

**Build distribution:**
```bash
npm run dist:win    # Windows (NSIS + ZIP)
npm run dist:mac    # macOS
npm run dist:linux  # Linux
```

**Project structure:**
```
src/
├── main/       # Electron main process, IPC, services
├── preload/    # Context bridge API
├── renderer/   # UI (TypeScript/CSS)
└── shared/     # Types, constants
```

## Limitations

- Requires Docker Desktop running
- Single transfer at a time
- 50 GB archive size limit

## License

MIT © SKR

This project wraps [Magic Wormhole](https://github.com/magic-wormhole/magic-wormhole) by Brian Warner (MIT License).

---

Contact: research@neomint.com
