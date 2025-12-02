# Wormhole Desktop - NSIS Build Fix

## Verbindliche Arbeitsweise

**ALLE Aktionen MÜSSEN folgende MCP-Tools verwenden:**

1. **Sequential Thinking MCP** - Jede Tätigkeitsabfolge planen und tracken
   - Vor jeder Aktion: `sequentialthinking` mit Analyse und Plan
   - Nach jeder Aktion: `sequentialthinking` mit Ergebnis und nächstem Schritt
   - Gedanken nummerieren, Revisionen markieren

2. **Context7 MCP** - Jede Implementierung nachschlagen
   - `resolve-library-id` für Library-ID
   - `get-library-docs` für Dokumentation
   - Relevante Libraries: `/electron-userland/electron-builder` (NSIS, packaging)

3. **Rust MCP Filesystem** - Ausschließlich für Dateizugriffe
   - `read_text_file` / `read_multiple_text_files` zum Lesen
   - `write_file` zum Schreiben
   - `edit_file` für Änderungen
   - `directory_tree` / `list_directory` für Navigation
   - Pfad-Präfix: `/D/DEVMIN/CODE/GitHub/magic-wormhole-cli/magic-wormhole-gui/`
   - KEINE bash/shell Befehle für Dateioperationen

---

## Problem

NSIS-Build schlägt fehl:
```
warning 6001: Variable "IsPortable" not referenced or never set
Error: warning treated as error
```

Datei: `build-resources/installer.nsh`

---

## Aufgabensequenz

### Schritt 1: Analyse (Sequential Thinking)
```
sequentialthinking:
  thought: "NSIS warning 6001 - unbenutzte Variable 'IsPortable' in installer.nsh verursacht Build-Fehler weil warnings als errors behandelt werden"
  thoughtNumber: 1
  totalThoughts: 4
  nextThoughtNeeded: true
```

### Schritt 2: Dokumentation (Context7)
```
resolve-library-id: "electron-builder"
get-library-docs: 
  context7CompatibleLibraryID: "/electron-userland/electron-builder"
  topic: "nsis custom installer macros"
```

### Schritt 3: Datei lesen (Rust MCP)
```
read_text_file:
  path: "/D/DEVMIN/CODE/GitHub/magic-wormhole-cli/magic-wormhole-gui/build-resources/installer.nsh"
```

### Schritt 4: Datei korrigieren (Rust MCP)
```
write_file:
  path: "/D/DEVMIN/CODE/GitHub/magic-wormhole-cli/magic-wormhole-gui/build-resources/installer.nsh"
  content: |
    ; Wormhole Desktop NSIS Customizations
    ; Portable mode handled via separate ZIP distribution
    
    !macro customInstall
      ; Standard installation - no custom actions needed
    !macroend
    
    !macro customUnInstall
      ; Clean up portable marker if upgrading from portable
      Delete "$INSTDIR\.portable"
      RMDir "$INSTDIR\data"
    !macroend
```

### Schritt 5: Verifikation (Sequential Thinking)
```
sequentialthinking:
  thought: "installer.nsh bereinigt - keine unbenutzten Variablen mehr. User kann npm run dist:win ausführen."
  thoughtNumber: 4
  totalThoughts: 4
  nextThoughtNeeded: false
```

---

## Erwartete Build-Outputs

Nach `npm run dist:win` (vom User auszuführen):
```
dist/
├── Wormhole Desktop Setup 1.0.0.exe   # Installer
├── Wormhole Desktop-1.0.0-win.zip     # Portable
└── win-unpacked/                       # Entpackt
```

---

## Projekt-Kontext

- Electron 35.7.5 GUI für Magic Wormhole P2P-Transfer
- Portable-Detection in `src/main/index.ts` und `src/main/utils/paths.ts`
- ZIP-Nutzer erstellen manuell `.portable` im App-Verzeichnis

---

## Dateisystem-Referenz (Rust MCP Pfade)

```
/D/DEVMIN/CODE/GitHub/magic-wormhole-cli/magic-wormhole-gui/
├── build-resources/
│   └── installer.nsh          # ZU KORRIGIEREN
├── src/
│   ├── main/
│   │   ├── index.ts           # Portable-Detection
│   │   └── utils/paths.ts     # Portable-aware Pfade
│   └── shared/
│       └── constants.ts
├── package.json               # Build-Konfiguration
└── HANDOFF.md                 # Diese Datei
```
