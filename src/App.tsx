import { useEffect, useMemo, useRef, useState } from "react";
import ModelSelector from "./components/ModelSelector";
import "./App.css";
// import "./world-clock.css"; // optional, can remove if unused

// ...rest of the file unchanged...

return (
  <div className="app-shell">
    <header className="topbar">
      <div className="logo">Personal ChatGPT</div>
      <div className="controls">
        <input
          type="password"
          placeholder="API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <ModelSelector model={model} setModel={setModel} />
      </div>
    </header>

    <section className="panels">
      <div className="main-panel">
        {error && <div className="error-banner">{error}</div>}
        {/* ...messages... */}
        <div className="composer">
          <textarea
            ref={inputRef}
            placeholder="Ask anything... (Ctrl/Cmd + Enter to send)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
          />
          <div className="composer-actions">
            <button onClick={handleSend} disabled={!canSend}>
              {isSending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
);