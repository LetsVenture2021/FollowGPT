# FollowMeGPT

A personal desktop ChatGPT-style app built with Electron + Vite (React/TS). It supports a clean UI, world clock widget, optional screen-capture plumbing (with explicit user permission), and model selection with a custom-model toggle. The renderer now reads the OpenAI API key exclusively from `.env` (no UI input field), so set `VITE_OPENAI_API_KEY` before running. Document uploads are inlined into the prompt and also auto-sent to a vector store.

## Features
- Cross-platform desktop (macOS/Windows/Linux) via Electron.
- React + Vite frontend; simple, dark UI with keyboard shortcuts (Ctrl/Cmd+Enter to send).
- World Clock component showing multiple time zones.
- Local persistence of model selection (localStorage).
- App icon support (512×512 PNG at `electron/icon.png`).
- Optional screen-capture scaffolding using Electron `desktopCapturer` (permission required).
- Build/packaging via `electron-builder`.
- Model selector with preset list and optional custom entry (warning shown for unknown models).

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
VITE_OPENAI_API_KEY=your_key_here
VITE_OPENAI_MODEL=gpt-5.2-pro
VITE_VECTOR_STORE_ID=vs_694e06ee375c8191a467da8f35515ac4
```
Or set via environment at runtime. If the key is missing, the Send button is disabled.

## Development
```bash
npm run dev
```
- This runs Vite and Electron together.
- If the devtools window opens and you don’t want it, remove/comment the `openDevTools` call in `electron/main.js`.

### Model selection behavior
- Default model: `gpt-5.2-pro`.
- Preset list: `gpt-5.2-pro`, `gpt-5.2`, `gpt-5 mini`, `gpt-5`, `gpt-4o`, `gpt-realtime`, `gpt-image-1.5`, `gpt-oss-120b`, `gpt-4o-transcribe-diarize`.
- Toggle “Allow custom” to type any model id; a warning appears for models outside the preset list. Sending still works but may fail if the backend rejects the id.

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
2. Confirm `VITE_OPENAI_API_KEY` (and optional `VITE_VECTOR_STORE_ID`) are set.
3. Type a prompt; optionally upload docs; send with the button or Ctrl/Cmd+Enter.
4. World Clock is shown above the chat area.

### Document uploads & vector store
- Supported file types: `.txt,.md,.csv,.json,.log,.pdf,.doc,.docx,.rtf`.
- Per-file size guard: ~700 KB; per-file prompt inline limit: ~2000 chars (truncated preview appended to the user message).
- Each uploaded file is sent to OpenAI Files and attached to the vector store `VITE_VECTOR_STORE_ID` (defaults to `vs_694e06ee375c8191a467da8f35515ac4`).
- UI shows per-file status: Queued → Uploading → Vectorized, or an inline error if attachment fails.

## Screen capture (optional, permission-gated)
- `electron/preload.js` exposes `capture.listSources()` which lists screens/windows.
- You must explicitly request screen-capture permissions (Screen Recording on macOS; Display Capture on Windows). No bypass is possible or attempted.
- Implement UI to select a source and use `getUserMedia` with the provided `chromeMediaSourceId` if you want in-app previews/analysis.

## Security & privacy
- API keys are never committed; `.env` is gitignored.
- Keys entered in the UI are stored locally (localStorage) for convenience—remove if undesired.
- Screen capture, if enabled, requires explicit OS permission and user consent; the app should show a visible indicator when capturing.

## SageMaker sample (optional, not wired into Electron)
- `dist/app.py` is a standalone SageMaker JumpStart example that deploys `openai-reasoning-gpt-oss-120b`, runs sample payloads, and tears down the endpoint. It is not invoked by the Electron app. If you want to integrate a SageMaker-backed API, add a local service layer (HTTP/IPC) and point the renderer fetches to it.

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
- Expose the new agent service (tool/executor stack in `agent/`) to the renderer over IPC/HTTP for local automations.