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

1. Download the release for your platform
2. Build the Docker image once: `docker build -t wormhole-cli ./docker`
3. Launch the app

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
npm run dist           # Package for distribution
```

**Structure:**
```
src/
├── main/       # Electron main process, IPC handlers, services
├── preload/    # Secure context bridge API
├── renderer/   # UI (vanilla JS, CSS)
└── shared/     # Types, constants
```

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
