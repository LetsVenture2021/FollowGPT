import React, { useEffect, useMemo, useRef, useState } from "react";
import ModelSelector from "./components/ModelSelector";
import WorldClock from "./components/WorldClock"; // ensure file exists at src/components/WorldClock.tsx
import "./App.css";
import "./world-clock.css";

type Role = "user" | "assistant" | "system";

type Message = {
  id: string;
  role: Role;
  content: string;
  error?: boolean;
};

const MODEL_DEFAULT = "gpt-4o-mini";
const STORAGE_MODEL = "followmegpt_model";
const API_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";

function uuid() {
  return Math.random().toString(36).slice(2);
}

async function callOpenAI({
  apiKey,
  model,
  messages,
}: {
  apiKey: string;
  model: string;
  messages: { role: Role; content: string }[];
}) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.5,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || resp.statusText);
  }

  const data = await resp.json();
  const content =
    data?.choices?.[0]?.message?.content ??
    "No response content received from model.";
  return content;
}

function App() {
  const [model, setModel] = useState(MODEL_DEFAULT);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const storedModel = localStorage.getItem(STORAGE_MODEL) || MODEL_DEFAULT;
    if (storedModel) setModel(storedModel);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_MODEL, model || MODEL_DEFAULT);
  }, [model]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const canSend = useMemo(() => {
    return (
      API_KEY.trim().length > 0 &&
      model.trim().length > 0 &&
      input.trim().length > 0 &&
      !isSending
    );
  }, [model, input, isSending]);

  const handleSend = async () => {
    if (!canSend) {
      setError("Set VITE_OPENAI_API_KEY, choose a model, and enter a message.");
      return;
    }
    setError(null);
    const userMessage: Message = { id: uuid(), role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const assistantContent = await callOpenAI({
        apiKey: API_KEY.trim(),
        model: model.trim(),
        messages: [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });
      const assistantMessage: Message = {
        id: uuid(),
        role: "assistant",
        content: assistantContent,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (e: any) {
      const assistantMessage: Message = {
        id: uuid(),
        role: "assistant",
        content: e?.message || "Failed to send message.",
        error: true,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setError("API error: " + (e?.message || "Unknown error"));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="logo">Personal ChatGPT</div>
        <div className="controls">
          <ModelSelector model={model} setModel={setModel} />
          {!API_KEY && <div className="error-banner">Set VITE_OPENAI_API_KEY in .env</div>}
        </div>
      </header>

      <section className="panels">
        <div className="left-panel">
          <WorldClock />
        </div>
        <div className="main-panel">
          {error && <div className="error-banner">{error}</div>}
          <div className="messages">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`message ${m.role} ${m.error ? "error" : ""}`}
              >
                <div className="role">{m.role.toUpperCase()}</div>
                <div className="content">{m.content}</div>
              </div>
            ))}
            {isSending && (
              <div className="message assistant">
                <div className="role">ASSISTANT</div>
                <div className="content">...</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

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
}

export default App;