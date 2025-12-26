# FollowMeGPT

A personal desktop ChatGPT-style app built with Electron + Vite (React/TS). It supports a clean UI, local persistence, a world clock widget, and optional screen-capture plumbing (with explicit user permission). No API key is stored in the repo—configure via `.env` or at runtime.

## Features
- Cross-platform desktop (macOS/Windows/Linux) via Electron.
- React + Vite frontend; simple, dark UI with keyboard shortcuts (Ctrl/Cmd+Enter to send).
- World Clock component showing multiple time zones.
- Local persistence of chat history (localStorage).
- App icon support (512×512 PNG at `electron/icon.png`).
- Optional screen-capture scaffolding using Electron `desktopCapturer` (permission required).
- Build/packaging via `electron-builder`.

## Project structure
```
electron/
  icon.png          # place your 512x512 app icon here
  main.js
  preload.js
src/
  components/
    WorldClock.tsx
  App.tsx
  App.css
  main.tsx
  world-clock.css
package.json
vite.config.ts
tsconfig.json
tsconfig.node.json
.gitignore
.env.example
```

## Prerequisites
- Node.js 18+ and npm
- An OpenAI API key (not committed; keep it local)

## Installation
```bash
npm install
```

## Configuration
Create a `.env` in the project root (do **not** commit it):
```
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
```
Or set via environment at runtime. The UI also lets you paste the key, which is then stored locally (localStorage) on your machine.

## Development
```bash
npm run dev
```
- This runs Vite and Electron together.
- If the devtools window opens and you don’t want it, remove/comment the `openDevTools` call in `electron/main.js`.

## Build (renderer only)
```bash
npm run build
```

## Package (desktop app)
```bash
npm run dist
```
Outputs platform-specific artifacts (DMG/EXE/AppImage depending on OS) with your icon.

## Usage
1. Run `npm run dev`.
2. Enter your OpenAI API key (and optional model) in the top bar.
3. Type a prompt; send with the button or Ctrl/Cmd+Enter.
4. World Clock is shown above the chat area.

## Screen capture (optional, permission-gated)
- `electron/preload.js` exposes `capture.listSources()` which lists screens/windows.
- You must explicitly request screen-capture permissions (Screen Recording on macOS; Display Capture on Windows). No bypass is possible or attempted.
- Implement UI to select a source and use `getUserMedia` with the provided `chromeMediaSourceId` if you want in-app previews/analysis.

## Security & privacy
- API keys are never committed; `.env` is gitignored.
- Keys entered in the UI are stored locally (localStorage) for convenience—remove if undesired.
- Screen capture, if enabled, requires explicit OS permission and user consent; the app should show a visible indicator when capturing.

## Keyboard shortcuts
- Send: Ctrl/Cmd + Enter
- You can add more (e.g., focus input, settings) in `App.tsx`.

## Troubleshooting
- Devtools pops up: comment/remove `win.webContents.openDevTools(...)` in `electron/main.js`.
- Blank window: ensure `npm run dev` is running; Vite should serve at `http://localhost:5173`.
- Missing icon: place a 512×512 PNG at `electron/icon.png`.
- Build errors about modules: rerun `npm install`; ensure Node 18+.
- If packaging fails, delete `dist/` and retry `npm run dist`.

## Contributing / next steps (personal fork)
- Add streaming responses for faster token display.
- Add offline-queue or local-model fallback (llama.cpp) if needed.
- Enhance styling/theme toggle and history export/import.
- Wire a “Share Screen” button with explicit source selection and on-screen indicator.