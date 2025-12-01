# Wormhole Desktop

A simple desktop GUI for [Magic Wormhole](https://magic-wormhole.readthedocs.io/), enabling secure peer-to-peer file transfers with minimal setup.

## Features

- Send files and folders via Magic Wormhole
- Receive files using wormhole codes
- Automatic archiving for multiple files/folders
- Drag and drop support
- Cross-platform (Windows, macOS, Linux)

## Requirements

### System Requirements

| Requirement | Minimum Version | Download |
|-------------|-----------------|----------|
| Docker Desktop | 20.10+ | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Node.js | 18.0+ | [nodejs.org](https://nodejs.org/) |
| npm | 9.0+ | Included with Node.js |

### Verified Environments

- Windows 11 Pro with Docker Desktop 29.0.1
- Node.js v24.x / npm 11.x

### Important Notes

- Docker Desktop must be **running** before starting the app
- On Windows, ensure WSL 2 backend is enabled for Docker
- Approximately 500 MB disk space required (Docker image + dependencies)

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/magic-wormhole-gui.git
   cd magic-wormhole-gui
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Build the Docker image:**
   ```bash
   npm run build:docker
   ```
   This creates the `wormhole-cli` Docker image containing Magic Wormhole.

4. **Verify installation:**
   ```bash
   docker run --rm wormhole-cli wormhole --version
   ```
   Expected output: `magic-wormhole 0.21.1`

## Usage

### Development Mode

Build and run the app:

```bash
npm run dev
```

### Production Build

Create a distributable package:

```bash
npm run dist
```

The packaged application will be in the `dist/` folder.

## How It Works

1. **Send**: Select files or folders, click Send, and share the generated wormhole code with the recipient.

2. **Receive**: Enter a wormhole code to download the shared file.

All transfers are end-to-end encrypted using the Magic Wormhole protocol. Files are transferred directly between peers via a relay server.

## Architecture

The application uses Electron with a secure architecture:

- **Main Process**: Handles Docker interactions and file operations
- **Renderer Process**: Provides the user interface
- **Preload Script**: Exposes a limited API via context bridge
- **Docker Container**: Runs the Magic Wormhole CLI in isolation

Security features:
- Context isolation enabled
- Node integration disabled
- Sandboxed renderer process
- Content Security Policy headers

## Project Structure

```
magic-wormhole-gui/
├── src/
│   ├── main/           # Electron main process
│   │   ├── services/   # Docker and wormhole services
│   │   ├── utils/      # Path and process utilities
│   │   └── ipc/        # IPC handlers
│   ├── preload/        # Context bridge API
│   ├── renderer/       # UI components
│   └── shared/         # Types and constants
├── docker/             # Dockerfile for wormhole-cli
├── assets/             # Application icons
└── package.json
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Build and run in development mode |
| `npm run build:ts` | Compile TypeScript |
| `npm run build:docker` | Build the Docker image |
| `npm run copy:static` | Copy static assets to build folder |
| `npm run dist` | Create distributable package |

## Troubleshooting

### "Docker is not available"

1. Ensure Docker Desktop is running (check system tray)
2. Verify Docker works: `docker info`
3. On Windows, check that WSL 2 is properly configured

### "Wormhole Docker image not found"

Run the Docker build command:
```bash
npm run build:docker
```

### "Checking Docker..." hangs

The app may take a few seconds on first launch. If it persists:
1. Restart Docker Desktop
2. Check Docker is responsive: `docker ps`

### Transfer timeout

The default timeout is 120 seconds. For large files:
- Ensure stable network connection on both ends
- Sender must keep the app open until transfer completes
- Receiver should enter the code promptly

### Build errors on Windows

If TypeScript compilation fails:
```bash
Remove-Item -Recurse -Force node_modules
npm install
npm run dev
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Magic Wormhole](https://github.com/magic-wormhole/magic-wormhole) by Brian Warner
- [Electron](https://www.electronjs.org/)
