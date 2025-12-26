import React, { useEffect, useMemo, useRef, useState } from "react";
import ModelSelector, { MODEL_OPTIONS } from "./components/ModelSelector";
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

type UploadedDoc = {
  id: string;
  name: string;
  size: number;
  content: string;
  file?: File;
};

const MODEL_DEFAULT = "gpt-5.2-pro";
const STORAGE_MODEL = "followmegpt_model";
const API_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";
const AGENT_ID = import.meta.env.VITE_OPENAI_AGENT_ID || "";
const VECTOR_STORE_ID = import.meta.env.VITE_VECTOR_STORE_ID || "vs_694e06ee375c8191a467da8f35515ac4";
const MAX_DOC_SIZE_BYTES = 700_000; // ~700 KB per file
const MAX_DOC_CHARS = 2000; // per-file content included in prompt

function uuid() {
  return Math.random().toString(36).slice(2);
}

function truncateContent(text: string, maxChars = MAX_DOC_CHARS) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n... [truncated ${text.length - maxChars} chars]`;
}

function setVectorStatus(
  setter: React.Dispatch<React.SetStateAction<Record<string, { status: string; message?: string }>>>,
  id: string,
  status: string,
  message?: string
) {
  setter((prev) => ({ ...prev, [id]: { status, message } }));
}

async function callOpenAI({
  apiKey,
  agentId,
  model,
  messages,
}: {
  apiKey: string;
  agentId?: string;
  model?: string;
  messages: { role: Role; content: string }[];
}) {
  const payload: Record<string, any> = {
    input: messages.map((m) => ({ role: m.role, content: m.content })),
  };

  if (agentId?.trim()) {
    payload.agent_id = agentId.trim();
  } else if (model?.trim()) {
    payload.model = model.trim();
  }

  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || resp.statusText);
  }

  const data = await resp.json();
  const outputs = Array.isArray(data?.output) ? data.output : [];
  const content = outputs
    .flatMap((out: any) => Array.isArray(out?.content) ? out.content : [])
    .map((c: any) => c?.text || c?.content || "")
    .filter(Boolean)
    .join("\n") || "No response content received from agent.";

  return content;
}

function App() {
  const [model, setModel] = useState(MODEL_DEFAULT);
  const [allowCustomModel, setAllowCustomModel] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [vectorStatuses, setVectorStatuses] = useState<Record<string, { status: string; message?: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const isKnownModel = useMemo(
    () => MODEL_OPTIONS.some((m) => m.value === model),
    [model]
  );

  useEffect(() => {
    const storedModel = localStorage.getItem(STORAGE_MODEL) || MODEL_DEFAULT;
    if (storedModel) setModel(storedModel);
  }, []);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    console.log("VITE_OPENAI_API_KEY", apiKey);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_MODEL, model || MODEL_DEFAULT);
  }, [model]);

  useEffect(() => {
    if (!allowCustomModel && !isKnownModel) {
      setModel(MODEL_DEFAULT);
    }
  }, [allowCustomModel, isKnownModel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selected = Array.from(files);
    const results: UploadedDoc[] = [];

    for (const file of selected) {
      if (file.size > MAX_DOC_SIZE_BYTES) {
        setError(
          `Skipped ${file.name}: too large (${(file.size / 1024).toFixed(0)} KB). Limit ~${Math.floor(
            MAX_DOC_SIZE_BYTES / 1024
          )} KB per file.`
        );
        continue;
      }

      try {
        const text = await file.text();
        results.push({ id: uuid(), name: file.name, size: file.size, content: text, file });
      } catch (e: any) {
        setError(`Could not read ${file.name}: ${e?.message || "unknown error"}`);
      }
    }

    if (results.length > 0) {
      setDocuments((prev) => [...prev, ...results]);
        results.forEach((doc) => {
          if (!API_KEY.trim()) {
            setVectorStatus(setVectorStatuses, doc.id, "blocked", "Set VITE_OPENAI_API_KEY to upload");
          } else {
            setVectorStatus(setVectorStatuses, doc.id, "pending");
            void syncDocToVectorStore(doc);
          }
        });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // allow re-selecting the same file
    }
  };

  const handleRemoveDoc = (id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    setVectorStatuses((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const buildDocAttachmentText = (docs: UploadedDoc[]) => {
    if (!docs.length) return "";
    const entries = docs.map((doc, idx) => {
      const sizeKb = (doc.size / 1024).toFixed(1);
      const preview = truncateContent(doc.content);
      return `${idx + 1}. ${doc.name} (${sizeKb} KB)\n${preview}`;
    });
    return entries.join("\n\n");
  };

  const uploadFileToOpenAI = async (doc: UploadedDoc) => {
    const blob = doc.file ?? new File([doc.content], doc.name || "document.txt", { type: "text/plain" });
    const formData = new FormData();
    formData.append("purpose", "assistants");
    formData.append("file", blob, doc.name);

    const resp = await fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
      body: formData,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || resp.statusText);
    }

    const data = await resp.json();
    return data?.id as string;
  };

  const attachFileToVectorStore = async (fileId: string) => {
    const resp = await fetch(`https://api.openai.com/v1/vector_stores/${VECTOR_STORE_ID}/file_batches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ file_ids: [fileId] }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || resp.statusText);
    }

    return resp.json();
  };

  const syncDocToVectorStore = async (doc: UploadedDoc) => {
    if (!API_KEY.trim()) {
      setVectorStatus(setVectorStatuses, doc.id, "blocked", "Set VITE_OPENAI_API_KEY to upload");
      return;
    }

    if (!VECTOR_STORE_ID) {
      setVectorStatus(setVectorStatuses, doc.id, "error", "Missing VITE_VECTOR_STORE_ID");
      return;
    }

    setVectorStatus(setVectorStatuses, doc.id, "uploading", "Uploading to vector store...");

    try {
      const fileId = await uploadFileToOpenAI(doc);
      await attachFileToVectorStore(fileId);
      setVectorStatus(setVectorStatuses, doc.id, "attached", "Vectorized & stored");
    } catch (e: any) {
      setVectorStatus(
        setVectorStatuses,
        doc.id,
        "error",
        e?.message || "Failed to store in vector"
      );
    }
  };

  const canSend = useMemo(() => {
    return (
      API_KEY.trim().length > 0 &&
      (AGENT_ID.trim().length > 0 || model.trim().length > 0) &&
      input.trim().length > 0 &&
      !isSending
    );
  }, [model, input, isSending, AGENT_ID]);

  const handleSend = async () => {
    if (!canSend) {
      setError("Set VITE_OPENAI_API_KEY, set VITE_OPENAI_AGENT_ID or choose a model, and enter a message.");
      return;
    }
    setError(null);
    const docText = buildDocAttachmentText(documents);
    const userContent = docText
      ? `${input.trim()}\n\nAttached documents:\n${docText}`
      : input.trim();

    const userMessage: Message = { id: uuid(), role: "user", content: userContent };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const assistantContent = await callOpenAI({
        apiKey: API_KEY.trim(),
        agentId: AGENT_ID.trim(),
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="logo">Personal ChatGPT</div>
        <div className="controls">
          <ModelSelector
            model={model}
            setModel={setModel}
            allowCustom={allowCustomModel}
            setAllowCustom={setAllowCustomModel}
          />
          {!API_KEY && <div className="error-banner">Set VITE_OPENAI_API_KEY in .env</div>}
          {!AGENT_ID && <div className="error-banner">Set VITE_OPENAI_AGENT_ID in .env</div>}
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
            <div className="composer-inputs">
              <div className="doc-upload">
                <div className="doc-upload-header">
                  <div className="doc-upload-title">Attached documents</div>
                  <div className="doc-upload-actions">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".txt,.md,.csv,.json,.log,.pdf,.doc,.docx,.rtf"
                      style={{ display: "none" }}
                      onChange={(e) => handleFilesSelected(e.target.files)}
                    />
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Upload
                    </button>
                  </div>
                </div>

                {documents.length === 0 ? (
                  <div className="doc-upload-empty">
                    No documents attached. Upload to inline their contents into the prompt.
                  </div>
                ) : (
                  <ul className="doc-list">
                    {documents.map((doc) => (
                      <li key={doc.id} className="doc-list-item">
                        <div className="doc-meta">
                          <div className="doc-name">{doc.name}</div>
                          <div className="doc-size">{(doc.size / 1024).toFixed(1)} KB</div>
                        </div>
                        <div className="doc-status-wrapper">
                          <div
                            className={`doc-status status-${
                              vectorStatuses[doc.id]?.status || "pending"
                            }`}
                          >
                            {vectorStatuses[doc.id]?.status === "attached" && "Vectorized"}
                            {vectorStatuses[doc.id]?.status === "uploading" && "Uploading..."}
                            {vectorStatuses[doc.id]?.status === "pending" && "Queued"}
                            {vectorStatuses[doc.id]?.status === "error" &&
                              (vectorStatuses[doc.id]?.message || "Error")}
                          </div>
                          {vectorStatuses[doc.id]?.message &&
                            vectorStatuses[doc.id]?.status === "error" && (
                              <div className="doc-status-message">{vectorStatuses[doc.id]?.message}</div>
                            )}
                        </div>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => handleRemoveDoc(doc.id)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="doc-hint">
                  Files are read locally and truncated to ~{MAX_DOC_CHARS} characters each before being
                  appended to your prompt and automatically sent to vector store {VECTOR_STORE_ID}.
                </div>
              </div>

              <textarea
                ref={inputRef}
                placeholder="Ask anything... (Enter to send, Shift+Enter for newline)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
              />
            </div>
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