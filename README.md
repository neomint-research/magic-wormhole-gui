# Wormhole Desktop

A modern desktop GUI for [Magic Wormhole](https://magic-wormhole.readthedocs.io/) - secure peer-to-peer file transfers with end-to-end encryption.

## Features

- **Drag & Drop** - Drop files and folders directly into the app
- **Multi-File Selection** - Send up to 100 items at once
- **AES-256 Encryption** - Optional password protection for transfers
- **Dark/Light Mode** - Adapts to system preference, persists your choice
- **Responsive UI** - Scales smoothly from compact to expanded view

## For Users

### Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (must be running)

### Installation

Download the latest release for your platform from the [Releases](https://github.com/yourusername/magic-wormhole-gui/releases) page.

### Sending Files

1. Drop files onto the window or click to browse
2. Optional: Enable **Encrypt** and set a password
3. Click **Send** (or **Encrypt & Send**)
4. Share the code with your recipient

### Receiving Files

1. Switch to **Receive** tab
2. Enter the wormhole code
3. Click **Receive**

### Encryption

When enabled, files are packaged into an AES-256 encrypted ZIP. Recipients can extract using any standard tool (7-Zip, WinRAR, macOS Archive Utility) with the password you share separately.

---

## For Builders

### Requirements

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| npm | 9+ |
| Docker | 20.10+ |

### Setup

```bash
git clone https://github.com/yourusername/magic-wormhole-gui.git
cd magic-wormhole-gui
npm install
npm run build:docker
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run dist
```

Output in `dist/` folder.

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Build and run |
| `npm run build:ts` | Compile TypeScript |
| `npm run build:docker` | Build wormhole-cli Docker image |
| `npm run copy:static` | Copy renderer assets |
| `npm run dist` | Package for distribution |

### Project Structure

```
src/
├── main/           # Electron main process
│   ├── services/   # Docker, wormhole, archiver
│   ├── ipc/        # IPC handlers
│   └── utils/      # Path utilities
├── preload/        # Context bridge API
├── renderer/       # UI (HTML, CSS, vanilla JS)
└── shared/         # Types, constants
```

### Architecture

- **Main Process** - Docker management, file operations, IPC
- **Renderer** - Vanilla JS with state management, CSS variables for theming
- **Preload** - Secure context bridge exposing limited API
- **Docker** - Isolated Magic Wormhole CLI execution

### Dependencies

| Package | Purpose |
|---------|---------|
| `archiver` | ZIP creation |
| `archiver-zip-encrypted` | AES-256 encryption |
| `electron` | Desktop framework |
| `electron-builder` | Packaging |

---

## License

MIT
